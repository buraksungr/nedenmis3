import fs from 'node:fs';
import path from 'node:path';
import { timingProblem } from '../shared/captions';
import type { TimedText, Word } from '../shared/schema';
import { exec, python, type Paths } from './media';

// Return *sentence cues*, never pretend estimated word boundaries came from the waveform.
export function sentenceEstimates(text: string, duration: number): TimedText[] {
  if (!Number.isFinite(duration) || duration <= 0 || !text.trim())
    throw new Error(
      'Tahmini altyazı için onaylı anlatım ve ölçülmüş pozitif ses süresi gerekiyor.',
    );
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

export async function readWhisper(
  paths: Paths,
  audio: string,
  script: string,
  out: string,
): Promise<unknown> {
  await exec(
    python(paths),
    [
      path.join(paths.pythonDir, 'align.py'),
      '--audio',
      audio,
      '--script',
      script,
      '--out',
      out,
      '--models',
      path.join(paths.root, 'models'),
    ],
    1200000,
  );
  // Keep JSON fragments (possibly containing the transcript) out of errors and logs.
  const json = fs.readFileSync(out, 'utf8');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`Whisper çıktısı geçerli JSON değil (${Buffer.byteLength(json)} bayt).`);
  }
}
export function verifiedAlignment(raw: unknown, duration: number) {
  const a = raw as { recognized?: unknown; match?: unknown; words?: Word[] } | null;
  if (typeof a?.recognized !== 'string' || !a.recognized.trim())
    throw new Error('Whisper transkripsiyonu boş veya eksik.');
  const issue = timingProblem(a.words, duration);
  if (issue) throw new Error(`Hizalama zamanları geçersiz: ${issue}`);
  const words = a.words!.map((w) => ({ ...w, end: Math.min(w.end, duration) }));
  return { method: 'whisper' as const, recognized: a.recognized, match: a.match, words };
}
