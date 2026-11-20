import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaxesParser } from 'saxes';
import { motionHeading, animKinds, type MotionRef } from '../shared/object-motion';
import { objectPose, ObjectScene } from '../composition/ObjectScene';
import { parseRig, parseStage } from '../server/motion-svg';
import { saveRig, saveMotion, motionFrame } from '../server/motion-files';
import { ObjectPlanner } from '../server/object-planner';
import { SceneModels } from '../server/scene-models';
import { Store, makeProject, scriptSig, approveBoard, hash } from '../server/store';
import { memoryVault } from '../server/vault';
import { rigReply, stageReply, lines, topic } from './ant-motion-art';
import { completion } from './vector-test-data';
const template = rigReply(),
  rig = parseRig(template.svg, template.subject).root;
const scene = (actors: string, decor = '', extra = '') =>
    `<svg viewBox="0 0 1080 1920">${decor}${actors}${extra}</svg>`,
  actor = (x: number, a = 'move', target = '#subject-main') =>
    `<use x="${x}" y="270" href="${target}" data-anim="${a}" data-dx="65"/>`;
const actors = actor(50) + actor(420),
  flakes = [1, 2, 3]
    .map((i) => `<circle cx="${120 * i}" cy="740" r="10" data-anim="fall"/>`)
    .join('');
test('complete Turkish titles, never cropped from narration', () => {
  for (const s of [
    'Donan Toprak Altı',
    'Kış Uykusu Değil',
    'Güvenli Derinlikler',
    'Isı Paylaşımı',
    'Doğanın Dayanışması',
  ])
    assert.ok(motionHeading.safeParse(s).success, s);
  for (const s of [
    'Donan Toprakta Kimler',
    'Karıncalar Kışın Uykusuna',
    'Toprağın Altındaki',
    'Yuvanın',
    'Kış Gelirken Ve',
    'Bu Başlık Çok Uzun',
  ])
    assert.ok(!motionHeading.safeParse(s).success, s);
});
test('rig is a coherent reusable group: morphology and articulated parts, no recursive references', () => {
  assert.throws(
    () => parseRig(template.svg.replace('id="leg-four"', 'id="four"'), template.subject),
    /altı/,
  );
  assert.throws(
    () =>
      parseRig(
        template.svg.replaceAll('data-anim="wiggle"', 'data-anim="pulse"'),
        template.subject,
      ),
    /antenna/,
  );
  assert.throws(() => parseRig(template.svg.replace('id="subject-main"', 'id="colony"')));
  assert.throws(() =>
    parseRig(template.svg.replace('</g></defs>', '<use href="#subject-main"/></g></defs>')),
  );
  const whale =
    '<svg><defs><g id="subject-main"><path id="body" d="M5 70 Q90 20 190 75 L240 79 Q90 120 5 70Z"/><path id="tail" d="M190 75 L244 54 239 78 252 96Z"/><path id="flipper" d="M80 86 Q94 121 124 111 L105 83Z"/></g></defs></svg>';
  assert.ok(parseRig(whale, 'Mavi balina'));
  assert.throws(() => parseRig(whale.replace('id="tail"', 'id="fin"'), 'Mavi balina'));
});
test('flat or gradient sets are preserved untouched; old layer wrappers, hidden or co-located subjects cannot fake five objects', () => {
  for (const decor of [
    '<rect width="100%" height="100%" fill="#223344"/>',
    '<defs><linearGradient id="sky"><stop stop-color="#def"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sky)"/>',
  ]) {
    const v = parseStage(scene(actors, decor, flakes), rig);
    assert.equal(v.actors, 2);
    assert.equal(v.objects, 5);
    assert.equal(parseStage(v.canonical, rig).canonical, v.canonical);
  }
  for (const svg of [
    scene(actors),
    scene(actor(50) + actor(50), '', flakes),
    scene(actor(30) + actor(30000), '', flakes),
    scene(actor(50) + `<g opacity="0">${actor(450)}</g>`, '', flakes),
    scene(`<g data-anim="pulse">${actors}</g>`, '', flakes),
    scene(actors, '<rect width="100%" height="100%" data-anim="pulse"/>', flakes),
    scene(actors, '', flakes.replaceAll('fall', 'draw')),
  ])
    assert.throws(() => parseStage(svg, rig));
});
test('only the fixed local rig can be instantiated and only bounded inert motion metadata reaches React', () => {
  for (const xml of [
    scene(actor(42, 'move', 'http://example.test/s.svg#subject-main') + actor(500), '', flakes),
    scene(actors, '', flakes.replace('fall', 'invented')),
    scene(actors, '', flakes.replace('r="10"', 'r="10" data-delay="-1"')),
    scene(actors, '', flakes.replace('r="10"', 'r="10" data-dx="Infinity"')),
    scene(actors, '', flakes.replace('r="10"', 'r="10" onclick="0"')),
    scene(actors, '<g id="subject-main"/>', flakes),
    scene(actors, '<image/>', flakes),
    scene(actors, '<animate/>', flakes),
  ])
    assert.throws(() => parseStage(xml, rig));
});
test('eight deterministic frame-based primitives: travel in units, looping weather, normalized trace, pivot, spring overshoot', () => {
  const at = (kind: string, f: number, extra = {}) =>
    objectPose(
      {
        tag: 'path',
        attrs: {
          'data-anim': kind,
          'data-duration': '1',
          'data-dx': '120',
          'data-dy': '60',
          'data-pivot-x': '10',
          'data-pivot-y': '20',
          ...extra,
        },
        children: [],
      },
      f,
      30,
    );
  assert.equal(animKinds.length, 8);
  assert.equal(at('move', 30, { 'data-delay': '.5' }).transform, 'translate(60 30)');
  assert.equal(at('draw', 15).reveal, 0.5);
  assert.equal(at('fall', 15).transform, 'translate(60 30)');
  assert.deepEqual(at('fall', 15), at('fall', 45));
  assert.equal(at('rise', 15).transform, 'translate(60 -30)');
  assert.ok(at('pulse', 18).opacity! < at('pulse', 3).opacity!);
  for (const k of ['swing', 'wiggle']) assert.ok(at(k, 7).transform?.endsWith(' 10 20)'));
  assert.equal(at('pop', 2, { 'data-delay': '.2' }).opacity, 0);
  assert.ok(
    Array.from({ length: 30 }, (_, f) =>
      Number(at('pop', f).transform?.match(/scale\(([^)]+)/)?.[1]),
    ).some((v) => v > 1),
  );
});
test('frame renderer: unchanged camera and set; non-colliding rig references on a dissolve; draw normalizes the actual path', () => {
  const stage = parseStage(stageReply(1).svg, rig).root,
    ref = { title: 'Güvenli Derinlikler', digest: 'demo' } as MotionRef;
  const nodes = (frame: number) => {
      const tree = renderToStaticMarkup(
        createElement(
          'div',
          {},
          ...[0, 1].map((i) =>
            createElement(ObjectScene, { key: i, scene: { rig, stage, ref }, frame }),
          ),
        ),
      );
      const tags: Record<string, string>[] = [];
      const parser = new SaxesParser();
      parser.on('opentag', (v) => {
        tags.push({ tag: v.name, ...v.attributes });
      });
      parser.write(tree).close();
      return tags;
    },
    a = nodes(0),
    b = nodes(30);
  assert.deepEqual(
    a.filter((n) => 'data-fixed-camera' in n),
    b.filter((n) => 'data-fixed-camera' in n),
  );
  assert.equal(b.filter((n) => 'data-fixed-camera' in n).length, 2);
  assert.deepEqual(
    a.filter((n) => n.id?.endsWith('set-set')),
    b.filter((n) => n.id?.endsWith('set-set')),
  );
  const ids = b.map((n) => n.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(b.filter((n) => n.tag === 'use').map((n) => n.href)).size, 2);
  for (const n of b.filter((n) => n.tag === 'use')) assert.ok(ids.includes(n.href.slice(1)));
  assert.ok(
    b.some((n) => n.tag === 'path' && n.pathLength === '1' && Number(n['stroke-dashoffset']) < 1),
  );
});
test('content address binds scene to narration and the exact project rig; offline tampering cannot become a rendered frame', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = { provider: 'openrouter' as const, model: 'qa' },
    r = saveRig(
      root,
      { kind: 'subject-rig-v1', subject: template.subject, scriptHash: hash(topic), ...source },
      template.svg,
    ),
    s = stageReply(),
    ref = saveMotion(
      root,
      r,
      { kind: 'objects-v1', title: s.title, narrationHash: hash(lines[0]), ...source },
      s.svg,
    );
  assert.equal(motionFrame(root, r, ref, lines[0]).ref.objects, 23);
  assert.throws(() => motionFrame(root, r, ref, lines[1]));
  assert.throws(() => motionFrame(root, { ...r, subject: 'Başka özne' }, ref, lines[0]));
  assert.throws(() => motionFrame(root, r, { ...ref, title: 'Sahte Çizim' }, lines[0]));
  fs.appendFileSync(path.join(root, 'media', 'motion', r.digest + '.svg'), ' ');
  assert.throws(() => motionFrame(root, r, ref, lines[0]));
});
test('one broken middle heading: two repairs, later sibling saved, reload and retry only the missing shot and never request the rig again', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-plan-')),
    store = new Store(dir, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const calls: number[] = [];
  let bad = true;
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_, o) => {
      const q = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
      calls.push(q.sahne ?? 0);
      return completion(
        q.sahne
          ? {
              ...stageReply(q.sahne - 1),
              ...(bad && q.sahne === 2
                ? { title: q.onarım ? 'Karıncalar Kışın Uykusuna' : 'Donan Toprakta Kimler' }
                : {}),
            }
          : template,
      );
    },
  );
  models.key('openrouter', 'offline-drawing-test');
  const planner = new ObjectPlanner(store, models, async () => {});
  let p = store.create(makeProject(topic, lines.slice(0, 3).join(' ')));
  p.scriptApproval = scriptSig(p);
  await assert.rejects(
    planner.plan(p, () => {}),
    /1 sahne/,
  );
  p = store.get(p.id);
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3]);
  const before = p.scenes.map((s) => s.choreography?.digest);
  assert.ok(before[0] && !before[1] && before[2]);
  assert.throws(() => approveBoard(p));
  bad = false;
  await planner.plan(p, () => {}, p.scenes[1]);
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3, 2]);
  assert.equal(p.motionWork, undefined);
  approveBoard(p);
  const sig = p.boardApproval;
  await planner.plan(p, () => {});
  assert.equal(p.boardApproval, sig);
  assert.equal(p.scenes[0].choreography?.digest, before[0]);
  assert.equal(p.scenes[2].choreography?.digest, before[2]);
  assert.equal(calls.length, 7);
});
