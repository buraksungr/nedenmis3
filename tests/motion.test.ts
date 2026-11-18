import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dissolveAt, poseAt } from '../composition/motion';
import { blankScene, cameras } from '../shared/schema';
import { motionForScene } from '../shared/shot';
import { invalidate } from '../server/invalidate';
import { imageKey, voiceKey } from '../server/production';
import { makeProject } from '../server/store';

const scene = blankScene('first');
test('automatic shot cycle is deterministic, directional and breathes in both directions', () => {
  const cycle = Array.from({ length: 6 }, (_, i) => motionForScene(i));
  assert.deepEqual(cycle, [
    'pan-right',
    'breathe',
    'float-up',
    'pan-left',
    'breathe',
    'float-down',
  ]);
  assert.deepEqual(
    cycle,
    cycle.map((_, i) => motionForScene(i + 6)),
  );
  const sample = (f: number, i: number) => poseAt(f, 30, 151, i, scene, 1);
  assert.ok(sample(144, 0).x > sample(0, 0).x + 4);
  assert.ok(sample(144, 3).x < sample(0, 3).x - 4);
  assert.ok(sample(40, 2).y < 0 && sample(40, 5).y > 0);
  assert.ok(sample(75, 1).scale > sample(0, 1).scale + 0.04);
  assert.ok(sample(75, 1).scale > sample(150, 1).scale + 0.04);
  const sought = sample(90, 0);
  sample(137, 2);
  sample(4, 0);
  assert.deepEqual(sample(90, 0), sought);
  assert.ok(Math.abs(poseAt(40, 30, 151, 2, scene, 0.58).y) < Math.abs(sample(40, 2).y));
});

test('framing stays full bleed even at maximum intensity; one-frame shots have a valid landing pose', () => {
  const w = 1080,
    h = 1920;
  for (const camera of cameras)
    for (let i = 0; i < 6; i++) {
      const shot = { ...scene, camera, motion: 2 };
      assert.deepEqual(poseAt(0, 30, 1, i, shot, 1.35), poseAt(0, 30, 181, i, shot, 1.35));
      for (let f = 0; f < 181; f += 3) {
        const p = poseAt(f, 30, 181, i, shot, 1.35),
          angle = (p.roll * Math.PI) / 180;
        // Inverse-transform each canvas corner into the image plane at both depths.
        for (const depth of [0.4, 1])
          for (const x of [-w / 2, w / 2])
            for (const y of [-h / 2, h / 2]) {
              const dx = x - (w * p.x * depth) / 100,
                dy = y - (h * p.y * depth) / 100;
              assert.ok(Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) <= (p.scale * w) / 2);
              assert.ok(
                Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= (p.scale * h) / 2,
              );
            }
      }
    }
});

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

test('moving a scene or changing its incoming visual invalidates the right cached clips, not its audio', () => {
  const p = makeProject('Kontrol');
  p.scenes = [scene, { ...scene, id: 'second' }, { ...scene, id: 'third' }];
  for (const s of p.scenes)
    p.assets[s.id] = {
      image: { file: `${s.id}.jpg`, key: imageKey(p, s) },
      voice: { file: `${s.id}.wav`, key: voiceKey(p, s) },
      clip: { file: `${s.id}.mp4`, key: 'old' },
      align: { file: 'prior.json', key: 'alignment' },
    };
  const original = structuredClone(p);
  p.scenes[1].effect = 'snow';
  invalidate(p, original);
  assert.ok(!p.assets.first.clip && !p.assets.second.clip && p.assets.third.clip);
  assert.deepEqual(p.assets.first.align, original.assets.first.align);
  const reordered = structuredClone(original);
  // The same scenes keep their neighbours but shift one slot in the motion cycle.
  reordered.scenes.unshift({ ...scene, id: 'inserted' });
  invalidate(reordered, original);
  assert.ok(
    !reordered.assets.first.clip && !reordered.assets.second.clip && !reordered.assets.third.clip,
  );
  for (const s of original.scenes)
    for (const asset of ['image', 'voice', 'align'] as const)
      assert.deepEqual(reordered.assets[s.id][asset], original.assets[s.id][asset]);
  const cut = structuredClone(original);
  cut.scenes[0].transition = 'cut';
  const was = structuredClone(cut);
  cut.scenes[1].motion = 0.5;
  invalidate(cut, was);
  assert.ok(cut.assets.first.clip);
});
