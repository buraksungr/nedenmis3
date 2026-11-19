import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { parseIllustration, MAX_XML } from '../server/layered-svg';
import { checkPaint } from '../server/vector-proof';
import { readIllustration, verifiedFrame } from '../server/vector-files';
import { SvgPlanner } from '../server/svg-planner';
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
    assert.ok((await checkPaint(a.drawing)).subject > 0.1);
    assert.ok(heading.safeParse(s.title).success);
  }
});
test('reject malformed XML, active/foreign/external content, invalid geometry and wrong or empty layers', () => {
  const v = sample().svg;
  const inject = (s: string) => v.replace('<g id="layer-fx">', '<g id="layer-fx">' + s);
  for (const x of [
    v.slice(0, -9),
    '<!DOCTYPE svg>' + v,
    v.repeat(2),
    v.replace('1080 1350', '1080 1920'),
    v.replace('id="layer-bg"', 'id="layer-main"'),
    v.replace(
      /<g id="layer-main">[\s\S]*<g id="layer-fx">/,
      '<g id="layer-main"/><g id="layer-fx">',
    ),
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
    inject('<rect width="0" height="10"/>'),
    inject('<g transform="matrix(1 2)"/>'),
    inject('<z:g xmlns:z="urn:other"/>'),
    inject('<g style="stroke:red"/>'),
    inject('<text>Üç bilimsel kelime</text>'),
    inject('<text>A</text>'.repeat(3)),
    inject('<g>'.repeat(20) + '</g>'.repeat(20)),
    v.replace('<g id="layer-bg">', '<g id="layer-bg"><text>Başlık</text>'),
  ])
    assert.throws(() => parseIllustration(x));
});
test('actual paint test detects tiny, transparent, offscreen or fully hidden geometry', async () => {
  for (const [id, attribute] of [
    ['layer-bg', 'opacity="0"'],
    ['layer-main', 'transform="scale(.1)"'],
    ['layer-main', 'transform="translate(5000 0)"'],
    ['layer-fx', 'opacity="0"'],
  ]) {
    const { drawing } = parseIllustration(
      sample().svg.replace(`id="${id}"`, `id="${id}" ${attribute}`),
    );
    await assert.rejects(checkPaint(drawing));
  }
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
  assert.deepEqual(p.scenes, []);
  planner.configure({ provider: 'disabled' });
  await assert.rejects(planner.plan(p), /Ayarlar/);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(planner.settings()).includes('isolated-key'));
});
test('scene-specific XML/title from model, one repair, immutable verified assets, offline playback, and independent redraw', async (t) => {
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
      calls === 1
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
  assert.equal(calls, 3);
  assert.ok(prompts[1].onarım);
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
  assert.equal(calls, 3);
  const next = await planner.redraw(p, p.scenes[0], 'Kırmızı okları büyüt');
  assert.equal(calls, 4);
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
test('second rejected drawing leaves the entire approved board intact; validated intermediate shots can be reused', async (t) => {
  const { store, vaults, p } = setup(t);
  let calls = 0,
    fail = true;
  const planner = new SvgPlanner(store, vaults, async (_url, o) => {
    calls++;
    const i = JSON.parse(JSON.parse(String(o?.body)).messages[1].content).sahne - 1;
    return completion(fail && i === 1 ? { ...sample(i), title: 'Devlerin Karadaki' } : sample(i));
  });
  planner.key('openrouter', 'isolated-key');
  p.scenes = whale
    .slice(0, 2)
    .map((narration) => ({ ...blankScene(randomUUID()), narration, description: 'Fotoğraf' }));
  approveBoard(p);
  const old = structuredClone(p);
  await assert.rejects(planner.plan(p), /tek onarım/);
  assert.equal(calls, 3);
  assert.deepEqual(p, old);
  approved(p);
  fail = false;
  assert.equal((await planner.plan(p)).length, 2);
  assert.equal(calls, 4);
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
