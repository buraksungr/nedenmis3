/** Only application-authored geometry reaches these helpers. Model values are enum-checked. */
export type ArtContext = {
  accent: string;
  duration: number;
  direction: 1 | -1;
  level: number;
};
export type Art = {
  main: string;
  fx: string;
  background?: string;
  /** The whole organ and its flow paths share one centered motion. */
  organ?: 'heart' | 'breath' | 'cell';
};
export const p = (d: string, fill: string, extra = '') =>
  `<path d="${d}" fill="${fill}"${extra.trim() ? ` ${extra.trim()}` : ''}/>`;
export const line = (d: string, color: string, width = 6, extra = '') =>
  p(
    d,
    'none',
    `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`,
  );
export const circle = (x: number, y: number, r: number, fill: string, extra = '') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra.trim() ? ` ${extra.trim()}` : ''}/>`;
export const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, extra = '') =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${extra.trim() ? ` ${extra.trim()}` : ''}/>`;
export const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra.trim() ? ` ${extra.trim()}` : ''}/>`;
export const group = (extra: string, contents: string) =>
  `<g${extra.trim() ? ` ${extra.trim()}` : ''}>${contents}</g>`;
export const flow = (
  id: string,
  d: string,
  color: string,
  width: number,
  c: ArtContext,
  reversible = false,
) =>
  line(
    d,
    color,
    width,
    `id="${id}" data-anim="flow" data-duration="${c.duration}" data-flow-direction="${reversible ? c.direction : 1}"`,
  );
export const pulse = (id: string, contents: string, c: ArtContext, amplitude = 0.045) =>
  group(
    `id="${id}" data-anim="pulse" data-amplitude="${amplitude}" data-duration="${c.duration}"`,
    contents,
  );
export const dilate = (id: string, contents: string, c: ArtContext, amplitude = 0.13) =>
  group(
    `id="${id}" data-anim="dilate" data-amplitude="${amplitude}" data-duration="${c.duration}"`,
    contents,
  );
/** Authored elliptical path; the orbiting body itself stays round/upright. */
export const orbit = (
  id: string,
  contents: string,
  c: ArtContext,
  rx: number,
  ry: number,
  duration = c.duration * 3,
) =>
  group(
    `id="${id}" data-anim="orbit" data-dx="${rx}" data-dy="${ry}" data-duration="${duration}" data-flow-direction="${c.direction}"`,
    contents,
  );
export const repeat = (n: number, f: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => f(i)).join('');
