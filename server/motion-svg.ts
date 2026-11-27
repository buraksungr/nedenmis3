import { SVGPathData } from 'svg-pathdata';
import { layers, type Geometry } from '../shared/vector';
import { parseGeometry, serialize, InvalidDrawing, MAX_XML, healXml } from './layered-svg';
import { I, MAX_MOVE_PIXELS, matrix, mul, type Matrix } from './svg-transform';
import { validateVisualQuality } from './svg-quality';
const fail = (s: string): never => {
  throw new InvalidDrawing(s);
};
const descend = (n: Geometry): Geometry[] => [n, ...n.children.flatMap(descend)];
function canonical(root: Geometry, cleanup = '') {
  const result = serialize({
    ...root,
    attrs: {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: root.attrs.viewBox,
      ...(cleanup ? { 'x-nedenmis-clean': cleanup } : {}),
    },
  });
  if (Buffer.byteLength(result) > MAX_XML) fail('SVG çok büyük.');
  return result;
}
export function parseSubjectRig(xml: string) {
  const { root, cleanup } = parseGeometry(xml, 'rig'),
    parts = descend(root);
  if (!parts.some((n) => n.tag === 'path' && n.attrs.d))
    fail('İllüstrasyon için en az bir dış kontur (path) gerekli.');
  if (parts.filter((n) => n.tag !== 'g').length < 2)
    fail('İllüstrasyon için bağlı ayrıntılarla çizilmeli.');
  if (root.attrs['data-anim'])
    fail('İllüstrasyonun tamamı hareket etmemeli; hareket yalnız sahne öğelerine ait olmalı.');
  return { root, canonical: canonical(root, cleanup) };
}
// Track placement without a browser; the SVG renderer remains the source of pixels.
// New model responses must contain a real, multi-part illustration. This is
// deliberately separate from parseStage: previously signed scenes must remain
// readable even when they predate the current art-direction contract.
export function validateNewStage(
  root: Geometry,
  context: { topic?: string; narration?: string } = {},
) {
  const groups = layers.map((id) => root.children.find((n) => n.tag === 'g' && n.attrs.id === id));
  if (groups.some((n) => !n))
    fail('Yeni çizimde kökte layer-bg, layer-main ve layer-fx grupları gerekli.');
  type Paint = {
    fill: string;
    stroke: string;
    fillOpacity: number;
    strokeOpacity: number;
    strokeWidth: number;
  };
  const visiblePaint = (value: string) =>
    !/^(?:none|transparent|#[0-9a-f]{3}0|#[0-9a-f]{6}00)$/i.test(value);
  const count = (n: Geometry, inherited: Paint, parent: Matrix): number => {
    // Definitions are not rendered here, nor is a hidden or collapsed group.
    if (n.tag === 'defs' || Number(n.attrs.opacity ?? 1) <= 0) return 0;
    const m = mul(parent, matrix(n.attrs.transform));
    if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 0.000001) return 0;
    const paint: Paint = {
      fill: n.attrs.fill ?? inherited.fill,
      stroke: n.attrs.stroke ?? inherited.stroke,
      fillOpacity: Number(n.attrs['fill-opacity'] ?? inherited.fillOpacity),
      strokeOpacity: Number(n.attrs['stroke-opacity'] ?? inherited.strokeOpacity),
      strokeWidth: parseFloat(n.attrs['stroke-width'] ?? String(inherited.strokeWidth)),
    };
    let own = 0;
    if (n.tag === 'path' && n.attrs.d) {
      const ink =
        (visiblePaint(paint.fill) && paint.fillOpacity > 0) ||
        (visiblePaint(paint.stroke) && paint.strokeOpacity > 0 && paint.strokeWidth > 0);
      if (ink) {
        // A lone move or zero-length path cannot stand in for a drawn detail.
        const bounds = new SVGPathData(n.attrs.d).getBounds();
        if (
          Number.isFinite(bounds.minX) &&
          Number.isFinite(bounds.minY) &&
          (bounds.maxX - bounds.minX > 0 || bounds.maxY - bounds.minY > 0)
        )
          own = 1;
      }
    }
    return own + n.children.reduce((sum, child) => sum + count(child, paint, m), 0);
  };
  const paths = count(
    groups[1]!,
    { fill: 'black', stroke: 'none', fillOpacity: 1, strokeOpacity: 1, strokeWidth: 1 },
    I,
  );
  if (paths < 3)
    fail(
      'layer-main içinde en az 3 görünür, anlamlı <path> gerekli; yalnız ilkel şekiller veya boş yollar yeterli değil.',
    );
  validateVisualQuality(root, context);
  // Limit new movement in OUTPUT pixels, after ancestor scale/rotation and viewBox
  // fitting. This catches large excursions without reinterpreting signed archives.
  // Geometry alone cannot prove that a path stays inside a semantic tunnel: the
  // planner must still place both endpoints inside its particular chamber.
  const [, , width, height] = root.attrs.viewBox.split(' ').map(Number),
    fit = Math.max(1080 / width, 1920 / height),
    words = `${context.topic ?? ''} ${context.narration ?? ''}`
      .toLocaleLowerCase('tr')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replaceAll('ı', 'i'),
    anatomicalScene =
      /\b(?:goz(?!lem|lemevi|den)\w*|gorme\w*|iris\w*|pupil\w*|retina\w*|kornea\w*|mercek\w*|kalp\w*|kalb(?:i|e)\w*|akciger\w*|bobrek\w*|karaciger\w*|beyin\w*|mide\w*|bagirsak\w*|dalak\w*|pankreas\w*|organ(?:lar|lari|in|i|da|dan|s)?|eyes?|eyeball|optic\w*|heart|kidneys?|lungs?|brain|stomach|liver|spleen|pancreas|intestines?)\b/i.test(
        words,
      );
  const fixedNames = new Set([
    'pupil',
    'pupila',
    'gozbebegi',
    'iris',
    'retina',
    'sclera',
    'sklera',
    'cornea',
    'kornea',
    'lens',
    'mercek',
    'heart',
    'kalp',
    'lung',
    'lungs',
    'akciger',
    'kidney',
    'kidneys',
    'bobrek',
    'liver',
    'karaciger',
    'brain',
    'beyin',
    'stomach',
    'mide',
    'intestine',
    'bagirsak',
    'spleen',
    'dalak',
    'pancreas',
    'pankreas',
    'organ',
    'organs',
  ]);
  const namedFixedPart = (id = '') => {
    const normalized = id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      parts = normalized.split(/[-_]+/);
    return (
      parts.some((part) => fixedNames.has(part.replace(/\d+$/, ''))) ||
      /(?:^|[-_])goz[-_]?bebegi(?:$|[-_0-9])/.test(normalized)
    );
  };
  const checkMovement = (
    n: Geometry,
    parent: Matrix,
    ancestorDistance = 0,
    main = false,
    fixed = false,
  ) => {
    if (n.tag === 'defs') {
      // A definition may be instantiated at many scales; its local displacement
      // cannot be bounded without every <use> context. Animate the instance instead.
      if (descend(n).some((part) => ['move', 'sway', 'orbit'].includes(part.attrs['data-anim'])))
        fail('defs içindeki nesnelere move verme; hareketi sahnedeki nesneye uygula.');
      return;
    }
    const m = mul(parent, matrix(n.attrs.transform));
    main ||= n.attrs.id === 'layer-main';
    fixed ||= namedFixedPart(n.attrs.id);
    let total = ancestorDistance;
    if (n.attrs['data-anim'] === 'orbit') {
      if (fixed || (main && anatomicalScene))
        fail('Organlar yörüngede hareket edemez; anatomiyi merkezde tut.');
      const rx = Number(n.attrs['data-dx'] ?? 0),
        ry = Number(n.attrs['data-dy'] ?? 0),
        ax = m[0] * rx * fit,
        ay = m[1] * rx * fit,
        bx = m[2] * ry * fit,
        by = m[3] * ry * fit,
        a = ax * ax + ay * ay,
        b = bx * bx + by * by,
        cross = ax * bx + ay * by,
        radius = Math.sqrt((a + b + Math.sqrt((a - b) ** 2 + 4 * cross ** 2)) / 2);
      if (!radius || radius + total > 400.001)
        fail('Yörünge yarıçapı dönüşümler dahil en fazla 400 çıktı pikseli olmalı.');
      total += radius;
    }
    if (['move', 'sway'].includes(n.attrs['data-anim'])) {
      // Semantic inference from arbitrary paths is impossible. New anatomical
      // shots therefore keep layer-main anchored even when a model omits an ID;
      // separately named organs remain protected anywhere in the stage.
      if (fixed || (main && anatomicalScene))
        fail(
          'Göz bebeği, iris ve organlar bağımsız move alamaz; anatomiyi sabit tut, merkezli dilate/pulse kullan ve akışı layer-fx içine taşı.',
        );
      const dx = Number(n.attrs['data-dx'] ?? 0),
        dy = Number(n.attrs['data-dy'] ?? 0);
      // Nested animations can add together even when each local dx/dy is small.
      total += Math.hypot(m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy) * fit;
      if (total > MAX_MOVE_PIXELS + 0.001)
        fail(
          `move yer değiştirmesi çıktı karesinde en fazla ${MAX_MOVE_PIXELS} piksel olmalı; özneyi tünelin içinde tut.`,
        );
    }
    n.children.forEach((child) => checkMovement(child, m, total, main, fixed));
  };
  checkMovement(root, I);
}

const loops = new Set([
  'fall',
  'rise',
  'sway',
  'pulse',
  'heartbeat',
  'dilate',
  'flow',
  'orbit',
  'swing',
  'wiggle',
]);
// Kamera sabitliği kuralı ile çakışan animasyon öznitelikleri; bu öznitelikler
// arka plan / kök / tam-tuval şeklinden sessizce silinir, sahne reddedilmez.
const animAttrs = [
  'data-anim',
  'data-dx',
  'data-dy',
  'data-delay',
  'data-duration',
  'data-phase',
  'data-amplitude',
  'data-pivot-x',
  'data-pivot-y',
  'data-angle',
];
export function parseStage(
  xml: string,
  _rig?: Geometry,
  editorial?: { title: string; narration: string },
) {
  const { root, cleanup: baseCleanup } = parseGeometry(xml, 'objects', editorial),
    [, , bw, bh] = root.attrs.viewBox.split(' ').map(Number);
  const motions = new Set<Geometry>();
  // Stroke properties inherit through groups; opacity multiplies instead. A
  // flow animation must have at least one actually painted drawable child.
  type Pen = { color?: string; width: number; strokeOpacity: number; opacity: number };
  const fraction = (v: string | undefined, fallback: number) =>
    v === undefined ? fallback : parseFloat(v) / (v.endsWith('%') ? 100 : 1);
  const inheritPen = (n: Geometry, parent: Pen): Pen => ({
    color: n.attrs.stroke ?? parent.color,
    width:
      n.attrs['stroke-width'] === undefined ? parent.width : parseFloat(n.attrs['stroke-width']),
    strokeOpacity: fraction(n.attrs['stroke-opacity'], parent.strokeOpacity),
    opacity: parent.opacity * fraction(n.attrs.opacity, 1),
  });
  const flowStroke = (n: Geometry, parent: Pen): boolean => {
    const p = inheritPen(n, parent);
    if (p.opacity <= 0 || n.tag === 'defs') return false;
    if (n.tag === 'g') return n.children.some((child) => flowStroke(child, p));
    return (
      ['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse'].includes(n.tag) &&
      !!p.color &&
      !/^(?:none|transparent|#[0-9a-f]{3}0|#[0-9a-f]{6}00)$/i.test(p.color) &&
      p.width > 0 &&
      p.strokeOpacity > 0
    );
  };
  let continuous = false,
    cleanup = baseCleanup;
  const note = (why: string) => {
    cleanup = cleanup ? `${cleanup}; ${why}` : why;
  };
  const walk = (
    n: Geometry,
    m: Matrix,
    owner?: Geometry,
    background = false,
    pen: Pen = { width: 1, strokeOpacity: 1, opacity: 1 },
  ): void => {
    const a = n.attrs,
      kind = a['data-anim'];
    if (n.tag === 'defs' || Number(a.opacity ?? 1) === 0) return;
    m = mul(m, matrix(a.transform));
    if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 0.000001) return;
    background ||= ['set', 'background', 'layer-bg'].includes(a.id);
    if (kind) {
      const selfBg =
        n.tag === 'svg' ||
        ['set', 'background', 'layer-bg'].includes(a.id) ||
        (n.tag === 'rect' &&
          (a.width === '100%' || parseFloat(a.width ?? '0') >= bw) &&
          (a.height === '100%' || parseFloat(a.height ?? '0') >= bh));
      if (selfBg) {
        // Arka plan, kök veya tam tuval şekli hareket etmez: animasyonu
        // sessizce kaldır ve sabit tut; geriye kalan nesneler hareket edebilir.
        for (const k of animAttrs) delete a[k];
        note(
          `${n.tag}${a.id ? '#' + a.id : ''} içindeki data-anim arka plan sabitliği için temizlendi`,
        );
      } else if (
        descend(n).some(
          (x) =>
            ['set', 'background', 'layer-bg'].includes(x.attrs.id) ||
            (x.tag === 'rect' &&
              (a.width === '100%' || parseFloat(a.width ?? '0') >= bw) &&
              (a.height === '100%' || parseFloat(a.height ?? '0') >= bh)),
        )
      )
        fail('Kamera ve tam tuval dekoru sabit kalmalı.');
      else {
        if (
          ['move', 'sway'].includes(kind) &&
          Math.hypot(+(a['data-dx'] ?? 0), +(a['data-dy'] ?? 0)) < 2
        )
          fail('move için belirgin bir dx veya dy ver.');
        if (kind === 'draw') {
          // Preserve the v1 archive validator's original draw behavior.
          const visibleStroke = (e: Geometry, inherited: string | undefined): boolean => {
            const ink = e.attrs.stroke ?? inherited;
            return e.tag === 'g'
              ? e.children.some((c) => visibleStroke(c, ink))
              : !!ink &&
                  ink !== 'none' &&
                  ink !== 'transparent' &&
                  Number(e.attrs['stroke-width'] ?? 1) > 0;
          };
          if (!visibleStroke(n, pen.color))
            fail('draw için görünür stroke ve bir çizgi/yol gerekli.');
        }
        if (kind === 'flow' && !flowStroke(n, pen))
          fail('flow için görünür stroke ve bir çizgi/yol gerekli.');
        if (descend(n).some((x) => x.tag !== 'g')) {
          motions.add(n);
          owner = n;
          if (loops.has(kind) && !Number(a['data-delay'] ?? 0)) continuous = true;
        }
      }
    }
    const inherited = inheritPen(n, pen);
    for (const c of n.children) walk(c, m, owner, background, inherited);
  };
  walk(root, I);
  if (motions.size < 3 || motions.size > 160) fail('Sahnede en az 3 ayrı hareketli nesne olmalı.');
  if (!continuous)
    fail('Baştan sona süren bir döngü kullan: fall, rise, pulse, dilate, flow, swing veya wiggle.');
  return {
    root,
    actors: motions.size,
    objects: motions.size,
    canonical: canonical(root, cleanup),
    cleanup,
  };
}

/** Toleranslı yedek ayrıştırıcı: parseStage InvalidDrawing fırlatırsa,
 * bozuk SVG'yi mümkün olan kadar temizleyip ikinci denemede parçalı ancak
 * işlenebilir bir sonuç döndürür. Hiçbir şey kurtarılamazsa hatayi yeniden fırlatır. */
export function parseStageTolerant(xml: string) {
  try {
    return parseStage(xml);
  } catch (e) {
    if (!(e instanceof InvalidDrawing)) throw e;
    const healed = healXml(xml);
    let repaired = healed.xml;
    // İkinci deneme: daha agresif temizleme — kalan bozuk etiketleri kaldır
    repaired = repaired.replace(/<[A-Za-z][^>]*>[^<]*<\/\s*[^>]*>/g, ''); // boş/bozuk çift etiketleri sil
    repaired = repaired.replace(/<[^>]*>[^<]*$/g, ''); // kapanmayan son etiketi sil
    try {
      const result = parseStage(repaired);
      return {
        ...result,
        cleanup:
          (result.cleanup ? result.cleanup + '; ' : '') +
          'toleranslı yedek ayrıştırıcı kullanıldı (' +
          healed.repairs.join('; ') +
          ')',
      };
    } catch (e2) {
      throw e; // İlk hatayı fırlat
    }
  }
}
