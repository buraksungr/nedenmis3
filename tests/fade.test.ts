import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dissolveAt } from '../composition/fade';
import { blankScene } from '../shared/schema';
import { invalidate } from '../server/invalidate';
import { imageKey, voiceKey } from '../server/production';
import { makeProject } from '../server/store';

const scene = blankScene('first');
test('crossfade is clamped, eased and duration-safe without overlapping the audio tracks', () => {
  assert.equal(dissolveAt(0, 30, 1), 0);
  for (const n of [2, 5, 24, 91, 390]) {
    const alphas = Array.from({ length: n }, (_, f) => dissolveAt(f, 30, n));
    assert.equal(alphas[0], 0);
    assert.equal(alphas.at(-1), 1);
    assert.ok(alphas.every((v, i) => v >= 0 && v <= 1 && (!i || v >= alphas[i - 1])));
  }
  assert.equal(dissolveAt(70, 30, 91), 0);
  assert.ok(dissolveAt(75, 30, 91) < 0.25);
  assert.ok(Math.abs(dissolveAt(80, 30, 91) - 0.5) < 1e-8);
});

test('only photo, neighbour and subtitle dependencies affect static clips, even for legacy boards', () => {
  const p = makeProject('Kontrol');
  p.scenes = [
    { ...scene, transition: 'cut' },
    { ...scene, id: 'second' },
    { ...scene, id: 'third' },
  ];
  for (const s of p.scenes)
    p.assets[s.id] = {
      image: { file: `${s.id}.jpg`, key: imageKey(p, s) },
      voice: { file: `${s.id}.wav`, key: voiceKey(p, s) },
      clip: { file: `${s.id}.mp4`, key: 'cached' },
    };
  const original = structuredClone(p);
  Object.assign(p.scenes[1], {
    camera: 'focus',
    motion: 2,
    effect: 'rays',
    object: 'orbit',
    transition: 'iris',
  });
  p.intensity = 'Yüksek';
  invalidate(p, original);
  assert.deepEqual(p.assets, original.assets);
  p.scenes.unshift({ ...scene, id: 'inserted' });
  invalidate(p, original);
  assert.deepEqual(p.assets, original.assets); // shifted indices alone do not affect stills
  p.scenes[2].prompt = 'Yeni görsel';
  invalidate(p, original);
  assert.ok(!p.assets.first.clip && !p.assets.second.clip && p.assets.third.clip);
  assert.ok(p.assets.first.image && p.assets.first.voice && p.assets.second.voice);
  const reordered = structuredClone(original);
  reordered.scenes.reverse();
  invalidate(reordered, original);
  assert.ok(Object.values(reordered.assets).every((a) => !a.clip && a.image && a.voice));
});
