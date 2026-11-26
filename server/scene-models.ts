import { svgOutputTokens } from './planner-pacing';
import {
  plannerConfigSchema,
  plannerConfigPatchSchema,
  type PlannerConfig,
  type PlannerSettings,
} from '../shared/vector';
import { Store, requireThat, Issue, ProviderHttpIssue } from './store';
import { memoryVault, type Vault } from './vault';
import type { Gemini, RetryNotice } from './gemini';
import { checkpoint, requestSignal } from './operation';

// The optional field keeps older in-process callers compatible. Desktop always
// supplies its own separately encrypted Anthropic vault.
export type PlannerVaults = { groq: Vault; openrouter: Vault; anthropic?: Vault };
type VaultName = 'groq' | 'openrouter' | 'anthropic';
type Cloud = { provider: 'openrouter' | 'anthropic'; model: string; key: string };
type Selection = Cloud | { provider: 'gemini'; model: string; gemini: Gemini };
export class InvalidModelReply extends Error {}

const statusNames: Record<number, string> = {
  400: 'Geçersiz istek',
  401: 'Geçersiz API anahtarı',
  402: 'Yetersiz bakiye',
  403: 'Erişim reddedildi',
  404: 'Model veya uç nokta bulunamadı',
  408: 'İstek zaman aşımına uğradı',
  429: 'Kota/Hız Sınırı',
  503: 'Hizmet Geçici Olarak Kullanılamıyor',
};
const names = { openrouter: 'OpenRouter', anthropic: 'Anthropic' } as const;
const safeModel = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(value)
    ? value
    : fallback;

/** Provider bodies are bounded and never exposed in errors or logs. */
async function responseBody(r: Response, provider: Cloud['provider']) {
  const name = names[provider];
  if (!r.ok) {
    await r.body?.cancel().catch(() => {});
    checkpoint();
    throw new ProviderHttpIssue(
      r.status,
      `${name} HTTP ${r.status}${statusNames[r.status] ? ' - ' + statusNames[r.status] : ''}.`,
      r.status >= 500 ? 'temporary-response' : 'failed',
    );
  }
  if (!r.body) throw new InvalidModelReply(`Boş yanıt - ${name} gövde döndürmedi.`);
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
    throw new Issue(502, `Ağ Hatası - ${name} yanıt gövdesi okunurken bağlantı kesildi.`);
  } finally {
    reader.releaseLock();
  }
  checkpoint();
  try {
    return JSON.parse(Buffer.concat(parts, size).toString('utf8'));
  } catch {
    throw new InvalidModelReply(`JSON Hatası - ${name} yanıt gövdesi geçerli JSON değil.`);
  }
}

function completed(data: any, selected: Cloud, httpStatus: number) {
  const name = names[selected.provider];
  // A provider can report an error inside a successful envelope. Never relay its
  // message or payload, which can contain credentials, or replay the POST.
  if (data?.error) {
    const code = data.error.code;
    throw new Issue(
      502,
      `${name} yanıt hatası (HTTP ${httpStatus}): ${Number.isInteger(code) && code >= 100 && code < 600 ? `sağlayıcı kodu ${code}${statusNames[code] ? ' - ' + statusNames[code] : ''}` : 'tamamlanmış metin döndürülmedi'}.`,
    );
  }
  let text = '';
  if (selected.provider === 'openrouter') {
    const c = data?.choices?.[0];
    if (c?.finish_reason === 'length' || c?.native_finish_reason === 'MAX_TOKENS')
      throw new InvalidModelReply('MAX_TOKENS - Yanıt Yarım Kaldı (OpenRouter).');
    const content = c?.message?.content;
    if (c?.finish_reason === 'stop')
      text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .map((part: any) =>
                  part?.type === 'text' && typeof part.text === 'string' ? part.text : '',
                )
                .join('')
            : '';
    if (!text.trim())
      throw new Issue(
        502,
        c?.finish_reason === 'content_filter'
          ? 'CONTENT_FILTER - OpenRouter yanıtı engellendi.'
          : 'Boş veya eksik yanıt - OpenRouter tamamlanmış bir metin döndürmedi.',
      );
  } else {
    if (data?.stop_reason === 'max_tokens')
      throw new InvalidModelReply('MAX_TOKENS - Yanıt Yarım Kaldı (Anthropic).');
    if (data?.stop_reason === 'end_turn' && Array.isArray(data?.content))
      text = data.content
        .map((part: any) =>
          part?.type === 'text' && typeof part.text === 'string' ? part.text : '',
        )
        .join('');
    if (!text.trim())
      throw new Issue(502, 'Boş veya eksik yanıt - Anthropic tamamlanmış bir metin döndürmedi.');
  }
  return { text: text.trim(), model: safeModel(data?.model, selected.model) };
}

export class SceneModels {
  private readonly vaults: Record<VaultName, Vault>;
  constructor(
    protected store: Store,
    vaults: PlannerVaults,
    private transport: typeof fetch = fetch,
    private gemini?: Gemini,
  ) {
    this.vaults = { ...vaults, anthropic: vaults.anthropic ?? memoryVault() };
  }
  config(): PlannerConfig {
    const cfg = this.store.setting<unknown>('vector-model', null),
      ok = plannerConfigSchema.safeParse(cfg);
    if (ok.success) return ok.data;
    const old = this.store.setting<{ provider?: string; artworkPolicy?: string }>(
      'svg-planner',
      {},
    );
    return plannerConfigSchema.parse({
      provider:
        old.artworkPolicy === 'offline' || old.provider === 'ollama' || old.provider === 'groq'
          ? 'disabled'
          : old.provider === 'openrouter'
            ? 'openrouter'
            : 'auto',
    });
  }
  settings(): PlannerSettings {
    return {
      ...this.config(),
      keys: {
        groq: this.vaults.groq.has(),
        openrouter: this.vaults.openrouter.has(),
        anthropic: this.vaults.anthropic.has(),
      },
    };
  }
  configure(v: unknown) {
    this.store.set(
      'vector-model',
      plannerConfigSchema.parse({ ...this.config(), ...plannerConfigPatchSchema.parse(v) }),
    );
  }
  key(provider: VaultName, value?: string) {
    if (value === undefined) this.vaults[provider].clear();
    else {
      requireThat(
        provider !== 'groq' && /^[\x21-\x7e]{8,512}$/.test(value),
        provider === 'anthropic'
          ? 'Geçerli bir Anthropic anahtarı gir.'
          : 'Geçerli bir OpenRouter anahtarı gir.',
        400,
      );
      this.vaults[provider].set(value);
    }
  }
  private select(forDrawing: boolean): Selection {
    const cfg = this.config(),
      c = cfg.provider;
    const missing = () =>
      new Issue(
        412,
        'Ayarlar → Sahne planlayıcı bölümünde OpenRouter, Anthropic veya izinli bir Gemini metin modeli seçin ve anahtarını kaydedin.',
        'config',
      );
    if (c === 'disabled' && forDrawing) throw missing();
    // Preserve the old auto rule: an existing OpenRouter key wins, otherwise use
    // Gemini. Anthropic and paid models are never selected as an error fallback.
    const cloud =
      c === 'openrouter' || (c === 'auto' && this.vaults.openrouter.has())
        ? 'openrouter'
        : c === 'anthropic'
          ? 'anthropic'
          : undefined;
    if (cloud) {
      let key: string | undefined;
      try {
        key = this.vaults[cloud].get();
      } catch {
        throw new Issue(
          412,
          `${names[cloud]} anahtarı çözülemedi. Ayarlar’dan değiştirin.`,
          'config',
        );
      }
      if (!key) throw missing();
      return {
        provider: cloud,
        model: cloud === 'openrouter' ? cfg.openrouterModel : cfg.anthropicModel,
        key,
      };
    }
    const g = this.gemini;
    if (!g) throw missing();
    let model: string;
    try {
      model = g.allowed('text');
    } catch (e) {
      if (!forDrawing) throw e; // Keep Gemini's existing script configuration guidance.
      throw missing();
    }
    // The historical 'disabled' setting disables drawings, not Gemini scripts.
    return { provider: 'gemini', model, gemini: g };
  }
  private async cloudText(selected: Cloud, input: string, system?: string) {
    const name = names[selected.provider],
      drawing = system !== undefined,
      signal = requestSignal(150000),
      body =
        selected.provider === 'openrouter'
          ? {
              model: selected.model,
              stream: false,
              temperature: 0.4,
              max_tokens: drawing ? svgOutputTokens : 4096,
              ...(drawing ? { response_format: { type: 'json_object' } } : {}),
              messages: [
                ...(drawing ? [{ role: 'system', content: system }] : []),
                { role: 'user', content: input },
              ],
            }
          : {
              model: selected.model,
              stream: false,
              temperature: 0.4,
              max_tokens: drawing ? svgOutputTokens : 4096,
              ...(drawing ? { system } : {}),
              messages: [{ role: 'user', content: input }],
            };
    let r: Response;
    try {
      r = await this.transport(
        selected.provider === 'openrouter'
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          headers:
            selected.provider === 'openrouter'
              ? { 'Content-Type': 'application/json', Authorization: `Bearer ${selected.key}` }
              : {
                  'Content-Type': 'application/json',
                  'x-api-key': selected.key,
                  'anthropic-version': '2023-06-01',
                },
          signal,
          body: JSON.stringify(body),
        },
      );
    } catch {
      checkpoint();
      throw new Issue(
        503,
        signal.reason?.name === 'TimeoutError'
          ? `Zaman Aşımı - ${name} 150 sn içinde yanıt vermedi. İstek tekrarlanmadı.`
          : `Ağ Hatası - ${name} yanıt vermedi. İstek tekrarlanmadı.`,
      );
    }
    return completed(await responseBody(r, selected.provider), selected, r.status);
  }
  /** The same selected provider and model drives scripts and drawings. */
  async text(prompt: string, onRetry?: RetryNotice): Promise<string> {
    const selected = this.select(false);
    return selected.provider === 'gemini'
      ? selected.gemini.text(prompt, undefined, onRetry)
      : (await this.cloudText(selected, prompt)).text;
  }
  model(system: string, schema: object) {
    const selected = this.select(true);
    if (selected.provider === 'gemini') {
      const { model, gemini } = selected;
      return {
        provider: 'gemini' as const,
        model,
        draw: async (input: string, onRetry?: RetryNotice) => {
          let used = model;
          const text = await gemini.text(
            system + '\nSahne verisi:\n' + input,
            schema,
            onRetry,
            (actual) => {
              used = actual;
            },
          );
          return { model: used, text };
        },
      };
    }
    return {
      provider: selected.provider,
      model: selected.model,
      draw: (input: string, _onRetry?: RetryNotice) => this.cloudText(selected, input, system),
    };
  }
}
