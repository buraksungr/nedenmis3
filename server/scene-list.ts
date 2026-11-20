import { randomUUID } from 'node:crypto';
import { blankScene, normalize, type Project, type Scene } from '../shared/schema';
import { requireThat } from './store';
// Segmentation and identifiers belong to the application, not the LLM. In particular,
// failed planning must not rewrite approved narration or orphan an existing recording.
export function skeleton(p: Project, mode: 'svg' | 'illustration'): Scene[] {
  if (
    p.scenes.length &&
    normalize(p.scenes.map((s) => s.narration).join(' ')) === normalize(p.script) &&
    p.scenes.every((s) => s.narration.trim())
  )
    return p.scenes;
  const text = normalize(p.script);
  const segments = Array.from(
    new Intl.Segmenter('tr', { granularity: 'sentence' }).segment(text),
    (s) => s.segment,
  );
  const stride = Math.max(1, Math.ceil(segments.length / 24)),
    rows: string[] = [];
  let block = '';
  for (const [i, segment] of segments.entries()) {
    block += segment; // Do not introduce whitespace at punctuation where the original had none.
    if (i < segments.length - 1 && ((i + 1) % stride !== 0 || !block.endsWith(' '))) continue;
    let row = '';
    for (const word of block.trim().split(' ')) {
      requireThat(word.length <= 5000, 'Senaryodaki çok uzun sözcüğü kısaltın.', 422);
      if (row && row.length + 1 + word.length > 5000) {
        rows.push(row);
        row = '';
      }
      row += (row ? ' ' : '') + word;
    }
    if (row) rows.push(row);
    block = '';
  }
  requireThat(rows.length > 0 && rows.length <= 24, 'Senaryo sahnelere ayrılamadı.', 422);
  const unused = [...p.scenes];
  return rows.map((narration) => {
    const ix = unused.findIndex((s) => normalize(s.narration) === narration);
    if (ix >= 0) return unused.splice(ix, 1)[0];
    return {
      ...blankScene(randomUUID()),
      narration,
      visualMode: mode,
      description: narration,
      seconds: Math.max(2, Math.min(120, Math.round(narration.split(/\s+/u).length / 2.4))),
    };
  });
}
