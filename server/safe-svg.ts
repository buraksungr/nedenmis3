import { SaxesParser } from 'saxes';
/** Rebuild static geometry; never insert provider markup in a document. The same gate
 * is used on download, model output and cache reads. No external resources or CSS. */
export const SVG_LIMIT = 64 * 1024;
const ns = 'http://www.w3.org/2000/svg',
  green = '#9ADBC1',
  cream = '#EDF5EE',
  amber = '#FACC15';
const fail = (): never => {
  throw Error('Güvenli SVG geometrisi doğrulanamadı.');
};
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function scalar(v: string) {
  if (!numeric.test(v) || !Number.isFinite(+v) || Math.abs(+v) > 100000) return fail();
  return String(+v);
}
const list = (s: string) =>
  s
    .trim()
    .split(/[\s,]+/)
    .map(scalar);
function paint(v: string, stroke: boolean) {
  if (v === 'none') return v;
  if ([green, cream, amber, '#112721'].includes(v)) return v;
  if (
    !/^(?:currentColor|transparent|black|white|red|blue|green|yellow|orange|gray|grey|#[a-f\d]{3,4}|#[a-f\d]{6}|#[a-f\d]{8})$/i.test(
      v,
    )
  )
    return fail();
  if (v === 'transparent') return 'none';
  if (/^(?:yellow|orange|red|#f[acf][0-9a-f]{1,4}[0-5][0-9a-f]?)$/i.test(v)) return amber;
  return stroke || /^white|^#fff(?:fff)?$/i.test(v) ? cream : green;
}
const coords = new Set(
  'x y width height cx cy r rx ry x1 x2 y1 y2 stroke-width stroke-miterlimit stroke-dashoffset pathLength'.split(
    ' ',
  ),
);
const shapes = new Set('path circle ellipse line polyline polygon rect'.split(' '));
export function safeSvg(xml: string): string {
  if (!xml.trim() || Buffer.byteLength(xml) > SVG_LIMIT || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    fail();
  const p = new SaxesParser({ xmlns: true });
  const out: string[] = [],
    stack: string[] = [];
  let nodes = 0,
    drawn = 0;
  p.on('error', fail);
  p.on('doctype', fail);
  p.on('processinginstruction', fail);
  p.on('cdata', fail);
  p.on('text', (v) => {
    if (v.trim() && !['title', 'desc'].includes(stack.at(-1) ?? '')) fail();
  });
  p.on('opentag', (tag) => {
    const name = tag.local,
      atRoot = stack.length === 0;
    if (
      ++nodes > 400 ||
      stack.length >= 18 ||
      tag.prefix ||
      (tag.uri && tag.uri !== ns) ||
      (atRoot
        ? name !== 'svg'
        : !['svg', 'g'].includes(stack.at(-1)!) ||
          (!shapes.has(name) && !['title', 'desc', 'g'].includes(name)))
    )
      fail();
    stack.push(name);
    const attr = new Map<string, string>();
    for (const [k, { value: v }] of Object.entries(tag.attributes)) {
      if (
        (k === 'xmlns' && v === ns) ||
        (k === 'xmlns:xlink' && v === 'http://www.w3.org/1999/xlink')
      )
        continue;
      if (
        k === 'id' ||
        k === 'class' ||
        k === 'role' ||
        k.startsWith('aria-') ||
        k.startsWith('data-')
      )
        continue;
      if (k === 'fill' || k === 'stroke' || k === 'color') {
        attr.set(k, paint(v, k === 'stroke'));
        continue;
      }
      if (atRoot && ['width', 'height', 'preserveAspectRatio', 'version'].includes(k)) continue;
      if (k === 'viewBox' && atRoot) {
        const d = list(v);
        if (
          d.length !== 4 ||
          +d[2] <= 0 ||
          +d[3] <= 0 ||
          +d[2] / +d[3] < 0.02 ||
          +d[2] / +d[3] > 50
        )
          fail();
        attr.set(k, d.join(' '));
        continue;
      }
      if (k === 'd' && name === 'path') {
        if (
          !/^[Mm][MmZzLlHhVvCcSsQqTtAaEe0-9.,+\s-]+$/.test(v) ||
          v.length > 48000 ||
          !/[0-9]/.test(v)
        )
          fail();
        const nums = v.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
        if (nums.length > 12000) fail();
        nums.forEach(scalar);
        attr.set(k, v.trim());
        continue;
      }
      if (coords.has(k)) {
        attr.set(k, scalar(v));
        continue;
      }
      if (['opacity', 'fill-opacity', 'stroke-opacity'].includes(k)) {
        const n = scalar(v);
        if (+n < 0 || +n > 1) fail();
        attr.set(k, n);
        continue;
      }
      if (k === 'points' || k === 'stroke-dasharray') {
        attr.set(k, list(v).join(' '));
        continue;
      }
      if (k === 'transform' && v.length <= 256) {
        if (
          !/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\(\s*[-+\.\deE,\s]+\)\s*,?\s*)+$/.test(
            v,
          )
        )
          fail();
        attr.set(k, v);
        continue;
      }
      const enums: Record<string, string[]> = {
        'fill-rule': ['nonzero', 'evenodd'],
        'clip-rule': ['nonzero', 'evenodd'],
        'stroke-linecap': ['round', 'square', 'butt'],
        'stroke-linejoin': ['miter', 'round', 'bevel'],
        'vector-effect': ['non-scaling-stroke'],
      };
      if (Object.hasOwn(enums, k) && enums[k].includes(v)) {
        attr.set(k, v);
        continue;
      }
      fail();
    }
    if (name === 'title' || name === 'desc') return;
    if (atRoot) {
      if (!attr.has('viewBox')) fail();
      attr.set('xmlns', ns);
      if (!attr.has('fill')) attr.set('fill', green);
    }
    if (shapes.has(name)) {
      const hasGeom =
        name === 'path'
          ? attr.has('d')
          : name === 'circle'
            ? +(attr.get('r') ?? 0) > 0
            : name === 'rect'
              ? +(attr.get('width') ?? 0) > 0 && +(attr.get('height') ?? 0) > 0
              : name === 'ellipse'
                ? +(attr.get('rx') ?? 0) > 0 && +(attr.get('ry') ?? 0) > 0
                : name === 'line'
                  ? attr.has('x2') || attr.has('y2')
                  : attr.has('points');
      if (hasGeom) drawn++;
    }
    out.push(
      '<' +
        name +
        [...attr]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => ` ${k}="${v}"`)
          .join('') +
        '>',
    );
  });
  p.on('closetag', () => {
    const name = stack.pop();
    if (name !== 'title' && name !== 'desc') out.push(`</${name}>`);
  });
  p.write(xml).close();
  const result = out.join('');
  if (!drawn || Buffer.byteLength(result) > SVG_LIMIT) fail();
  return result;
}
