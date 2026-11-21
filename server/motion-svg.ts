import type { Geometry } from '../shared/vector';
import { parseGeometry, serialize, InvalidDrawing, MAX_XML } from './layered-svg';
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
export function parseRig(xml: string, subject = '') {
  const { root, defs, cleanup } = parseGeometry(xml, 'rig'),
    main = defs.find((n) => ['g', 'symbol'].includes(n.tag) && n.attrs.id === 'subject-main');
  if (!main) return fail('defs içinde tek, bütünleşik subject-main gerekli.');
  const parts = descend(main);
  if (
    !parts.some((n) => n.tag === 'path' && n.attrs.d) ||
    parts.filter((n) => n.tag !== 'g').length < 2
  )
    fail('Özneyi birleşik bir dış kontur ve ona bağlı anatomik ayrıntılarla çiz.');
  if (main.attrs['data-anim'])
    fail('Öznenin tamamını şablonda değil sahnedeki örneklerde hareket ettir.');
  const named = (id: string) => parts.some((v) => v.attrs.id === id);
  const name = subject.toLocaleLowerCase('tr');
  if (/karınca|\bants?\b/u.test(name)) {
    const legs = parts.filter((n) => n.attrs.id?.startsWith('leg-')),
      antennae = parts.filter((n) => n.attrs.id?.startsWith('antenna-'));
    if (
      !['head', 'thorax', 'abdomen'].every(named) ||
      legs.length !== 6 ||
      antennae.length !== 2 ||
      !antennae.every((n) =>
        descend(n).some(
          (c) => c.attrs['data-anim'] === 'wiggle' || c.attrs['data-anim'] === 'swing',
        ),
      )
    )
      fail(
        'Karınca şablonunda head, thorax, abdomen, altı leg-* ve mafsalında salınan iki antenna-* gerekli.',
      );
  }
  if (/balina|whale/u.test(name) && !['body', 'tail', 'flipper'].every(named))
    fail('Balinanın body, tail ve flipper parçalarını bağlı bir siluet olarak çiz.');
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
export function parseStage(xml: string, rig: Geometry) {
  const { root, cleanup: baseCleanup } = parseGeometry(xml, 'objects'),
    [bx, by, bw, bh] = root.attrs.viewBox.split(' ').map(Number),
    [rx, ry, rw, rh] = rig.attrs.viewBox.split(' ').map(Number);
  const motions = new Set<Geometry>(),
    actors = new Set<Geometry>(),
    positions = new Set<string>();
  let instances = 0,
    continuous = false,
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
        descend(n).filter((x) => x.tag === 'use').length > 1 ||
        descend(n).some(
          (x) =>
            ['set', 'background', 'layer-bg'].includes(x.attrs.id) ||
            (x.tag === 'rect' &&
              (x.attrs.width === '100%' || parseFloat(x.attrs.width ?? '0') >= bw) &&
              (x.attrs.height === '100%' || parseFloat(x.attrs.height ?? '0') >= bh)),
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
    if (n.tag === 'use') {
      instances++;
      if (owner) {
        const x = Number(a.x ?? 0),
          y = Number(a.y ?? 0),
          corners = [
            [rx, ry],
            [rx + rw, ry],
            [rx + rw, ry + rh],
            [rx, ry + rh],
          ].map(([u, v]) => [
            m[0] * (u + x) + m[2] * (v + y) + m[4],
            m[1] * (u + x) + m[3] * (v + y) + m[5],
          ]);
        const xx = corners.map((v) => v[0]),
          yy = corners.map((v) => v[1]);
        const vw = Math.min(bw, (bh * 9) / 16),
          vh = Math.min(bh, (bw * 16) / 9),
          left = bx + (bw - vw) / 2,
          top = by + (bh - vh) / 2;
        // Both actors must occupy a readable area inside the actual, fixed portrait crop.
        if (
          Math.min(Math.max(...xx), left + vw) - Math.max(Math.min(...xx), left) >= vw * 0.035 &&
          Math.min(Math.max(...yy), top + vh) - Math.max(Math.min(...yy), top) >= vh * 0.012
        ) {
          actors.add(owner);
          positions.add(
            `${Math.round(xx.reduce((a, b) => a + b) / 4)},${Math.round(yy.reduce((a, b) => a + b) / 4)}`,
          );
        }
      }
      return;
    }
    for (const c of n.children) walk(c, m, owner, background, a.stroke ?? pen);
  };
  walk(root, I);
  if (instances > 40 || positions.size < 2 || actors.size < 2)
    fail('En az iki farklı konumda bağımsız hareket eden, görünür #subject-main örneği gerekli.');
  if (motions.size < 5 || motions.size > 160)
    fail('Sahnede en az 5 ayrı hareketli nesne olmalı (şablonun iç parçaları sayılmaz).');
  if (
    !continuous &&
    !descend(rig).some(
      (n) => loops.has(n.attrs['data-anim']) && !Number(n.attrs['data-delay'] ?? 0),
    )
  )
    fail('Baştan sona süren bir döngü kullan: fall, rise, pulse, swing veya wiggle.');
  return {
    root,
    actors: instances,
    objects: motions.size,
    canonical: canonical(root, cleanup),
    cleanup,
  };
}
