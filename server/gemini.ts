import {
  kinds,
  manualImages,
  type Connection,
  type Kind,
  type ModelConfig,
  type ProviderSettings,
  type Settings,
} from '../shared/schema';
import type { Speaker } from '../shared/speakers';
import type { Store } from './store';
import { Issue, now, requireThat } from './store';
export interface Vault {
  mode: 'session' | 'encrypted';
  has?(): boolean;
  get(): string | undefined;
  set(v: string): void;
  clear(): void;
}
export function memoryVault(): Vault {
  let secret: string | undefined;
  return {
    mode: 'session',
    has: () => !!secret,
    get: () => secret,
    set: (v) => {
      secret = v;
    },
    clear: () => {
      secret = undefined;
    },
  };
}
const fresh = (): ProviderSettings => ({
  models: {
    text: { model: '', consent: 'blocked' },
    image: { model: '', consent: 'blocked' },
    tts: { model: '', consent: 'blocked' },
  },
  catalog: [],
  status: 'untested',
  tested: null,
  services: {},
  requests: {},
  message: '',
});
const base = 'https://generativelanguage.googleapis.com/v1beta';
export function modality(id: string): Kind | undefined {
  if (
    !/^(gemini-|nano-banana)/.test(id) ||
    /embedding|robotics|computer-use|omni|live|native-audio|transcribe|customtools|deep-research/.test(
      id,
    )
  )
    return;
  if (/tts/.test(id)) return 'tts';
  if (/image|nano-banana/.test(id)) return 'image';
  return 'text';
}
function fault(status: number, reason: string, retry: string | null) {
  if (status === 429)
    return [
      'quota',
      `Gemini kotası aşıldı.${retry ? ' Yeniden deneme: ' + retry + ' sn.' : ' AI Studio kota ekranını kontrol edin.'} Ücretli modele geçilmedi.`,
    ] as const;
  if (status === 401 || reason === 'API_KEY_INVALID' || reason === 'API_KEY_EXPIRED')
    return ['invalid', 'API anahtarı geçersiz veya süresi dolmuş.'] as const;
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
type Part = { type: string; text?: string; data?: string; mime_type?: string };
export class Gemini {
  constructor(
    private store: Store,
    private vault: Vault,
    private transport: typeof fetch = fetch,
  ) {}
  raw() {
    return this.store.setting('gemini', fresh());
  }
  usesManualImages() {
    return manualImages(this.raw().models.image);
  }
  requireAutomaticImages() {
    if (this.usesManualImages())
      throw new Issue(409, 'Görsel istekleri kapalı. Bu sahneye kendi görselinizi yükleyin.');
  }
  settings(): Settings {
    const s = this.raw();
    const hasKey = this.vault.has ? this.vault.has() : !!this.vault.get();
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
    if (kind === 'image' && c.consent === 'blocked') {
      // Disabling is a local preference: no key, discovery or model required.
      s.models.image = { model: '', consent: 'blocked' };
      delete s.services.image;
      this.store.set('gemini', s);
      return;
    }
    requireThat(
      s.catalog.some((m) => m.kind === kind && m.id === c.model),
      'Bu model bağlantı testinde bulunmadı.',
      400,
    );
    requireThat(
      kind !== 'image' || c.consent !== 'free',
      'Görsel API için ücretsiz erişim doğrulanmadı. Kendi görselinizi içe aktarabilir veya bu model için ücretli kullanıma açıkça izin verebilirsiniz.',
      400,
    );
    s.models[kind] = { model: c.model, consent: c.consent };
    delete s.services[kind];
    this.store.set('gemini', s);
  }
  async request(route: string, body?: object, kind?: Kind) {
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
    let r: Response;
    try {
      r = await this.transport(base + route, {
        method: body ? 'POST' : 'GET',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(body ? 180000 : 20000),
        redirect: 'error',
      });
    } catch {
      this.record(
        'unavailable',
        'Gemini servisine ulaşılamadı. İnternet bağlantısını kontrol edin.',
        kind,
      );
      throw new Issue(503, 'Gemini servisine ulaşılamadı. Ağ bağlantısını kontrol edin.');
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      const retryInfo = e.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
      const retry =
        r.headers.get('retry-after') ??
        (typeof retryInfo === 'string' ? retryInfo.replace(/s$/, '') : null);
      const [st, msg] = fault(
        r.status,
        e.error?.details?.find((d: any) => d.reason)?.reason,
        retry && /^\d+(\.\d+)?$/.test(retry) ? retry : null,
      );
      this.record(st, msg, kind);
      throw new Issue(r.status, msg, st === 'invalid' ? 'config' : 'failed');
    }
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
  async test() {
    const catalog: ProviderSettings['catalog'] = [];
    let token = '';
    const seen = new Set<string>();
    do {
      const data = await this.request(
        '/models?pageSize=1000' + (token ? '&pageToken=' + encodeURIComponent(token) : ''),
      );
      if (!Array.isArray(data.models))
        this.record('unavailable', 'Google geçerli bir model listesi döndürmedi.');
      requireThat(Array.isArray(data.models), 'Google geçerli bir model listesi döndürmedi.', 502);
      for (const m of data.models) {
        const id = String(m.name).replace(/^models\//, '');
        const kind = modality(id);
        if (kind && m.supportedGenerationMethods?.includes('generateContent'))
          catalog.push({ id, kind, name: m.displayName || id });
      }
      token = data.nextPageToken || '';
      requireThat(!token || !seen.has(token), 'Model listesi sayfalaması tamamlanamadı.', 502);
      seen.add(token);
    } while (token);
    const s = this.raw();
    s.catalog = catalog;
    for (const k of kinds) {
      if (k === 'image' && manualImages(s.models.image)) {
        s.models.image = { model: '', consent: 'blocked' };
        delete s.services.image;
        continue;
      }
      if (!catalog.some((m) => m.id === s.models[k].model && m.kind === k)) {
        const choices = catalog
          .filter((m) => m.kind === k)
          .sort(
            (a, b) =>
              Number(/pro|preview|latest/.test(a.id)) - Number(/pro|preview|latest/.test(b.id)) ||
              b.id.localeCompare(a.id, 'en', { numeric: true }),
          );
        s.models[k] = { model: k === 'image' ? '' : choices[0]?.id || '', consent: 'blocked' };
        delete s.services[k];
      }
    }
    s.status = 'connected';
    s.tested = now();
    s.message = `Model listesi doğrulandı · ${catalog.length} uyumlu model. Üretim erişimi ilk gerçek istekte sınanır.`;
    this.store.set('gemini', s);
    return this.settings();
  }
  allowed(kind: Kind) {
    const s = this.settings(),
      c = s.models[kind];
    if (
      !s.hasKey ||
      s.status === 'invalid' ||
      !c.model ||
      c.consent === 'blocked' ||
      (kind === 'image' && c.consent === 'free')
    )
      throw new Issue(
        412,
        `${{ text: 'Metin', image: 'Görsel', tts: 'Seslendirme' }[kind]} için Ayarlar’da anahtarı test edin, model seçin ve kullanım iznini belirleyin. Ücretli istek yapılmadı.`,
        'config',
      );
    return c.model;
  }
  async generate(kind: Kind, params: object, type: string): Promise<Part> {
    const model = this.allowed(kind);
    const s = this.raw(),
      day = now().slice(0, 10) + ':' + kind;
    s.requests[day] = (s.requests[day] || 0) + 1;
    this.store.set('gemini', s);
    const out = await this.request('/interactions', { model, store: false, ...params }, kind);
    const parts: Part[] = (out.steps ?? [])
      .filter((x: any) => x.type === 'model_output')
      .flatMap((x: any) => x.content ?? [])
      .filter((x: Part) => x.type === type && (x.data || x.text));
    const part =
      type === 'text' && parts.length
        ? { type, text: parts.map((x) => x.text).join('') }
        : parts.at(-1);
    if (out.status !== 'completed' || !part) {
      this.record('unavailable', 'Yanıt engellendi, eksik veya beklenen biçimde değil.', kind);
      throw new Issue(
        502,
        'Gemini doğrulanabilir bir çıktı döndürmedi. Modeli ve içeriği kontrol edin.',
      );
    }
    this.record('connected', 'Geçerli servis yanıtı alındı.', kind);
    return part;
  }
  async text(prompt: string, schema?: object) {
    const p = await this.generate(
      'text',
      {
        input: prompt,
        ...(schema
          ? { response_format: { type: 'text', mime_type: 'application/json', schema } }
          : {}),
      },
      'text',
    );
    return p.text!.trim();
  }
  async image(prompt: string, ref?: Buffer) {
    const input = ref
      ? [
          { type: 'text', text: prompt },
          { type: 'image', data: ref.toString('base64'), mime_type: 'image/jpeg' },
        ]
      : prompt;
    const p = await this.generate(
      'image',
      { input, response_format: { type: 'image', aspect_ratio: '9:16', mime_type: 'image/jpeg' } },
      'image',
    );
    return Buffer.from(p.data!, 'base64');
  }
  async voice(text: string, voice: Speaker, style: string) {
    const model = this.allowed('tts');
    const newer = !/^gemini-(2\.|3\.1-)/.test(model);
    const p = await this.generate(
      'tts',
      {
        input: newer
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
      'audio',
    );
    const data = Buffer.from(p.data!, 'base64');
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
