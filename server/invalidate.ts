import { isSvgScene, mediaUrl, type Project, type Scene } from '../shared/schema';
import { draftInputs, imageKey, voiceKey } from './production';
import { hash } from './store';
const visualKey = (p: Project, s: Scene) =>
  s.visualMode === 'motion-svg'
    ? hash(s.choreography)
    : s.visualMode === 'svg'
      ? hash('svg', s.vector ?? s.svgPlan)
      : s.visualMode === 'illustration'
        ? hash(imageKey(p, s), s.cinema?.title)
        : imageKey(p, s);
/** Detach stale outputs, don't delete files. Snapshots retain the original versions. */
export function invalidate(p: Project, old: Project) {
  if (p.draft && draftInputs(p) !== draftInputs(old)) delete p.draft;
  const active = new Set(p.scenes.map((s) => s.id));
  for (const id of Object.keys(p.assets)) if (!active.has(id)) delete p.assets[id];
  for (const [i, s] of p.scenes.entries()) {
    const m = p.assets[s.id];
    if (!m) continue;
    const oldIndex = old.scenes.findIndex((x) => x.id === s.id);
    if (m.image && (s.visualMode === 'motion-svg' || m.image.key !== imageKey(p, s))) {
      if (p.cover === mediaUrl(p, m.image.file))
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
      oldIndex < 0 ||
      visualKey(p, s) !== visualKey(old, old.scenes[oldIndex]) ||
      (isSvgScene(s) &&
        !m.voice &&
        (s.svgVoiceMode !== old.scenes[oldIndex].svgVoiceMode ||
          s.seconds !== old.scenes[oldIndex].seconds ||
          s.narration !== old.scenes[oldIndex].narration)) ||
      p.subtitleSize !== old.subtitleSize ||
      p.highlight !== old.highlight ||
      next?.id !== oldNext?.id ||
      (next && oldNext && visualKey(p, next) !== visualKey(old, oldNext))
    )
      delete m.clip;
  }
}
