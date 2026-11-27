import {
  type Art,
  type ArtContext,
  p,
  line,
  circle,
  ellipse,
  rect,
  group,
  orbit,
  flow,
  pulse,
  repeat,
} from './common';
const ink = '#173544',
  cream = '#f4f7df',
  gold = '#ffe5a1',
  coral = '#f4a28d';
export function physics(id: string, c: ArtContext): Art {
  switch (id) {
    case 'refraction':
      return {
        main:
          p('M356 899 L540 504 L740 899Z', '#a2dee0', `stroke="${cream}" stroke-width="12"`) +
          p('M391 877 L540 555 L540 878Z', '#d6f4e9', 'opacity="0.62"') +
          p('M540 555 L702 877 L540 877Z', '#6db9cc', 'opacity="0.55"') +
          line('M363 899 L740 899', ink, 8) +
          // The incoming ray meets the left face, bends toward its normal in
          // glass, then disperses toward the base on leaving the right face.
          p('M190 650 L160 636 L160 664Z', gold) +
          line('M158 650 L472 650', gold, 13) +
          line('M472 650 L626 673', '#fff3bd', 11) +
          line('M626 673 L900 830', '#f8ada3', 10) +
          line('M626 673 L900 875', '#ffd185', 10) +
          line('M626 673 L900 920', '#a2dfed', 10) +
          line('M382 608 L562 692', '#c7e7e2', 4, 'stroke-dasharray="14 13"') +
          p('M425 650 Q426 640 430 631', 'none', 'stroke="#ffffff" stroke-width="5"'),
        fx:
          flow('incident-ray', 'M159 650 L472 650 L626 673', gold, 8, c) +
          flow('refracted-ray', 'M626 673 L900 830', '#fff1ce', 7, c) +
          pulse('prism-refraction', circle(472, 650, 12, '#ffffff'), c, 0.2),
      };
    case 'magnetism':
      return {
        main:
          p(
            'M268 778 L268 573 Q268 466 377 466 L430 466 L430 666 L390 666 L390 579 Q390 565 376 565 Q363 565 363 579 L363 778Z',
            coral,
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p(
            'M650 666 L650 466 L703 466 Q812 466 812 573 L812 778 L717 778 L717 579 Q717 565 704 565 Q690 565 690 579 L690 666Z',
            '#91d7e1',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p(
            'M268 768 L363 768 L363 850 Q363 971 540 971 Q717 971 717 850 L717 768 L812 768 L812 858 Q812 1077 540 1077 Q268 1077 268 858Z',
            '#d9ded6',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          rect(268, 573, 95, 91, '#f8b0a0') +
          rect(717, 573, 95, 91, '#a9e5eb') +
          line('M301 607 h29 M315 592 v30 M747 607 h35', '#244d59', 7) +
          line(
            'M415 620 C451 550 629 550 665 620 M414 592 C448 482 632 482 666 592 M414 560 C449 417 631 417 666 560',
            '#d7eee4',
            5,
          ) +
          repeat(6, (i) => circle(445 + i * 38, 727 + (i % 2) * 12, 6, '#ffe4a6')),
        fx:
          flow('magnetic-field-a', 'M415 620 C451 550 629 550 665 620', gold, 9, c) +
          flow('magnetic-field-b', 'M414 560 C449 417 631 417 666 560', c.accent, 8, c) +
          pulse('magnetic-pole', circle(430, 644, 14, '#fff5d1'), c, 0.16),
      };
    case 'electricity':
      return {
        main:
          line('M285 534 H449 M625 534 H795 V944 H285 V534', '#acd9d7', 24) +
          rect(407, 486, 245, 99, '#f3c485', `rx="16" stroke="${ink}" stroke-width="10"`) +
          rect(463, 486, 85, 99, '#d8ebd3') +
          line('M490 514 v42 M470 535 h40 M583 535 h36', ink, 8) +
          circle(795, 740, 78, '#f5eab5', `stroke="${ink}" stroke-width="12"`) +
          p(
            'M750 787 Q761 818 777 826 H813 Q830 816 840 787Z',
            '#c5d2cb',
            `stroke="${ink}" stroke-width="7"`,
          ) +
          line('M776 739 Q783 758 795 759 Q807 758 814 739 M795 759 V792', '#dc9a68', 7) +
          rect(408, 894, 240, 100, '#e2c09a', `rx="12" stroke="${ink}" stroke-width="9"`) +
          repeat(6, (i) => line(`M${432 + i * 33} 902 l21 80`, '#b77d72', 6)) +
          circle(285, 534, 12, '#ffffff') +
          circle(285, 944, 12, '#ffffff'),
        fx:
          flow('circuit-top', 'M650 534 H795 V658', c.accent, 10, c, true) +
          flow('circuit-bottom', 'M795 825 V944 H649', gold, 10, c, true) +
          pulse('bulb-glow', circle(795, 740, 42, '#fffbd2', 'opacity="0.8"'), c, 0.13),
      };
    case 'orbit':
      return {
        main:
          ellipse(
            540,
            735,
            325,
            184,
            'none',
            `stroke="#92b9c7" stroke-width="5" stroke-dasharray="15 15"`,
          ) +
          ellipse(
            540,
            735,
            238,
            118,
            'none',
            `stroke="#c1d6d2" stroke-width="5" stroke-dasharray="12 15"`,
          ) +
          circle(540, 735, 97, '#f6bb72', `stroke="${ink}" stroke-width="12"`) +
          circle(540, 735, 72, '#ffe4a2') +
          p('M492 716 Q540 677 588 716 Q572 761 540 775 Q508 761 492 716Z', '#fff1bd') +
          repeat(10, (i) => {
            const a = (i * Math.PI) / 5;
            return line(
              `M${(540 + Math.cos(a) * 110).toFixed(1)} ${(735 + Math.sin(a) * 110).toFixed(1)} L${(540 + Math.cos(a) * 132).toFixed(1)} ${(735 + Math.sin(a) * 132).toFixed(1)}`,
              '#f8d697',
              7,
            );
          }) +
          group(
            'transform="translate(540 735)"',
            orbit(
              'orbit-planet-earth',
              circle(0, 0, 43, '#88d3de', `stroke="${ink}" stroke-width="9"`) +
                p('M-24 -10 Q-11 -26 0 -21 L5 -2 L20 2 L16 21 L-7 27 L-13 12Z', '#a7dfa9'),
              c,
              325,
              184,
            ),
          ) +
          group(
            'transform="translate(540 735)"',
            orbit(
              'orbit-planet-inner',
              circle(0, 0, 24, '#ebaa93', `stroke="${ink}" stroke-width="6"`),
              c,
              -238,
              118,
              c.duration * 2,
            ),
          ) +
          repeat(14, (i) =>
            circle(160 + ((i * 131) % 760), 430 + ((i * 83) % 590), (i % 3) + 2, '#e9f5dd'),
          ),
        fx:
          flow(
            'orbit-outer',
            'M215 735 C215 633 360 551 540 551 C720 551 865 633 865 735 C865 837 720 919 540 919 C360 919 215 837 215 735',
            c.accent,
            7,
            c,
            true,
          ) +
          flow(
            'orbit-inner',
            'M302 735 C302 670 409 617 540 617 C671 617 778 670 778 735 C778 800 671 853 540 853 C409 853 302 800 302 735',
            gold,
            7,
            c,
            true,
          ) +
          pulse('sun-energy', circle(540, 735, 37, '#fff6c5'), c, 0.1),
      };
    case 'gravity':
      return {
        main:
          circle(525, 804, 223, '#69bac7', `stroke="${ink}" stroke-width="16"`) +
          p(
            'M352 734 Q392 671 442 653 L476 680 L465 724 L493 744 L472 781 L424 781 L412 817 L364 806Z',
            '#ace0a8',
          ) +
          p(
            'M539 643 Q610 633 669 689 L661 729 L624 738 L615 775 L577 756 L550 719 L521 708Z',
            '#a9daa0',
          ) +
          p(
            'M538 812 L580 791 L618 816 L608 851 L581 876 L575 923 L543 958 L524 919 L533 885 L510 858Z',
            '#aadca4',
          ) +
          ellipse(
            525,
            804,
            304,
            280,
            'none',
            'stroke="#9bc1c9" stroke-width="6" stroke-dasharray="15 16"',
          ) +
          rect(716, 470, 65, 53, '#f6d9a3', `rx="5" stroke="${ink}" stroke-width="8"`) +
          rect(659, 476, 51, 40, '#96c8d5', `stroke="${ink}" stroke-width="6"`) +
          rect(787, 476, 51, 40, '#96c8d5', `stroke="${ink}" stroke-width="6"`) +
          line('M680 476 v40 M808 476 v40 M749 469 l10 -25 M749 469 l-11 -24', '#d1e6da', 5) +
          line('M739 540 L633 676', '#ffe5a2', 9) +
          p('M633 676 L641 636 L666 656Z', '#ffe5a2') +
          repeat(12, (i) =>
            circle(159 + ((i * 137) % 760), 430 + ((i * 83) % 590), (i % 3) + 2, '#e9f5dd'),
          ),
        fx:
          flow('gravity-vector', 'M739 540 L633 676', gold, 9, c) +
          flow(
            'gravity-orbit',
            'M221 804 C221 650 357 524 525 524 C620 524 707 566 762 630',
            c.accent,
            8,
            c,
            true,
          ) +
          pulse('gravity-center', circle(525, 804, 16, '#eaf8d8'), c, 0.16),
      };
    case 'sound':
      return {
        main:
          p(
            'M180 650 H298 L449 535 V944 L298 829 H180Z',
            '#accdc9',
            `stroke="${ink}" stroke-width="13"`,
          ) +
          p('M207 676 H298 L414 590 V889 L298 803 H207Z', '#dbe9dd') +
          p('M313 681 L408 621 V855 L313 795Z', '#81b8bd') +
          line('M501 654 Q553 738 501 825', '#ffe2aa', 18) +
          line('M559 600 Q650 738 559 881', '#b9ede4', 16) +
          line('M626 550 Q755 739 626 933', '#ffe2aa', 14) +
          line('M703 501 Q866 739 703 984', '#b9ede4', 12) +
          line('M160 1045 H921', '#b1cfc9', 5) +
          line(
            'M175 1045 Q206 1006 237 1045 T299 1045 T361 1045 T423 1045 T485 1045 T547 1045 T609 1045 T671 1045 T733 1045 T795 1045 T857 1045 T919 1045',
            '#f7d995',
            7,
          ),
        fx:
          flow('sound-wave-a', 'M501 654 Q553 738 501 825', gold, 9, c) +
          flow('sound-wave-b', 'M626 550 Q755 739 626 933', c.accent, 9, c) +
          pulse('speaker-diaphragm', p('M325 692 L392 649 V827 L325 784Z', '#c8f0db'), c, 0.06),
      };
    case 'thermal':
      return {
        main:
          rect(210, 696, 662, 140, '#d4c7a2', `rx="24" stroke="${ink}" stroke-width="12"`) +
          p('M219 707 H440 V825 H219Z', '#efac89') +
          p('M440 707 H653 V825 H440Z', '#edc394') +
          p('M653 707 H863 V825 H653Z', '#9ed7d9') +
          repeat(12, (i) => circle(245 + i * 52, 751 + (i % 2) * 22, 9, '#f6efce')) +
          p(
            'M210 908 Q174 859 202 827 Q207 859 228 855 Q220 821 248 790 Q249 831 269 839 Q290 869 269 907Z',
            '#f4ae82',
            `stroke="${ink}" stroke-width="8"`,
          ) +
          p(
            'M795 931 L820 900 L846 931 L846 967 L820 982 L795 967Z',
            '#d5f3ee',
            `stroke="#7ec2ce" stroke-width="8"`,
          ) +
          line('M820 895 V984 M786 940 H854 M796 913 L843 973 M844 913 L797 973', '#ffffff', 5) +
          line('M270 638 H810', '#d7e4d0', 5) +
          p('M810 638 l-31 -16 v32Z', '#d7e4d0'),
        fx:
          flow('heat-conduction', 'M250 766 H828', gold, 10, c) +
          flow('heat-radiation', 'M230 820 Q220 774 242 727', c.accent, 8, c) +
          pulse('heat-particle', circle(510, 764, 12, '#fff9dc'), c, 0.18),
      };
    default:
      throw new Error(`Unknown physics template: ${id}`);
  }
}
