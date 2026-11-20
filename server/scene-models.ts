import { plannerConfigSchema, type PlannerConfig, type PlannerSettings } from '../shared/vector';
import { Store, requireThat, Issue } from './store';
import type { Vault } from './vault';
import type { Gemini } from './gemini';
import { checkpoint, requestSignal } from './operation';
export type PlannerVaults = Record<'groq' | 'openrouter', Vault>;
export class InvalidModelReply extends Error {}
const routerModel = 'openrouter/free';
async function responseText(r: Response) {
  if (!r.ok || !r.body) {
    await r.body?.cancel();
    throw new Issue(
      502,
      `OpenRouter HTTP ${r.status}. İstek tekrarlanmadı; kayıtlı sahneler korunuyor.`,
      r.status >= 500 ? 'temporary-response' : 'failed',
    );
  }
  const reader = r.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((size += value.byteLength) > 256 * 1024) {
        await reader.cancel();
        throw new InvalidModelReply('Yanıt çok büyük, daha kısa ve eksiksiz bir yanıt ver.');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(parts, size).toString('utf8'));
  } catch {
    throw new InvalidModelReply('Tek, geçerli bir JSON nesnesi döndür.');
  }
  const c = data?.choices?.[0];
  if (c?.finish_reason === 'length')
    throw new InvalidModelReply('Yanıt yarım kaldı; daha kısa ve eksiksiz bir yanıt ver.');
  if (!c || c.finish_reason !== 'stop' || typeof c.message?.content !== 'string')
    throw new Issue(502, 'OpenRouter kullanılabilir bir sahne yanıtı vermedi.');
  return {
    text: c.message.content as string,
    model:
      typeof data.model === 'string' && /^[a-zA-Z0-9_./:-]{1,120}$/.test(data.model)
        ? data.model
        : routerModel,
  };
}
export class SceneModels {
  constructor(
    protected store: Store,
    private vaults: PlannerVaults,
    private transport: typeof fetch = fetch,
    private gemini?: Gemini,
  ) {}
  config(): PlannerConfig {
    const cfg = this.store.setting<unknown>('vector-model', null),
      ok = plannerConfigSchema.safeParse(cfg);
    if (ok.success) return ok.data;
    const old = this.store.setting<{ provider?: string; artworkPolicy?: string }>(
      'svg-planner',
      {},
    );
    return {
      provider:
        old.artworkPolicy === 'offline' || old.provider === 'ollama' || old.provider === 'groq'
          ? 'disabled'
          : old.provider === 'openrouter'
            ? 'openrouter'
            : 'auto',
    };
  }
  settings(): PlannerSettings {
    return {
      ...this.config(),
      keys: { groq: this.vaults.groq.has(), openrouter: this.vaults.openrouter.has() },
    };
  }
  configure(v: unknown) {
    this.store.set('vector-model', plannerConfigSchema.parse(v));
  }
  key(provider: keyof PlannerVaults, value?: string) {
    if (value === undefined) this.vaults[provider].clear();
    else {
      requireThat(
        provider === 'openrouter' && /^[\x21-\x7e]{8,512}$/.test(value),
        'Geçerli bir OpenRouter anahtarı gir.',
        400,
      );
      this.vaults[provider].set(value);
    }
  }
  model(system: string, schema: object, maxTokens = 8192) {
    const c = this.config().provider;
    const missing = () =>
      new Issue(
        412,
        'Ayarlar → Sahne planlayıcı bölümünde OpenRouter veya izinli bir Gemini metin modeli seçin.',
        'config',
      );
    if (c === 'disabled') throw missing();
    if (c === 'openrouter' || (c === 'auto' && this.vaults.openrouter.has())) {
      const key = this.vaults.openrouter.get();
      if (!key) throw missing();
      return {
        provider: 'openrouter' as const,
        model: routerModel,
        draw: async (input: string) => {
          let r: Response;
          try {
            r = await this.transport('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              credentials: 'omit',
              redirect: 'error',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              signal: requestSignal(150000),
              body: JSON.stringify({
                model: routerModel,
                stream: false,
                temperature: 0.4,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: input },
                ],
              }),
            });
          } catch {
            checkpoint();
            throw new Issue(503, 'OpenRouter yanıt vermedi. İstek tekrarlanmadı.');
          }
          return responseText(r);
        },
      };
    }
    const g = this.gemini;
    if (!g) throw missing();
    let model: string;
    try {
      model = g.allowed('text');
    } catch {
      throw missing();
    }
    return {
      provider: 'gemini' as const,
      model,
      draw: async (input: string) => ({
        model,
        text: await g.text(system + '\nSahne verisi:\n' + input, schema),
      }),
    };
  }
}
