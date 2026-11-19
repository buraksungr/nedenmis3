import type { Media, TimedText, Word, Scene } from './schema';
export const captionEntries = (m?: Media): TimedText[] =>
  m?.edits ?? (m?.align?.method === 'estimated' ? m.align.sentences : m?.words) ?? [];
export function cue(group: Word[]): TimedText {
  return {
    start: group[0].start,
    end: group[group.length - 1].end,
    text: group.map((w) => w.text).join(' '),
  };
}
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
  return srtFromCues(groups(words).map(cue));
}
export function srtFromCues(cues: TimedText[]) {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`)
    .join('\n');
}
// Keep the existing acoustic tolerances, but report the first failed invariant to the operator.
export function timingProblem(entries: unknown, duration: number): string | undefined {
  if (!Number.isFinite(duration) || duration <= 0) return 'Ölçülen ses süresi geçersiz.';
  if (!Array.isArray(entries) || !entries.length) return 'Zaman listesi yok veya boş.';
  let prev = 0;
  for (const [i, w] of entries.entries()) {
    const at = `${i + 1}. kayıt`;
    if (!w || typeof w.text !== 'string' || !w.text.trim()) return `${at}: metin yok.`;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end))
      return `${at}: başlangıç veya bitiş sonlu bir sayı değil.`;
    if (w.start < 0 || w.end <= w.start)
      return `${at}: başlangıç=${w.start}, bitiş=${w.end} sn; pozitif bir aralık değil.`;
    if (w.start >= duration)
      return `${at}: başlangıç=${w.start} sn, ses aralığının (0–${duration} sn) dışında.`;
    if (w.end > duration + 0.031)
      return `${at}: bitiş=${w.end} sn, ölçülen ses süresini (${duration} sn) aşıyor.`;
    if (i && w.start < prev - 0.001)
      return `${at}: başlangıç=${w.start} sn, önceki bitiş=${prev} sn ile çakışıyor.`;
    prev = w.end;
  }
}
export function validWords(w: TimedText[], duration: number) {
  return timingProblem(w, duration) === undefined;
}

// Return *sentence cues*, never pretend estimated word boundaries came from the waveform.
export function sentenceEstimates(text: string, duration: number): TimedText[] {
  if (!Number.isFinite(duration) || duration <= 0 || !text.trim())
    throw new Error('Tahmini altyazı için onaylı anlatım ve pozitif süre gerekiyor.');
  const sentences = Array.from(
    new Intl.Segmenter('tr', { granularity: 'sentence' }).segment(text),
    ({ segment }) => segment.trim(),
  ).filter(Boolean);
  const weights = sentences.map((s) => s.split(/\s+/u).length);
  const total = weights.reduce((a, b) => a + b, 0),
    ms = Math.floor(duration * 1000);
  const cues: TimedText[] = [],
    pending: string[] = [];
  let used = 0,
    start = 0;
  for (const [i, sentence] of sentences.entries()) {
    pending.push(sentence);
    used += weights[i];
    const last = i === sentences.length - 1;
    const end = last ? duration : Math.round((ms * used) / total) / 1000;
    // Coalesce boundaries that would collapse to a zero-length SRT cue at millisecond precision.
    if (!last && (end <= start || end >= ms / 1000)) continue;
    cues.push({ text: pending.join(' '), start, end });
    start = end;
    pending.length = 0;
  }
  return cues;
}

export const unvoicedSvg = (s: Scene, m?: Media) => s.visualMode === 'svg' && !m?.voice;
export const sceneSeconds = (s: Scene, m?: Media) =>
  unvoicedSvg(s, m) ? s.seconds : (m?.voice?.duration ?? 0);
export const sceneCaptions = (s: Scene, m?: Media) =>
  unvoicedSvg(s, m) ? sentenceEstimates(s.narration, s.seconds) : captionEntries(m);
