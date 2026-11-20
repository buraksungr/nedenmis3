// QA ONLY: test-authored editorial responses, actual image-generated raster plates. Not a production fallback.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import lines from './fixtures/ant.json';
import { STYLE_LOCK, NEGATIVE_LOCK } from '../shared/cinema';
import { completion } from './vector-test-data';
export { lines };
export const topic = 'Karıncalar kışın nereye gider?';
export const subject = 'red worker ant with a vermilion head and a burgundy banded abdomen';
export const shots = [
  {
    title: 'Kış Gelirken',
    brief:
      'A large worker pauses on a snowy woodland path near the nest at blue hour, in side profile.',
  },
  {
    title: 'Yuvaya Dönüş',
    brief:
      'Follow the worker into a sloping underground passage, with smaller workers in the tunnel behind it.',
  },
  {
    title: 'Koruyucu Toprak',
    brief:
      'Continuous winter nest cross-section beneath a snowy surface, with red workers in the warmer deep chamber.',
  },
  {
    title: 'Enerji Tasarrufu',
    brief:
      'Close-up of still red workers gathered in a sheltered chamber under curved dark earthen walls.',
  },
  {
    title: 'İlkbaharda Uyanış',
    brief:
      'A worker emerges from the nest to forage among thawed fern shoots under warm spring light.',
  },
];
export const closer =
  'Move closer to the underground tunnels where a large red worker crosses a narrow fork framed by dark earthen walls.';
export const direction = 'Yeraltındaki karınca tünellerini daha yakından göster.';
export function planned(input: Record<string, unknown>) {
  if (input.direction) {
    assert.equal(input.direction, direction);
    assert.equal(input.subject, subject);
    return completion({ brief: closer });
  }
  if (!input.scene) {
    assert.ok(typeof input.narration === 'string' && input.narration.includes(lines[0]));
    return completion({ subject });
  }
  const i = Number(input.scene) - 1;
  assert.equal(input.subject, subject);
  assert.equal(input.narration, lines[i]);
  return completion(shots[i]);
}
export function imageRequest(url: URL, expectedSubject = subject) {
  const prompt = decodeURIComponent(url.pathname.split('/').at(-1)!);
  assert.equal(url.searchParams.get('width'), '1080');
  assert.equal(url.searchParams.get('height'), '1920');
  assert.ok(url.searchParams.has('seed'));
  assert.ok(
    prompt.includes(STYLE_LOCK) &&
      prompt.includes(NEGATIVE_LOCK) &&
      prompt.includes(expectedSubject),
  );
  assert.doesNotMatch(prompt, /pixel art|<svg/i);
  return prompt;
}
export function antImage(name: string) {
  return new Response(fs.readFileSync(`tests/fixtures/ant-cinema/${name}.jpg`), {
    headers: { 'content-type': 'image/jpeg' },
  });
}
export function shotFile(prompt: string) {
  if (prompt.includes(closer)) return 'tunnel-close';
  const i = shots.findIndex((s) => prompt.includes(s.brief));
  assert.notEqual(i, -1);
  return String(i + 1).padStart(2, '0');
}
