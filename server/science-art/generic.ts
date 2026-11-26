import {
  type Art,
  type ArtContext,
  p,
  line,
  circle,
  ellipse,
  rect,
  flow,
  pulse,
  repeat,
} from './common';
const ink = '#183744',
  gold = '#ffe2a2';
export function generic(id: string, c: ArtContext): Art {
  switch (id) {
    case 'detail':
      return {
        main:
          p(
            'M184 502 Q184 452 234 452 H846 Q896 452 896 502 V1038 Q896 1088 846 1088 H234 Q184 1088 184 1038Z',
            '#a9ddd3',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p('M207 523 H873 V1012 H207Z', '#d9f0df') +
          p(
            'M289 811 C343 633 458 581 563 641 C646 688 683 810 651 909 C579 982 410 972 289 811Z',
            '#8ccbc2',
            `stroke="#559e9d" stroke-width="9"`,
          ) +
          repeat(12, (i) =>
            circle(344 + ((i * 73) % 263), 677 + ((i * 43) % 211), 8 + (i % 3) * 3, '#dff4d8'),
          ) +
          circle(740, 870, 98, '#f4ddb5', `stroke="${ink}" stroke-width="9"`) +
          p(
            'M679 873 Q738 808 800 873 Q741 937 679 873Z',
            '#b4ded0',
            `stroke="#69aaa4" stroke-width="6"`,
          ) +
          line('M626 775 L675 816 M626 908 L671 909', '#78aca7', 6),
        fx:
          flow('detail-link-a', 'M621 774 L677 817', c.accent, 8, c, true) +
          flow('detail-link-b', 'M623 910 L672 909', gold, 8, c, true) +
          pulse('detail-center', circle(740, 873, 20, '#fff8d5'), c, 0.18),
      };
    case 'overview':
      return {
        main:
          line(
            'M540 722 L300 526 M540 722 L780 526 M540 722 L300 946 M540 722 L780 946',
            '#aacfc6',
            10,
          ) +
          p(
            'M540 581 L654 651 L654 788 L540 859 L426 788 L426 651Z',
            '#b1e2d5',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          p('M540 616 L625 668 L625 772 L540 825 L455 772 L455 668Z', '#e4f4df') +
          repeat(4, (i) => {
            const x = i % 2 ? 780 : 300,
              y = i < 2 ? 526 : 946;
            return (
              circle(x, y, 63, i % 2 ? '#f4c79f' : '#9bd9d1', `stroke="${ink}" stroke-width="9"`) +
              circle(x, y, 25, '#edf7df')
            );
          }) +
          line('M506 720 H574 M540 687 V753', '#7cb9ae', 7),
        fx:
          flow('overview-link-a', 'M329 548 L426 653', c.accent, 8, c, true) +
          flow('overview-link-b', 'M654 788 L754 925', gold, 8, c, true) +
          pulse('overview-center', circle(540, 720, 16, '#fff8d5'), c, 0.18),
      };
    case 'focus':
      return {
        main:
          circle(496, 685, 250, '#a9ded4', `stroke="${ink}" stroke-width="15"`) +
          circle(496, 685, 211, '#d6f2dd', `stroke="#7bbcb8" stroke-width="9"`) +
          p(
            'M649 865 L715 815 L876 1014 Q895 1039 873 1058 Q851 1077 830 1054Z',
            '#e9c39b',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          p(
            'M395 687 Q496 579 600 687 Q498 796 395 687Z',
            '#91cfc3',
            `stroke="#4a9593" stroke-width="8"`,
          ) +
          circle(497, 687, 57, '#e7f4db', `stroke="#4a9593" stroke-width="7"`) +
          line('M337 685 H369 M622 685 H654 M496 525 V557 M496 813 V845', '#5ca39f', 7) +
          repeat(8, (i) => {
            const a = (i * Math.PI) / 4;
            return circle(496 + Math.cos(a) * 150, 685 + Math.sin(a) * 150, 6, '#78b3ae');
          }),
        fx:
          flow('focus-ring-a', 'M319 685 A177 177 0 0 1 496 508', c.accent, 8, c, true) +
          flow('focus-ring-b', 'M673 685 A177 177 0 0 1 496 862', gold, 8, c, true) +
          pulse('focus-center', circle(496, 687, 20, '#fff9d9'), c, 0.18),
      };
    case 'comparison': {
      const bar1 = 120 + Math.round(c.level * 2.2),
        bar2 = 340 - Math.round(c.level * 1.2);
      return {
        main:
          p('M170 1069 H910 V1120 H170Z', '#b7d1c9') +
          rect(
            227,
            1058 - bar1,
            225,
            bar1,
            '#93d8ce',
            `rx="25" stroke="${ink}" stroke-width="10"`,
          ) +
          rect(
            628,
            1058 - bar2,
            225,
            bar2,
            '#f0b995',
            `rx="25" stroke="${ink}" stroke-width="10"`,
          ) +
          line('M340 588 V1021 M740 588 V1021', '#e3f2dc', 5, 'stroke-dasharray="12 14"') +
          circle(339, 530, 65, '#b1e6da', `stroke="${ink}" stroke-width="9"`) +
          circle(741, 530, 65, '#f9ce9c', `stroke="${ink}" stroke-width="9"`) +
          line('M310 530 h58 M339 500 v60 M715 530 h52', ink, 8) +
          repeat(4, (i) =>
            line(
              `M${250 + i * 40} ${1027 - i * 16} h24 M${652 + i * 40} ${1027 - i * 12} h24`,
              '#eaf8e4',
              6,
            ),
          ),
        fx:
          flow('comparison-a', 'M339 618 V' + (1030 - bar1), c.accent, 8, c, true) +
          flow('comparison-b', 'M741 618 V' + (1030 - bar2), gold, 8, c, true) +
          pulse('comparison-marker', circle(540, 781, 15, '#fff2c5'), c, 0.2),
      };
    }
    case 'cause-effect':
      return {
        main:
          p(
            'M159 678 Q159 620 218 620 H363 Q422 620 422 678 V840 Q422 899 363 899 H218 Q159 899 159 840Z',
            '#a6e0d5',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          p(
            'M658 678 Q658 620 717 620 H862 Q921 620 921 678 V840 Q921 899 862 899 H717 Q658 899 658 840Z',
            '#f4c69f',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          circle(290, 759, 62, '#e9f6dc') +
          circle(790, 759, 62, '#fff0cc') +
          line('M260 759 h60 M290 729 v60', ink, 8) +
          line('M762 771 l24 -28 24 28', ink, 8) +
          p(
            'M441 732 H581 V699 L646 759 L581 819 V785 H441Z',
            '#e8f0ce',
            `stroke="${ink}" stroke-width="8"`,
          ) +
          line('M247 956 Q540 1030 833 956', '#9bc9bd', 7),
        fx:
          flow('cause-path', 'M442 759 H625', c.accent, 10, c) +
          flow('effect-path', 'M254 955 Q540 1026 824 955', gold, 7, c) +
          pulse('effect-center', circle(790, 759, 18, '#fff8d6'), c, 0.18),
      };
    case 'timeline':
      return {
        main:
          line('M190 880 C309 755 419 782 540 743 C664 704 774 736 890 615', '#a4d2cb', 16) +
          repeat(5, (i) => {
            const x = 205 + i * 168,
              y = [864, 791, 743, 723, 639][i];
            return (
              circle(x, y, 43, i % 2 ? '#ffd5a2' : '#b4e7d9', `stroke="${ink}" stroke-width="9"`) +
              circle(x, y, 15, '#edf9e3')
            );
          }) +
          p('M192 1054 Q247 987 304 1054Z', '#b8dfc7', `stroke="${ink}" stroke-width="7"`) +
          p('M465 1054 Q540 937 615 1054Z', '#e3d2aa', `stroke="${ink}" stroke-width="7"`) +
          p('M756 1054 Q814 989 872 1054Z', '#b5dfd3', `stroke="${ink}" stroke-width="7"`) +
          line('M175 1061 H910', '#d8ebd5', 6) +
          repeat(11, (i) => line(`M${195 + i * 66} 1082 v${i % 2 ? 12 : 22}`, '#a7c9be', 5)),
        fx:
          flow(
            'timeline-flow',
            'M190 880 C309 755 419 782 540 743 C664 704 774 736 890 615',
            c.accent,
            9,
            c,
          ) +
          flow('timeline-branch', 'M540 743 Q557 803 540 909', gold, 8, c) +
          pulse('timeline-point', circle(541, 743, 20, '#fff8d4'), c, 0.2),
      };
    case 'microscope':
      return {
        main:
          p(
            'M314 1059 Q347 1019 430 1022 H690 Q749 1022 783 1061 L781 1101 H312Z',
            '#d4e2d7',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          p(
            'M571 520 Q773 562 774 770 Q773 917 668 1018 L582 1018 Q717 881 692 744 Q675 640 563 602Z',
            '#a2d5d0',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p(
            'M390 487 L530 428 L635 663 L494 725Z',
            '#d8eadc',
            `stroke="${ink}" stroke-width="11"`,
          ) +
          p('M366 448 L492 396 L530 460 L404 513Z', '#91c6c8', `stroke="${ink}" stroke-width="9"`) +
          p('M495 713 L594 670 L625 737 L523 779Z', '#f1c292', `stroke="${ink}" stroke-width="8"`) +
          rect(389, 828, 301, 36, '#d0e2d8', `rx="8" stroke="${ink}" stroke-width="8"`) +
          rect(478, 815, 106, 13, '#f8dfae', `rx="4"`) +
          circle(656, 748, 36, '#f1c99c', `stroke="${ink}" stroke-width="8"`) +
          circle(656, 748, 13, '#ddad89') +
          line('M466 876 Q522 934 582 874', '#b5dcd4', 10) +
          p('M558 777 L507 821 H597Z', '#d0f2e3', 'opacity="0.65"'),
        fx:
          flow('microscope-light', 'M554 773 L533 824', gold, 8, c) +
          flow('microscope-focus', 'M482 905 Q537 947 592 905', c.accent, 8, c) +
          pulse('microscope-specimen', ellipse(532, 821, 20, 6, '#ffffff'), c, 0.2),
      };
    case 'balance': {
      const tilt = Math.round((c.level - 50) * 0.55),
        ly = 730 + tilt,
        ry = 730 - tilt;
      return {
        main:
          p('M472 1080 L493 1015 H588 L608 1080Z', '#c6ded5', `stroke="${ink}" stroke-width="9"`) +
          rect(523, 699, 34, 323, '#d6e9db', `stroke="${ink}" stroke-width="8"`) +
          line(`M244 ${ly} L836 ${ry}`, '#f2d1a0', 20) +
          circle(540, 730, 26, '#fff0c4', `stroke="${ink}" stroke-width="8"`) +
          line(
            `M250 ${ly} L211 ${ly + 141} M250 ${ly} L324 ${ly + 141} M830 ${ry} L756 ${ry + 141} M830 ${ry} L869 ${ry + 141}`,
            '#cce2d5',
            7,
          ) +
          p(
            `M183 ${ly + 142} Q268 ${ly + 211} 354 ${ly + 142}Z`,
            '#98d9d2',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            `M726 ${ry + 142} Q812 ${ry + 211} 898 ${ry + 142}Z`,
            '#f0c19e',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          circle(252, ly + 127, 16, '#dff8df') +
          circle(822, ry + 127, 16, '#fff0cf') +
          line('M345 530 H735', '#a9d1c5', 6) +
          repeat(9, (i) => line(`M${376 + i * 41} 518 v24`, '#b9ddcf', 5)) +
          p('M531 509 L549 509 L540 489Z', gold),
        fx:
          flow('balance-left', `M250 ${ly + 12} L211 ${ly + 141}`, c.accent, 7, c) +
          flow('balance-right', `M830 ${ry + 12} L869 ${ry + 141}`, gold, 7, c) +
          pulse('balance-pivot', circle(540, 730, 12, '#fff9df'), c, 0.2),
      };
    }
    default:
      throw new Error(`Unknown generic template: ${id}`);
  }
}
