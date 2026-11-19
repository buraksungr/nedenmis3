import fs from 'node:fs';
import path from 'node:path';
import { timingProblem } from '../shared/captions';
import type { Word } from '../shared/schema';
import { exec, python, type Paths } from './media';

export { sentenceEstimates } from '../shared/captions';

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
