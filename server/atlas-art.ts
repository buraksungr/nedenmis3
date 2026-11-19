import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { artRefSchema, keywordSchema, type ArtRef, type ArtPolicy } from '../shared/artwork';
import type { SvgPlan } from '../shared/svg';
import licenses from '../resources/atlas-licenses.json';
import { atomic, hash, type Store } from './store';
import { safeSvg, SVG_LIMIT } from './safe-svg';
const base = 'https://api.iconify.design';
const prefixes = Object.keys(licenses) as (keyof typeof licenses)[];
export type Artist = {
  name: string;
  draw: (text: string, keyword: string, template: string) => Promise<string>;
};
export type ArtResult = { ref?: ArtRef; reason: string; cached: boolean };
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
function assetPath(root: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Geçersiz çizim kimliği.');
  return path.join(root, 'media', 'atlas', id + '.svg');
}
export function readArtwork(root: string, id: string) {
  try {
    const f = assetPath(root, id);
    if (fs.statSync(f).size > SVG_LIMIT) return;
    const s = fs.readFileSync(f, 'utf8');
    if (digest(s) === id && safeSvg(s) === s) return s;
  } catch {
    /* missing or modified: keep local rendering available */
  }
}
async function content(r: Response, kind: 'json' | 'svg') {
  if (
    !r.ok ||
    !r.body ||
    !(kind === 'json' ? /application\/json/i : /image\/svg\+xml/i).test(
      r.headers.get('content-type') ?? '',
    )
  ) {
    await r.body?.cancel();
    throw Error('Iconify yanıtı alınamadı.');
  }
  const reader = r.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((total += value.byteLength) > SVG_LIMIT) {
        await reader.cancel();
        throw Error('Çizim çok büyük.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}
export function candidates(ids: unknown, key: string) {
  if (!Array.isArray(ids)) return [];
  const terms = key.split(/[ -]/),
    slug = terms.join('-');
  return ids
    .slice(0, 128)
    .filter(
      (s): s is string =>
        typeof s === 'string' &&
        /^[a-z0-9-]{1,40}:[a-z0-9-]{1,80}$/.test(s) &&
        Object.hasOwn(licenses, s.split(':')[0]),
    )
    .map((id) => {
      const [pre, name] = id.split(':');
      const parts = name.split('-');
      return {
        id,
        score: terms.every((t) => parts.includes(t))
          ? 100 +
            (name === slug ? 100 : 0) -
            parts.length * 3 -
            prefixes.indexOf(pre as keyof typeof licenses)
          : -1,
      };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((v) => v.id);
}
/** Asset preparation runs before approval, not while sampling Remotion frames. File
 * content is immutable; keyword and per-scene model indices are only cache hints. */
export class AtlasArt {
  private pending = new Map<string, Promise<ArtResult>>();
  constructor(
    private store: Store,
    private transport: typeof fetch = fetch,
  ) {}
  async resolve(
    id: string,
    plan: SvgPlan,
    text: string,
    policy: ArtPolicy,
    artist?: Artist,
  ): Promise<ArtResult> {
    const root = this.store.dir(id),
      kw = keywordSchema.safeParse(plan.iconKeyword).data,
      custom = plan.artMode === 'custom';
    if (plan.artMode === 'local') return { reason: 'Yerel ikon seçildi.', cached: false };
    type Source = ArtRef['source'];
    const previous = plan.artwork,
      model = artist?.name ?? (previous?.source === 'llm' ? previous.name : undefined);
    const sources: Source[] = custom ? ['llm', 'iconify'] : ['iconify', 'llm'];
    const keyFor = (source: Source, by = model) =>
      hash('atlas-art-1', source, kw, source === 'llm' ? [text, plan.template, by] : null);
    // Attribution doubles as the lookup index; both it and the geometry survive
    // the project's cache/** backup exclusion. No API permission is needed to read.
    const creditFile = (key: string) => path.join(root, 'media', 'atlas', 'credits', key + '.json');
    const cached = (key: string, source: Source): ArtResult | undefined => {
      try {
        const ref = artRefSchema.parse(JSON.parse(fs.readFileSync(creditFile(key), 'utf8')).ref);
        if (ref.source === source && readArtwork(root, ref.digest))
          return { ref, reason: 'Proje önbelleği', cached: true };
      } catch {
        /* Missing or damaged asset */
      }
    };
    if (
      previous &&
      !(policy === 'iconify' && previous.source === 'llm') &&
      !(custom && previous.source !== 'llm')
    ) {
      const hit = cached(keyFor(previous.source, previous.name), previous.source);
      if (hit?.ref?.digest === previous.digest) return hit;
    }
    let reason = 'Uygun çizim bulunamadı.';
    for (const source of sources) {
      if ((source === 'iconify' && !kw) || (source === 'llm' && (!model || policy === 'iconify')))
        continue;
      const key = keyFor(source),
        hit = cached(key, source);
      if (hit) return hit;
      if (policy === 'offline' || (source === 'llm' && !artist)) continue;
      const run = async (): Promise<ArtResult> => {
        const get = (url: string, kind: 'json' | 'svg') =>
          this.transport(url, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'error',
            headers: { Accept: kind === 'json' ? 'application/json' : 'image/svg+xml' },
            signal: AbortSignal.timeout(6500),
          }).then((r) => content(r, kind));
        let name: string, svg: string, credit: object;
        if (source === 'iconify') {
          const params = new URLSearchParams({
            query: kw!,
            limit: '48',
            prefixes: prefixes.join(','),
          });
          const search = JSON.parse(await get(`${base}/search?${params}`, 'json'));
          const hits = candidates(search.icons, kw!);
          let picked: { name: string; svg: string; upstreamSha256: string } | undefined;
          for (const candidate of hits.slice(0, 3)) {
            const [pre, n] = candidate.split(':');
            const raw = await get(`${base}/${pre}/${n}.svg`, 'svg');
            try {
              picked = { name: candidate, svg: safeSvg(raw), upstreamSha256: digest(raw) };
              break;
            } catch {
              /* Unsupported geometry: try another relevant result */
            }
          }
          if (!picked) throw Error('Iconify’da uygun güvenli çizim bulunamadı.');
          ({ name, svg } = picked);
          const prefix = name.split(':')[0] as keyof typeof licenses,
            info = search.collections?.[prefix],
            field = (v: unknown) => (typeof v === 'string' ? v.slice(0, 240) : undefined);
          credit = {
            ...licenses[prefix],
            collection: field(info?.name) ?? prefix,
            author: field(info?.author?.name),
            distributedLicense: field(info?.license?.spdx),
            upstreamSha256: picked.upstreamSha256,
            retrievedAt: new Date().toISOString(),
            url: `${base}/${name.replace(':', '/')}.svg`,
            modifications: 'Nedenmiş Studio palette; static SVG geometry only',
          };
        } else {
          name = artist!.name;
          svg = safeSvg(await artist!.draw(text, kw ?? '', plan.template));
          credit = { model: name };
        }
        const ref = artRefSchema.parse({ source, name, digest: digest(svg) });
        atomic(assetPath(root, ref.digest), svg);
        atomic(creditFile(key), JSON.stringify({ keyword: kw, ref, ...credit }, null, 2));
        return { ref, reason: source === 'llm' ? 'Özel çizim' : 'Iconify', cached: false };
      };
      try {
        const pendingKey = id + key;
        let task = this.pending.get(pendingKey);
        if (!task) {
          task = run().finally(() => this.pending.delete(pendingKey));
          this.pending.set(pendingKey, task);
        }
        return await task;
      } catch {
        reason =
          source === 'llm'
            ? 'Özel çizim üretilemedi veya doğrulanamadı.'
            : 'Iconify yanıt vermedi veya uygun çizim bulunamadı.';
      }
    }
    return {
      reason:
        policy === 'offline' ? 'Çevrimdışı yerel ikon.' : reason + ' Yerel ikon kullanılıyor.',
      cached: false,
    };
  }
}
