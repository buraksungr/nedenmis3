import {
  type Art,
  type ArtContext,
  p,
  line,
  circle,
  ellipse,
  group,
  flow,
  pulse,
  repeat,
} from './common';

const ink = '#173544',
  paleSoil = '#c8a985',
  ice = '#e5f4eb';
// Three distinct body segments, narrow waist, six legs, antennae and eyes. The only
// translation is a short path wholly inside the specifically authored chamber.
export function ant(x: number, y: number, scale: number, id: string, c: ArtContext) {
  const body =
    line(
      'M46 50 L30 65 L17 64 M57 53 L52 70 L38 74 M67 53 L81 65 L97 66 M48 41 L28 29 L16 32 M59 39 L59 23 L48 16 M70 42 L87 30 L102 32',
      '#f7bc8e',
      5,
    ) +
    p(
      'M7 45 C5 30 19 23 34 26 C47 28 54 40 48 52 C44 63 27 65 15 58Z',
      '#e79064',
      `stroke="${ink}" stroke-width="4"`,
    ) +
    p('M47 42 Q54 34 61 40 L64 46 L58 51 L50 49Z', '#efac7b', `stroke="${ink}" stroke-width="3"`) +
    p(
      'M62 42 Q67 31 78 34 L85 45 Q82 55 70 55 L63 51Z',
      '#ec9e72',
      `stroke="${ink}" stroke-width="4"`,
    ) +
    p(
      'M81 40 Q84 25 99 25 Q112 26 115 39 Q113 53 102 56 Q89 54 82 49Z',
      '#f4b684',
      `stroke="${ink}" stroke-width="4"`,
    ) +
    group(
      `id="${id}-antennae" data-anim="wiggle" data-pivot-x="96" data-pivot-y="26" data-angle="9" data-duration="${c.duration * 0.6}"`,
      line('M96 26 Q98 13 108 9 L117 13 M104 27 Q113 17 124 19 L129 24', '#ffcf9c', 3),
    ) +
    circle(104, 36, 3, '#12303b') +
    circle(105, 35, 1, '#ffffff') +
    line('M17 36 Q26 31 35 33 M69 39 L76 38', '#ffe2b6', 3);
  return group(
    `transform="translate(${x} ${y}) scale(${scale})"`,
    group(
      `id="${id}" data-anim="sway" data-dx="20" data-dy="0" data-duration="${Math.max(3, c.duration)}"`,
      pulse(`${id}-body`, body, c, 0.025),
    ),
  );
}
const ground =
  p('M0 427 Q200 406 380 425 T750 420 T1080 427 L1080 1920 H0Z', '#715949') +
  p('M0 515 Q270 474 513 527 T1080 495 L1080 1920 H0Z', '#594d48') +
  line('M0 427 Q200 406 380 425 T750 420 T1080 427', '#d4b897', 16) +
  repeat(12, (i) => p(`M${40 + i * 92} 435 Q${52 + i * 92} 411 ${64 + i * 92} 433Z`, '#bcd1a1')) +
  repeat(8, (i) =>
    line(`M${70 + i * 136} 481 Q${40 + i * 136} 560 ${64 + i * 136} 616`, '#b29072', 7),
  );
const rocks = repeat(9, (i) =>
  p(
    `M${160 + ((i * 91) % 760)} ${570 + Math.floor(i / 4) * 230} l20 -11 27 8 11 15 -29 8Z`,
    i % 2 ? '#af9981' : '#cfb798',
  ),
);
const tunnel = (d: string, width: number) =>
  line(d, '#d0ae89', width + 22) + line(d, '#3a4141', width);

export function ecology(id: string, c: ArtContext): Art {
  switch (id) {
    case 'soil-colony':
      return {
        background: ground,
        main:
          rocks +
          tunnel('M207 548 C240 659 332 675 456 701 C586 726 636 813 832 832', 133) +
          tunnel('M454 703 C420 808 375 921 480 1001 C568 1068 671 1046 797 1025', 125) +
          ellipse(
            448,
            705,
            150,
            78,
            '#3a4141',
            `id="colony-room-a" stroke="${paleSoil}" stroke-width="9"`,
          ) +
          ellipse(
            749,
            831,
            143,
            74,
            '#3a4141',
            `id="colony-room-b" stroke="${paleSoil}" stroke-width="9"`,
          ) +
          ellipse(
            560,
            1019,
            153,
            76,
            '#3a4141',
            `id="colony-room-c" stroke="${paleSoil}" stroke-width="9"`,
          ) +
          ant(360, 730, 0.65, 'colony-ant-a', c) +
          ant(694, 854, 0.65, 'colony-ant-b', c) +
          ant(482, 1041, 0.7, 'colony-ant-c', c) +
          line('M183 560 Q160 626 177 695 M882 916 Q898 990 880 1058', '#d6bd9f', 6) +
          repeat(8, (i) => circle(180 + i * 90, 1120 + (i % 2) * 20, 7, '#d7bb96')),
        fx:
          flow(
            'tunnel-trace',
            'M205 550 C240 659 332 675 456 701 C586 726 636 813 832 832',
            '#f7d8a5',
            6,
            c,
          ) +
          pulse('colony-warmth', ellipse(535, 1016, 43, 15, '#e1a77c', 'opacity="0.55"'), c, 0.08),
      };
    case 'ant-tunnel':
      return {
        background: ground,
        main:
          rocks +
          p(
            'M151 684 C235 624 310 650 410 674 C510 697 635 641 774 660 Q874 673 930 720 L930 948 Q839 1000 741 978 C613 953 475 1010 360 981 Q243 959 151 991Z',
            '#d1af8d',
          ) +
          p(
            'M161 714 C245 665 311 681 410 706 C520 730 641 676 771 692 Q864 702 920 740 L920 919 Q837 962 744 945 C606 919 475 973 364 949 Q248 928 161 956Z',
            '#354448',
          ) +
          line('M166 946 Q250 917 364 946 T744 943 T916 918', '#9c8a70', 13, 'id="tunnel-floor"') +
          ant(331, 847, 1.45, 'tunnel-ant-a', c) +
          ant(650, 891, 0.72, 'tunnel-ant-b', c) +
          line('M233 697 Q215 676 216 647 M830 706 Q858 682 857 652', '#e0c7a3', 8) +
          repeat(8, (i) => circle(200 + i * 87, 990 + (i % 2) * 23, 5, '#e0c7a3')),
        fx:
          flow('tunnel-air', 'M195 850 Q360 815 498 838 T873 834', '#b9d9c7', 6, c) +
          pulse('tunnel-speck', circle(805, 862, 9, '#f9d4a6'), c, 0.18),
      };
    case 'colony-chamber':
      return {
        background:
          ground +
          p('M0 399 Q180 379 356 393 T710 388 T1080 394 L1080 425 Q840 408 560 425 T0 427Z', ice),
        main:
          rocks +
          tunnel('M540 492 C505 558 518 615 540 655', 110) +
          ellipse(540, 821, 354, 244, '#d1ad8a') +
          ellipse(540, 821, 334, 224, '#354448') +
          p(
            'M227 918 Q362 955 540 936 Q710 956 853 918 L853 1001 Q690 1051 539 1039 Q372 1051 227 1001Z',
            '#7c6c5b',
          ) +
          line('M227 918 Q362 955 540 936 Q710 956 853 918', '#a9927b', 5, 'id="chamber-floor"') +
          ant(250, 855, 1.05, 'chamber-ant-a', c) +
          ant(665, 865, 0.95, 'chamber-ant-b', c) +
          ant(437, 847, 1.22, 'chamber-queen', c) +
          repeat(8, (i) =>
            ellipse(690 + (i % 4) * 29, 904 + Math.floor(i / 4) * 20, 11, 7, '#f3dfbd'),
          ) +
          line('M239 712 Q254 681 280 674 M817 682 Q838 695 847 725', '#e8d1ad', 7),
        fx:
          flow('chamber-warmth-a', 'M307 787 Q295 757 313 727 Q329 696 317 669', '#f1c389', 7, c) +
          flow('chamber-warmth-b', 'M748 801 Q735 771 752 740 Q766 715 758 685', '#f1c389', 7, c) +
          pulse('chamber-glow', ellipse(544, 930, 44, 10, '#e1aa7d', 'opacity="0.5"'), c, 0.1),
      };
    case 'atmosphere':
      return {
        main:
          p(
            'M130 1088 Q540 808 950 1088 L950 1225 L130 1225Z',
            '#65a79f',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p('M146 1093 Q540 861 934 1093 L934 1172 Q540 992 146 1172Z', '#96d5bf') +
          p('M160 1057 Q540 810 920 1057', 'none', 'stroke="#c2eee0" stroke-width="15"') +
          line('M180 969 Q540 699 900 969', '#86cbd4', 10) +
          line('M205 854 Q540 580 875 854', '#a6d9e7', 10) +
          line('M250 736 Q540 484 830 736', '#c8edf0', 8) +
          p(
            'M223 1029 Q252 985 293 1010 Q321 982 351 1014 Q389 1017 390 1043 L223 1043Z',
            '#f2f6e7',
          ) +
          p(
            'M653 1018 Q681 981 716 1002 Q745 969 778 1006 Q810 1007 820 1033 L653 1033Z',
            '#f2f6e7',
          ) +
          circle(769, 500, 46, '#ffe8a8') +
          repeat(8, (i) => {
            const a = (i * Math.PI) / 4;
            return line(
              `M${(769 + Math.cos(a) * 60).toFixed(1)} ${(500 + Math.sin(a) * 60).toFixed(1)} L${(769 + Math.cos(a) * 79).toFixed(1)} ${(500 + Math.sin(a) * 79).toFixed(1)}`,
              '#ffe8a8',
              6,
            );
          }),
        fx:
          flow('atmosphere-current-a', 'M230 955 Q540 718 850 955', c.accent, 8, c, true) +
          flow('atmosphere-current-b', 'M279 748 Q540 561 801 748', '#fff0b4', 7, c, true) +
          pulse('sun-halo', circle(769, 500, 48, '#ffe8a8', 'opacity="0.4"'), c, 0.12),
      };
    case 'ocean-depth':
      return {
        background:
          p('M0 447 H1080 V1920 H0Z', '#1a546f') +
          p('M0 746 H1080 V1920 H0Z', '#17445d') +
          p('M0 1039 H1080 V1920 H0Z', '#163448') +
          line(
            'M0 447 Q90 430 180 447 T360 447 T540 447 T720 447 T900 447 T1080 447',
            '#b2edf1',
            13,
          ),
        main:
          p('M147 1124 Q290 1069 401 1110 T658 1101 T932 1120 L932 1220 H147Z', '#ad9a7d') +
          repeat(6, (i) =>
            line(
              `M${189 + i * 125} 1117 q-12 -60 10 -96 q14 37 -2 65 q27 -41 35 -29`,
              '#b8ca96',
              8,
            ),
          ) +
          p(
            'M273 571 Q324 526 386 568 L413 549 L408 583 L389 577 Q332 616 273 584 L247 597 L254 574 L246 555Z',
            '#ffca91',
            `stroke="${ink}" stroke-width="7"`,
          ) +
          circle(374, 569, 4, ink) +
          p(
            'M610 813 Q657 774 715 811 L741 794 L735 828 L713 824 Q663 856 610 828 L585 839 L591 819 L584 800Z',
            '#b8eadf',
            `stroke="${ink}" stroke-width="7"`,
          ) +
          circle(704, 811, 4, ink) +
          p(
            'M390 974 Q434 925 482 969 Q493 1007 474 1028 L453 1001 L432 1028 L411 1001 L390 1028 Q374 1000 390 974Z',
            '#f1b5aa',
            `stroke="${ink}" stroke-width="7"`,
          ) +
          line('M405 972 Q436 948 469 972', '#ffe3ca', 5) +
          repeat(12, (i) => circle(204 + ((i * 139) % 670), 520 + ((i * 83) % 470), 3, '#c7eddd')),
        fx:
          flow(
            'surface-current',
            'M181 503 Q318 487 441 505 T729 503 T892 501',
            c.accent,
            8,
            c,
            true,
          ) +
          flow(
            'deep-current',
            'M203 895 Q352 883 472 899 T700 896 T878 899',
            '#8fe0db',
            7,
            c,
            true,
          ) +
          pulse('jelly-bell', ellipse(438, 974, 25, 13, '#ffe7cb'), c, 0.12),
      };
    case 'water-cycle':
      return {
        main:
          circle(804, 461, 53, '#ffe5a2') +
          p(
            'M144 970 L331 695 L425 826 L545 648 L727 952 L937 1008 L937 1157 L144 1157Z',
            '#8bbeb1',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          p('M269 785 L331 695 L388 776 L360 763 L340 779 L323 757 L307 778Z', '#edf5e9') +
          p('M472 756 L545 648 L617 768 L583 751 L561 774 L539 748 L517 772Z', '#f4f6e9') +
          p('M145 1042 Q311 1000 456 1042 T742 1027 T937 1050 L937 1167 H145Z', '#7dd4dd') +
          line('M182 1080 Q277 1066 361 1081 M603 1093 Q698 1076 794 1091', '#ddf9e8', 7) +
          p(
            'M285 578 Q299 536 349 548 Q378 503 424 535 Q466 525 488 569 Q526 574 527 607 L274 607 Q260 586 285 578Z',
            '#edf5ed',
            `stroke="#b9d8d9" stroke-width="7"`,
          ) +
          p(
            'M592 555 Q609 520 646 535 Q671 499 713 523 Q753 517 773 553 Q811 561 812 590 L584 590 Q578 572 592 555Z',
            '#edf5ed',
            `stroke="#b9d8d9" stroke-width="7"`,
          ) +
          repeat(6, (i) => line(`M${313 + i * 55} 633 l-12 29`, '#86d6e5', 7)),
        fx:
          flow('evaporation', 'M703 1004 Q678 932 707 868 Q728 824 716 763', '#f6f1c0', 9, c) +
          flow('rainfall', 'M388 631 Q380 688 362 739', '#a7e5ed', 10, c) +
          flow('runoff', 'M551 777 Q588 855 651 924 Q695 963 742 1009', c.accent, 9, c),
      };
    case 'plant':
      return {
        main:
          p('M140 1030 Q375 1009 540 1028 T940 1027 L940 1200 H140Z', '#aa896b') +
          line('M541 1044 C531 926 535 811 540 564', '#9ee1a2', 18) +
          p(
            'M535 756 C424 751 322 670 281 578 C397 571 492 620 535 756Z',
            '#8ed6a0',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          p(
            'M546 691 C658 680 745 601 786 523 C672 520 587 570 546 691Z',
            '#a9e1a0',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          p(
            'M535 894 C449 887 380 841 350 777 C448 775 511 813 535 894Z',
            '#b0dea2',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          line(
            'M294 586 Q415 634 532 746 M774 531 Q653 584 549 681 M358 785 Q445 824 530 883',
            '#e6f5bd',
            6,
          ) +
          repeat(5, (i) =>
            line(
              `M${360 + i * 27} ${617 + i * 22} l-15 -31 M${636 + i * 26} ${620 - i * 19} l20 -30`,
              '#d9f0b6',
              4,
            ),
          ) +
          line(
            'M538 1046 Q516 1102 484 1165 M540 1046 Q558 1102 605 1160 M524 1084 Q482 1101 447 1116 M558 1091 Q604 1097 633 1132',
            '#f4d6a5',
            10,
          ),
        fx:
          flow('plant-water', 'M484 1155 Q528 1080 540 991 L540 654', '#c8f6eb', 8, c) +
          flow('plant-leaf', 'M540 743 Q440 663 300 589', c.accent, 7, c) +
          pulse('plant-growth', circle(540, 561, 14, '#fff1a8'), c, 0.2),
      };
    case 'photosynthesis':
      return {
        main:
          p(
            'M186 840 C219 583 484 428 805 520 C881 809 698 1024 397 1021 C298 1020 225 960 186 840Z',
            '#9bd7a4',
            `stroke="${ink}" stroke-width="14"`,
          ) +
          line('M207 891 Q467 793 776 538', '#e2f4b9', 14) +
          repeat(5, (i) =>
            line(
              `M${315 + i * 69} ${853 - i * 51} q-42 -75 -30 -145 M${315 + i * 69} ${853 - i * 51} q73 20 117 3`,
              '#d9efb6',
              7,
            ),
          ) +
          ellipse(515, 758, 145, 95, '#5cab7d', `stroke="#2f7a70" stroke-width="8"`) +
          repeat(5, (i) =>
            group(
              '',
              ellipse(445 + i * 34, 746, 14, 34, '#b4e8a8') +
                line(
                  `M${435 + i * 34} 735 h20 M${435 + i * 34} 750 h20 M${435 + i * 34} 765 h20`,
                  '#4b9c78',
                  4,
                ),
            ),
          ) +
          circle(225, 507, 49, '#ffe5a0') +
          repeat(6, (i) => line(`M${195 + i * 13} 571 l28 53`, '#ffe6a9', 5)) +
          circle(728, 941, 18, '#d9f7ed') +
          circle(769, 909, 13, '#d9f7ed') +
          circle(800, 958, 10, '#d9f7ed'),
        fx:
          flow('sun-to-leaf', 'M258 542 L356 657', '#fff2ad', 10, c) +
          flow('leaf-exchange', 'M632 824 Q698 866 754 920', c.accent, 8, c) +
          pulse('chloroplast', ellipse(515, 758, 37, 24, '#daf5a7'), c, 0.12),
      };
    default:
      throw new Error(`Unknown ecology template: ${id}`);
  }
}
