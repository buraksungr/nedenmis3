import { svgOutputTokens } from './planner-pacing';
import { plannerConfigSchema, type PlannerConfig, type PlannerSettings } from '../shared/vector';
import { Store, requireThat, Issue, ProviderHttpIssue } from './store';
import type { Vault } from './vault';
import type { Gemini } from './gemini';
import { checkpoint, requestSignal } from './operation';
export type PlannerVaults = Record<'groq' | 'openrouter', Vault>;
export class InvalidModelReply extends Error {}
const routerModel = 'openrouter/free';
const routerStatus: Record<number, string> = {
  400: 'Geçersiz istek',
  401: 'Geçersiz API anahtarı',
  402: 'Yetersiz bakiye',
  403: 'Erişim reddedildi',
  404: 'Model veya uç nokta bulunamadı',
  408: 'İstek zaman aşımına uğradı',
  429: 'Kota/Hız Sınırı',
  503: 'Hizmet Geçici Olarak Kullanılamıyor',
};
async function responseText(r: Response) {
  if (!r.ok) {
    await r.body?.cancel().catch(() => {});
    checkpoint();
    throw new ProviderHttpIssue(
      r.status,
      `OpenRouter HTTP ${r.status}${routerStatus[r.status] ? ' - ' + routerStatus[r.status] : ''}.`,
      r.status >= 500 ? 'temporary-response' : 'failed',
    );
  }
  if (!r.body) throw new InvalidModelReply('Boş yanıt - OpenRouter gövde döndürmedi.');
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
  } catch (e) {
    checkpoint();
    if (e instanceof InvalidModelReply) throw e;
    throw new Issue(502, 'Ağ Hatası - OpenRouter yanıt gövdesi okunurken bağlantı kesildi.');
  } finally {
    reader.releaseLock();
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(parts, size).toString('utf8'));
  } catch {
    throw new InvalidModelReply('JSON Hatası - OpenRouter yanıt gövdesi geçerli JSON değil.');
  }
  // OpenRouter may report a provider error *inside* a successful HTTP envelope. Describe
  // only its numeric code, never the raw message/credentials, and do not replay this POST.
  if (data?.error) {
    const code = data.error.code;
    throw new Issue(
      502,
      `OpenRouter yanıt hatası (HTTP ${r.status}): ${Number.isInteger(code) && code >= 100 && code < 600 ? `sağlayıcı kodu ${code}${routerStatus[code] ? ' - ' + routerStatus[code] : ''}` : 'çizim döndürülmedi'}.`,
    );
  }
  const c = data?.choices?.[0];
  if (c?.finish_reason === 'length' || c?.native_finish_reason === 'MAX_TOKENS')
    throw new InvalidModelReply(
      'MAX_TOKENS - Yanıt Yarım Kaldı (OpenRouter). Daha kısa ve eksiksiz SVG ver.',
    );
  if (!c || c.finish_reason !== 'stop' || typeof c.message?.content !== 'string')
    throw new Issue(
      502,
      c?.finish_reason === 'content_filter'
        ? 'CONTENT_FILTER - OpenRouter yanıtı engellendi.'
        : 'Boş veya eksik yanıt - OpenRouter tamamlanmış bir metin döndürmedi.',
    );
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
  model(system: string, schema: object) {
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
          const signal = requestSignal(150000);
          try {
            r = await this.transport('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              credentials: 'omit',
              redirect: 'error',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              signal,
              body: JSON.stringify({
                model: routerModel,
                stream: false,
                temperature: 0.4,
                max_tokens: svgOutputTokens,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: input },
                ],
              }),
            });
          } catch {
            checkpoint();
            throw new Issue(
              503,
              signal.reason?.name === 'TimeoutError'
                ? 'Zaman Aşımı - OpenRouter 150 sn içinde yanıt vermedi. İstek tekrarlanmadı.'
                : 'Ağ Hatası - OpenRouter yanıt vermedi. İstek tekrarlanmadı.',
            );
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
