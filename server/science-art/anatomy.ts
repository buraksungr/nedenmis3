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
  dilate,
  repeat,
} from './common';

// These are authored illustrations, not positions supplied by a model. Each view
// intentionally uses different structures and different physical motion.
export function anatomy(id: string, c: ArtContext): Art {
  const ivory = '#eef8ed',
    ink = '#183344',
    cyan = '#73e3ec',
    red = '#f18480',
    gold = '#ffcf83';
  switch (id) {
    case 'eye-front': {
      const fibres = repeat(28, (i) => {
        const a = (2 * Math.PI * i) / 28,
          cos = Math.cos(a),
          sin = Math.sin(a);
        return line(
          `M${(540 + cos * 105).toFixed(1)} ${(710 + sin * 105).toFixed(1)} L${(540 + cos * 216).toFixed(1)} ${(710 + sin * 216).toFixed(1)}`,
          i % 2 ? '#e8fbeb' : '#257883',
          i % 2 ? 4 : 6,
        );
      });
      return {
        main:
          p(
            'M140 710 C235 515 393 451 540 456 C696 451 845 526 940 710 C845 891 691 967 540 963 C387 967 234 895 140 710Z',
            ivory,
            `stroke="${ink}" stroke-width="18"`,
          ) +
          p(
            'M145 710 C252 540 383 484 540 486 C698 485 833 548 935 710',
            'none',
            `stroke="#e6a298" stroke-width="23" stroke-linecap="round"`,
          ) +
          p(
            'M147 718 C259 881 393 940 540 935 C691 940 829 882 933 718',
            'none',
            `stroke="#cd8c8a" stroke-width="18" stroke-linecap="round"`,
          ) +
          circle(540, 710, 231, '#22616f', `stroke="${ink}" stroke-width="11"`) +
          circle(540, 710, 211, c.accent) +
          fibres +
          circle(540, 710, 112, '#18505b') +
          dilate('pupil', circle(540, 710, 62 + Math.round(c.level * 0.24), '#0d1c2c'), c, 0.17) +
          ellipse(478, 650, 31, 19, '#ffffff', 'opacity="0.9"') +
          ellipse(605, 780, 14, 8, '#ffffff', 'opacity="0.7"') +
          line('M181 650 Q235 574 307 551 M770 548 Q845 578 902 650', '#f5c8b6', 7),
        fx:
          flow('light-ray-a', 'M210 508 Q330 468 419 486', gold, 7, c) +
          flow('light-ray-b', 'M861 508 Q748 468 651 486', gold, 7, c) +
          pulse('eye-glint', circle(479, 649, 10, '#ffffff'), c, 0.12),
      };
    }
    case 'eye-cross':
      return {
        main:
          p(
            'M270 700 C278 494 438 412 600 454 C746 492 836 612 825 733 C819 894 696 996 538 993 C390 989 276 908 270 700Z',
            '#e5eee1',
            `stroke="${ink}" stroke-width="15"`,
          ) +
          p(
            'M325 701 C333 538 458 475 597 509 C717 538 774 632 768 737 C759 867 674 939 543 939 C420 935 325 864 325 701Z',
            '#98d3d5',
            `stroke="#65a5ad" stroke-width="10"`,
          ) +
          p(
            'M699 533 C765 582 792 655 788 730 C783 814 748 883 693 921',
            'none',
            'stroke="#f49583" stroke-width="28"',
          ) +
          p(
            'M731 546 C786 605 802 674 799 731 C795 806 762 879 710 917',
            'none',
            'stroke="#ffcf8c" stroke-width="9"',
          ) +
          p(
            'M289 564 C231 592 211 645 211 708 C211 774 231 824 289 850 C317 796 328 623 289 564Z',
            '#d6faff',
            `stroke="#6fc8db" stroke-width="12"`,
          ) +
          p(
            'M333 530 Q350 618 341 706 Q350 794 333 878 L372 858 Q388 778 381 708 Q387 625 371 554Z',
            '#5f9094',
          ) +
          p(
            'M401 568 C461 610 472 786 401 840 C360 790 353 622 401 568Z',
            '#faf4c8',
            `stroke="#d3c781" stroke-width="10"`,
          ) +
          line('M393 561 Q367 531 346 523 M393 846 Q366 873 347 887', '#dfb9a0', 9) +
          p('M790 715 L899 684 L899 755 L792 749Z', '#eed19b', `stroke="${ink}" stroke-width="8"`) +
          repeat(8, (i) => line(`M${748 + i * 3} ${625 + i * 35} l30 12`, '#ffe2a3', 4)),
        fx:
          flow('refract-a', 'M142 592 L220 622 L400 666 L750 764', gold, 8, c) +
          flow('refract-b', 'M142 808 L220 783 L400 749 L750 665', '#ffffff', 7, c) +
          pulse('retina-signal', circle(750, 714, 13, c.accent), c, 0.25),
      };
    case 'brain':
      return {
        main:
          p(
            'M273 735 C239 690 246 613 289 578 C287 521 337 482 388 487 C419 440 482 438 521 468 C557 431 620 447 644 486 C699 479 741 516 746 562 C796 593 802 658 781 702 C807 749 779 808 743 825 C741 882 690 914 640 905 C605 941 546 930 520 900 C480 935 421 933 390 904 C337 914 292 880 290 829 C249 806 244 768 273 735Z',
            '#f7b5aa',
            `stroke="${ink}" stroke-width="16"`,
          ) +
          p('M520 469 C514 580 527 690 518 900', 'none', `stroke="#ab6970" stroke-width="11"`) +
          line(
            'M314 603 C340 563 381 565 391 605 C413 621 441 606 442 580 M289 695 C331 672 356 688 368 724 C389 738 424 725 431 699 M314 807 C337 775 373 776 394 808 C412 826 443 823 458 794 M349 523 C378 514 400 524 408 549 M448 487 C466 505 470 533 457 552',
            '#bd757a',
            11,
          ) +
          line(
            'M556 531 C583 505 614 518 619 551 C630 572 655 572 673 558 M552 635 C581 598 621 605 629 641 C643 655 677 651 694 629 M551 743 C574 716 604 724 619 758 C639 778 675 768 688 748 M557 851 C585 824 617 834 630 858 C658 875 690 861 703 837 M708 589 C740 598 752 626 741 654',
            '#bd757a',
            11,
          ) +
          p(
            'M485 898 C484 968 515 1021 556 1069 L606 1069 C566 1019 559 959 563 903Z',
            '#e8a499',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          p(
            'M588 900 Q660 878 709 917 Q726 962 683 985 Q623 996 580 968Z',
            '#eda69b',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          repeat(5, (i) =>
            line(`M${611 + i * 17} 915 Q${620 + i * 17} 940 ${614 + i * 17} 967`, '#ba7478', 4),
          ),
        fx:
          flow('brain-signal-a', 'M306 715 Q376 660 433 692', c.accent, 8, c) +
          flow('brain-signal-b', 'M562 743 Q623 698 695 737', gold, 8, c) +
          pulse('brain-node', circle(520, 690, 12, '#fff6d0'), c, 0.22),
      };
    case 'neuron':
      return {
        main:
          line(
            'M405 680 C330 614 263 593 193 560 M390 703 Q283 700 199 733 M393 729 Q303 786 241 841 M421 658 Q387 571 374 505 M449 649 Q475 569 520 510',
            '#8ce5df',
            19,
          ) +
          repeat(9, (i) =>
            line(
              `M${196 + (i % 3) * 68} ${558 + Math.floor(i / 3) * 133} l${i % 2 ? '-39' : '-31'} ${i % 2 ? '-35' : '31'} m31 -31 l-21 -21`,
              '#a9efe3',
              8,
            ),
          ) +
          p(
            'M392 663 C423 625 482 636 503 673 C529 716 502 776 457 782 C403 789 369 728 392 663Z',
            '#f5b297',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          circle(454, 712, 35, '#a96e86') +
          circle(445, 704, 9, '#ffe7bc') +
          p(
            'M504 699 C558 694 595 705 646 707 C720 712 789 699 859 712 L859 748 C780 734 720 749 641 738 C582 730 550 742 507 731Z',
            '#ffc888',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          repeat(5, (i) =>
            p(
              `M${550 + i * 58} 689 Q${570 + i * 58} 682 ${587 + i * 58} 695 L${587 + i * 58} 748 Q${568 + i * 58} 760 ${550 + i * 58} 746Z`,
              '#e8eee0',
              `stroke="#aac9c4" stroke-width="5"`,
            ),
          ) +
          line(
            'M858 728 Q904 700 921 658 M858 728 Q909 739 928 781 M889 693 l30 -19 M900 752 l28 22',
            '#f9b388',
            12,
          ) +
          repeat(4, (i) => circle(916 + (i % 2) * 12, 650 + i * 38, 7, '#f7c468')),
        fx:
          flow('axon-impulse', 'M496 716 C596 708 712 725 860 726', c.accent, 11, c) +
          flow('dendrite-impulse', 'M200 734 Q300 702 397 710', '#fff2c2', 7, c) +
          pulse('neuron-nucleus', circle(453, 712, 14, '#ffe7c9'), c, 0.2),
      };
    case 'heart':
      return {
        main:
          p(
            'M483 500 C423 454 353 481 347 560 L352 615 C281 591 251 651 273 724 C298 810 374 894 523 1002 C650 902 762 817 790 718 C806 648 763 590 700 611 C714 533 660 489 606 510 L584 571Z',
            '#e97878',
            `stroke="${ink}" stroke-width="16"`,
          ) +
          p(
            'M521 565 C501 675 492 798 523 977 C442 903 372 831 353 746 C332 664 368 613 427 628 C444 587 479 575 521 565Z',
            '#f5a28f',
            `stroke="#bc626a" stroke-width="8"`,
          ) +
          p(
            'M552 620 C572 574 632 552 662 601 C681 632 673 674 652 701 C630 737 628 800 609 842 L538 926 C552 818 548 712 552 620Z',
            '#f49a86',
            `stroke="#b75d68" stroke-width="8"`,
          ) +
          p(
            'M463 550 L465 438 Q465 401 502 398 L548 398 L548 451 L516 451 L516 560Z',
            '#ed8178',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M577 540 L572 427 Q571 388 610 385 L652 385 L653 437 L626 437 L629 566Z',
            '#efa08a',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M703 609 C733 570 762 566 789 574 L796 617 Q757 615 735 662Z',
            '#79bdde',
            `stroke="${ink}" stroke-width="8"`,
          ) +
          p(
            'M354 621 Q367 576 411 570 Q455 574 465 618 Q436 648 388 649Z',
            '#ffb39d',
            `stroke="#ae6571" stroke-width="6"`,
          ) +
          p(
            'M579 590 Q621 559 664 588 Q679 609 668 646 Q631 653 597 632Z',
            '#ffc0a6',
            `stroke="#ae6571" stroke-width="6"`,
          ) +
          line('M403 651 Q433 635 462 653 M588 648 Q615 630 646 650', '#ffe5c5', 10) +
          line(
            'M507 643 Q463 712 443 784 M575 638 Q616 681 632 731 M410 812 Q452 831 480 867 M535 691 Q521 780 526 898',
            '#ffcfad',
            7,
          ) +
          line('M389 717 Q371 767 389 808 M660 688 Q694 726 683 765', '#ffd5b4', 5) +
          repeat(6, (i) => circle(343 + i * 67, 690 + (i % 2) * 22, 6, '#ffe2c2')),
        fx:
          flow('heart-arterial-flow', 'M516 855 Q548 706 610 566 L610 420', '#fff3bd', 10, c) +
          flow('heart-venous-flow', 'M774 596 Q709 602 663 688 L619 784', cyan, 10, c) +
          pulse('heart-beat', p('M384 666 Q415 643 446 657 Q430 687 395 696Z', '#ffcaaf'), c, 0.08),
      };
    case 'circulation':
      return {
        main:
          p(
            'M473 459 Q540 409 607 459 L642 570 L682 668 L652 813 L615 824 L610 1029 L574 1029 L540 841 L506 1029 L470 1029 L465 824 L428 813 L398 668 L438 570Z',
            '#d2dedb',
            `stroke="${ink}" stroke-width="14"`,
          ) +
          circle(540, 406, 59, '#e8d9c4', `stroke="${ink}" stroke-width="10"`) +
          p(
            'M520 596 C481 553 444 592 466 637 Q486 673 540 710 Q595 671 612 636 C633 593 597 554 558 596 L540 617Z',
            red,
            `stroke="${ink}" stroke-width="7"`,
          ) +
          line(
            'M532 654 L510 734 L490 897 M530 734 L552 817 L569 963 M537 620 L590 527 L632 650 M590 527 L541 464',
            '#ef8b82',
            13,
          ) +
          line(
            'M552 655 L578 738 L596 907 M553 739 L523 817 L502 963 M549 620 L491 527 L447 650 M491 527 L539 464',
            '#87cbea',
            13,
          ) +
          repeat(5, (i) => line(`M${470 + i * 36} ${773 + i * 3} q18 17 34 0`, '#f2d5b0', 4)) +
          p(
            'M208 520 C244 471 305 476 332 524 C352 567 316 624 265 665 C216 624 183 568 208 520Z',
            '#d8eff0',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M748 520 C776 473 838 470 870 519 C897 564 860 625 809 665 C760 624 729 567 748 520Z',
            '#d8eff0',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          repeat(4, (i) =>
            line(`M${231 + i * 20} 524 q20 35 2 82 M${771 + i * 20} 524 q20 35 2 82`, '#91bec7', 5),
          ),
        fx:
          flow(
            'arterial-loop',
            'M530 625 L590 527 L634 650 M532 655 L510 735 L492 902',
            red,
            9,
            c,
          ) +
          flow('venous-loop', 'M598 902 L578 738 L551 655 M448 650 L491 527 L549 620', cyan, 9, c) +
          pulse('circulation-heart', circle(540, 625, 13, '#fff0c3'), c, 0.22),
      };
    case 'cell':
      return {
        main:
          p(
            'M216 698 C202 553 316 452 461 449 C556 404 681 447 740 507 C842 520 886 630 861 724 C884 852 780 963 659 959 C568 1010 453 975 389 958 C270 957 199 840 216 698Z',
            '#83c9c0',
            `stroke="${ink}" stroke-width="15"`,
          ) +
          p(
            'M245 704 C244 574 338 486 466 489 C564 451 665 487 724 546 C809 561 850 646 824 734 C841 839 757 928 649 927 C568 964 469 945 395 922 C292 919 235 836 245 704Z',
            '#c9ede0',
            `stroke="#55a6a2" stroke-width="6"`,
          ) +
          ellipse(503, 692, 142, 125, '#b49ad0', `stroke="#6a628f" stroke-width="9"`) +
          ellipse(505, 690, 46, 37, '#6a628f') +
          p(
            'M302 585 C335 546 382 559 389 594 C394 629 348 646 318 636 C294 628 285 607 302 585Z',
            '#f1ab7e',
            `stroke="#a9635e" stroke-width="6"`,
          ) +
          line(
            'M305 594 Q325 605 344 582 Q362 602 382 588 M312 619 Q333 630 351 606 Q366 619 383 609',
            '#b96e65',
            5,
          ) +
          p(
            'M671 790 C719 755 769 779 765 818 C762 852 714 865 679 848 C653 835 651 809 671 790Z',
            '#f1ab7e',
            `stroke="#a9635e" stroke-width="6"`,
          ) +
          line(
            'M673 811 Q698 825 716 797 Q737 816 758 807 M683 839 Q701 846 719 823 Q742 840 758 825',
            '#b96e65',
            5,
          ) +
          repeat(4, (i) =>
            line(
              `M${340 + i * 18} 778 Q${380 + i * 18} 748 ${416 + i * 18} 781 Q${380 + i * 18} 811 ${340 + i * 18} 778`,
              '#6aa6b3',
              5,
            ),
          ) +
          repeat(24, (i) =>
            circle(
              290 + ((i * 79) % 487),
              520 + ((i * 67) % 350),
              4,
              i % 2 ? '#70a5aa' : '#f6cf88',
            ),
          ),
        fx:
          flow('cell-transport-a', 'M280 696 Q338 664 365 672', c.accent, 8, c) +
          flow('cell-transport-b', 'M646 650 Q730 634 803 666', '#f9de93', 8, c) +
          pulse('cell-nucleus', ellipse(503, 692, 17, 16, '#ffe5bc'), c, 0.18),
      };
    case 'dna':
      return {
        main:
          p(
            'M213 426 C165 559 286 680 221 808 C181 900 227 1004 290 1065 L390 1065 C303 984 295 906 331 820 C381 686 275 568 316 426Z',
            '#87d7d2',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          p(
            'M764 426 C812 559 691 680 756 808 C796 900 750 1004 687 1065 L587 1065 C674 984 682 906 646 820 C596 686 702 568 661 426Z',
            '#f6a98c',
            `stroke="${ink}" stroke-width="9"`,
          ) +
          repeat(10, (i) => {
            const y = 455 + i * 59,
              wave = Math.sin(i * 1.05),
              x1 = 310 + wave * 75,
              x2 = 670 - wave * 75;
            return group(
              '',
              line(
                `M${x1.toFixed(1)} ${y} L${x2.toFixed(1)} ${y}`,
                i % 2 ? '#fbe2a0' : '#a7e9de',
                15,
              ) +
                circle(x1, y, 8, '#287a81') +
                circle(x2, y, 8, '#af6969'),
            );
          }) +
          line('M274 440 C250 563 357 681 278 814 C233 905 280 1009 336 1050', '#c9f7e9', 7) +
          line('M707 440 C731 563 624 681 703 814 C748 905 701 1009 645 1050', '#ffe2bc', 7),
        fx:
          flow(
            'dna-signal-left',
            'M273 444 C250 563 357 681 278 814 C233 905 280 1009 336 1050',
            c.accent,
            8,
            c,
          ) +
          flow(
            'dna-signal-right',
            'M707 444 C731 563 624 681 703 814 C748 905 701 1009 645 1050',
            '#fff0c0',
            8,
            c,
          ) +
          pulse('dna-bond', circle(491, 692, 14, '#ffffff'), c, 0.2),
      };
    case 'lung':
      return {
        main:
          p(
            'M476 465 H554 V611 Q556 633 585 650 L638 682 L620 711 L558 677 Q536 666 515 645 Q495 665 472 677 L410 711 L392 682 L445 650 Q475 633 476 611Z',
            '#e5c8b7',
            `stroke="${ink}" stroke-width="10"`,
          ) +
          repeat(7, (i) => line(`M486 ${484 + i * 18} H544`, '#ba8d83', 5)) +
          p(
            'M418 625 C360 603 288 663 267 745 C245 830 236 946 272 1009 C321 1066 407 1042 474 1014 L476 724 Q457 655 418 625Z',
            '#f4aaa0',
            `stroke="${ink}" stroke-width="14"`,
          ) +
          p(
            'M612 625 C670 603 742 663 763 745 C785 830 794 946 758 1009 C709 1066 623 1042 556 1014 L554 724 Q573 655 612 625Z',
            '#f4aaa0',
            `stroke="${ink}" stroke-width="14"`,
          ) +
          line(
            'M438 681 Q399 704 372 743 L326 805 M399 705 L367 678 M372 743 L391 805 M367 744 L314 756 M326 805 L300 856 M326 805 L352 854 M391 805 L412 864 M584 681 Q623 704 650 743 L696 805 M623 705 L655 678 M650 743 L631 805 M655 744 L708 756 M696 805 L721 856 M696 805 L669 854 M631 805 L612 864',
            '#ce7777',
            9,
          ) +
          repeat(10, (i) =>
            circle(304 + ((i * 37) % 145), 800 + Math.floor(i / 4) * 51, 9, '#f9d0b4'),
          ) +
          repeat(10, (i) =>
            circle(580 + ((i * 37) % 145), 800 + Math.floor(i / 4) * 51, 9, '#f9d0b4'),
          ) +
          p(
            'M264 1091 Q513 1171 767 1091',
            'none',
            'stroke="#dfb9a4" stroke-width="23" stroke-linecap="round"',
          ),
        fx:
          flow('air-left', 'M497 466 L497 616 Q490 650 439 681 Q396 712 369 764', cyan, 9, c) +
          flow('air-right', 'M533 466 L533 616 Q540 650 591 681 Q633 712 663 764', cyan, 9, c) +
          pulse(
            'breath-chest',
            p('M358 915 Q393 942 427 917 Q409 962 369 966Z', '#ffe0c4'),
            c,
            0.12,
          ),
      };
    case 'muscle-joint':
      return {
        main:
          p(
            'M345 399 Q413 390 449 431 L505 618 Q513 647 491 676 L425 696 Q397 679 388 644 L318 460 Q310 421 345 399Z',
            '#f1d7b1',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          p(
            'M566 690 Q591 665 623 680 L740 882 Q755 911 735 943 L694 967 Q659 978 642 946 L542 753 Q531 716 566 690Z',
            '#f1d7b1',
            `stroke="${ink}" stroke-width="12"`,
          ) +
          circle(515, 701, 65, '#f4e1bd', `stroke="${ink}" stroke-width="12"`) +
          p(
            'M383 463 Q456 433 492 492 Q525 555 510 626 L468 653 Q426 621 405 563Z',
            '#e77f7a',
            `stroke="#aa5c67" stroke-width="9"`,
          ) +
          p(
            'M592 741 Q640 716 667 753 L715 855 Q682 886 648 879 L601 794Z',
            '#e88d7e',
            `stroke="#aa5c67" stroke-width="9"`,
          ) +
          repeat(6, (i) =>
            line(`M${400 + i * 13} 483 Q${445 + i * 10} 540 ${457 + i * 8} 613`, '#ffc0a7', 5),
          ) +
          repeat(5, (i) =>
            line(`M${603 + i * 12} 764 Q${641 + i * 10} 793 ${660 + i * 10} 851`, '#ffd0ae', 5),
          ) +
          line('M458 649 Q483 669 498 681 M574 704 Q553 693 543 694', '#fff4dc', 15) +
          p('M480 696 Q515 666 549 695 Q530 721 496 727Z', '#8fcbd4'),
        fx:
          flow('muscle-fibre-a', 'M409 489 Q450 536 462 612', c.accent, 8, c) +
          flow('muscle-fibre-b', 'M617 765 Q653 800 673 852', '#ffe7a7', 8, c) +
          pulse('joint-pulse', circle(516, 701, 19, '#fff8d8'), c, 0.12),
      };
    default:
      throw new Error(`Unknown anatomy template: ${id}`);
  }
}
