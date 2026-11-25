import { SVGPathData } from 'svg-pathdata';
import { layers, type Geometry } from '../shared/vector';
import { parseGeometry, serialize, InvalidDrawing, MAX_XML, healXml } from './layered-svg';
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
// Track placement without a browser; catch co-located clones / invisible transforms without
// a pixel-count or background-complexity gate. The SVG renderer remains the source of pixels.
type Matrix = [number, number, number, number, number, number];
const I: Matrix = [1, 0, 0, 1, 0, 0];
function mul([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix {
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}
function matrix(s = '') {
  let m = I;
  for (const [, name, args] of s.matchAll(/(\w+)\(([^()]*)\)/g)) {
    const n = args
        .trim()
        .split(/[ ,\s]+/)
        .map(Number),
      [a, b = 0, c = 0] = n,
      angle = (a * Math.PI) / 180,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    let t: Matrix;
    if (name === 'matrix') t = n as Matrix;
    else if (name === 'translate') t = [1, 0, 0, 1, a, b];
    else if (name === 'scale') t = [a, 0, 0, n[1] ?? a, 0, 0];
    else if (name === 'rotate')
      t = [cos, sin, -sin, cos, b - b * cos + c * sin, c - b * sin - c * cos];
    else t = name === 'skewX' ? [1, 0, Math.tan(angle), 1, 0, 0] : [1, Math.tan(angle), 0, 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}
// New model responses must contain a real, multi-part illustration. This is
// deliberately separate from parseStage: previously signed scenes must remain
// readable even when they predate the current art-direction contract.
export function validateNewStage(root: Geometry) {
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
}

const loops = new Set(['fall', 'rise', 'pulse', 'swing', 'wiggle']);
// Kamera sabitliği kuralı ile çakışan animasyon öznitelikleri; bu öznitelikler
// arka plan / kök / tam-tuval şeklinden sessizce silinir, sahne reddedilmez.
const animAttrs = [
  'data-anim',
  'data-dx',
  'data-dy',
  'data-delay',
  'data-duration',
  'data-pivot-x',
  'data-pivot-y',
  'data-angle',
];
export function parseStage(xml: string, _rig?: Geometry) {
  const { root, cleanup: baseCleanup } = parseGeometry(xml, 'objects'),
    [, , bw, bh] = root.attrs.viewBox.split(' ').map(Number);
  const motions = new Set<Geometry>();
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
    pen?: string,
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
        if (kind === 'move' && Math.hypot(+(a['data-dx'] ?? 0), +(a['data-dy'] ?? 0)) < 2)
          fail('move için belirgin bir dx veya dy ver.');
        if (kind === 'draw') {
          const visibleStroke = (e: Geometry, inherited: string | undefined): boolean => {
            const ink = e.attrs.stroke ?? inherited;
            return e.tag === 'g'
              ? e.children.some((c) => visibleStroke(c, ink))
              : !!ink &&
                  ink !== 'none' &&
                  ink !== 'transparent' &&
                  Number(e.attrs['stroke-width'] ?? 1) > 0;
          };
          if (!visibleStroke(n, pen)) fail('draw için görünür stroke ve bir çizgi/yol gerekli.');
        }
        if (descend(n).some((x) => x.tag !== 'g')) {
          motions.add(n);
          owner = n;
          if (loops.has(kind) && !Number(a['data-delay'] ?? 0)) continuous = true;
        }
      }
    }
    for (const c of n.children) walk(c, m, owner, background, a.stroke ?? pen);
  };
  walk(root, I);
  if (motions.size < 3 || motions.size > 160) fail('Sahnede en az 3 ayrı hareketli nesne olmalı.');
  if (!continuous)
    fail('Baştan sona süren bir döngü kullan: fall, rise, pulse, swing veya wiggle.');
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
