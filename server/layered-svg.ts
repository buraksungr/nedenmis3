import { animKinds } from '../shared/object-motion';
import { SaxesParser } from 'saxes';
import { SVGPathData } from 'svg-pathdata';
import { layers, type Drawing, type Geometry, type Layer } from '../shared/vector';
export const MAX_XML = 96 * 1024;

/** LLM tarafından üretilen yaygın SVG yazım hatalarını otomatik onarır.
 * Katı XML ayrıştırıcıya gitmeden önce çağrılır. Sıfır onarım isteğiyle bozuk XML'i
 * temiz corrected eder, böylece modele tekrar sorulmadan sahne geçerli hale getirilir. */
export function healXml(xml: string): { xml: string; repairs: string[] } {
  const repairs: string[] = [];
  let s = xml;

  // 1. Kod blok işaretlerini temizle (```svg, ```xml, ```)
  const before = s;
  s = s
    .replace(/```svg\s*/gi, '')
    .replace(/```xml\s*/gi, '')
    .replace(/```\s*/g, '');
  if (s !== before) repairs.push('kod blok işaretleri temizlendi');

  // 2. Önceki/sonraki fazlalık metni temizle — ilk <svg ve son </svg> arasında kal
  const svgStart = s.indexOf('<svg');
  const svgEnd = s.lastIndexOf('</svg>');
  if (svgStart >= 0 && svgEnd >= 0 && svgEnd > svgStart) {
    s = s.slice(svgStart, svgEnd + 6);
    if (s !== before) repairs.push('fazlalık metin temizlendi');
  } else if (svgStart >= 0 && svgEnd < 0) {
    s = s.slice(svgStart) + '</svg>';
    repairs.push('eksik </svg> tamamlandı');
  }

  // 3. Çıplak & karakterlerini &amp; ile değiştir (zaten varolan entity'leri bozma)
  const before2 = s;
  s = s.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  if (s !== before2) repairs.push('çıplak & karakterleri &amp; olarak düzeltildi');

  // 4. Bitişik özniteliklere boşluk ekle: fill="#fff"stroke="#000" → fill="#fff" stroke="#000"
  const before3 = s;
  s = s.replace(/"\s*([A-Za-z][A-Za-z0-9:_-]*)\s*=/g, '" $1=');
  if (s !== before3) repairs.push('bitişik özniteliklere boşluk eklendi');

  // 5. Aynı etikette tekrarlanan öznitelikleri tekilleştir (ilk değer kazanır).
  // Sadece name="value" kalıbına uyan özniteliklere uygulanır; path d= gibi
  // boşluk içeren değerler bölünmez.
  const before4 = s;
  s = s.replace(/<([A-Za-z][A-Za-z0-9:_\-]*)([^>]*?)>/g, (_match, tag, attrs) => {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    const attrRe = /\s*([A-Za-z][A-Za-z0-9:_\-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = attrRe.exec(attrs)) !== null) {
      const gap = attrs.slice(lastIndex, m.index);
      if (gap.trim()) cleaned.push(gap.trim());
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        cleaned.push(m[0].trim());
      }
      lastIndex = attrRe.lastIndex;
    }
    const tail = attrs.slice(lastIndex).trim();
    if (tail && tail !== '/') cleaned.push(tail);
    // /' > için ön ek boşluk ekleme: self-closing etiketlerde ' />' değil '/>' olmalı
    const body = cleaned.join(' ');
    return `<${tag}${body ? ' ' + body : ''}${tail === '/' ? '/' : ''}>`;
  });
  if (s !== before4) repairs.push('tekrarlanan öznitelikler tekilleştirildi');

  // 6. Kapatılmamış şekil etiketlerini otomatik kapat (self-closing)
  const before5 = s;
  const selfCloseTags = [
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'stop',
    'use',
  ];
  for (const tag of selfCloseTags) {
    // /' > ile biten (zaten self-closing) etiketleri atla: [^>/] '/' karakterini de hariç tutar
    s = s.replace(new RegExp('<' + tag + '(\\s[^>/]*?)>(?!.*</' + tag + '>)', 'g'), '<$1/>');
  }
  if (s !== before5) repairs.push('kapatılmamış şekil etiketleri kapatıldı');

  return { xml: s, repairs };
}

const ns = 'http://www.w3.org/2000/svg',
  stage = '0 0 1080 1350';
const shapes = new Set(['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line']);
/** Painted, static SVG. A model may use filter/mask/clipPath/pattern/symbol, but only with
 * numeric geometry, local paints and no script: a decoration is never a reason to fail. */
const painted = new Set([...shapes, 'text']);
const defsTags = new Set([
  'linearGradient',
  'radialGradient',
  'clipPath',
  'mask',
  'pattern',
  'filter',
  'symbol',
]);
const filterTags = new Set(['feGaussianBlur', 'feDropShadow', 'feOffset', 'feBlend']);
const mergeTags = new Set(['feMerge', 'feMergeNode']);
/** Content that can execute, embed or fetch. It is removed (with its subtree) and the
 * remaining drawing is accepted. */
const activeTags = new Set(
  [
    'script',
    'iframe',
    'foreignObject',
    'image',
    'object',
    'embed',
    'video',
    'audio',
    'canvas',
    'handler',
    'listener',
    'font-face',
  ].map((v) => v.toLowerCase()),
);
/** Harmless but not drawn: titles, CSS, SMIL, metadata and text wrappers are stripped. */
const noiseTags = new Set(
  [
    'title',
    'desc',
    'metadata',
    'style',
    'animate',
    'animatemotion',
    'animatetransform',
    'animatecolor',
    'set',
    'discard',
    'mpath',
    'textpath',
    'switch',
    'a',
    'tspan',
    'a:tspan',
  ].map((v) => v.toLowerCase()),
);
export class InvalidDrawing extends Error {}
const bad = (why: string): never => {
  throw new InvalidDrawing(why);
};
const numRE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
function num(v: string) {
  if (!numRE.test(v) || !Number.isFinite(+v) || Math.abs(+v) > 100000)
    bad('sayı sınır dışında veya geçersiz');
  return +v;
}
const nums = (v: string) =>
  v
    .trim()
    .split(/[\s,]+/)
    .map(num);
const number = (v: string, tag: string, key: string) => {
  try {
    return num(v);
  } catch {
    return bad(
      `<${token(tag)}> için geçersiz ${token(key)} değeri: ${token(v)} (sonlu bir sayı gerekli).`,
    );
  }
};
function transform(v: string) {
  const calls = v.match(/(?:matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)/g);
  if (
    !calls ||
    calls.length > 8 ||
    v.length > 320 ||
    v.replace(/(?:matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)/g, '').replace(/[ ,\s]/g, '')
  )
    return bad('geçersiz dönüşüm');
  for (const c of calls) {
    const name = c.slice(0, c.indexOf('(')),
      n = nums(c.slice(c.indexOf('(') + 1, -1)).length;
    if (
      !(name === 'matrix'
        ? n === 6
        : name === 'rotate'
          ? n === 1 || n === 3
          : name.startsWith('skew')
            ? n === 1
            : n === 1 || n === 2)
    )
      bad('geçersiz dönüşüm');
  }
  return v;
}
const enums: Record<string, string[]> = {
  'fill-rule': ['evenodd', 'nonzero'],
  'clip-rule': ['evenodd', 'nonzero'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'text-anchor': ['start', 'middle', 'end'],
  'font-family': ['sans-serif', 'Arial', 'system-ui'],
  'font-weight': ['normal', 'bold', '400', '500', '600', '650', '700'],
  gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  spreadMethod: ['pad', 'reflect', 'repeat'],
  clipPathUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  maskUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  maskContentUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  patternUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  patternContentUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  filterUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  primitiveUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  'color-interpolation-filters': ['sRGB', 'linearRGB'],
  'vector-effect': ['non-scaling-stroke'],
  preserveAspectRatio: ['none', 'xMidYMid meet', 'xMidYMid slice'],
};
const blendModes = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
];
const sources = new Set([
  'SourceGraphic',
  'SourceAlpha',
  'BackgroundImage',
  'BackgroundAlpha',
  'FillPaint',
  'StrokePaint',
]);
/** Percentages are relative to the fixed viewBox, so they are safe; expressions and
 * external references are not. */
function length(v: string, allowNegative = false) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(em|ex|px|pt|pc|mm|cm|in|%)?$/i.exec(v.trim())!;
  if (!m) bad(`geçersiz boyut değeri: ${token(v)}`);
  const n = num(m[1]);
  if (!allowNegative && n < 0) bad('negatif boyut kullanılamaz');
  return n + (m[2] ? m[2].toLowerCase() : '');
}
const colorRE =
  /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|none|black|white|red|green|blue|yellow|orange|transparent|currentColor)$/i;
const named: Record<string, string> = {
  black: 'black',
  white: 'white',
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  orange: 'orange',
  transparent: 'transparent',
};
const paints = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);
const references = new Set([
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
]);
const hrefs = new Set(['href', 'src', 'action', 'formaction', 'poster', 'data', 'background']);
const smil = new Set([
  'begin',
  'end',
  'dur',
  'repeatcount',
  'repeatdur',
  'from',
  'to',
  'by',
  'values',
  'keytimes',
  'keysplines',
  'calculatemode',
  'accumulate',
  'additive',
  'attributename',
  'attributetype',
  'rel',
  'target',
]);
const localOnly = /^url\(\s*#([A-Za-z][A-Za-z0-9_-]{0,48})\s*\)$|^#([A-Za-z][A-Za-z0-9_-]{0,48})$/;
const escape = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
export const serialize = (n: Geometry): string =>
  `<${n.tag}${Object.keys(n.attrs)
    .sort()
    .map((k) => ` ${k}="${escape(n.attrs[k])}"`)
    .join('')}>${escape(n.text ?? '')}${n.children.map(serialize).join('')}</${n.tag}>`;
const token = (v: string) => v.replace(/[^A-Za-z0-9:._#-]/g, '').slice(0, 48) || '?';
/** Notes are capped, de-duplicated and contain no artwork, prompt or credential. They are
 * stored on the signed SVG root as `x-nedenmis-clean` so a later run reuses the sanitized
 * file instead of asking the model for the same repair. */
export type Cleanup = { notes: Set<string>; add(why: string): void };
const cleanup = (): Cleanup => {
  const notes = new Set<string>();
  return { notes, add: (why) => notes.size < 8 && notes.add(why) };
};
const describe = (c: Cleanup) => [...c.notes].join('; ').slice(0, 240);
export function parseGeometry(
  xml: string,
  mode: 'layers' | 'rig' | 'objects',
  editorial?: { title: string; narration: string },
) {
  const c = cleanup(),
    note = (why: string) => c.add(why),
    at = (tag: string, scope: string, why: string): never =>
      bad(`${scope}: <${token(tag)}> ${why}`);

  // Güvenlik kontrolleri ön-onarımdan önce: DOCTYPE/ENTITY, boyut ve kök <svg> yapısı
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) bad('SVG belge türü geçersiz (DOCTYPE/ENTITY).');
  if (Buffer.byteLength(xml) > MAX_XML) bad('SVG boyutu sınır dışında.');
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<svg')) bad('XML Hatası - Satır 1, sütun 1: geçersiz SVG kök etiketi.');
  if (!trimmed.endsWith('</svg>')) bad('XML Hatası - Satır 1, sütun 1: eksik kapanış etiketi.');
  const svgKokSayisi = (xml.match(/<svg\b/g) || []).length;
  if (svgKokSayisi > 1) bad('XML Hatası - birden fazla kök <svg> öğesi.');

  // Otomatik XML ön-onarıcı: LLM yazım hatalarını sıfır onarım ile düzelt
  const healed = healXml(xml);
  if (healed.repairs.length > 0) {
    note(`XML ön-onarım: ${healed.repairs.join('; ')}`);
  }
  xml = healed.xml;
  // Onarımdan sonra boyutu tekrar kontrol et (onarım çok az büyültür)
  if (Buffer.byteLength(xml) > MAX_XML) bad('SVG boyutu sınır dışında.');
  const p = new SaxesParser({ xmlns: true }),
    stack: Geometry[] = [],
    ids = new Set<string>(),
    refs = new Set<string>();
  let root: Geometry | undefined,
    layer: Layer | undefined,
    labels = 0,
    nodes = 0,
    skip = 0,
    skipRoot = false;
  const counts: Record<Layer, number> = { 'layer-bg': 0, 'layer-main': 0, 'layer-fx': 0 };
  p.on('error', (e) => {
    const element = /<([A-Za-z][A-Za-z0-9:_-]{0,47})>/.exec(e.message)?.[1];
    bad(
      `XML Hatası - Satır ${p.line}, sütun ${p.column}${element ? `, <${element}>` : ''}: etiket kapanışlarını ve öznitelikleri kontrol et.`,
    );
  });
  p.on('doctype', () => bad('Güvenlik: <!DOCTYPE> kabul edilmez.'));
  p.on('processinginstruction', () => note('XML yönergesi temizlendi'));
  p.on('cdata', () => note('CDATA temizlendi'));
  p.on('opentag', (t) => {
    const tag = t.local ?? '',
      lower = tag.toLowerCase();
    if (skip) {
      skip++;
      return;
    }
    if (activeTags.has(lower)) {
      const label = `<${token(tag)}>`;
      note(`${label} etkin içerik olarak temizlendi`);
      skip = 1;
      skipRoot ||= !stack.length;
      return;
    }
    // Ordinary model text is still decoration, not a heading. Motion scenes may opt in
    // to a tightly bounded scientific keyword directly in layer-fx. Keeping this explicit
    // also preserves the behaviour of old signed scenes and unsupported-text fixtures.
    const keyword =
      mode === 'objects' &&
      lower === 'text' &&
      stack.length === 2 &&
      stack.at(-1)?.attrs.id === 'layer-fx' &&
      Object.values(t.attributes).some(
        (a) => !a.prefix && a.local === 'data-keyword' && a.value === 'true',
      );
    if (
      noiseTags.has(lower) ||
      lower === 'style' ||
      (lower === 'text' && mode !== 'layers' && !keyword)
    ) {
      skip = 1;
      return;
    }
    if (++nodes > 1800 || stack.length > 20) bad('SVG yapısı çok derin veya çok büyük.');
    const parent = stack.at(-1),
      object = mode !== 'layers',
      use = mode === 'objects' && tag === 'use',
      allowed = !parent
        ? tag === 'svg'
        : parent.tag === 'svg'
          ? tag === 'defs' ||
            (mode !== 'rig' && (tag === 'g' || (object && painted.has(tag)) || use))
          : parent.tag === 'defs'
            ? defsTags.has(tag) ||
              filterTags.has(tag) ||
              mergeTags.has(tag) ||
              tag === 'g' ||
              tag === 'symbol'
            : ['linearGradient', 'radialGradient'].includes(parent.tag)
              ? tag === 'stop'
              : parent.tag === 'filter'
                ? filterTags.has(tag) || mergeTags.has(tag)
                : filterTags.has(parent.tag)
                  ? filterTags.has(tag) || mergeTags.has(tag)
                  : mergeTags.has(parent.tag)
                    ? tag === 'feMergeNode'
                    : ['clipPath', 'mask', 'pattern', 'symbol'].includes(parent.tag)
                      ? shapes.has(tag) ||
                        tag === 'g' ||
                        tag === 'text' ||
                        (parent.tag === 'pattern' && (defsTags.has(tag) || filterTags.has(tag)))
                      : parent.tag === 'g'
                        ? object
                          ? shapes.has(tag) || tag === 'g' || use || tag === 'defs' || keyword
                          : tag === 'defs' || tag === 'g' || shapes.has(tag) || tag === 'text'
                        : false;
    if (!allowed) {
      // Yanlış konumdaki veya desteklenmeyen standart bir SVG etiketi asla sahneyi
      // reddetmez: içeriği temizlenir, not kaydedilir ve üretim devam eder.
      note(
        parent
          ? `${token(tag)} <${token(parent.tag)}> içinde kullanılmaz, içeriği temizlendi`
          : `Kökte <${token(tag)}> kabul edilmez; tek kök <svg> olmalı.`,
      );
      skip = 1;
      return;
    }
    const a: Record<string, string> = {},
      unsupported: string[] = [];
    for (const attr of Object.values(t.attributes)) {
      const k = attr.local ?? attr.name,
        v = attr.value,
        n = k.toLowerCase().replaceAll('_', ''),
        xlink = isXlink(attr) || k.startsWith('xlink:');
      if (!xlink && attr.prefix) continue;
      if (k === 'xmlns') {
        if (tag === 'svg' && v === ns) a.xmlns = v;
        else if (v !== ns) note('Yabancı XML ad alanı temizlendi');
        continue;
      }
      if (n === 'href' && tag === 'use') {
        // Yalnız yerel #id referansı geçerli; dış bağlantı özniteliği olarak silinir.
        const id = localOnly.exec(v);
        if (!id) {
          note(`${token(tag)} dış href temizlendi`);
          continue;
        }
        refs.add(id[1] ?? id[2]);
        a.href = `#${id[1] ?? id[2]}`;
        continue;
      }
      if (/^on[a-z]+$/.test(n)) {
        note(`${token(k)} etkin olay özniteliği temizlendi`);
        continue;
      }
      if (hrefs.has(n)) {
        if (n === 'href' && tag !== 'use') {
          const id = localOnly.exec(v),
            ref = id?.[1] ?? id?.[2];
          if (!ref) {
            note(`harici ${token(k)} bağlantısı temizlendi`);
            continue;
          }
          refs.add(ref);
          a[k] = `#${ref}`;
          continue;
        }
        note(`harici ${token(k)} bağlantısı temizlendi`);
        continue;
      }
      if (n === 'x-nedenmis-clean') {
        // Our own recorded note: keep it so a sanitized file re-validates byte for byte.
        for (const why of v.split('; ').slice(0, 8)) if (why) c.notes.add(why.slice(0, 240));
        continue;
      }
      if (smil.has(n) || n === 'class') {
        note(`${token(k)} özniteliği temizlendi`);
        continue;
      }
      if (n === 'style') {
        note('<style> CSS temizlendi');
        continue;
      }
      if (!/^[A-Za-z][A-Za-z0-9:_-]{0,63}$/.test(k)) {
        note('Geçersiz öznitelik adı temizlendi');
        continue;
      }
      if (n === 'id' && tag === 'defs') continue;
      if (n === 'id') {
        // Only an essential structural name is rejected: duplicated keyed groups (layer ids,
        // subject-main) break React's sibling keys and subject binding. Other duplicates
        // are cleaned, not a reason to lose the scene.
        if (tag === 'g' && ['subject-main', ...layers].includes(v) && ids.has(v))
          at(tag, 'SVG', `için yinelenen ${v} kimliği kullanılamaz.`);
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,48}$/.test(v) || ids.has(v)) {
          note(`geçersiz veya yinelenen id temizlendi: ${token(v)}`);
          continue;
        }
        ids.add(v);
        a.id = v;
        continue;
      }
      if (lower === 'svg') {
        if (k === 'viewBox') {
          const box = nums(v);
          if (box.length !== 4 || box[2] < 0.1 || box[3] < 0.1)
            at(tag, 'SVG', 'viewBox geçerli ve sonlu bir alan olmalı.');
          a.viewBox = box.join(' ');
          continue;
        }
        if (k === 'width' || k === 'height') {
          const n = parseFloat(String(length(v)));
          if (!v.endsWith('%')) a[k] = String(n);
          continue;
        }
        if (enums[k]?.includes(v)) {
          a[k] = v;
          continue;
        }
        note(`Kök özniteliği temizlendi: ${token(k)}`);
        continue;
      }
      if (keyword && k === 'data-keyword') {
        a[k] = 'true';
        continue;
      }
      if (object && (shapes.has(tag) || tag === 'g' || use) && n.startsWith('data-')) {
        if (k === 'data-anim') {
          if (!animKinds.some((vv) => vv === v))
            at(tag, 'SVG', `için bilinmeyen data-anim değeri: ${token(v)}.`);
        } else {
          const ranges: Record<string, [number, number]> = {
            'data-dx': [-8000, 8000],
            'data-dy': [-8000, 8000],
            'data-duration': [0.08, 120],
            'data-delay': [0, 120],
            'data-phase': [0, 1],
            'data-pivot-x': [-10000, 10000],
            'data-pivot-y': [-10000, 10000],
            'data-angle': [-180, 180],
          };
          if (!Object.hasOwn(ranges, k)) {
            note(`${token(k)} parametresi temizlendi`);
            continue;
          }
          const nv = number(v, tag, k),
            [lo, hi] = ranges[k];
          if (nv < lo || nv > hi)
            at(tag, 'SVG', `geçersiz hareket parametresi ${token(k)}=${token(v)} (sınır dışında).`);
        }
        a[k] = v;
        continue;
      }
      if (paints.has(k)) {
        a[k] = paint(v, tag, k, note);
        continue;
      }
      if (k === 'paint-order') {
        if (/^(?:normal|(?:fill|stroke|markers)(?: (?:fill|stroke|markers)){0,2})$/.test(v))
          a[k] = v;
        else note('paint-order temizlendi');
        continue;
      }
      if (references.has(k)) {
        const id = localOnly.exec(v);
        if (!id) {
          note(`harici ${token(k)} bağlantısı temizlendi`);
          continue;
        }
        // localOnly has either group 1 (url(#id)) or group 2 (#id).
        const ref = id[1] ?? id[2];
        refs.add(ref);
        a[k] = `url(#${ref})`;
        continue;
      }
      if (k === 'd' && tag === 'path') {
        if (v.length > 32000 || !/^\s*[Mm]/.test(v))
          at(tag, 'SVG', 'path M veya m komutuyla başlamalı ve kısa olmalı.');
        try {
          const cs = SVGPathData.parse(v);
          if (
            cs.length > 5000 ||
            cs.some((cmd) =>
              Object.values(cmd).some(
                (x) => typeof x === 'number' && (!Number.isFinite(x) || Math.abs(x) > 100000),
              ),
            )
          )
            at(tag, 'SVG', 'path koordinatları sınır dışında.');
        } catch {
          at(tag, 'SVG', 'path komutlarını ve koordinat sayılarını düzelt.');
        }
        a[k] = v;
        continue;
      }
      if (k === 'transform' || k === 'gradientTransform') {
        if (
          k === 'gradientTransform' &&
          !/^(?:matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)$/.test(v)
        ) {
          note('gradientTransform temizlendi');
          continue;
        }
        try {
          a[k] = transform(v);
        } catch (e) {
          throw new InvalidDrawing(`<${token(tag)}> ${k}: ${(e as Error).message}`);
        }
        continue;
      }
      if (
        ['opacity', 'stroke-opacity', 'fill-opacity', 'stop-opacity', 'flood-opacity'].includes(k)
      ) {
        const nv = number(
          v.endsWith('%') ? String(number(v.slice(0, -1), tag, k) / 100) : v,
          tag,
          k,
        );
        if (nv < 0 || nv > 1)
          at(tag, 'SVG', `geçersiz ${token(k)} değeri: ${token(v)} (0 ile 1 arası olmalı).`);
        a[k] = v;
        continue;
      }
      if (k === 'offset') {
        const nv = v.endsWith('%') ? number(v.slice(0, -1), tag, k) / 100 : number(v, tag, k);
        if (nv < 0 || nv > 1)
          at(tag, 'SVG', `geçersiz ${token(k)} değeri: ${token(v)} (0 ile 1 arası olmalı).`);
        a[k] = v;
        continue;
      }
      if (
        [
          'x',
          'y',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'x1',
          'x2',
          'y1',
          'y2',
          'fx',
          'fy',
          'fr',
          'dx',
          'dy',
          'stroke-miterlimit',
          'stroke-dashoffset',
          'font-size',
          'pathLength',
        ].includes(k)
      ) {
        try {
          a[k] = length(v, !['r', 'rx', 'ry', 'font-size'].includes(k));
        } catch (e) {
          throw new InvalidDrawing(`<${token(tag)}> ${k}: ${(e as Error).message}`);
        }
        continue;
      }
      if (['width', 'height', 'stroke-width'].includes(k)) {
        try {
          a[k] = length(v, k === 'stroke-width');
        } catch (e) {
          throw new InvalidDrawing(`<${token(tag)}> ${k}: ${(e as Error).message}`);
        }
        continue;
      }
      if (k === 'stdDeviation') {
        const d = nums(v);
        if (d.length < 1 || d.length > 2 || d.some((x) => x < 0))
          at(tag, 'SVG', 'stdDeviation 0 veya daha büyük bir veya iki sayı olmalı.');
        a[k] = d.join(' ');
        continue;
      }
      if (k === 'points' && ['polyline', 'polygon'].includes(tag)) {
        const nv = nums(v);
        if (nv.length < 4 || nv.length % 2 || nv.length > 3000)
          at(tag, 'SVG', 'nokta listesi çift sayıda ve kısa olmalı.');
        a[k] = nv.join(' ');
        continue;
      }
      if (k === 'stroke-dasharray') {
        const dashes = nums(v);
        if (dashes.some((nv) => nv < 0)) at(tag, 'SVG', 'çizgi aralığı negatif olamaz.');
        a[k] = v;
        continue;
      }
      if (k === 'in' || k === 'in2') {
        if (!sources.has(v) && !/^[A-Za-z][A-Za-z0-9_-]{0,32}$/.test(v))
          at(tag, 'SVG', `geçersiz filtre girdisi: ${token(v)}.`);
        a[k] = v;
        continue;
      }
      if (k === 'result') {
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,32}$/.test(v)) at(tag, 'SVG', 'filtre sonuç adı geçersiz.');
        a[k] = v;
        continue;
      }
      if (k === 'mode' && tag === 'feBlend') {
        if (!blendModes.includes(v.toLowerCase())) at(tag, 'SVG', 'karışım modu geçersiz.');
        a[k] = v.toLowerCase();
        continue;
      }
      if (Object.hasOwn(enums, k) && enums[k].includes(v)) {
        a[k] = v;
        continue;
      }
      unsupported.push(token(k));
    }
    if (unsupported.length)
      note(`Desteklenmeyen öznitelik temizlendi: ${[...new Set(unsupported)].sort().join(', ')}`);
    const node: Geometry = { tag, attrs: a, children: [] };
    if (
      ['linearGradient', 'radialGradient', 'pattern', 'filter', 'mask', 'clipPath'].includes(tag)
    ) {
      const parentDefs = stack.at(-1);
      if (parentDefs?.tag === 'defs')
        for (const [k2, v2] of Object.entries(parentDefs.attrs))
          if (!(k2 in a) && k2 !== 'id') a[k2] = v2;
    }
    if (!parent) {
      if (skipRoot) return;
      if (tag !== 'svg') bad(`Desteklenmeyen SVG kökü: <${token(tag)}>.`);
      a.viewBox ??= `0 0 ${a.width ?? (mode === 'rig' ? 300 : 1080)} ${a.height ?? (mode === 'rig' ? 180 : mode === 'layers' ? 1350 : 1920)}`;
      if (
        nums(a.viewBox)
          .slice(2)
          .some((v) => v < 0.1)
      )
        at('svg', 'SVG', 'geçersiz tuval boyutu.');
      root = node;
    } else parent.children.push(node);
    if (mode !== 'rig' && parent?.tag === 'svg' && tag === 'g') {
      if (mode === 'layers' && !layers.includes(a.id as Layer))
        at(
          'g',
          'SVG',
          `kökte layer-bg, layer-main ve layer-fx grupları gerekli (${token(a.id ?? 'id yok')}).`,
        );
      if (layers.includes(a.id as Layer)) layer = a.id as Layer;
    }
    if (layer && shapes.has(tag)) counts[layer]++;
    stack.push(node);
  });
  p.on('text', (v) => {
    if (skip) return;
    const n = stack.at(-1);
    if (n?.tag === 'text') n.text = (n.text ?? '') + v;
    else if (v.trim()) note('serbest metin temizlendi');
  });
  p.on('closetag', () => {
    if (skip) {
      skip--;
      return;
    }
    const n = stack.pop()!;
    if (n.tag === 'text') {
      const text = n.text?.trim() ?? '';
      const parent = stack.at(-1)!;
      // Coordinates, font size, and the resulting output bounds are restricted before
      // a keyword reaches React. Ancestor transforms, positioning tricks and oversized
      // lettering cannot recreate a title band or enter the lower subtitle area.
      let unsafeKeyword = false;
      if (mode === 'objects') {
        const [bx, by, bw, bh] = root!.attrs.viewBox.split(' ').map(Number),
          scale = Math.max(1080 / bw, 1920 / bh),
          numberOnly = (v?: string) => (v && numRE.test(v) ? Number(v) : NaN),
          x = numberOnly(n.attrs.x),
          y = numberOnly(n.attrs.y),
          size = numberOnly(n.attrs['font-size']) * scale,
          outX = (x - bx - (bw - 1080 / scale) / 2) * scale,
          outY = (y - by - (bh - 1920 / scale) / 2) * scale,
          width = Array.from(text).length * size * 0.9,
          anchor = n.attrs['text-anchor'] ?? 'start',
          left = outX - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
        unsafeKeyword =
          parent.attrs.id !== 'layer-fx' ||
          !!parent.attrs.transform ||
          !!parent.attrs['data-anim'] ||
          !!n.attrs.transform ||
          ![outX, outY, size].every(Number.isFinite) ||
          size < 14 ||
          size > 40 ||
          outY - size < 24 ||
          outY > 1200 ||
          left < 24 ||
          left + width > 1056;
      }
      // Optional editorial text never rejects an otherwise valid scene. Keep only short
      // scientific labels; drop a sentence or the title instead of cropping it.
      if (
        layer !== 'layer-fx' ||
        unsafeKeyword ||
        labels >= 2 ||
        text.length > 28 ||
        !/^\p{L}[\p{L}\p{M}\p{N}’'-]*(?: \p{L}[\p{L}\p{M}\p{N}’'-]*)?$/u.test(text) ||
        [editorial?.title, editorial?.narration].some(
          (t) => t?.trim().toLocaleLowerCase('tr') === text.toLocaleLowerCase('tr'),
        ) ||
        /(?:src|href)\s*=/i.test(text)
      ) {
        stack.at(-1)!.children.pop();
        return;
      }
      labels++;
      n.text = text;
      if (mode === 'objects') {
        // No animation, relative offsets, filter or mask on a keyword. A local colour
        // and a small system font are all it needs.
        n.attrs = Object.fromEntries(
          Object.entries(n.attrs).filter(([k]) =>
            [
              'data-keyword',
              'x',
              'y',
              'font-size',
              'font-family',
              'font-weight',
              'text-anchor',
              'fill',
            ].includes(k),
          ),
        );
        n.attrs.fill ??= '#ffffff';
        n.attrs['font-family'] ??= 'Arial';
      }
    }
    if (stack.length === 1 && n.tag === 'g') layer = undefined;
  });
  p.write(xml).close();
  if (!root) {
    if (skipRoot) return bad('SVG kökü <svg> olmalı; etkin <script> veya <style> kabuk olamaz.');
    return bad('Boş SVG.');
  }
  const all: Geometry[] = [];
  const walk = (n: Geometry) => {
    all.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  const defs = all.filter((n) => n.tag === 'defs').flatMap((n) => n.children);
  if (defs.length > 32) bad('Gradyan veya maske sayısı sınır dışında.');
  const defined = new Set(defs.map((n) => n.attrs.id).filter(Boolean));
  for (const ref of refs)
    if (!defined.has(ref)) {
      note(`tanımsız yerel başvuru temizlendi`);
      // Drop a dangling paint/href so the renderer never receives an unresolved URL.
      for (const n of all)
        for (const [k, v] of Object.entries(n.attrs)) {
          if (v === `url(#${ref})` || v === `#${ref}`) {
            if (paints.has(k)) n.attrs[k] = 'none';
            else delete n.attrs[k];
          }
        }
    }
  return { root, defs, counts, nodes, cleanup: describe(c) };
}
const isXlink = (a: { prefix?: string; uri?: string }) =>
  a.prefix === 'xlink' || a.uri === 'http://www.w3.org/1999/xlink';
/** A paint may be a local gradient/pattern, a plain colour or none. Anything else is
 * cleaned to `none`, with the offending element named in the cleanup note. */
function paint(v: string, tag: string, key: string, note: (s: string) => void) {
  if (v === 'none') return v;
  if (named[v.toLowerCase()]) return named[v.toLowerCase()];
  if (/^currentcolor$/i.test(v)) return 'currentColor';
  if (colorRE.test(v)) return v.toLowerCase();
  const id = localOnly.exec(v);
  if (id) return `url(#${id[1] ?? id[2]})`;
  note(`<${token(tag)}> ${key}: harici veya geçersiz boya temizlendi`);
  return 'none';
}
export function parseIllustration(
  xml: string,
  editorial?: { title: string; narration: string },
): { drawing: Drawing; canonical: string } {
  const { root, defs, counts, nodes, cleanup } = parseGeometry(xml, 'layers', editorial),
    note = cleanup || root.attrs['x-nedenmis-clean'] || '';
  if (layers.some((id) => !root!.children.some((n) => n.tag === 'g' && n.attrs.id === id)))
    bad('layer-bg, layer-main ve layer-fx grupları gerekli.');
  const box = root.attrs.viewBox;
  const drawing: Drawing = {
    ...(box === stage ? {} : { viewBox: box }),
    defs,
    layers: Object.fromEntries(
      layers.map((l) => [l, root!.children.find((n) => n.tag === 'g' && n.attrs.id === l)!]),
    ) as Record<Layer, Geometry>,
  };
  const document: Geometry = {
    tag: 'svg',
    attrs: { xmlns: ns, viewBox: box, ...(note ? { 'x-nedenmis-clean': note } : {}) },
    children: [
      ...(defs.length ? [{ tag: 'defs', attrs: {}, children: defs }] : []),
      ...layers.map((l) => drawing.layers[l]),
    ],
  };
  let canonical = serialize(document);
  if (Buffer.byteLength(canonical) > MAX_XML) bad('SVG çok büyük.');
  // Acquisition only; even at the parser limits decoration must never reject
  // an otherwise valid scene. This fixed, id-free light pass needs no resource.
  if (editorial && counts['layer-bg'] <= 1) {
    const bg = drawing.layers['layer-bg'],
      before = bg.children.length,
      [x, y, w, h] = nums(box);
    if (!counts['layer-bg'])
      bg.children.push({
        tag: 'rect',
        attrs: { x: String(x), y: String(y), width: String(w), height: String(h), fill: '#192738' },
        children: [],
      });
    bg.children.push({
      tag: 'path',
      attrs: {
        d: 'M0 260 Q320 140 620 240 T1080 198 V230 Q859 296 604 270 T0 294Z M0 1050 Q356 921 637 1012 T1080 970 V985 Q884 1085 624 1027 T0 1070Z',
        fill: '#fff2d6',
        stroke: '#203344',
        'stroke-width': '5',
        opacity: '.12',
        ...(box === stage
          ? {}
          : { transform: `translate(${x} ${y}) scale(${w / 1080} ${h / 1350})` }),
      },
      children: [],
    });
    const enriched = serialize(document);
    if (nodes + bg.children.length - before <= 1200 && Buffer.byteLength(enriched) <= MAX_XML)
      canonical = enriched;
    else bg.children.length = before;
  }
  return { canonical, drawing };
}
