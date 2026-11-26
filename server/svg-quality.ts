import { SVGPathData } from 'svg-pathdata';
import type { Geometry } from '../shared/vector';
import { InvalidDrawing } from './layered-svg';
import { I, matrix, mul, type Matrix } from './svg-transform';

type Color = { r: number; g: number; b: number; a: number };
type Paint = {
  fill: string;
  stroke: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  opacity: number;
  unstable: boolean;
};
const initial: Paint = {
  fill: 'black',
  stroke: 'none',
  fillOpacity: 1,
  strokeOpacity: 1,
  strokeWidth: 1,
  opacity: 1,
  unstable: false,
};
const fraction = (value: string | undefined, fallback: number) =>
  value === undefined ? fallback : parseFloat(value) / (value.endsWith('%') ? 100 : 1);
const inherit = (n: Geometry, p: Paint): Paint => ({
  fill: n.attrs.fill ?? p.fill,
  stroke: n.attrs.stroke ?? p.stroke,
  fillOpacity: fraction(n.attrs['fill-opacity'], p.fillOpacity),
  strokeOpacity: fraction(n.attrs['stroke-opacity'], p.strokeOpacity),
  strokeWidth: parseFloat(n.attrs['stroke-width'] ?? String(p.strokeWidth)),
  opacity: p.opacity * fraction(n.attrs.opacity, 1),
  // These animations can hide their entire shape at some frame; don't use them
  // to prove that the main subject is visible throughout the shot.
  unstable: p.unstable || ['fall', 'rise', 'pulse', 'pop', 'draw'].includes(n.attrs['data-anim']),
});
const names: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  currentcolor: '#000000',
  transparent: '#00000000',
};
function solid(value: string): Color | undefined {
  let s = (names[value.toLowerCase()] ?? value).toLowerCase();
  if (!/^#[0-9a-f]+$/.test(s)) return undefined;
  s = s.slice(1);
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  if (s.length !== 6 && s.length !== 8) return undefined;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
    a: s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1,
  };
}
const composite = (front: Color, back: Color, opacity = 1): Color => {
  const a = Math.max(0, Math.min(1, front.a * opacity));
  return {
    r: front.r * a + back.r * (1 - a),
    g: front.g * a + back.g * (1 - a),
    b: front.b * a + back.b * (1 - a),
    a: 1,
  };
};
const luminance = ({ r, g, b }: Color) => {
  const linear = (v: number) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
const contrast = (a: Color, b: Color) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
function pathBounds(n: Geometry): Bounds | undefined {
  if (n.tag !== 'path' || !n.attrs.d) return;
  const b = new SVGPathData(n.attrs.d).getBounds();
  return [b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite) ? b : undefined;
}
function mapped(b: Bounds, [a, c, d, e, x, y]: Matrix): Bounds {
  const points = [
    [b.minX, b.minY],
    [b.minX, b.maxY],
    [b.maxX, b.minY],
    [b.maxX, b.maxY],
  ].map(([px, py]) => [a * px + d * py + x, c * px + e * py + y]);
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxY: Math.max(...points.map((p) => p[1])),
  };
}
// Some models use an M/H/V/L/Z path instead of a full-bleed <rect>.
// Only call it a backdrop when four axis-aligned corners are provable.
function rectanglePath(n: Geometry): Bounds | undefined {
  if (n.tag !== 'path' || !/z\s*$/i.test(n.attrs.d ?? '')) return;
  const commands = new SVGPathData(n.attrs.d).toAbs().normalizeHVZ(false, true, true).commands;
  if (
    commands[0]?.type !== SVGPathData.MOVE_TO ||
    commands.at(-1)?.type !== SVGPathData.CLOSE_PATH ||
    commands.slice(1, -1).some((c) => c.type !== SVGPathData.LINE_TO)
  )
    return;
  const points = commands.slice(0, -1).map((c) => c as { x: number; y: number });
  if (points.length === 5 && points[0].x === points[4].x && points[0].y === points[4].y)
    points.pop();
  if (points.length !== 4) return;
  const xs = [...new Set(points.map((p) => p.x))],
    ys = [...new Set(points.map((p) => p.y))];
  if (xs.length !== 2 || ys.length !== 2 || new Set(points.map((p) => `${p.x},${p.y}`)).size !== 4)
    return;
  if (
    points.some((p, i) => {
      const next = points[(i + 1) % points.length];
      return p.x !== next.x && p.y !== next.y;
    })
  )
    return;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
function shapeBounds(n: Geometry): Bounds | undefined {
  const a = n.attrs,
    value = (k: string, fallback = 0) => parseFloat(a[k] ?? String(fallback));
  if (n.tag === 'path') return pathBounds(n);
  if (n.tag === 'rect')
    return {
      minX: value('x'),
      minY: value('y'),
      maxX: value('x') + value('width'),
      maxY: value('y') + value('height'),
    };
  if (n.tag === 'circle' || n.tag === 'ellipse') {
    const x = value('cx'),
      y = value('cy'),
      rx = value(n.tag === 'circle' ? 'r' : 'rx'),
      ry = value(n.tag === 'circle' ? 'r' : 'ry');
    return { minX: x - rx, maxX: x + rx, minY: y - ry, maxY: y + ry };
  }
  return undefined;
}
const curvedCommands = new Set<number>([
  SVGPathData.CURVE_TO,
  SVGPathData.SMOOTH_CURVE_TO,
  SVGPathData.QUAD_TO,
  SVGPathData.SMOOTH_QUAD_TO,
  SVGPathData.ARC,
]);
function primitive(n: Geometry): boolean {
  if (['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(n.tag)) return true;
  if (n.tag !== 'path' || !n.attrs.d) return false;
  const commands = new SVGPathData(n.attrs.d).toAbs().commands;
  const lines = new Set<number>([
    SVGPathData.MOVE_TO,
    SVGPathData.CLOSE_PATH,
    SVGPathData.LINE_TO,
    SVGPathData.HORIZ_LINE_TO,
    SVGPathData.VERT_LINE_TO,
  ]);
  const arcs = new Set<number>([SVGPathData.MOVE_TO, SVGPathData.CLOSE_PATH, SVGPathData.ARC]);
  return (
    commands.every((c) => lines.has(c.type)) ||
    (commands.filter((c) => c.type === SVGPathData.ARC).length <= 2 &&
      commands.some((c) => c.type === SVGPathData.ARC) &&
      commands.every((c) => arcs.has(c.type)))
  );
}

/** Conservative production-only checks. They catch provably dark main artwork and obvious
 * rings/boxes for an eye topic, but cannot certify semantic accuracy or local pixel contrast. */
export function validateVisualQuality(
  root: Geometry,
  context: { topic?: string; narration?: string } = {},
) {
  const all: Geometry[] = [];
  const flatten = (n: Geometry) => {
    all.push(n);
    n.children.forEach(flatten);
  };
  flatten(root);
  const ids = new Map(all.filter((n) => n.attrs.id).map((n) => [n.attrs.id, n]));
  // undefined = cannot safely determine paint; null = deliberately unpainted.
  const resolve = (value: string, seen = new Set<string>()): Color | null | undefined => {
    if (value === 'none') return null;
    const direct = solid(value);
    if (direct) return direct;
    const id = /^url\(#([^)]*)\)$/.exec(value)?.[1];
    if (!id || seen.has(id)) return undefined;
    const node = ids.get(id);
    if (!node) return undefined;
    seen.add(id);
    if (['linearGradient', 'radialGradient'].includes(node.tag)) {
      const stops = node.children
        .filter((n) => n.tag === 'stop')
        .map((n) => {
          const c = solid(n.attrs['stop-color'] ?? 'black');
          return c && { ...c, a: c.a * fraction(n.attrs['stop-opacity'], 1) };
        })
        .filter((c): c is Color => !!c);
      if (!stops.length && node.attrs.href) return resolve(`url(${node.attrs.href})`, seen);
      if (!stops.length) return undefined;
      return {
        r: stops.reduce((s, c) => s + c.r, 0) / stops.length,
        g: stops.reduce((s, c) => s + c.g, 0) / stops.length,
        b: stops.reduce((s, c) => s + c.b, 0) / stops.length,
        a: stops.reduce((s, c) => s + c.a, 0) / stops.length,
      };
    }
    // Patterns and filters are not reducible to a representative solid without rendering.
    return undefined;
  };
  const [, , width, height] = root.attrs.viewBox.split(' ').map(Number),
    [vx, vy] = root.attrs.viewBox.split(' ').map(Number),
    scale = Math.max(1080 / width, 1920 / height),
    safe = {
      minX: vx + (width - 1080 / scale) / 2,
      minY: vy + (height - 1920 / scale) / 2,
      maxX: vx + (width + 1080 / scale) / 2,
      maxY: vy + (height - 1920 / scale) / 2 + 1460 / scale,
    };
  const bg = root.children.find((n) => n.attrs.id === 'layer-bg'),
    main = root.children.find((n) => n.attrs.id === 'layer-main');
  if (!bg || !main) return; // The caller reports missing layers first.
  let backdrop: Color | undefined;
  const background = (n: Geometry, inherited: Paint, parent: Matrix) => {
    if (n.tag === 'defs') return;
    const p = inherit(n, inherited),
      m = mul(parent, matrix(n.attrs.transform));
    if (Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6 && m[0] > 0 && m[3] > 0) {
      const number = (key: string, reference: number, fallback = 0) =>
        n.attrs[key]?.endsWith('%')
          ? (parseFloat(n.attrs[key]) * reference) / 100
          : parseFloat(n.attrs[key] ?? String(fallback));
      const x = number('x', width),
        y = number('y', height),
        w = number('width', width),
        h = number('height', height),
        local =
          n.tag === 'rect' ? { minX: x, minY: y, maxX: x + w, maxY: y + h } : rectanglePath(n),
        b = local && mapped(local, m);
      if (b && b.minX <= vx && b.minY <= vy && b.maxX >= vx + width && b.maxY >= vy + height) {
        const color = resolve(p.fill);
        if (color)
          backdrop = composite(color, backdrop ?? solid('#18231f')!, p.opacity * p.fillOpacity);
        else if (color === undefined) backdrop = undefined;
      }
    }
    n.children.forEach((child) => background(child, p, m));
  };
  background(bg, initial, I);

  const subjects: { node: Geometry; paint: Paint; transform: Matrix }[] = [];
  const walk = (n: Geometry, inherited: Paint, parent: Matrix, seen: Set<string>) => {
    if (n.tag === 'defs' || ['set', 'background', 'layer-bg'].includes(n.attrs.id)) return;
    const p = inherit(n, inherited),
      m = mul(parent, matrix(n.attrs.transform));
    if (p.opacity <= 0 || Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-8) return;
    if (n.tag === 'use') {
      const id = n.attrs.href?.replace(/^#/, ''),
        target = id && ids.get(id);
      if (id && target && !seen.has(id)) {
        const next = new Set(seen);
        next.add(id);
        const offset: Matrix = [
          1,
          0,
          0,
          1,
          parseFloat(n.attrs.x ?? '0'),
          parseFloat(n.attrs.y ?? '0'),
        ];
        walk(target, p, mul(m, offset), next);
      }
      return;
    }
    if (['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(n.tag)) {
      const visiblePaint = (value: string, opacity: number) => {
        if (opacity <= 0) return false;
        const c = resolve(value);
        return c === undefined || (c !== null && c.a > 0);
      };
      const b = shapeBounds(n),
        box = b && mapped(b, m);
      const inFrame =
        !box ||
        !(
          box.maxX < safe.minX ||
          box.minX > safe.maxX ||
          box.maxY < safe.minY ||
          box.minY > safe.maxY
        );
      if (
        inFrame &&
        ((n.tag !== 'line' && visiblePaint(p.fill, p.opacity * p.fillOpacity)) ||
          (p.strokeWidth > 0 && visiblePaint(p.stroke, p.opacity * p.strokeOpacity)))
      )
        subjects.push({ node: n, paint: p, transform: m });
    }
    n.children.forEach((child) => walk(child, p, m, seen));
  };
  walk(main, initial, I, new Set());

  const subjectText = `${context.topic ?? ''} ${context.narration ?? ''}`.toLocaleLowerCase(
    'tr-TR',
  );
  if (
    /(göz|goz|görme|gorme|görüş|gorus|iris|pupil|retina|kornea|mercek|optik|optic|sklera|sclera|fotoresept)/u.test(
      subjectText,
    ) &&
    subjects.length
  ) {
    // A faceted eye can be made from simple shapes plus many real iris fibres
    // or light rays. Do not reject it merely because those details are straight
    // segments; only reject primitive-only art without such visible detail.
    const lineDetails = subjects.reduce((count, { node, paint }) => {
      if (paint.strokeWidth <= 0 || paint.strokeOpacity <= 0 || paint.stroke === 'none')
        return count;
      const c = resolve(paint.stroke);
      if (c === null || (c && c.a <= 0)) return count;
      if (node.tag === 'line' || node.tag === 'polyline') return count + 1;
      if (node.tag !== 'path' || /z\s*$/i.test(node.attrs.d ?? '')) return count;
      return (
        count +
        new SVGPathData(node.attrs.d).commands.filter(
          (command) => (command.type & SVGPathData.DRAWING_COMMANDS) !== 0,
        ).length
      );
    }, 0);
    const allPrimitive = lineDetails < 4 && subjects.every(({ node }) => primitive(node));
    const closed = subjects.map(({ node, transform }) => {
      if (node.tag === 'path' && !/z\s*$/i.test(node.attrs.d ?? '')) return undefined;
      const b = shapeBounds(node);
      return b && mapped(b, transform);
    });
    const boxes = closed.filter((b): b is Bounds => !!b);
    const largest =
      boxes.length && Math.max(...boxes.map((b) => Math.max(b.maxX - b.minX, b.maxY - b.minY)));
    const nestedRings =
      boxes.length >= 3 &&
      boxes.length === subjects.length &&
      !!largest &&
      boxes.every((b) => {
        const w = b.maxX - b.minX,
          h = b.maxY - b.minY,
          center = boxes[0];
        return (
          h > 0 &&
          w / h > 0.7 &&
          w / h < 1.4 &&
          Math.abs((b.minX + b.maxX - center.minX - center.maxX) / 2) < largest * 0.08 &&
          Math.abs((b.minY + b.maxY - center.minY - center.maxY) / 2) < largest * 0.08
        );
      });
    if (allPrimitive || nestedRings)
      throw new InvalidDrawing(
        'Göz/optik sahnesi boş halka veya kutulardan oluşamaz; sklera, göz kapağı, radyal iris lifleri, kornea/mercek kesiti veya retinaya ulaşan ışınlar gibi somut anatomik yapı çiz.',
      );
  }

  if (!backdrop) return; // A complex/unresolved backdrop needs human visual review.
  let contrasted = 0,
    uncertain = 0,
    knownFillArea = 0,
    brightFillArea = 0,
    unknownFillArea = 0;
  for (const { node, paint, transform } of subjects) {
    if (node.tag !== 'path' || paint.unstable) continue;
    const local = pathBounds(node);
    if (!local) continue;
    const b = mapped(local, transform),
      visibleW = Math.max(0, Math.min(b.maxX, safe.maxX) - Math.max(b.minX, safe.minX)) * scale,
      visibleH = Math.max(0, Math.min(b.maxY, safe.maxY) - Math.max(b.minY, safe.minY)) * scale;
    if (
      b.maxX < safe.minX ||
      b.minX > safe.maxX ||
      b.maxY < safe.minY ||
      b.minY > safe.maxY ||
      Math.max(visibleW, visibleH) < 24
    )
      continue;
    const commands = SVGPathData.parse(node.attrs.d),
      segments = commands.filter((c) => (c.type & SVGPathData.DRAWING_COMMANDS) !== 0),
      area = segments.length >= 2 || segments.some((c) => curvedCommands.has(c.type)),
      strokeScale =
        Math.min(Math.hypot(transform[0], transform[1]), Math.hypot(transform[2], transform[3])) *
        scale;
    let best = 0,
      unknown = false;
    for (const [value, opacity, usable, isFill] of [
      [paint.fill, paint.opacity * paint.fillOpacity, area && visibleW > 0 && visibleH > 0, true],
      [
        paint.stroke,
        paint.opacity * paint.strokeOpacity,
        paint.strokeWidth * strokeScale >= 2,
        false,
      ],
    ] as const) {
      if (!usable || opacity <= 0) continue;
      const c = resolve(value),
        weight = visibleW * visibleH;
      if (c === undefined) {
        unknown = true;
        if (isFill) unknownFillArea += weight;
      } else if (c && c.a > 0) {
        const ratio = contrast(composite(c, backdrop, opacity), backdrop);
        best = Math.max(best, ratio);
        if (isFill) {
          knownFillArea += weight;
          if (ratio >= 3) brightFillArea += weight;
        }
      }
    }
    if (best >= 3) contrasted++;
    else if (unknown) uncertain++;
  }
  // Two tiny highlights must not excuse a huge near-black subject on a dark
  // background. Bounding boxes are only a rough proxy for painted area; skip
  // this additional check when unresolved patterns dominate the main layer.
  const mostlyDark =
    luminance(backdrop) < 0.08 &&
    knownFillArea > 10000 &&
    unknownFillArea < knownFillArea &&
    brightFillArea / knownFillArea < 0.05;
  if (contrasted + uncertain < 2 || mostlyDark)
    throw new InvalidDrawing(
      'Görünürlük/kontrast hatası: ana öznenin en az iki kalıcı yolunu arka plandan açıkça ayır (en az 3:1 kontrast); koyu zemin üzerinde koyu gri, kahverengi veya kırmızı yerine orta/açık renk ve net kontur kullan.',
    );
}
