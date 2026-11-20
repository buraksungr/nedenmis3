/** Original, deliberately art-directed QA display lists. These fixtures replay the text-model
 * contract, NOT production templates or a topic-keyword fallback. One exact rig for the film. */
import fs from 'node:fs';
import lines from './fixtures/ant.json';
export { lines };
export const topic = 'Karıncalar kışın nereye gider?',
  subject = 'Kızıl işçi karınca',
  titles = [
    'Kışın Eşiğinde',
    'Güvenli Derinlikler',
    'Toprağın Yalıtımı',
    'Sakin Koloni',
    'Yuvadan Çıkış',
  ];
export const rigReply = () => ({
  subject,
  svg: fs.readFileSync('tests/fixtures/ant-motion/subject.svg', 'utf8'),
});
const p = (d: string, fill: string, more = '') => `<path d="${d}" fill="${fill}" ${more}/>`,
  stroke = (d: string, c: string, w: number, more = '') =>
    p(
      d,
      'none',
      `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${more}`,
    ),
  circle = (x: number, y: number, r: number, c: string, more = '') =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${more}/>`,
  g = (x: string, b: string) => `<g ${x}>${b}</g>`;
const gradient = (id: string, colors: string[]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2=".18" y2="1">${colors.map((c, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// Some featured stones have faceted faces and mineral inclusions. Two near the margins in
// each scene stay completely unobstructed; use the actual edges, not an artificial fiducial.
function stone(x: number, y: number, k: number, col = ['#536676', '#839790', '#344655']) {
  return g(
    `transform="translate(${x} ${y}) scale(${k})"`,
    p('M-42 14 L-29 -15 -6 -28 22 -20 43 9 23 20 -20 22Z', col[0]) +
      p('M-29 -15 L-6 -28 20 -20 0 -8 -18 -3Z', col[1]) +
      p('M0 -8 L20 -20 43 9 22 18 12 6Z', col[2]) +
      stroke('M-22 11 L-13 5 -7 6 2 0', col[1], 3),
  );
}
const lichen = (x: number, y: number, k: number, c: string) =>
  g(
    `transform="translate(${x} ${y}) scale(${k})"`,
    stroke(
      'M0 4 Q-7 -28 -22 -45 M-12 -25 Q-26 -29 -31 -38 M-18 -36 Q-16 -49 -19 -57 M-2 -9 Q13 -20 22 -42 M15 -28 Q24 -27 34 -37',
      c,
      3.4,
    ),
  );
function pine(x: number, y: number, k: number, c: string) {
  return g(
    `transform="translate(${x} ${y}) scale(${k})"`,
    p(
      'M-7 3 L-4 -37 -34 -32 -15 -58 -30 -52 -10 -85 -22 -82 0 -127 22 -82 11 -84 29 -53 16 -58 37 -30 5 -36 6 3Z',
      c,
    ),
  );
}
function actor(
  id: string,
  x: number,
  y: number,
  size: number,
  angle: number,
  dx: number,
  dy: number,
  duration: number,
  delay = 0,
) {
  return g(
    `transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"`,
    `<use id="${id}" href="#subject-main" data-anim="move" data-dx="${dx}" data-dy="${dy}" data-duration="${duration}" data-delay="${delay}"/>`,
  );
}
function flake(i: number, x: number, y: number, scale: number) {
  return g(
    `transform="translate(${x} ${y}) scale(${scale})"`,
    g(
      `id="snow-${i}" data-anim="fall" data-dx="38" data-dy="225" data-duration="${2.1 + (i % 4) * 0.41}" data-phase="${(i * 0.217) % 1}"`,
      stroke(
        'M0 -16 V16 M-14 -8 L14 8 M-14 8 L14 -8 M-4 -12 L0 -9 4 -12 M-4 12 L0 9 4 12 M-12 -4 L-8 -5 -9 -10 M9 10 L8 5 13 4',
        '#e4f6e9',
        2.8,
      ),
    ),
  );
}
const snow = Array.from({ length: 19 }, (_, i) =>
  flake(i, 30 + ((i * 197) % 1010), 302 + ((i * 97) % 456), 0.47 + (i % 4) * 0.22),
).join('');
function route(id: string, d: string, w = 8, c = '#efb47b', duration = 4.7) {
  return stroke(d, c, w, `id="${id}" data-anim="draw" data-duration="${duration}"`);
}
function heat(i: number, x: number, y: number, r: number) {
  return circle(
    x,
    y,
    r,
    'none',
    `id="heat-${i}" stroke="#ffbe75" stroke-width="${6 + (i % 3)}" data-anim="pulse" data-phase="${(i * 0.27) % 1}" data-duration="3.2"`,
  );
}
function mineral(seed: number) {
  return Array.from({ length: 66 }, (_, i) => {
    const x = (73 * i + seed * 17) % 1075,
      y = 460 + ((97 * i + seed * 91) % 1150);
    return i % 3 === 0
      ? stroke(`M${x} ${y} l12 -3 8 1`, '#b98262', 2.7, 'opacity=".5"')
      : circle(x, y, 1.8 + (i % 3), '#bf9175', 'opacity=".48"');
  }).join('');
}
const rockRamp = ['#775a52', '#b99076', '#493d46'];
function soil(seed: number, level: number) {
  return (
    p(
      `M-20 ${level} Q240 ${level - 54} 506 ${level + 24} T1100 ${level - 13} V1950 H-20Z`,
      'url(#earth)',
    ) +
    p('M-10 1320 Q240 1185 510 1355 T1090 1260 V1940 H-10Z', '#413942') +
    p('M-10 1395 Q235 1260 492 1400 T1090 1330 V1381 Q780 1506 490 1445 T-10 1440Z', '#785849') +
    mineral(seed)
  );
}
function winter() {
  const trees = Array.from({ length: 21 }, (_, i) =>
    pine(i * 57 - 38, 688 + ((i * 23) % 67), 1.2 + (i % 6) * 0.24, i % 2 ? '#285061' : '#224452'),
  ).join('');
  return {
    defs:
      gradient('sky', ['#122b40', '#416c79', '#e0cbaa']) +
      gradient('earth', ['#455c5c', '#273f48', '#162c37']),
    set:
      `<rect width="1080" height="1920" fill="url(#sky)"/>` +
      circle(809, 464, 88, '#f1debb') +
      p('M-10 720 Q175 490 338 552 T678 549 Q887 427 1100 570 V850 H-10Z', '#527786') +
      p('M-10 698 Q220 555 421 650 T778 594 Q982 552 1100 617 V885 H-10Z', '#3c626e') +
      trees +
      p('M-10 815 Q256 733 495 854 T1090 913 V1920 H-10Z', 'url(#earth)') +
      p('M-10 800 Q250 722 500 837 T1090 894 V924 Q842 1008 503 868 T-10 838Z', '#c9dede') +
      p('M-20 1005 Q260 929 530 1045 T1100 1064 V1112 Q789 1198 521 1080 T-20 1044Z', '#516967') +
      stroke('M-20 1005 Q260 929 530 1045 T1100 1064', '#bed0bd', 6) +
      stone(75, 1284, 1.18) +
      stone(997, 1194, 0.92) +
      lichen(220, 978, 1, '#acc6ae') +
      lichen(874, 1134, 0.75, '#adbd9f') +
      mineral(17),
    objects:
      snow +
      actor('ant-lead', 102, 855, 1.28, 8, 132, 6, 5) +
      actor('ant-mid', 572, 998, 0.85, 3, 192, 5, 5.6, 0.13) +
      actor('ant-back', -35, 1086, 0.64, -8, 245, 0, 5.1, 0.05) +
      actor('ant-far', 553, 806, 0.55, 8, 204, 0, 5.4, 0.2),
  };
}
const branches = [
  'M-30 531 C210 437 282 674 483 695 S796 714 856 861 761 1092 502 1132 202 1173 95 1325',
  'M851 874 C750 927 535 863 403 925 S280 1057 189 1078',
];
function tunnel(revised: boolean) {
  const [a, b] = branches;
  return {
    defs: gradient('earth', ['#9b775b', '#57464a', '#27313e']),
    set:
      `<rect width="1080" height="1920" fill="#476778"/>` +
      soil(21, 340) +
      p('M-10 322 Q270 272 511 344 T1090 312 V345 Q835 410 498 372 T-10 351Z', '#d0dfd2') +
      stroke(a, '#b3876b', 200) +
      stroke(a, '#293740', 177) +
      stroke(b, '#926c59', 124) +
      stroke(b, '#303841', 105) +
      stone(78, 768, 0.96, rockRamp) +
      stone(994, 1220, 1.22, rockRamp) +
      lichen(889, 333, 0.8, '#cedac2'),
    objects:
      route(
        'trace-main',
        'M10 566 C201 496 295 725 485 742 S807 749 813 868 720 1051 494 1082',
        7,
        '#db9870',
        5.5,
      ) +
      route(
        'trace-branch',
        'M937 862 C732 1011 550 908 434 964 S300 1090 207 1116',
        6,
        '#ddb389',
        3.8,
      ) +
      actor('ant-lead', 90, 443, revised ? 1.21 : 1.01, 31, 140, 0, 4.7) +
      actor('ant-mid', 493, 652, 0.76, 8, 201, -8, 4.8, 0.15) +
      actor('ant-back', 653, 931, 0.63, 165, 205, 20, 5.1, 0.14) +
      actor('ant-low', 251, 1237, 0.71, -20, 214, 0, 5) +
      actor('ant-fork', 362, 935, 0.53, -13, 169, 0, 5.3) +
      g(
        'transform="translate(828 1232)"',
        g('id="mote" data-anim="rise" data-dy="110"', circle(0, 0, 6, '#e1a77d')),
      ),
  };
}
function shelter() {
  const nest =
    'M241 923 Q246 806 407 795 C523 788 619 809 737 782 Q841 761 917 838 955 885 921 958 884 1042 718 1049 L464 1077 Q270 1099 241 923Z';
  return {
    defs:
      gradient('sky', ['#213d55', '#54798a']) +
      gradient('earth', ['#896d59', '#5b4948', '#353440']),
    set:
      `<rect width="1080" height="1920" fill="url(#sky)"/>` +
      pine(847, 466, 1.26, '#365364') +
      pine(248, 444, 1.01, '#365364') +
      soil(37, 466) +
      stroke('M-20 471 Q244 421 513 490 T1100 458', '#dce8dd', 21) +
      stroke('M105 452 C70 625 357 595 364 745 L407 860', '#ae8166', 85) +
      stroke('M105 452 C70 625 357 595 364 745 L407 860', '#343b43', 68) +
      p(nest, '#263b43', 'stroke="#b58870" stroke-width="12"') +
      stone(80, 1120, 1.18, rockRamp) +
      stone(993, 717, 0.99, rockRamp),
    objects:
      [heat(0, 601, 920, 103), heat(1, 601, 920, 150), heat(2, 601, 920, 239)].join('') +
      actor('ant-lead', 356, 843, 1.04, 4, 42, 5, 6.5) +
      actor('ant-mid', 666, 855, 0.85, -2, -79, 12, 6.7) +
      actor('ant-back', 244, 967, 0.65, -5, 152, 0, 6.7) +
      actor('ant-far', 682, 1002, 0.48, 0, -142, 0, 5.6) +
      route('trace', 'M78 491 C90 625 342 607 341 753', 5, '#c49479', 4.8),
  };
}
function chamber() {
  const hollow =
    'M-20 802 Q90 624 271 676 C448 710 505 614 699 633 Q921 606 1100 783 L1100 1154 Q921 1280 700 1193 C501 1123 399 1268 161 1215 Q46 1193 -20 1159Z';
  return {
    defs:
      gradient('earth', ['#5a4548', '#986b54', '#443840']) +
      gradient('hollow', ['#24383e', '#34464b', '#23353f']),
    set:
      `<rect width="1080" height="1920" fill="url(#earth)"/>` +
      mineral(63) +
      p(hollow, 'url(#hollow)', 'stroke="#b48366" stroke-width="14"') +
      stroke('M-12 786 Q111 586 275 643 T624 610 Q918 552 1090 735', '#76584d', 13) +
      stone(72, 533, 1.03, rockRamp) +
      stone(997, 1272, 1.13, rockRamp) +
      lichen(838, 1186, 0.72, '#8b806a'),
    objects:
      heat(0, 576, 931, 141) +
      heat(1, 576, 931, 207) +
      actor('ant-queen', 299, 785, 1.69, 3, 12, 0, 6.6) +
      actor('ant-mid', 36, 997, 0.86, -6, 138, -2, 6.5) +
      actor('ant-back', 696, 1023, 0.89, 4, -110, 2, 6.8) +
      actor('ant-far', 634, 727, 0.59, -6, -83, 16, 5.6) +
      actor('ant-low', 338, 1061, 0.65, 7, 92, 0, 6.3) +
      g(
        'transform="translate(851 944)"',
        g('id="mote" data-anim="rise" data-dy="109"', circle(0, 0, 5, '#ebb28a')),
      ),
  };
}
function leaf(x: number, y: number, k: number, col: string, i: number) {
  return g(
    `transform="translate(${x} ${y}) scale(${k})"`,
    g(
      `id="leaf-${i}" data-anim="pop" data-delay="${i * 0.28}" data-duration="1.35"`,
      p('M0 1 Q-73 -4 -83 -70 Q-28 -66 0 1Z', col) + stroke('M0 0 Q-37 -28 -67 -55', '#bfd38b', 3),
    ),
  );
}
function springField() {
  return {
    defs:
      gradient('sky', ['#284b60', '#75948a', '#e8ce8b']) +
      gradient('earth', ['#75815e', '#41594e', '#233e40']),
    set:
      `<rect width="1080" height="1920" fill="url(#sky)"/>` +
      circle(810, 450, 98, '#fbe0a3') +
      p('M-20 730 Q234 487 479 609 T867 584 Q1029 548 1100 616 V830 H-20Z', '#698b83') +
      p('M-20 780 Q168 642 432 714 T780 697 Q950 615 1100 666 V932 H-20Z', '#496e65') +
      p('M-20 1002 Q203 817 483 944 T1090 843 V1960 H-20Z', 'url(#earth)') +
      p('M63 1055 Q114 980 190 975 Q264 965 308 1021 Q242 1044 207 1069Z', '#253f40') +
      stroke('M-30 1100 Q211 956 473 1068 T1100 980', '#b3b184', 12) +
      stroke('M794 875 Q836 754 801 627 M813 821 Q905 771 928 703', '#7e9a6e', 14) +
      stone(77, 1214, 1.15, ['#74866d', '#b1bc8e', '#536d60']) +
      stone(998, 1270, 1.06) +
      lichen(92, 938, 1.5, '#9cb184') +
      lichen(697, 1270, 1.4, '#819c79'),
    objects:
      leaf(818, 794, 0.82, '#b3c77a', 0) +
      leaf(811, 710, 0.63, '#bcd38a', 1) +
      leaf(904, 750, 0.61, '#ccce80', 2) +
      actor('ant-lead', 166, 863, 1.32, -7, 169, 0, 5.4) +
      actor('ant-mid', 523, 1027, 0.94, -8, 156, 0, 5.3, 0.13) +
      actor('ant-back', 27, 1070, 0.66, 2, 190, 0, 5.9) +
      actor('ant-far', 733, 850, 0.58, -8, 131, 0, 5.6) +
      Array.from({ length: 10 }, (_, i) =>
        g(
          `transform="translate(${45 + ((i * 157) % 992)} ${588 + ((i * 67) % 408)})"`,
          g(
            `id="pollen-${i}" data-anim="rise" data-phase="${i / 11}" data-dy="142" data-dx="28" data-duration="2.9"`,
            circle(0, 0, 3.8 + (i % 3), '#f2dda4'),
          ),
        ),
      ).join(''),
  };
}
export function stageReply(i = 0, revised = false) {
  const s = [winter, () => tunnel(revised), shelter, chamber, springField][i % 5]();
  return {
    title: titles[i % 5],
    svg: `<svg viewBox="0 0 1080 1920"><defs>${s.defs}</defs><g id="set">${s.set}</g>${s.objects}</svg>`,
  };
}
export const landmarks = [
  [
    [75, 1284],
    [997, 1194],
  ],
  [
    [78, 768],
    [994, 1220],
  ],
  [
    [80, 1120],
    [993, 717],
  ],
  [
    [72, 533],
    [997, 1272],
  ],
  [
    [77, 1214],
    [998, 1270],
  ],
];
