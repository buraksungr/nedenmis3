import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { z } from 'zod';
import { defaultSvg, svgPlanSchema, templates } from '../shared/svg';
import { blankScene, normalize } from '../shared/schema';
import { Store, makeProject, scriptSig, approveBoard, approved } from '../server/store';
import { SvgPlanner } from '../server/svg-planner';
import { memoryVault } from '../server/vault';
import { invalidate } from '../server/invalidate';
import { imageKey, voiceKey } from '../server/production';
function setup(t: TestContext, transport: typeof fetch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-svg-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const keys = { groq: memoryVault(), openrouter: memoryVault() },
    planner = new SvgPlanner(store, keys, transport);
  const p = makeProject(
    'Kış',
    'Toprak yüzeyi karla kaplanır. Sıcaklık -5 dereceden +4 dereceye çıkar.',
  );
  p.scriptApproval = scriptSig(p);
  return { store, planner, p, keys };
}
const valid = defaultSvg('Toprakta kök gelişimi.');
test('diagram contract accepts exactly seven typed fields for five templates', () => {
  assert.equal(z.toJSONSchema(svgPlanSchema).additionalProperties, false);
  for (const template of templates)
    assert.ok(svgPlanSchema.safeParse({ ...valid, template }).success);
  for (const invalid of [
    { ...valid, other: 'markup' },
    { ...valid, toValue: '4' },
    { ...valid, fromValue: Infinity },
    { ...valid, template: 'CustomJSX' },
    { ...valid, weather: 'storm' },
    { ...valid, accentColor: 'url(example)' },
    { ...valid, title: '' },
    { ...valid, subtitle: undefined },
  ])
    assert.equal(svgPlanSchema.safeParse(invalid).success, false);
  assert.ok(svgPlanSchema.safeParse(defaultSvg('🍃'.repeat(120))).success);
});
test('local planning keeps approved narration verbatim, needs neither keys nor transport', async (t) => {
  let calls = 0;
  const { planner, p } = setup(t, async () => {
    calls++;
    throw Error();
  });
  const result = await planner.plan(p);
  assert.equal(calls, 0);
  assert.equal(result.warning, '');
  assert.equal(normalize(result.scenes.map((s) => s.narration).join(' ')), normalize(p.script));
  assert.ok(
    result.scenes.every(
      (s) => s.visualMode === 'svg' && svgPlanSchema.safeParse(s.svgPlan).success,
    ),
  );
  assert.equal(result.scenes[1].svgPlan.template, 'ThermometerGaugeScene');
  assert.deepEqual([result.scenes[1].svgPlan.fromValue, result.scenes[1].svgPlan.toValue], [-5, 4]);
  p.scriptApproval = null;
  await assert.rejects(planner.plan(p), /onay/);
});
test('OpenAI-compatible planners target only their selected host and validate the entire JSON plan', async (t) => {
  const calls: { url: string; h: Headers; b: any; redirect: RequestRedirect | undefined }[] = [];
  const { planner, p } = setup(t, async (url, opts) => {
    calls.push({
      url: String(url),
      h: new Headers(opts?.headers),
      b: JSON.parse(String(opts?.body)),
      redirect: opts?.redirect,
    });
    if (String(url).endsWith('/api/show'))
      return Response.json({ model_info: { 'general.architecture': 'qwen2' } });
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              scenes: [
                { ...valid, title: 'Test 1' },
                { ...valid, title: 'Test 2' },
              ],
            }),
          },
        },
      ],
    });
  });
  for (const provider of ['groq', 'openrouter', 'ollama'] as const) {
    if (provider !== 'ollama') planner.key(provider, provider + '-isolated-secret');
    planner.configure({ provider, ollamaModel: 'qwen2.5:7b', groqFreeConfirmed: true });
    const r = await planner.plan(p);
    assert.equal(r.warning, '');
    assert.deepEqual(
      r.scenes.map((s) => s.svgPlan.title),
      ['Test 1', 'Test 2'],
    );
  }
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      'https://api.groq.com/openai/v1/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
      'http://127.0.0.1:11434/api/show',
      'http://127.0.0.1:11434/v1/chat/completions',
    ],
  );
  assert.deepEqual(
    calls.map((c) => c.h.get('authorization')),
    ['Bearer groq-isolated-secret', 'Bearer openrouter-isolated-secret', null, null],
  );
  assert.equal(calls[1].b.model, 'openrouter/free');
  assert.ok(
    calls.every((c) => c.redirect === 'error' && !JSON.stringify(c.b).includes('isolated-secret')),
  );
  assert.ok(calls[0].b.messages[0].content.includes('additionalProperties'));
  assert.equal(calls[0].b.response_format.type, 'json_object');
  assert.ok(!JSON.stringify(planner.settings()).includes('secret'));
  planner.key('groq', 'another-free-account');
  assert.equal(planner.settings().groqFreeConfirmed, false);
  planner.key('openrouter');
  assert.deepEqual(planner.settings().keys, { groq: true, openrouter: false });
});
test('503, timeout, missing key, truncated/invalid/extra JSON and cloud Ollama all fall back without replay or losing authored fields', async (t) => {
  let calls = 0,
    reply: () => Response = () => new Response(null, { status: 503 });
  const { p, planner } = setup(t, async () => {
    calls++;
    return reply();
  });
  const manual = { ...valid, title: 'Benim şemam' };
  p.scenes = [
    {
      ...blankScene(randomUUID()),
      narration: p.script,
      description: p.script,
      visualMode: 'svg',
      svgPlan: manual,
    },
  ];
  planner.configure({
    provider: 'openrouter',
    ollamaModel: 'qwen2.5:7b',
    groqFreeConfirmed: false,
  });
  assert.match((await planner.plan(p)).warning, /anahtarı yok/);
  assert.equal(calls, 0);
  planner.key('openrouter', 'fixture-only-secret');
  for (reply of [
    () => new Response(null, { status: 503 }),
    () => {
      throw Error('fixture-only-secret');
    },
    () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    ...[
      'not JSON',
      JSON.stringify({ scenes: [] }),
      JSON.stringify({ scenes: [{ ...valid, code: 'untrusted text' }] }),
    ].map(
      (content) => () =>
        Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] }),
    ),
  ]) {
    const n: number = calls,
      r = await planner.plan(p);
    assert.equal(calls, n + 1);
    assert.match(r.warning, /Yerel şablon/);
    assert.ok(!r.warning.includes('fixture-only-secret'));
    assert.deepEqual(r.scenes[0].svgPlan, manual);
    assert.equal(r.scenes[0].id, p.scenes[0].id);
  }
  assert.throws(() =>
    planner.configure({ provider: 'groq', ollamaModel: 'local', groqFreeConfirmed: false }),
  );
  planner.configure({ provider: 'ollama', ollamaModel: 'local', groqFreeConfirmed: false });
  reply = () =>
    Response.json({ remote_host: 'remote', model_info: { 'general.architecture': 'remote' } });
  const n: number = calls;
  assert.match((await planner.plan(p)).warning, /yerel Ollama/);
  assert.equal(calls, n + 1);
});
test('SVG edits detach only dependent clips, keep old photo and voice assets, and require review', () => {
  const p = makeProject('Katman', 'Bir. İki. Üç.');
  p.scenes = ['Bir.', 'İki.', 'Üç.'].map((n) => ({
    ...blankScene(randomUUID()),
    description: n,
    narration: n,
  }));
  const [a, b, c] = p.scenes;
  for (const s of p.scenes)
    p.assets[s.id] = {
      image: { file: s.id + '.jpg', key: imageKey(p, s) },
      voice: { file: s.id + '.wav', key: voiceKey(p, s) },
      clip: { file: s.id + '.mp4', key: 'clip' },
    };
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  const photo = structuredClone(p);
  b.visualMode = 'svg';
  b.svgPlan = valid;
  invalidate(p, photo);
  assert.ok(!p.assets[a.id].clip && !p.assets[b.id].clip && p.assets[c.id].clip);
  assert.deepEqual(p.assets[b.id].image, photo.assets[b.id].image);
  assert.deepEqual(p.assets[b.id].voice, photo.assets[b.id].voice);
  assert.throws(() => approved(p));
  approveBoard(p);
  const orig = structuredClone(p);
  p.assets[a.id].clip = photo.assets[a.id].clip;
  p.assets[b.id].clip = photo.assets[b.id].clip;
  b.svgPlan = { ...valid, accentColor: '#FF9900' };
  invalidate(p, orig);
  assert.ok(!p.assets[a.id].clip && !p.assets[b.id].clip && p.assets[c.id].clip);
});
