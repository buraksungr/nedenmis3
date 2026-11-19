// Read-only playback of artwork already saved by 1.3. No network acquisition.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { safeSvg, SVG_LIMIT } from './safe-svg';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
function assetPath(root: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Geçersiz çizim kimliği.');
  return path.join(root, 'media', 'atlas', id + '.svg');
}
export function readArtwork(root: string, id: string) {
  try {
    const f = assetPath(root, id);
    if (fs.statSync(f).size > SVG_LIMIT) return;
    const s = fs.readFileSync(f, 'utf8');
    if (digest(s) === id && safeSvg(s) === s) return s;
  } catch {
    /* missing or modified: keep local rendering available */
  }
}
