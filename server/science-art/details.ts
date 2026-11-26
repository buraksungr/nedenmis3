import { type ArtContext, p, line, circle, ellipse, rect, group, repeat } from './common';
const ink = '#244a54',
  pale = '#d9f0db',
  warm = '#f4c8a1',
  cool = '#98d9d5';
/** Small, static subject-specific inset details. The caller translates this local
 * artwork above the principal illustration, well clear of the caption region. */
export function details(id: string, c: ArtContext): string {
  switch (id) {
    case 'eye-front':
      return repeat(3, (i) => {
        const x = 330 + i * 210,
          r = 14 + i * 8;
        return (
          circle(x, 1305, 53, '#e4f5e5', `stroke="${ink}" stroke-width="6"`) +
          circle(x, 1305, 41, c.accent) +
          repeat(12, (j) => {
            const a = (j * Math.PI) / 6;
            return line(
              `M${(x + Math.cos(a) * 27).toFixed(1)} ${(1305 + Math.sin(a) * 27).toFixed(1)} L${(x + Math.cos(a) * 39).toFixed(1)} ${(1305 + Math.sin(a) * 39).toFixed(1)}`,
              '#3e9999',
              3,
            );
          }) +
          circle(x, 1305, r, '#173342')
        );
      });
    case 'eye-cross':
      return (
        line('M252 1364 Q540 1390 828 1364', '#eab99f', 10) +
        repeat(9, (i) => {
          const x = 290 + i * 62;
          return (
            p(
              `M${x - 8} 1356 L${x - 10} 1302 Q${x} 1276 ${x + 10} 1302 L${x + 8} 1356Z`,
              i % 2 ? '#f7d5a3' : '#b9e7db',
              `stroke="${ink}" stroke-width="3"`,
            ) +
            line(`M${x} 1357 q${i % 2 ? '-20' : '20'} 21 ${i % 2 ? '-36' : '36'} 19`, '#91c8c4', 3)
          );
        })
      );
    case 'brain':
      return (
        line('M292 1312 Q368 1237 458 1303 T635 1303 T794 1286', cool, 6) +
        line('M333 1350 Q419 1287 497 1345 T700 1349', pale, 5) +
        repeat(11, (i) =>
          circle(
            294 + i * 49,
            1304 + ((i % 3) - 1) * 29,
            8,
            i % 2 ? warm : c.accent,
            `stroke="${ink}" stroke-width="3"`,
          ),
        )
      );
    case 'neuron':
      return (
        p(
          'M264 1277 Q347 1214 424 1272 L428 1323 Q350 1354 264 1305Z',
          '#b2ddd2',
          `stroke="${ink}" stroke-width="6"`,
        ) +
        p(
          'M602 1275 Q678 1215 760 1275 V1311 Q681 1358 604 1322Z',
          '#b2ddd2',
          `stroke="${ink}" stroke-width="6"`,
        ) +
        repeat(5, (i) => circle(315 + i * 19, 1296 + (i % 2) * 13, 7, warm)) +
        line('M447 1299 H585', c.accent, 7, 'stroke-dasharray="9 10"') +
        repeat(3, (i) => circle(630 + i * 34, 1296, 5, '#ffe3ad'))
      );
    case 'heart':
      return (
        p(
          'M249 1282 Q540 1230 831 1282 L831 1320 Q540 1279 249 1320Z',
          '#a9d4c9',
          `stroke="${ink}" stroke-width="6"`,
        ) +
        line('M300 1300 Q420 1281 540 1300 T780 1300', '#f49386', 8) +
        repeat(9, (i) =>
          ellipse(
            301 + i * 60,
            1300 + (i % 2) * 5,
            11,
            6,
            '#f7a59b',
            `stroke="#b96d70" stroke-width="2"`,
          ),
        ) +
        line('M540 1300 Q554 1337 590 1356 M469 1294 Q449 1260 411 1246', pale, 5)
      );
    case 'circulation':
      return (
        line(
          'M232 1268 H400 Q450 1268 480 1305 Q510 1340 540 1340 Q570 1340 600 1305 Q630 1268 680 1268 H849',
          '#f0998b',
          12,
        ) +
        line(
          'M232 1354 H400 Q450 1354 480 1318 Q510 1284 540 1284 Q570 1284 600 1318 Q630 1354 680 1354 H849',
          '#95d7e0',
          12,
        ) +
        repeat(7, (i) => circle(366 + i * 58, 1308 + (i % 2 ? 8 : -8), 6, pale))
      );
    case 'cell':
      return (
        p(
          'M282 1299 C300 1248 377 1233 540 1240 C703 1233 780 1248 798 1299 C780 1350 703 1365 540 1358 C377 1365 300 1350 282 1299Z',
          '#efb28c',
          `stroke="${ink}" stroke-width="7"`,
        ) +
        p(
          'M311 1299 C334 1264 395 1259 540 1265 C685 1259 746 1264 769 1299 C745 1333 685 1339 540 1333 C395 1339 335 1333 311 1299Z',
          'none',
          'stroke="#bc7770" stroke-width="5"',
        ) +
        repeat(9, (i) => line(`M${350 + i * 46} 1274 q-16 24 0 49 q16 -24 0 -49`, '#b26f69', 4))
      );
    case 'dna':
      return (
        line('M272 1252 Q355 1340 438 1252 T604 1252 T770 1252', cool, 9) +
        line('M272 1349 Q355 1260 438 1349 T604 1349 T770 1349', warm, 9) +
        repeat(9, (i) => line(`M${290 + i * 59} 1270 V1330`, i % 2 ? pale : '#f6d7a5', 5))
      );
    case 'lung':
      return (
        line('M540 1225 V1272 M540 1272 L459 1301 M540 1272 L621 1301', '#d7c2b4', 12) +
        repeat(9, (i) => {
          const x = 380 + (i % 3) * 54 + Math.floor(i / 3) * 155,
            y = 1305 + (i % 2) * 25;
          return (
            circle(x, y, 23, '#f3b3a3', `stroke="#aa7073" stroke-width="5"`) +
            circle(x - 6, y - 6, 5, '#ffe5c8')
          );
        })
      );
    case 'muscle-joint':
      return (
        rect(251, 1259, 578, 80, '#df8e81', `rx="25" stroke="${ink}" stroke-width="7"`) +
        repeat(16, (i) => line(`M${275 + i * 34} 1268 V1331`, i % 2 ? '#f3c3a3' : '#bd726e', 5)) +
        line('M271 1299 H805', '#fff0c4', 5)
      );
    case 'soil-colony':
    case 'ant-tunnel':
    case 'colony-chamber':
      return (
        line(
          'M290 1217 Q320 1280 290 1358 M540 1202 Q514 1288 550 1375 M754 1215 Q728 1283 767 1358',
          '#c6aa8b',
          7,
        ) +
        repeat(10, (i) =>
          p(`M${260 + i * 57} ${1337 + (i % 2) * 16} l13 -8 16 5 6 10 -17 6Z`, '#cfb696'),
        )
      );
    case 'atmosphere':
      return (
        repeat(4, (i) =>
          line(
            `M${248 + i * 18} ${1370 - i * 27} Q540 ${1250 - i * 25} ${832 - i * 18} ${1370 - i * 27}`,
            i % 2 ? cool : pale,
            6,
          ),
        ) + circle(540, 1338, 12, warm)
      );
    case 'ocean-depth':
      return (
        repeat(5, (i) =>
          line(`M${260 + i * 114} 1382 q-16 -43 8 -75 q17 28 1 52 q20 -33 31 -20`, '#b8d3a8', 7),
        ) + repeat(8, (i) => circle(284 + i * 64, 1266 + (i % 3) * 18, 4, '#bee9df'))
      );
    case 'water-cycle':
      return (
        p('M242 1267 Q540 1229 838 1267 L838 1364 H242Z', '#bca587') +
        line('M260 1283 Q385 1270 513 1283 T818 1283', '#e4d2ae', 6) +
        line('M262 1321 Q383 1303 514 1321 T817 1321', '#8ed9dc', 8) +
        repeat(9, (i) => circle(283 + i * 64, 1346 + (i % 2) * 7, 5, '#d7c9a6'))
      );
    case 'plant':
      return (
        line(
          'M540 1226 Q531 1308 487 1370 M540 1258 Q567 1321 611 1369 M512 1320 Q469 1312 430 1334 M564 1322 Q601 1311 642 1333',
          warm,
          9,
        ) + repeat(6, (i) => circle(379 + i * 64, 1362 + (i % 2) * 9, 5, '#d3b899'))
      );
    case 'photosynthesis':
      return (
        ellipse(540, 1300, 218, 71, '#6cb386', `stroke="${ink}" stroke-width="7"`) +
        repeat(9, (i) =>
          group(
            '',
            ellipse(385 + i * 38, 1300, 14, 46, '#b7e9ab') +
              line(
                `M${376 + i * 38} 1286 h18 M${376 + i * 38} 1300 h18 M${376 + i * 38} 1314 h18`,
                '#4b9877',
                4,
              ),
          ),
        )
      );
    case 'refraction':
      return (
        // At a horizontal interface the ray crosses into the lower medium and
        // bends toward the normal rather than bouncing off the same side.
        line('M245 1305 H835', '#8bbcc0', 5) +
        line('M300 1228 L540 1305 L650 1384', pale, 7) +
        line('M540 1215 V1395', '#a4c7c6', 4, 'stroke-dasharray="8 9"') +
        p('M499 1292 Q509 1279 523 1273', 'none', `stroke="${c.accent}" stroke-width="5"`) +
        p('M542 1339 Q555 1336 566 1327', 'none', 'stroke="#ffd1a0" stroke-width="5"')
      );
    case 'magnetism':
      return (
        repeat(4, (i) =>
          line(
            `M${280 + i * 35} 1340 C${290 + i * 18} ${1240 - i * 8} ${790 - i * 18} ${1240 - i * 8} ${800 - i * 35} 1340`,
            i % 2 ? cool : pale,
            5,
          ),
        ) +
        circle(300, 1340, 16, '#eeaa98') +
        circle(780, 1340, 16, '#9edbe3')
      );
    case 'electricity':
      return (
        line('M252 1304 H828', pale, 8) +
        repeat(8, (i) =>
          circle(
            302 + i * 68,
            1304,
            12,
            i % 2 ? c.accent : '#ffe0a4',
            `stroke="${ink}" stroke-width="4"`,
          ),
        ) +
        line('M250 1260 H830 M250 1348 H830', '#85b3ad', 3)
      );
    case 'orbit':
      return (
        ellipse(540, 1300, 270, 70, 'none', 'stroke="#a5c9c6" stroke-width="5"') +
        ellipse(540, 1300, 176, 46, 'none', 'stroke="#d4e6d2" stroke-width="5"') +
        circle(540, 1300, 25, '#ffe0a2') +
        circle(300, 1268, 13, '#94d8de') +
        circle(681, 1328, 10, '#f1b49b')
      );
    case 'gravity':
      return (
        repeat(4, (i) =>
          line(
            `M${260 + i * 35} ${1363 - i * 15} Q540 ${1240 - i * 17} ${820 - i * 35} ${1363 - i * 15}`,
            i % 2 ? pale : cool,
            5,
          ),
        ) + circle(540, 1317, 24, '#a5dfb0')
      );
    case 'sound':
      return (
        line(
          'M250 1300 Q280 1248 310 1300 T370 1300 T430 1300 T490 1300 T550 1300 T610 1300 T670 1300 T730 1300 T790 1300 T850 1300',
          c.accent,
          7,
        ) +
        line('M250 1300 H850', '#abcac3', 3) +
        repeat(11, (i) => line(`M${250 + i * 60} 1288 v24`, '#e0edda', 3))
      );
    case 'thermal':
      return (
        rect(244, 1267, 592, 68, '#d7cfaa', `rx="18" stroke="${ink}" stroke-width="6"`) +
        repeat(9, (i) =>
          circle(288 + i * 63, 1301, 12, i < 3 ? '#f5a690' : i < 6 ? '#f4d19d' : '#a5e4e3'),
        ) +
        line('M270 1371 H810', pale, 5) +
        p('M810 1371 l-26 -13 v26Z', pale)
      );
    default:
      return '';
  }
}
