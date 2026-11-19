import { SaxesParser } from 'saxes';
import { SVGPathData } from 'svg-pathdata';
import { layers, type Drawing, type Geometry, type Layer } from '../shared/vector';
export const MAX_XML = 96 * 1024;
const ns = 'http://www.w3.org/2000/svg';
const shapes = new Set(['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line']);
const gradients = new Set(['linearGradient', 'radialGradient']);
export class InvalidDrawing extends Error {}
const bad = (why: string): never => {
  throw new InvalidDrawing(why);
};
const numRE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
function num(v: string) {
  if (!numRE.test(v) || !Number.isFinite(+v) || Math.abs(+v) > 100000)
    bad('Geometri sayıları sınır dışında.');
  return +v;
}
const nums = (v: string) =>
  v
    .trim()
    .split(/[\s,]+/)
    .map(num);
function transform(v: string) {
  const calls = v.match(/(?:matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)/g);
  if (
    !calls ||
    calls.length > 8 ||
    v.length > 320 ||
    v.replace(/(?:matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)/g, '').replace(/[ ,\s]/g, '')
  )
    return bad('Geçersiz dönüşüm.');
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
      bad('Geçersiz dönüşüm.');
  }
  return v;
}
const enums: Record<string, string[]> = {
  'fill-rule': ['evenodd', 'nonzero'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'text-anchor': ['start', 'middle', 'end'],
  'font-family': ['sans-serif', 'Arial', 'system-ui'],
  'font-weight': ['normal', 'bold', '400', '500', '600', '650', '700'],
  gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'],
};
const color =
  /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|none|black|white|red|green|blue|yellow|orange|transparent)$/i;
const esc = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
export const serialize = (n: Geometry): string =>
  `<${n.tag}${Object.keys(n.attrs)
    .sort()
    .map((k) => ` ${k}="${esc(n.attrs[k])}"`)
    .join('')}>${esc(n.text ?? '')}${n.children.map(serialize).join('')}</${n.tag}>`;
/** Parse to a small, inert display list. A gradient paint server is the ONLY
 * reference type; it must resolve inside this illustration. Never render raw XML. */
export function parseIllustration(
  xml: string,
  editorial?: { title: string; narration: string },
): { drawing: Drawing; canonical: string } {
  if (Buffer.byteLength(xml) > MAX_XML || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    bad('SVG boyutu veya belge türü geçersiz.');
  const p = new SaxesParser({ xmlns: true }),
    stack: Geometry[] = [],
    ids = new Set<string>(),
    refs = new Set<string>();
  let root: Geometry | undefined,
    layer: Layer | undefined,
    labels = 0,
    nodes = 0;
  const counts: Record<Layer, number> = { 'layer-bg': 0, 'layer-main': 0, 'layer-fx': 0 };
  p.on('error', () => bad('XML kapanışlarını ve öznitelikleri düzelt.'));
  for (const event of ['doctype', 'processinginstruction', 'cdata'] as const)
    p.on(event, () => bad('Etkin içerik veya belge yönergesi kabul edilmez.'));
  p.on('opentag', (t) => {
    const tag = t.local,
      parent = stack.at(-1),
      a: Record<string, string> = {};
    if (++nodes > 1200 || stack.length > 16 || t.prefix || (t.uri && t.uri !== ns))
      bad('Desteklenmeyen SVG yapısı.');
    const allowed = !parent
      ? tag === 'svg'
      : parent.tag === 'svg'
        ? ['defs', 'g'].includes(tag)
        : parent.tag === 'defs'
          ? gradients.has(tag)
          : gradients.has(parent.tag)
            ? tag === 'stop'
            : parent.tag === 'g'
              ? shapes.has(tag) || tag === 'g' || tag === 'text'
              : false;
    if (!allowed) bad('Yalnız statik geometri, yerel gradyan ve üç sahne katmanı kullanılabilir.');
    for (const [k, { value: v }] of Object.entries(t.attributes)) {
      if (k === 'xmlns' && tag === 'svg' && v === ns) continue;
      if (tag === 'svg') {
        if (k === 'viewBox' && nums(v).join(' ') === '0 0 1080 1350') {
          a.viewBox = '0 0 1080 1350';
          continue;
        }
        if ((k === 'width' && v === '1080') || (k === 'height' && v === '1350')) continue;
        bad('Kök yalnız viewBox="0 0 1080 1350" içermeli.');
      }
      if (k === 'id') {
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,48}$/.test(v) || ids.has(v))
          bad('Geçersiz veya tekrarlanan id.');
        ids.add(v);
        a.id = v;
        continue;
      }
      if (['fill', 'stroke', 'stop-color'].includes(k)) {
        const local = /^url\(#([A-Za-z][A-Za-z0-9_-]{0,48})\)$/.exec(v);
        if (local && k !== 'stop-color') refs.add(local[1]);
        else if (!color.test(v)) bad('Renk olarak hex veya tanımlı bir yerel gradyan kullan.');
      } else if (k === 'd' && tag === 'path') {
        if (v.length > 32000 || !/^\s*[Mm]/.test(v)) bad('Geçersiz path.');
        try {
          const cs = SVGPathData.parse(v);
          if (
            cs.length > 5000 ||
            cs.some((c) =>
              Object.values(c).some(
                (n) => typeof n === 'number' && (!Number.isFinite(n) || Math.abs(n) > 100000),
              ),
            )
          )
            bad('Geçersiz path.');
        } catch {
          bad('Path komutlarını ve koordinat sayılarını düzelt.');
        }
      } else if (k === 'transform' || k === 'gradientTransform') transform(v);
      else if (
        ['opacity', 'stroke-opacity', 'fill-opacity', 'stop-opacity', 'offset'].includes(k)
      ) {
        const n = k === 'offset' && v.endsWith('%') ? num(v.slice(0, -1)) / 100 : num(v);
        if (n < 0 || n > 1) bad('Opaklık veya gradyan durağı geçersiz.');
      } else if (
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
          'width',
          'height',
          'fx',
          'fy',
          'stroke-width',
          'stroke-miterlimit',
          'stroke-dashoffset',
          'font-size',
        ].includes(k)
      ) {
        const val = num(v.endsWith('%') ? v.slice(0, -1) : v);
        if (
          ['r', 'rx', 'ry', 'width', 'height', 'stroke-width', 'font-size'].includes(k) &&
          val < 0
        )
          bad('Negatif boyut kullanılamaz.');
      } else if (k === 'points' && ['polyline', 'polygon'].includes(tag)) {
        const n = nums(v);
        if (n.length < 4 || n.length % 2 || n.length > 3000) bad('Geçersiz nokta listesi.');
      } else if (k === 'stroke-dasharray') {
        if (nums(v).some((n) => n < 0)) bad('Geçersiz çizgi aralığı.');
      } else if (!Object.hasOwn(enums, k) || !enums[k].includes(v))
        bad('İzin verilmeyen SVG özniteliği.');
      a[k] = v;
    }
    const n: Geometry = { tag, attrs: a, children: [] };
    if (!parent) {
      if (!a.viewBox) bad('viewBox="0 0 1080 1350" gerekli.');
      root = n;
    } else parent.children.push(n);
    if (parent?.tag === 'svg' && tag === 'g') {
      if (!layers.includes(a.id as Layer)) bad('Kökte layer-bg, layer-main ve layer-fx gerekli.');
      layer = a.id as Layer;
    }
    if (layer && shapes.has(tag)) counts[layer]++;
    stack.push(n);
  });
  p.on('text', (v) => {
    const n = stack.at(-1);
    if (n?.tag === 'text') n.text = (n.text ?? '') + v;
    else if (v.trim()) bad('Sahne içinde serbest metin kullanma.');
  });
  p.on('closetag', () => {
    const n = stack.pop()!;
    if (n.tag === 'text') {
      const text = n.text?.trim() ?? '';
      // Optional editorial text is not a reason to reject a safe drawing. Keep only
      // short scientific labels, never crop a sentence or repeat the title.
      if (
        layer !== 'layer-fx' ||
        labels >= 2 ||
        text.length > 28 ||
        !/^\p{L}[\p{L}\p{M}\p{N}’'-]*(?: \p{L}[\p{L}\p{M}\p{N}’'-]*)?$/u.test(text) ||
        [editorial?.title, editorial?.narration].some(
          (t) => t?.trim().toLocaleLowerCase('tr') === text.toLocaleLowerCase('tr'),
        )
      ) {
        stack.at(-1)!.children.pop();
        return;
      }
      labels++;
      n.text = text;
    }
    if (stack.length === 1 && n.tag === 'g') layer = undefined;
  });
  p.write(xml).close();
  if (!root) return bad('Boş SVG.');
  const defs = root.children.filter((n) => n.tag === 'defs').flatMap((n) => n.children);
  if (defs.length > 32) bad('Gradyan sayısı sınır dışında.');
  for (const ref of refs)
    if (!defs.some((g) => g.attrs.id === ref)) bad('Kullanılan gradyan tanımsız.');
  if (layers.some((id) => !root!.children.some((n) => n.tag === 'g' && n.attrs.id === id)))
    bad('layer-bg, layer-main ve layer-fx grupları gerekli.');
  const drawing: Drawing = {
    defs,
    layers: Object.fromEntries(
      layers.map((l) => [l, root!.children.find((n) => n.tag === 'g' && n.attrs.id === l)!]),
    ) as Record<Layer, Geometry>,
  };
  const document: Geometry = {
    tag: 'svg',
    attrs: { xmlns: ns, viewBox: '0 0 1080 1350' },
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
      before = bg.children.length;
    if (!counts['layer-bg'])
      bg.children.push({
        tag: 'rect',
        attrs: { width: '1080', height: '1350', fill: '#192738' },
        children: [],
      });
    bg.children.push({
      tag: 'path',
      attrs: {
        d: 'M0 260 Q320 140 620 240 T1080 198 V230 Q859 296 604 270 T0 294Z M0 1050 Q356 921 637 1012 T1080 970 V985 Q884 1085 624 1027 T0 1070Z',
        fill: '#fff2d6',
        opacity: '.12',
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
