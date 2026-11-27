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
export function generic(id: string, c: ArtContext, actualMicroscope = false): Art {
  switch (id) {
    case 'detail':
      return {
        // Layered material bands are neutral: no cell, eye or invented specimen.
        main:
          p(
            'M190 567 Q540 522 890 567 L890 682 Q540 638 190 682Z',
            '#a9d8ce',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M190 700 Q540 656 890 700 L890 815 Q540 771 190 815Z',
            '#e4d2ad',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M190 832 Q540 788 890 832 L890 947 Q540 903 190 947Z',
            '#8cbfbf',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          repeat(7, (i) =>
            line(`M${252 + i * 96} 599 v42 M${252 + i * 96} 866 v42`, '#dff3df', 5),
          ) +
          line('M230 740 Q540 701 850 740', '#fff1cb', 6),
        fx:
          flow('detail-link-a', 'M218 623 Q540 585 862 623', c.accent, 8, c, true) +
          flow('detail-link-b', 'M218 887 Q540 850 862 887', gold, 8, c, true) +
          pulse('detail-center', p('M513 728 H567 V768 H513Z', '#fff8d5'), c, 0.1),
      };
    case 'overview':
      return {
        main:
          // A chart, not a molecular graph.
          line('M195 1014 H888 M195 1014 V475', '#b8d7cb', 8) +
          repeat(4, (i) => line(`M195 ${892 - i * 112} H884`, '#6b9b9b', 4, 'opacity="0.6"')) +
          rect(263, 718, 125, 296, '#a5d9cf', `rx="12" stroke="${ink}" stroke-width="8"`) +
          rect(480, 570, 125, 444, '#e9c7a0', `rx="12" stroke="${ink}" stroke-width="8"`) +
          rect(697, 644, 125, 370, '#93c9c8', `rx="12" stroke="${ink}" stroke-width="8"`) +
          repeat(3, (i) => line(`M${285 + i * 217} 950 h78`, '#e8f8e4', 6)),
        fx:
          flow('overview-link-a', 'M325 679 V747', c.accent, 8, c, true) +
          flow('overview-link-b', 'M758 603 V673', gold, 8, c, true) +
          pulse('overview-center', rect(520, 598, 45, 22, '#fff8d5', 'rx="5"'), c, 0.12),
      };
    case 'focus':
      return {
        main:
          // Four corners focus attention on a small layered square; no lens/eye.
          line(
            'M245 600 V500 H345 M735 500 H835 V600 M245 904 V1004 H345 M735 1004 H835 V904',
            '#c7e5d7',
            13,
          ) +
          p(
            'M369 589 L683 589 L711 617 L711 895 L397 895 L369 867Z',
            '#a7d9cf',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          p('M409 633 H671 V852 H409Z', '#e6f2dd') +
          repeat(5, (i) => line(`M${436 + i * 48} 663 V819`, '#8dbdb6', 6)) +
          repeat(4, (i) => line(`M435 ${670 + i * 48} H644`, '#a5cdc0', 6)),
        fx:
          flow('focus-ring-a', 'M258 599 V513 H344', c.accent, 9, c, true) +
          flow('focus-ring-b', 'M822 905 V991 H736', gold, 9, c, true) +
          pulse('focus-center', rect(515, 715, 50, 50, '#fff9d9', 'rx="6"'), c, 0.1),
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
      if (!actualMicroscope) {
        // This generic ID is a close-detail fallback unless the narration really
        // mentions a microscope. Do not introduce optics into unrelated subjects.
        return {
          main:
            line('M228 530 H850 M228 1000 H850', '#a5ccc4', 7) +
            repeat(4, (i) =>
              rect(
                265 + i * 135,
                600 + (i % 2) * 52,
                94,
                270 - (i % 2) * 52,
                i % 2 ? '#eacda9' : '#a8d9d1',
                `rx="12" stroke="${ink}" stroke-width="7"`,
              ),
            ) +
            line('M215 1000 V1040 H865 V1000', '#d8ead9', 7) +
            line('M290 930 H790', '#d8ead9', 5),
          fx:
            flow('micro-detail-a', 'M245 558 H835', c.accent, 8, c, true) +
            flow('micro-detail-b', 'M245 960 H835', gold, 8, c, true) +
            pulse('micro-detail-center', rect(502, 866, 75, 20, '#fff9d9', 'rx="5"'), c, 0.1),
        };
      }
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
