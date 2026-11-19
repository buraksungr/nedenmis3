import type { PollinationsSettings } from '../shared/schema';
import { inputFormat } from './import-formats';
import { Issue, Store, requireThat } from './store';
import type { Vault } from './vault';

const suffix = ', nostalgic 2D pixel art style, highly detailed, nature documentary aesthetic';
const maxBytes = 30 * 1024 * 1024;
export class ImageUnavailable extends Issue {
  constructor(detail: string) {
    super(502, `Pollinations: ${detail}`);
  }
}

// Encode exactly one path component, including the style; never put a secret in this URL.
function storyboardUrl(prompt: string, keyed: boolean) {
  const text = prompt.trim();
  requireThat(text, 'Görsel istemi veya sahne betimlemesi gerekiyor.', 422);
  const base = keyed
    ? 'https://gen.pollinations.ai/image/'
    : 'https://image.pollinations.ai/prompt/';
  try {
    return `${base}${encodeURIComponent(text + suffix)}?width=1080&height=1920${keyed ? '' : '&nologo=true'}`;
  } catch {
    throw new ImageUnavailable('Görsel istemindeki karakterler kodlanamadı.');
  }
}

async function readImage(r: Response) {
  if (!r.ok || !r.body) {
    await r.body?.cancel();
    const reason =
      r.status === 401 || r.status === 403
        ? 'Erişim reddedildi.'
        : r.status === 402
          ? 'Hesap bakiyesi veya anahtar bütçesi yetersiz.'
          : r.status === 429
            ? 'İstek sınırına ulaşıldı.'
            : 'Görsel alınamadı.';
    throw new ImageUnavailable(`HTTP ${r.status}. ${reason}`);
  }
  const type = r.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (
    type &&
    !['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(type)
  ) {
    await r.body.cancel();
    throw new ImageUnavailable('Yanıt, desteklenen bir görsel değil.');
  }
  const tooLarge = () => new ImageUnavailable('Görsel 30 MB sınırını aşıyor.');
  if (Number(r.headers.get('content-length')) > maxBytes) {
    await r.body.cancel();
    throw tooLarge();
  }
  const reader = r.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = Buffer.concat(chunks, size);
  try {
    inputFormat(data, true);
  } catch {
    throw new ImageUnavailable('Boş veya geçersiz görsel yanıtı.');
  }
  return data;
}

export class Pollinations {
  constructor(
    private store: Store,
    private vault: Vault,
    private transport: typeof fetch = fetch,
  ) {}
  autoFill() {
    return this.store.setting('pollinations-auto-fill', true);
  }
  setAutoFill(value: boolean) {
    this.store.set('pollinations-auto-fill', value);
  }
  settings(): PollinationsSettings {
    return { autoFill: this.autoFill(), hasKey: this.vault.has(), storage: this.vault.mode };
  }
  key(value?: string) {
    if (value === undefined) {
      this.vault.clear();
      return;
    }
    const key = value.trim();
    requireThat(
      /^[\x21-\x7e]{8,512}$/.test(key) && !key.startsWith('pk_'),
      'Geçerli bir Pollinations gizli API anahtarı girin (App Key değil).',
      400,
    );
    this.vault.set(key);
  }
  async image(prompt: string) {
    let key: string | undefined;
    try {
      key = this.vault.get();
    } catch {
      throw new ImageUnavailable('Kayıtlı anahtar çözülemedi. Ayarlar’dan güncelleyin veya silin.');
    }
    const url = storyboardUrl(prompt, !!key);
    try {
      const response = await this.transport(url, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(90_000),
        headers: {
          Accept: 'image/jpeg, image/png, image/webp',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
      });
      return await readImage(response);
    } catch (e) {
      if (e instanceof ImageUnavailable) throw e;
      // Neither server error bodies nor fetch exceptions (which can contain the URL) belong in logs.
      throw new ImageUnavailable('Servise ulaşılamadı veya görsel zamanında indirilemedi.');
    }
  }
}
