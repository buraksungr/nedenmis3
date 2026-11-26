import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { app } from './http-studio';
import { stageReply } from './ant-motion-art';
import { saveMotion } from '../server/motion-files';
import { instantiateTemplate } from '../server/science-templates';
import { assertDistinctAdjacentTemplates } from '../server/template-guard';
import { narrationHash } from '../server/vector-files';
import { approveBoard, hash, now } from '../server/store';
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

test('board approval and partial drafts reject consecutive repeated signed templates without altering legacy scenes', async (t) => {
  const { req, store, prod } = await app(t);
  let p: Project = await (
    await req('/projects', {
      topic: 'Karıncaların yuvası',
      script: 'Birinci sahne. İkinci sahne. Üçüncü sahne.',
    })
  ).json();
  const route = '/projects/' + p.id;
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  p.scenes = ['Birinci sahne.', 'İkinci sahne.', 'Üçüncü sahne.'].map((narration) => ({
    ...blankScene(randomUUID()),
    narration,
    visualMode: 'motion-svg' as const,
  }));
  const draw = (i: number, template: 'soil-colony' | 'ant-tunnel') => {
    const scene = p.scenes[i],
      title = ['İlk Koloni', 'Güvenli Tünel', 'Derin Koloni'][i];
    scene.choreography = saveMotion(
      store.dir(p.id),
      {
        kind: 'objects-v2',
        title,
        narrationHash: narrationHash(scene.narration),
        provider: 'openrouter',
        model: 'offline-draft-guard',
      },
      instantiateTemplate(template, { title, template }, scene.narration),
    );
  };
  draw(0, 'soil-colony');
  draw(2, 'soil-colony');
  store.save(p);
  assert.deepEqual(await (await req(route + '/draft-status')).json(), { ready: 2, total: 3 });
  const partial = await req(route + '/generate', { kind: 'draft' }, p.rev);
  assert.equal(partial.status, 422);
  assert.match((await partial.json()).error, /aynı şablon/);
  await assert.rejects(prod.exportDraft(p), /aynı şablon/);
  assert.equal(p.draft, undefined);
  draw(1, 'ant-tunnel');
  store.save(p);
  const reordered = [p.scenes[0], p.scenes[2], p.scenes[1]];
  const badBoard = await req(
    route + '/board',
    { styleGuide: p.styleGuide, scenes: reordered, approve: true },
    p.rev,
  );
  assert.equal(badBoard.status, 422);
  assert.match((await badBoard.json()).error, /aynı şablon/);
  const goodBoard = await req(
    route + '/board',
    { styleGuide: p.styleGuide, scenes: p.scenes, approve: true },
    p.rev,
  );
  assert.equal(goodBoard.status, 200);
  p = await goodBoard.json();
  assert.ok(p.boardApproval);
  // Defense in depth for direct production callers that bypass HTTP approval.
  draw(1, 'soil-colony');
  approveBoard(p);
  await assert.rejects(prod.render(p, 'all'), /aynı şablon/);
  const legacy = p.scenes.slice(0, 2).map((s, i) => ({
    ...s,
    choreography: saveMotion(
      store.dir(p.id),
      {
        kind: 'objects-v1',
        title: ['Eski Sahne', 'Eski Çizim'][i],
        narrationHash: narrationHash(s.narration),
        provider: 'openrouter',
        model: 'legacy-fixture',
      },
      stageReply(0).svg,
    ),
  }));
  assert.doesNotThrow(() => assertDistinctAdjacentTemplates(store.dir(p.id), legacy));
});
