import type { Word } from './schema';
export function groups(words: Word[], max = 5) {
  const out: Word[][] = [];
  let g: Word[] = [];
  for (const w of words) {
    if (g.length && (w.start - g[g.length - 1].end > 0.45 || g.length >= max)) {
      out.push(g);
      g = [];
    }
    g.push(w);
    if (/[.!?…]$/.test(w.text)) {
      out.push(g);
      g = [];
    }
  }
  if (g.length) out.push(g);
  return out;
}
const stamp = (v: number) =>
  new Date(Math.round(v * 1000)).toISOString().slice(11, 23).replace('.', ',');
export function srt(words: Word[]) {
  return groups(words)
    .map(
      (g, i) =>
        `${i + 1}\n${stamp(g[0].start)} --> ${stamp(g[g.length - 1].end)}\n${g.map((w) => w.text).join(' ')}\n`,
    )
    .join('\n');
}
export function validWords(w: Word[], duration: number) {
  return (
    w.length > 0 &&
    w.every(
      (x, i) =>
        typeof x.text === 'string' &&
        !!x.text.trim() &&
        Number.isFinite(x.start) &&
        Number.isFinite(x.end) &&
        x.start >= 0 &&
        x.end > x.start &&
        x.end <= duration + 0.031 &&
        (!i || x.start >= w[i - 1].end - 0.001),
    )
  );
}
