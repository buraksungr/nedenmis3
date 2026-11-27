import { anatomy } from './anatomy';
import { ant } from './ecology';
import { physics } from './physics';
import {
  type Art,
  type ArtContext,
  p,
  line,
  circle,
  ellipse,
  group,
  flow,
  orbit,
  pulse,
  repeat,
} from './common';
import type { ScienceTheme, TemplateId } from '../science-templates';

const diagrams = [
  'overview',
  'focus',
  'detail',
  'comparison',
  'cause-effect',
  'timeline',
  'microscope',
  'balance',
] as const;
const isDiagram = (id: TemplateId) => (diagrams as readonly string[]).includes(id);

/** A black hole is not an eye or a prism: a dark event horizon, luminous
 * accretion disk, lensed arcs and inward-moving light are authored locally. */
function blackHoleArt(id: TemplateId, c: ArtContext): Art {
  const variant = Math.max(0, ['orbit', 'gravity', ...diagrams].indexOf(id));
  const scale = id === 'focus' ? 1.12 : id === 'detail' || id === 'microscope' ? 1.06 : 1;
  const wrap = (contents: string) =>
    group(`transform="translate(540 740) scale(${scale}) translate(-540 -740)"`, contents);
  const stars = repeat(24, (i) =>
    circle(
      143 + ((i * 173) % 795),
      430 + ((i * 107) % 625),
      i % 6 === 0 ? 4 : 2,
      i % 3 ? '#d4e8e4' : '#ffdca6',
    ),
  );
  const grid =
    variant % 3 === 1
      ? repeat(5, (i) =>
          line(
            `M${165 + i * 36} ${1035 + i * 18} Q540 ${1132 - i * 28} ${915 - i * 36} ${1035 + i * 18}`,
            '#5a8d9c',
            4,
            'opacity="0.8"',
          ),
        ) +
        repeat(4, (i) =>
          line(
            `M${258 + i * 98} 1051 Q${373 + i * 52} 1118 ${445 + i * 55} 1112`,
            '#76a7ac',
            3,
            'opacity="0.75"',
          ),
        )
      : line('M198 1026 Q540 1114 882 1026', '#5c8b98', 5, 'opacity="0.7"');
  const main =
    stars +
    grid +
    // Back half of the hot disk lies behind the event horizon.
    ellipse(540, 740, 331, 111, '#783d49', 'stroke="#aa6356" stroke-width="7"') +
    ellipse(540, 740, 302, 83, '#f49b58', 'stroke="#ffd792" stroke-width="8"') +
    ellipse(540, 740, 252, 61, '#9d5148', 'stroke="#f9c27a" stroke-width="7"') +
    // Light lensed around the hole is an arc, not an iris or a framed inset.
    p(
      'M386 723 C376 588 447 518 540 510 C636 518 705 588 694 723',
      'none',
      'stroke="#d97950" stroke-width="18" stroke-linecap="round"',
    ) +
    p(
      'M406 700 C406 589 463 541 540 537 C619 541 674 590 674 700',
      'none',
      'stroke="#ffe0a1" stroke-width="9" stroke-linecap="round"',
    ) +
    circle(540, 718, 137, '#080b18', 'id="black-hole-horizon" stroke="#ffc782" stroke-width="9"') +
    circle(540, 718, 119, '#050711') +
    // The front disk occludes the very bottom of the circular shadow.
    p(
      'M217 746 C297 819 416 849 540 851 C666 850 787 817 863 746 C807 842 676 882 540 883 C403 882 271 842 217 746Z',
      '#ec8b4c',
    ) +
    line('M228 765 C308 823 426 853 540 854 C658 853 773 823 852 765', '#ffe1a3', 13) +
    line('M267 800 C354 844 448 863 540 864 C633 863 728 843 812 800', '#f9b66c', 8);
  const fx =
    flow(
      'accretion-flow-back',
      'M218 728 C261 654 378 626 540 625 C701 626 817 655 862 728',
      '#ffe8a8',
      9,
      c,
      true,
    ) +
    flow(
      'accretion-flow-front',
      'M228 765 C308 823 426 853 540 854 C658 853 773 823 852 765',
      '#fff1bb',
      11,
      c,
      true,
    ) +
    // Both curves end at, rather than emerge from, the horizon.
    flow('infall-ray-a', 'M156 521 C250 542 336 586 393 645 L426 675', '#b8f2ef', 8, c) +
    flow('infall-ray-b', 'M918 516 C833 540 740 588 687 646 L653 675', '#ffdda0', 8, c) +
    group(
      'transform="translate(540 740)"',
      orbit('accretion-orbit', circle(0, 0, 9, '#fff3c4'), c, 289, 92, c.duration * 2.4),
    ) +
    pulse('accretion-glow', circle(281, 755, 8, '#fff4c4'), c, 0.18);
  return { main: wrap(main), fx: wrap(fx) };
}

/** General IDs become actual ant views when the video is about ants, including
 * close-up, above-ground trail and nest perspectives. Ants and ground share the
 * same camera; their antennae articulate around attached pivots. */
function antDiagram(id: TemplateId, c: ArtContext): Art {
  const variant = diagrams.indexOf(id as (typeof diagrams)[number]);
  const close = id === 'focus' || id === 'microscope';
  const chamber = id === 'detail' || id === 'balance' || id === 'comparison';
  const floorY = close ? 1003 : chamber ? 995 : 967;
  const ground =
    p(
      `M125 ${floorY} Q335 ${floorY - 23} 540 ${floorY} T955 ${floorY} L955 1220 H125Z`,
      '#b99b78',
    ) +
    line(`M130 ${floorY} Q335 ${floorY - 23} 540 ${floorY} T950 ${floorY}`, '#dfc29a', 11) +
    repeat(10, (i) =>
      p(
        `M${171 + i * 78} ${floorY + 40 + (i % 2) * 22} l18 -10 20 6 8 10 -20 7Z`,
        i % 2 ? '#bda17c' : '#d1b490',
      ),
    );
  const surroundings = chamber
    ? p(
        'M151 921 C151 673 288 493 540 493 C792 493 929 673 929 921 L929 1040 Q540 1070 151 1040Z',
        '#c5a581',
      ) +
      p(
        'M184 919 C184 693 311 533 540 533 C769 533 896 693 896 919 L896 1022 Q540 1047 184 1022Z',
        '#354448',
      ) +
      line('M210 842 Q216 714 284 645 M797 645 Q864 715 870 842', '#d0b08a', 9)
    : line('M196 896 Q190 807 218 753 M866 899 Q888 801 860 737', '#bda27d', 8) +
      repeat(5, (i) => p(`M${188 + i * 155} ${floorY - 10} q22 -34 45 0Z`, '#a8c896'));
  const ants = close
    ? ant(305, 729, 3.7, `${id}-ant-a`, c)
    : chamber
      ? ant(240, 918, 1.05, `${id}-ant-a`, c) +
        ant(475, 907, 1.15, `${id}-ant-b`, c) +
        ant(702, 925, 0.95, `${id}-ant-c`, c) +
        repeat(6, (i) => ellipse(696 + i * 26, 982, 10, 7, '#f3dfbd'))
      : ant(217, 896, 1.0, `${id}-ant-a`, c) +
        ant(409, 889, 1.0, `${id}-ant-b`, c) +
        ant(602, 893, 1.0, `${id}-ant-c`, c) +
        ant(788, 900, 0.9, `${id}-ant-d`, c);
  const flowA =
    id === 'focus' ? 'focus-ring-a' : id === 'overview' ? 'overview-link-a' : `${id}-trail-a`;
  const flowB =
    id === 'focus' ? 'focus-ring-b' : id === 'overview' ? 'overview-link-b' : `${id}-trail-b`;
  return {
    main:
      surroundings +
      ground +
      ants +
      // Different, subject-related environmental details per stable view.
      repeat(3 + (variant % 4), (i) =>
        line(`M${230 + i * 125} ${floorY - 120} q-12 -31 6 -57`, '#a5c3a2', 5),
      ),
    fx:
      flow(
        flowA,
        `M200 ${floorY - 145} Q405 ${floorY - 180} 550 ${floorY - 145}`,
        '#c4e6d2',
        7,
        c,
      ) +
      flow(
        flowB,
        `M570 ${floorY - 145} Q737 ${floorY - 180} 878 ${floorY - 145}`,
        '#f4d6a4',
        7,
        c,
      ) +
      pulse(`${id}-nest-warmth`, circle(540, floorY - 245, 10, '#ffe5b6'), c, 0.15),
  };
}

function heartDiagram(id: TemplateId, c: ArtContext): Art {
  const bodyView = ['overview', 'timeline', 'cause-effect', 'balance'].includes(id);
  const base = anatomy(bodyView ? 'circulation' : 'heart', c);
  if (id === 'comparison') {
    const heart = anatomy('heart', c),
      prefix = (xml: string, side: string) => xml.replace(/id="([^"]+)"/g, `id="${side}-$1"`),
      side = (name: string, x: number) =>
        group(
          `transform="translate(${x} 300) scale(0.55)"`,
          group(
            `id="${name}-whole-heart" data-anim="heartbeat" data-amplitude="0.06" data-duration="${c.duration / 3.2}"`,
            prefix(heart.main + heart.fx, name),
          ),
        );
    return {
      main: side('left', 45) + side('right', 558) + line('M200 1120 H880', '#a9c9c3', 5),
      fx: flow('comparison-heart-line', 'M215 1086 H865', '#f6d4a0', 7, c),
    };
  }
  // Scale the complete anatomy and its flow together, not individual vessels.
  const scale = id === 'focus' ? 1.1 : id === 'microscope' ? 1.06 : id === 'detail' ? 0.94 : 1;
  const wrap = (s: string) =>
    group(`transform="translate(540 740) scale(${scale}) translate(-540 -740)"`, s);
  return { ...base, main: wrap(base.main), fx: wrap(base.fx) };
}

/** Undefined means use the original subject-specific or neutral local drawing. */
export function themedArt(id: TemplateId, theme: ScienceTheme, c: ArtContext): Art | undefined {
  if (theme === 'black-hole' && (id === 'orbit' || id === 'gravity' || isDiagram(id)))
    return blackHoleArt(id, c);
  if (theme === 'ant' && isDiagram(id)) return antDiagram(id, c);
  if (theme === 'heart' && isDiagram(id)) return heartDiagram(id, c);
  if (theme === 'space' && isDiagram(id)) {
    const base = physics('orbit', c),
      i = diagrams.indexOf(id as (typeof diagrams)[number]);
    return {
      ...base,
      main:
        base.main +
        repeat(3 + (i % 4), (j) =>
          line(`M${246 + j * 130} ${1010 + (i % 3) * 14} l18 -10`, '#9bc5c8', 5),
        ),
    };
  }
  return undefined;
}
