import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import {
  kinds,
  type Connection,
  type Kind,
  type ModelConfig,
  type ProviderSettings,
  type Settings,
} from '../shared/schema';
import type { Speaker } from '../shared/speakers';
import type { Store } from './store';
import { Issue, now, requireThat } from './store';
import type { Vault } from './vault';
const fresh = (): ProviderSettings => ({
  models: {
    text: { model: '', consent: 'blocked' },
    tts: { model: '', consent: 'blocked' },
  },
  catalog: [],
  status: 'untested',
  tested: null,
  services: {},
  requests: {},
  message: '',
});
const origin = 'https://generativelanguage.googleapis.com';
const scriptVersion = 'v1'; // Stable Gemini Developer API, also the current JS SDK default.
const mediaVersion = 'v1beta'; // Structured storyboard JSON and media Interactions use the beta contract.
const maxScriptRetries = 3;
const maxTimerMs = 2_147_483_647; // Larger Node timeouts fire immediately; never retry early.
function retryAfterMs(header: string | null, rpcDelay: unknown) {
  if (header) {
    if (/^\d+(?:\.\d+)?$/.test(header)) return Math.ceil(Number(header) * 1000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return typeof rpcDelay === 'string' && /^\d+(?:\.\d+)?s$/.test(rpcDelay)
    ? Math.ceil(parseFloat(rpcDelay) * 1000)
    : 0;
}
export type RetryNotice = (label: string) => void;
// models.list returns a resource name; settings and request builders use a single model ID.
function modelId(name: unknown): string {
  if (typeof name !== 'string') return '';
  const id = name
    .trim()
    .replace(/^models\//, '')
    .trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id) ? id : '';
}
export function modality(id: string): Kind | undefined {
  if (
    !id.startsWith('gemini-') ||
    /image|embedding|robotics|computer-use|omni|live|native-audio|transcribe|customtools|deep-research/.test(
      id,
    )
  )
    return;
  if (/tts/.test(id)) return 'tts';
  return 'text';
}
function fault(
  status: number,
  reason: string | undefined,
  retry: string | null,
  textRoute?: string,
) {
  if (status === 429)
    return [
      'quota',
      `Gemini kotası aşıldı.${retry ? ' Yeniden deneme: ' + retry + ' sn.' : ' AI Studio kota ekranını kontrol edin.'} Ücretli modele geçilmedi.`,
    ] as const;
  if (status === 401 || reason === 'API_KEY_INVALID' || reason === 'API_KEY_EXPIRED')
    return ['invalid', 'API anahtarı geçersiz veya süresi dolmuş.'] as const;
  if (status === 404 && textRoute)
    return [
      'unavailable',
      `Metin modeli bu projede ${textRoute} ile kullanılamadı (HTTP 404). Ayarlar → API ve modeller’de bağlantıyı yeniden test edip listeden bir metin modeli seçin.`,
    ] as const;
  if (status === 503)
    return [
      'unavailable',
      'Gemini hizmeti şu anda kullanılamıyor (HTTP 503). Daha sonra tekrar deneyin.',
    ] as const;
  if (status === 403)
    return [
      'unavailable',
      'Erişim reddedildi. Proje izinlerini, anahtar kısıtlarını ve bölgeyi kontrol edin.',
    ] as const;
  return [
    'unavailable',
    `Gemini isteği tamamlanamadı (HTTP ${status}). Model erişimini ve yapılandırmasını kontrol edin.`,
  ] as const;
}
type AudioPart = { type: 'audio'; data: string; mime_type?: string };
export class Gemini {
  constructor(
    private store: Store,
    private vault: Vault,
    private transport: typeof fetch = fetch,
    private wait: (ms: number) => Promise<void> = sleep,
  ) {}
  raw() {
    return this.store.setting('gemini', fresh());
  }
  settings(): Omit<Settings, 'pollinations'> {
    const s = this.raw();
    const hasKey = this.vault.has();
    return {
      ...s,
      status: hasKey ? s.status : 'not-configured',
      hasKey,
      defaultSpeaker: this.store.defaultSpeaker(),
      storage: this.vault.mode,
      folder: this.store.projects,
      desktop: this.vault.mode === 'encrypted',
      setupDone: this.store.setting('setup-done', false),
    };
  }
  key(key?: string) {
    if (key) {
      requireThat(/^\S{12,250}$/.test(key), 'Geçerli bir API anahtarı girin.', 400);
      this.vault.set(key);
    } else this.vault.clear();
    this.store.set('gemini', fresh());
  }
  configure(kind: Kind, c: ModelConfig) {
    const s = this.raw();
    const model = modelId(c.model);
    requireThat(
      model && s.catalog.some((m) => m.kind === kind && modelId(m.id) === model),
      'Bu model bağlantı testinde bulunmadı.',
      400,
    );
    s.models[kind] = { model, consent: c.consent };
    delete s.services[kind];
    this.store.set('gemini', s);
  }
  private apiKey(kind?: Kind) {
    let key: string | undefined;
    try {
      key = this.vault.get();
    } catch {
      this.record(
        'invalid',
        'Anahtar bu Windows hesabında çözülemedi. Güncelleyin veya silin.',
        kind,
      );
      throw new Issue(412, 'Kayıtlı anahtar çözülemedi. Ayarlar’dan değiştirin.', 'config');
    }
    if (!key)
      throw new Issue(
        412,
        'Ayarlar → API ve modeller bölümünde Gemini anahtarını kaydedin.',
        'config',
      );
    return key;
  }
  // One transport for REST and the SDK. Never infer retryability from a thrown network
  // error: the POST might already have reached Google. Only a received script HTTP 503 qualifies.
  private async send(
    url: string,
    init: RequestInit,
    kind?: Kind,
    script?: { onRetry?: RetryNotice },
  ) {
    for (let retry = 0; ; retry++) {
      if (kind) this.countRequest(kind);
      let r: Response;
      try {
        const timeout = AbortSignal.timeout(init.method === 'POST' ? 180_000 : 20_000);
        r = await this.transport(url, {
          ...init,
          redirect: 'error',
          signal: init.signal ? AbortSignal.any([timeout, init.signal]) : timeout,
        });
      } catch {
        this.record(
          'unavailable',
          'Gemini servisine ulaşılamadı. İnternet bağlantısını kontrol edin.',
          kind,
        );
        throw new Issue(503, 'Gemini servisine ulaşılamadı. Ağ bağlantısını kontrol edin.');
      }
      if (r.ok) return r;
      const e = await r.json().catch(() => null);
      const details = Array.isArray(e?.error?.details) ? e.error.details : [];
      const after = retryAfterMs(
        r.headers.get('retry-after'),
        details.find((d: any) => d?.retryDelay)?.retryDelay,
      );
      const [status, reason] = fault(
        r.status,
        details.find((d: any) => d?.reason)?.reason,
        after ? String(Math.ceil(after / 1000)) : null,
        kind === 'text' ? new URL(url).pathname : undefined,
      );
      let msg: string = reason;
      if (script && r.status === 503 && status === 'unavailable') {
        const delay = Math.max(1000 * 2 ** retry, after);
        if (retry < maxScriptRetries && delay <= maxTimerMs) {
          script.onRetry?.(
            `Gemini HTTP 503 · ${Math.ceil(delay / 1000)} sn sonra aynı modelle yeniden denenecek (${retry + 1}/${maxScriptRetries}).`,
          );
          await this.wait(delay);
          continue;
        }
        msg =
          retry === maxScriptRetries
            ? `Gemini hizmeti 4 isteğe de HTTP 503 döndürdü. Senaryo değiştirilmedi; daha sonra tekrar deneyin.`
            : `Gemini HTTP 503 döndürdü ve otomatik zamanlayıcının desteklediğinden uzun bekleme istedi. Senaryo değiştirilmedi; daha sonra tekrar deneyin.`;
      }
      this.record(status, msg, kind);
      throw new Issue(
        r.status,
        msg,
        status === 'invalid' || (r.status === 404 && kind === 'text') ? 'config' : 'failed',
      );
    }
  }
  private async request(route: string, body?: object, kind?: Kind) {
    const r = await this.send(
      origin + route,
      {
        method: body ? 'POST' : 'GET',
        headers: { 'x-goog-api-key': this.apiKey(kind), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      },
      kind,
    );
    try {
      return await r.json();
    } catch {
      this.record('unavailable', 'Google geçerli JSON döndürmedi.', kind);
      throw new Issue(502, 'Google yanıtı doğrulanamadı.');
    }
  }
  private record(status: Connection, message: string, kind?: Kind) {
    const s = this.raw();
    if (kind) s.services[kind] = { status, message, at: now() };
    if (!kind || status === 'invalid') {
      s.status = status;
      s.message = message;
      s.tested = now();
    }
    this.store.set('gemini', s);
  }
  private async listModels(version: string) {
    const catalog: ProviderSettings['catalog'] = [];
    let token = '';
    const seen = new Set<string>();
    do {
      const data = await this.request(
        `/${version}/models?pageSize=1000` +
          (token ? '&pageToken=' + encodeURIComponent(token) : ''),
      );
      if (!Array.isArray(data?.models))
        this.record('unavailable', 'Google geçerli bir model listesi döndürmedi.');
      requireThat(Array.isArray(data?.models), 'Google geçerli bir model listesi döndürmedi.', 502);
      for (const m of data.models) {
        const id = modelId(m?.name);
        const kind = modality(id);
        if (
          kind &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        )
          catalog.push({ id, kind, name: m.displayName || id });
      }
      token = data.nextPageToken || '';
      requireThat(!token || !seen.has(token), 'Model listesi sayfalaması tamamlanamadı.', 502);
      seen.add(token);
    } while (token);
    return catalog;
  }
  async test() {
    const catalog = (await this.listModels(scriptVersion)).filter((m) => m.kind === 'text');
    let mediaNote = '';
    // A preview-only voice must not disappear when moving script discovery to stable v1.
    // A TTS catalog outage must not block a verified script model.
    try {
      catalog.push(...(await this.listModels(mediaVersion)).filter((m) => m.kind === 'tts'));
    } catch (e) {
      if (!(e instanceof Issue) || e.code === 'config') throw e;
      catalog.push(...this.raw().catalog.filter((m) => m.kind === 'tts'));
      mediaNote = ' Medya model listesi yenilenemedi; varsa önceki liste korundu.';
    }
    const s = this.raw();
    s.catalog = catalog;
    for (const k of kinds) {
      s.models[k].model = modelId(s.models[k].model);
      if (!catalog.some((m) => m.id === s.models[k].model && m.kind === k)) {
        const choices = catalog
          .filter((m) => m.kind === k)
          .sort(
            (a, b) =>
              Number(/pro|preview|latest/.test(a.id)) - Number(/pro|preview|latest/.test(b.id)) ||
              b.id.localeCompare(a.id, 'en', { numeric: true }),
          );
        s.models[k] = { model: choices[0]?.id || '', consent: 'blocked' };
        delete s.services[k];
      }
    }
    s.status = 'connected';
    s.tested = now();
    s.message = mediaNote
      ? `Metin model listesi doğrulandı.${mediaNote}`
      : `Model listesi doğrulandı · ${catalog.length} uyumlu model. Üretim erişimi ilk gerçek istekte sınanır.`;
    this.store.set('gemini', s);
    return this.settings();
  }
  allowed(kind: Kind) {
    const s = this.settings(),
      c = s.models[kind],
      model = modelId(c.model);
    if (!s.hasKey || s.status === 'invalid' || modality(model) !== kind || c.consent === 'blocked')
      throw new Issue(
        412,
        `${{ text: 'Metin', tts: 'Seslendirme' }[kind]} için Ayarlar’da anahtarı test edin, model seçin ve kullanım iznini belirleyin. Ücretli istek yapılmadı.`,
        'config',
      );
    return model;
  }
  private countRequest(kind: Kind) {
    const s = this.raw(),
      day = now().slice(0, 10) + ':' + kind;
    s.requests[day] = (s.requests[day] || 0) + 1;
    this.store.set('gemini', s);
  }
  private noOutput(kind: Kind): never {
    this.record('unavailable', 'Yanıt engellendi, eksik veya beklenen biçimde değil.', kind);
    throw new Issue(
      502,
      'Gemini doğrulanabilir bir çıktı döndürmedi. Modeli ve içeriği kontrol edin.',
    );
  }
  async text(prompt: string, schema?: object, onRetry?: RetryNotice): Promise<string> {
    const model = this.allowed('text');
    // Explicit backend, origin and version: never pick up Vertex, another host or
    // an API-version override from the user's environment. No SDK-level retry loop.
    const ai = new GoogleGenAI({
      apiKey: this.apiKey('text'),
      enterprise: false,
      apiVersion: schema ? mediaVersion : scriptVersion,
      httpOptions: {
        baseUrl: origin,
        fetch: (url, init) =>
          this.send(String(url), init ?? {}, 'text', schema ? undefined : { onRetry }),
      },
    });
    let out: GenerateContentResponse;
    try {
      out = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(schema
          ? { config: { responseMimeType: 'application/json', responseJsonSchema: schema } }
          : {}),
      });
    } catch (e) {
      if (e instanceof Issue) throw e;
      // Do not expose raw SDK exceptions (may contain provider payload or credentials).
      this.noOutput('text');
    }
    const candidate = out?.candidates?.[0];
    const parts = candidate?.content?.parts;
    const block = out?.promptFeedback?.blockReason;
    if (
      !Array.isArray(parts) ||
      (block && !['BLOCK_REASON_UNSPECIFIED', 'BLOCKED_REASON_UNSPECIFIED'].includes(block)) ||
      (candidate?.finishReason && candidate.finishReason !== 'STOP')
    )
      this.noOutput('text');
    // Never write a thought summary into the script or concatenate alternative candidates.
    const text = parts
      .map((p) => (!p?.thought && typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    if (!text) this.noOutput('text');
    this.record('connected', 'Geçerli servis yanıtı alındı.', 'text');
    return text;
  }
  async voice(text: string, voice: Speaker, style: string) {
    const model = this.allowed('tts');
    const out = await this.request(
      `/${mediaVersion}/interactions`,
      {
        model,
        store: false,
        input: !/^gemini-(2\.|3\.1-)/.test(model)
          ? [
              {
                type: 'user_input',
                content: [
                  { type: 'text', text, annotations: [{ type: 'speech_metadata', style }] },
                ],
              },
            ]
          : `${style} Aşağıdaki Türkçe metni ekleme yapmadan aynen oku:\n\n${text}`,
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
      },
      'tts',
    );
    const p = (out?.steps ?? [])
      .filter((x: any) => x.type === 'model_output')
      .flatMap((x: any) => x.content ?? [])
      .filter((x: AudioPart) => x.type === 'audio' && x.data)
      .at(-1);
    if (out?.status !== 'completed' || !p) this.noOutput('tts');
    this.record('connected', 'Geçerli servis yanıtı alındı.', 'tts');
    const data = Buffer.from(p.data, 'base64');
    if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE')
      return data;
    requireThat(
      /^audio\/(l16|pcm)/i.test(p.mime_type ?? ''),
      'Ses biçimi WAV veya PCM değil.',
      502,
    );
    const rate = Number(/rate=(\d+)/i.exec(p.mime_type ?? '')?.[1] || 24000);
    requireThat(
      rate >= 8000 && rate <= 96000 && data.length % 2 === 0,
      'PCM verisi geçersiz.',
      502,
    );
    return wav(data, rate);
  }
}
export function wav(data: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write('RIFF');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
