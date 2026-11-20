import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { parseIllustration, MAX_XML } from '../server/layered-svg';
import { readIllustration, verifiedFrame } from '../server/vector-files';
import { SvgPlanner } from './legacy-layered-planner';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { Store, makeProject, scriptSig, approveBoard, approved } from '../server/store';
import { blankScene } from '../shared/schema';
import { heading, layers } from '../shared/vector';
import { legacyPlate } from '../shared/legacy-atlas';
import { svgPlanSchema } from '../shared/svg';
import { sample, completion } from './vector-test-data';
import whale from './fixtures/whale.json';
import legacy from './fixtures/legacy-flight.json';
function setup(t: TestContext, n = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-vector-')),
    store = new Store(root, false),
    vaults = { groq: memoryVault(), openrouter: memoryVault() },
    p = store.create(
      makeProject('Karaya vuran balinalar neden ölür?', whale.slice(0, n).join(' ')),
    );
  p.scriptApproval = scriptSig(p);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { force: true, recursive: true });
  });
  return { root, store, p, vaults };
}
test('rich colors, bounded local gradients and all three visible full-stage layers survive canonical round trip', async () => {
  for (const [i] of whale.entries()) {
    const s = sample(i),
      a = parseIllustration(s.svg);
    assert.deepEqual(parseIllustration(a.canonical), a);
    assert.ok(a.drawing.defs.length);
    assert.deepEqual(Object.keys(a.drawing.layers), layers);
    assert.deepEqual(parseIllustration(s.svg, { title: s.title, narration: whale[i] }), a);
    assert.ok(heading.safeParse(s.title).success);
  }
});
test('reject malformed XML, active/foreign/external content, invalid geometry and missing or repeated layers', () => {
  const v = sample().svg;
  const inject = (s: string) => v.replace('<g id="layer-fx">', '<g id="layer-fx">' + s);
  for (const x of [
    v.slice(0, -9),
    '<!DOCTYPE svg>' + v,
    v.repeat(2),
    v.replace('1080 1350', '1080 -1'),
    v.replace('id="layer-bg"', 'id="layer-main"'),
    v.replace(/<g id="layer-main">[\s\S]*<g id="layer-fx">/, '<g id="layer-fx">'),
    v + ' '.repeat(MAX_XML),
    v.replace('url(#sky)', 'url(#missing)'),
    inject('<circle r="8" fill="url(https://example.com/paint)"/>'),
    inject('<use href="#sky"/>'),
    inject('<script/>'),
    inject('<image/>'),
    inject('<a/>'),
    inject('<animate/>'),
    inject('<foreignObject/>'),
    inject('<style/>'),
    inject('<g onload="1"/>'),
    inject('<circle r="1e999"/>'),
    inject('<path d="M3 4 C90"/>'),
    inject('<rect width="-1" height="10"/>'),
    inject('<g transform="matrix(1 2)"/>'),
    inject('<z:g xmlns:z="urn:other"/>'),
    inject('<g style="stroke:red"/>'),
    inject('<g>'.repeat(20) + '</g>'.repeat(20)),
  ])
    assert.throws(() => parseIllustration(x));
});
const flat = (paint: string) =>
  `<svg viewBox="0 0 1080 1350"><defs><linearGradient id="sky"><stop stop-color="#7ac"/><stop offset="100%" stop-color="#8bc"/></linearGradient></defs><g id="layer-bg"><rect width="100%" height="100%" fill="${paint}"/></g><g id="layer-main"/><g id="layer-fx" opacity="0"/></svg>`;
test('flat and gradient environments pass on the first response and round-trip with app light, even with tiny or empty layers', async (t) => {
  const { p, store, vaults } = setup(t);
  let calls = 0;
  const planner = new SvgPlanner(store, vaults, async () =>
    completion({ ...sample(), svg: flat(['#123', 'url(#sky)'][calls++]) }),
  );
  planner.key('openrouter', 'isolated-key');
  const scenes = await planner.plan(p);
  assert.equal(calls, 2);
  for (const s of scenes) {
    const art = readIllustration(store.dir(p.id), s.vector!.digest);
    assert.equal(art.drawing.layers['layer-bg'].children.length, 2);
    assert.deepEqual(parseIllustration(art.canonical), {
      drawing: art.drawing,
      canonical: art.canonical,
    });
  }
  for (const layer of layers)
    assert.throws(() => parseIllustration(flat('#123').replace(layer, 'unknown')));
  assert.throws(() => parseIllustration(flat('url(https://example.invalid/a)')));
});
test('safe alternate coordinate systems are fitted to the full stage, not sent for aesthetic repair', () => {
  for (const input of [
    flat('#fff').replace('viewBox="0 0 1080 1350"', 'width="200px" height="300"'),
    flat('#fff').replace('0 0 1080 1350', '-10 2 400 402'),
    flat('#fff').replace('viewBox="0 0 1080 1350"', 'width="100%"'),
  ]) {
    const a = parseIllustration(input, { title: 'Deneme Sahnesi', narration: '' });
    assert.deepEqual(parseIllustration(a.canonical), a);
    assert.equal(a.drawing.layers['layer-bg'].children.length, 2);
  }
});
test('a shorter approved script consisting entirely of finished scenes commits the reused IDs offline', async (t) => {
  const { store, vaults, p } = setup(t);
  const planner = new SvgPlanner(store, vaults, async () => completion(sample()));
  planner.key('openrouter', 'isolated-key');
  await planner.plan(p);
  const first = p.scenes[0];
  p.script = first.narration;
  p.scriptApproval = scriptSig(p);
  planner.key('openrouter');
  await planner.plan(p);
  assert.deepEqual(store.get(p.id).scenes, [first]);
});
test('headings are validated, not cut to fit or rebuilt from narration', () => {
  for (const s of [
    'Devlerin Karadaki',
    'Yapar ve nefes',
    'Devasa Efendileri Olan Balinalar',
    'Kuvvet',
    'Etkiler ve',
    '<g>Basınç</g>',
    'Başlık 1',
  ])
    assert.ok(!heading.safeParse(s).success, s);
  for (const s of ['Solunum Güçlüğü', 'Kaldırma Kuvveti', 'Aşırı Isınma', 'Karada Isı Kaybı'])
    assert.equal(heading.parse(s), s);
});
test('consent before requests; no slide, fabricated headline, or automatic provider switch on outage', async (t) => {
  const { store, vaults, p } = setup(t);
  let calls = 0;
  const planner = new SvgPlanner(store, vaults, async () => {
    calls++;
    return new Response('private-error', { status: 503 });
  });
  await assert.rejects(planner.plan(p), /Ayarlar/);
  assert.equal(calls, 0);
  planner.key('openrouter', 'isolated-key');
  await assert.rejects(planner.plan(p), /HTTP 503/);
  assert.equal(calls, 1);
  assert.equal(p.scenes.filter((s) => s.vector).length, 0);
  assert.equal(p.vectorWork?.[p.scenes[0].id].state, 'failed');
  planner.configure({ provider: 'disabled' });
  await assert.rejects(planner.plan(p), /Ayarlar/);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(planner.settings()).includes('isolated-key'));
});
test('scene-specific XML/title from model, two automatic repairs, immutable verified assets, offline playback, and independent redraw', async (t) => {
  const { store, vaults, p } = setup(t);
  let calls = 0;
  const prompts: Record<string, unknown>[] = [];
  const planner = new SvgPlanner(store, vaults, async (url, o) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
    const b = JSON.parse(String(o?.body));
    assert.equal(b.model, 'openrouter/free');
    assert.equal(o?.redirect, 'error');
    const input = JSON.parse(b.messages[1].content);
    prompts.push(input);
    calls++;
    return completion(
      calls <= 2
        ? { ...sample(), svg: '<svg>' }
        : input.yönlendirme
          ? sample(2)
          : sample(input.sahne - 1),
    );
  });
  planner.key('openrouter', 'isolated-key');
  p.scenes = whale.slice(0, 2).map((narration) => ({ ...blankScene(randomUUID()), narration }));
  const before = structuredClone(p.scenes);
  p.scenes = await planner.plan(p);
  assert.equal(calls, 4);
  assert.ok(prompts[1].onarım && prompts[2].onarım);
  assert.equal(prompts[0].anlatım, p.scenes[0].narration);
  assert.deepEqual(
    p.scenes.map((s) => [s.id, s.narration]),
    before.map((s) => [s.id, s.narration]),
  );
  const ref = p.scenes[0].vector!;
  assert.equal(ref.title, sample().title);
  const base = store.dir(p.id),
    image = verifiedFrame(base, ref, p.scenes[0].narration);
  assert.deepEqual(
    (await planner.plan(p)).map((s) => s.vector),
    p.scenes.map((s) => s.vector),
  );
  assert.equal(calls, 4);
  const next = await planner.redraw(p, p.scenes[0], 'Kırmızı okları büyüt');
  assert.equal(calls, 5);
  assert.equal(prompts.at(-1)?.yönlendirme, 'Kırmızı okları büyüt');
  assert.ok(prompts.at(-1)?.öncekiÇizim);
  assert.notEqual(next.digest, ref.digest);
  assert.throws(() =>
    verifiedFrame(base, { ...ref, title: 'Farklı Bir Başlık' }, p.scenes[0].narration),
  );
  assert.throws(() => verifiedFrame(base, ref, 'Yeni anlatım'));
  planner.key('openrouter');
  assert.deepEqual(readIllustration(base, ref.digest).drawing, image.drawing);
  fs.appendFileSync(path.join(base, 'media', 'illustrations', ref.digest + '.svg'), ' ');
  assert.throws(() => readIllustration(base, ref.digest));
  assert.throws(() => readIllustration(base, '../a'));
});
test('one bad middle drawing takes exactly two repairs without blocking later scenes; retry only that ID from disk', async (t) => {
  const { store, vaults, p } = setup(t, 3);
  p.scenes = whale
    .slice(0, 3)
    .map((narration) => ({ ...blankScene(randomUUID()), description: narration, narration }));
  approveBoard(p);
  const ids = p.scenes.map((s) => s.id),
    calls: number[] = [];
  let fail = true;
  const planner = new SvgPlanner(store, vaults, async (_url, o) => {
    const i = JSON.parse(JSON.parse(String(o?.body)).messages[1].content).sahne - 1;
    calls.push(i);
    if (i === 1) assert.equal(store.get(p.id).scenes[0].vector?.title, sample().title); // visible DURING the blocked/failed next request
    return completion(fail && i === 1 ? { ...sample(i), svg: '<svg>' } : sample(i));
  });
  planner.key('openrouter', 'isolated-key');
  await assert.rejects(planner.plan(p), /iki onarım/);
  assert.deepEqual(calls, [0, 1, 1, 1, 2]);
  const disk = store.get(p.id);
  assert.equal(disk.boardApproval, null);
  assert.deepEqual(
    disk.scenes.map((s) => s.id),
    ids,
  );
  assert.deepEqual(
    disk.scenes.map((s) => !!s.vector),
    [true, false, true],
  );
  assert.deepEqual(Object.keys(disk.vectorWork!), [ids[1]]);
  assert.equal(disk.vectorWork![ids[1]].state, 'failed');
  fail = false;
  await planner.redraw(disk, disk.scenes[1], undefined);
  assert.deepEqual(calls, [0, 1, 1, 1, 2, 1]);
  assert.equal(store.get(p.id).vectorWork, undefined);
  for (const i of [0, 2]) assert.deepEqual(disk.scenes[i], p.scenes[i]);
  approveBoard(disk);
  approved(disk);
});
test('authorised Gemini text generateContent path, one repair for an incomplete response, no TTS/images', async (t) => {
  const { store, vaults, p } = setup(t, 1);
  let calls = 0;
  const model = 'gemini-2.5-flash',
    g = new Gemini(store, memoryVault(), async (url, o) => {
      if (o?.method === 'GET')
        return Response.json({
          models: [{ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] }],
        });
      assert.match(String(url), /v1beta\/models\/gemini-2\.5-flash:generateContent$/);
      const b = JSON.parse(String(o?.body));
      assert.equal(b.generationConfig.responseMimeType, 'application/json');
      assert.match(b.contents[0].parts[0].text, /layer-main/);
      const truncated = calls++ === 0;
      return Response.json({
        candidates: [
          {
            finishReason: truncated ? 'MAX_TOKENS' : 'STOP',
            content: { parts: [{ text: truncated ? '{' : JSON.stringify(sample()) }] },
          },
        ],
      });
    });
  const planner = new SvgPlanner(
    store,
    vaults,
    async () => {
      throw Error('not OpenRouter');
    },
    g,
  );
  g.key('isolated-gemini-key');
  await g.test();
  await assert.rejects(planner.plan(p), /metin modeli/);
  assert.equal(calls, 0);
  g.configure('text', { model, consent: 'free' });
  const [s] = await planner.plan(p);
  assert.equal(calls, 2);
  assert.equal(s.vector?.provider, 'gemini');
  assert.equal(s.vector?.model, model);
});
test('opening a signed legacy storyboard never selects a template, calls a model, or modifies the project file', (t) => {
  const { store, p } = setup(t, 1);
  const plan = svgPlanSchema.parse(legacy[0]);
  p.scenes = [
    { ...blankScene(randomUUID()), visualMode: 'svg', narration: p.script, svgPlan: plan },
  ];
  approveBoard(p);
  store.save(p);
  const fname = path.join(store.dir(p.id), 'project.json'),
    before = fs.readFileSync(fname),
    reopened = store.get(p.id);
  approved(reopened);
  assert.deepEqual(legacyPlate(reopened.scenes[0].svgPlan!), plan);
  assert.deepEqual(fs.readFileSync(fname), before);
});
