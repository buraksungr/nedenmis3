import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CinemaPlanner } from '../server/cinema-planner';
import { SceneModels } from '../server/scene-models';
import { Store, makeProject, scriptSig, approveBoard, approved } from '../server/store';
import { memoryVault } from '../server/vault';
import { completion } from './vector-test-data';
import { lines, planned } from './ant-fixtures';
import { illustrationPrompt, STYLE_LOCK, NEGATIVE_LOCK } from '../shared/cinema';

test('broken title is isolated and repairable without redrawing siblings; changed script cannot reuse an old subject approval', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'science-plan-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let bad = true;
  const calls: number[] = [];
  const models = new SceneModels(
    store,
    { openrouter: memoryVault(), groq: memoryVault() },
    async (_url, o) => {
      const input = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
      calls.push(input.scene ?? 0);
      return input.scene === 2 && bad
        ? completion({ title: 'Çünkü', brief: 'A close view of the winter nest.' })
        : planned(input);
    },
  );
  models.key('openrouter', 'isolated-fixture');
  const c = new CinemaPlanner(store, models),
    p = store.create(makeProject('Karıncalar', lines.slice(0, 3).join(' ')));
  p.scriptApproval = scriptSig(p);
  await assert.rejects(
    c.plan(p, () => {}),
    /tamamlanamadı/,
  );
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3]);
  assert.deepEqual(
    store.get(p.id).scenes.map((s) => !!s.cinema),
    [true, false, true],
  );
  assert.throws(() => approveBoard(p));
  bad = false;
  await c.plan(p, () => {}, p.scenes[1]);
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3, 2]);
  approveBoard(p);
  approved(p);
  const stamp = p.boardApproval;
  await c.plan(p, () => {});
  assert.equal(stamp, p.boardApproval);
  assert.equal(calls.length, 7);
  p.cinema!.subject = 'blue whale';
  assert.throws(() => approved(p));
  assert.throws(() => approveBoard(p));
});
test('style and negative tail are server-owned, subject required even for a cross-section', () => {
  const p = illustrationPrompt('blue whale', 'Cross-section of a lung during a dive');
  assert.ok(p.endsWith(STYLE_LOCK));
  assert.ok(p.includes(NEGATIVE_LOCK));
  assert.equal(p.split('blue whale').length - 1, 2);
  assert.throws(() => illustrationPrompt('', 'Draw anything'));
  assert.throws(() => illustrationPrompt('blue whale', '<svg><path/></svg>'));
});
