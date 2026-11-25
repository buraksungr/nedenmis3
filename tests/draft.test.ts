import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { app } from './http-studio';
import { stageReply } from './ant-motion-art';
import { saveMotion } from '../server/motion-files';
import { hash, now } from '../server/store';
import { invalidate } from '../server/invalidate';
import { blankScene, type Project } from '../shared/schema';

test('draft status verifies signed artwork and the HTTP route bypasses board approval only for drafts', async (t) => {
  const { req, settle, store, prod } = await app(t);
  let p: Project = await (
    await req('/projects', {
      topic: 'Yeraltı taslağı',
      script: 'Birinci sahne. İkinci sahne. Üçüncü sahne.',
    })
  ).json();
  const route = '/projects/' + p.id;
  assert.equal((await req(route + '/generate', { kind: 'draft' }, p.rev)).status, 409);
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  assert.equal((await req(route + '/generate', { kind: 'draft' }, p.rev)).status, 409);
  p.scenes = ['Birinci sahne.', 'İkinci sahne.', 'Üçüncü sahne.'].map((narration) => ({
    ...blankScene(randomUUID()),
    visualMode: 'motion-svg',
    narration,
  }));
  for (const i of [0, 2])
    p.scenes[i].choreography = saveMotion(
      store.dir(p.id),
      {
        kind: 'objects-v1',
        title: stageReply(i).title,
        narrationHash: hash(p.scenes[i].narration),
        provider: 'openrouter',
        model: 'offline-test',
      },
      stageReply(i).svg,
    );
  // The third file is no longer signed and must be skipped, not rendered as ready.
  fs.appendFileSync(
    path.join(store.dir(p.id), 'media', 'motion', p.scenes[2].choreography!.digest + '.svg'),
    ' ',
  );
  store.save(p);
  assert.deepEqual(await (await req(route + '/draft-status')).json(), { ready: 1, total: 3 });
  assert.equal((await req(route + '/generate', { kind: 'all' }, p.rev)).status, 409);
  assert.equal(
    (await req(route + '/generate', { kind: 'draft', scene: p.scenes[0].id }, p.rev)).status,
    400,
  );
  let invoked = 0;
  prod.exportDraft = async (project) => {
    invoked++;
    assert.equal(project.boardApproval, null);
    assert.deepEqual(
      prod.draftReadyScenes(project).map((s) => s.id),
      [p.scenes[0].id],
    );
    return { state: 'done', kind: 'draft', label: '1/3 hazır sahne • Sessiz taslak', at: now() };
  };
  assert.equal((await req(route + '/generate', { kind: 'draft' }, p.rev + 1)).status, 412);
  assert.equal((await req(route + '/generate', { kind: 'draft' }, p.rev)).status, 202);
  p = await settle(route);
  assert.equal(invoked, 1);
  assert.equal(p.job.label, '1/3 hazır sahne • Sessiz taslak');
  assert.equal(p.boardApproval, null);
  assert.equal(p.final, undefined);
  assert.deepEqual(p.assets, {});
});

test('draft invalidation tracks visual/timing inputs without destroying normal production', async (t) => {
  const { store } = await app(t);
  const p = store.create(
    (await import('../server/store')).makeProject('Kış taslağı', 'Bir sahne.'),
  );
  p.scenes = [{ ...blankScene(randomUUID()), visualMode: 'motion-svg', narration: p.script }];
  p.draft = {
    asset: { file: `renders/${randomUUID()}.mp4`, key: 'draft' },
    scenes: [{ id: p.scenes[0].id, frames: 150 }],
    total: 1,
  };
  p.final = { file: `renders/${randomUUID()}.mp4`, key: 'normal' };
  const original = structuredClone(p);
  p.voiceStyle = 'Değişen seslendirme';
  invalidate(p, original);
  assert.deepEqual(p.draft, original.draft, 'voice settings do not affect a silent draft');
  p.scenes[0].seconds += 1;
  invalidate(p, original);
  assert.equal(p.draft, undefined);
  assert.deepEqual(p.final, original.final, 'draft invalidation does not touch the normal export');
});
