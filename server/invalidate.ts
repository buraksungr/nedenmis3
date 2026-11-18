import type { Project } from '../shared/schema';
import { imageKey, voiceKey } from './production';
/** Detach stale outputs, don't delete files. Snapshots retain the original versions. */
export function invalidate(p: Project, old: Project) {
  const active = new Set(p.scenes.map((s) => s.id));
  for (const id of Object.keys(p.assets)) if (!active.has(id)) delete p.assets[id];
  for (const [i, s] of p.scenes.entries()) {
    const m = p.assets[s.id];
    if (!m) continue;
    const oldIndex = old.scenes.findIndex((x) => x.id === s.id);
    if (m.image && m.image.key !== imageKey(p, s)) {
      if (p.cover.endsWith(m.image.file))
        p.cover = old.example && old.category === 'DOĞA' ? '/art/ants.jpg' : '';
      delete m.image;
      delete m.clip;
    }
    if (m.voice && m.voice.key !== voiceKey(p, s)) {
      delete m.voice;
      delete m.align;
      delete m.words;
      delete m.edits;
      delete m.recognized;
      delete m.clip;
    }
    const next = p.scenes[i + 1],
      oldNext = oldIndex < 0 ? undefined : old.scenes[oldIndex + 1];
    if (
      p.subtitleSize !== old.subtitleSize ||
      p.highlight !== old.highlight ||
      next?.id !== oldNext?.id ||
      (next && oldNext && imageKey(p, next) !== imageKey(old, oldNext))
    )
      delete m.clip;
  }
}
