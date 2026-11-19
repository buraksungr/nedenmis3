import { Easing, interpolate } from 'remotion';
import type { SvgPlan } from '../shared/svg';
import { ScienceGlyph } from './ScienceGlyph';
export type DiagramProps = { plan: SvgPlan; frame: number; progress: number };
export const ink = '#EDF5EE',
  muted = '#A7BAB2',
  rule = '#3A534C',
  dark = '#112721';
export const ease = (x: number, l = 0, r = 1) =>
  interpolate(x, [l, r], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
export const seq = (n: number) => Array.from({ length: n }, (_, i) => i);
export const num = (v: number) =>
  new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
    notation: Math.abs(v) >= 10000 ? 'compact' : 'standard',
  }).format(Math.abs(v) < 0.05 ? 0 : v);
// Lay out whole words. Long words shrink to fit their own line; neither a glyph nor
// the last word of a heading is dropped. No dependency on browser font metrics.
export function TextBlock({
  text,
  x,
  y,
  maxWidth = 468,
  size = 18,
  weight = 400,
  anchor = 'start',
}: {
  text: string;
  x: number;
  y: number;
  maxWidth?: number;
  size?: number;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
}) {
  const measure = (line: string) =>
    Array.from(line).reduce(
      (em, ch) =>
        em +
        ('ilıİ.,: '.includes(ch)
          ? 0.31
          : 'WMmwÖÜĞ'.includes(ch)
            ? 0.89
            : ch === ch.toLocaleUpperCase('tr')
              ? 0.71
              : 0.57),
      0,
    ) * size;
  const rows: string[] = [];
  for (const word of text.trim().split(/\s+/u).filter(Boolean)) {
    const last = rows.at(-1);
    if (last && measure(last + ' ' + word) <= maxWidth) rows[rows.length - 1] = last + ' ' + word;
    else rows.push(word);
  }
  return (
    <text x={x} y={y} textAnchor={anchor} fill={ink} fontSize={size} fontWeight={weight}>
      {rows.map((line, i) => (
        <tspan
          x={x}
          dy={i ? 1.18 * size : 0}
          key={i}
          textLength={Math.min(maxWidth, measure(line))}
          lengthAdjust="spacingAndGlyphs"
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
export function Mark({
  x,
  y,
  children,
  color = muted,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <text x={x} y={y} fill={color} fontSize="12" fontFamily="monospace" letterSpacing="1.2">
      {children}
    </text>
  );
}
export function Specimen({
  plan,
  x,
  y,
  size,
}: {
  plan: SvgPlan;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
      <ScienceGlyph icon={plan.icon} accent={plan.accentColor} />
    </g>
  );
}
