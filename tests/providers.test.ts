import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { app } from './http-studio';
import { stageReply } from './ant-motion-art';
import { SceneModels } from '../server/scene-models';
import { motionFrame } from '../server/motion-files';
import { Store } from '../server/store';
import { memoryVault } from '../server/vault';
import { defaultAnthropicModel, defaultRouterModel } from '../shared/vector';
import type { Project } from '../shared/schema';

const keyRouter = 'isolated-router-secret';
const keyClaude = 'isolated-anthropic-secret';
const narration = 'Karıncalar kış boyunca toprağın derinlerinde yaşar.';

test('old settings acquire safe defaults, partial changes retain both model choices and keys stay isolated', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-provider-migration-')),
    store = new Store(dir, false),
    vaults = { groq: memoryVault(), openrouter: memoryVault(), anthropic: memoryVault() },
    models = new SceneModels(store, vaults);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  store.set('vector-model', { provider: 'openrouter' });
  assert.deepEqual(models.config(), {
    provider: 'openrouter',
    openrouterModel: defaultRouterModel,
    anthropicModel: defaultAnthropicModel,
  });
  models.key('openrouter', keyRouter);
  models.key('anthropic', keyClaude);
  assert.equal(models.model('s', {}).model, 'openrouter/free');
  models.configure({
    openrouterModel: 'anthropic/claude-sonnet-4',
    anthropicModel: 'claude-test-20250101',
  });
  models.configure({ provider: 'anthropic' }); // old API client sends only this field
  assert.deepEqual(models.config(), {
    provider: 'anthropic',
    openrouterModel: 'anthropic/claude-sonnet-4',
    anthropicModel: 'claude-test-20250101',
  });
  assert.equal(models.model('s', {}).model, 'claude-test-20250101');
  models.key('openrouter');
  assert.equal(vaults.anthropic.get(), keyClaude);
  assert.deepEqual(models.settings().keys, { groq: false, openrouter: false, anthropic: true });
  assert.ok(!JSON.stringify(models.settings()).includes(keyClaude));
  models.configure({ provider: 'auto' });
  // Anthropic's stored key alone is never silently selected in auto mode.
  assert.throws(() => models.model('s', {}), /Gemini|OpenRouter/);
  for (const bad of ['', 'model with spaces', 'bad\nmodel', 'x'.repeat(121)])
    assert.throws(() => models.configure({ openrouterModel: bad }));
  assert.throws(() => models.configure({ provider: 'other' }));
  assert.equal(models.config().anthropicModel, 'claude-test-20250101');
});

for (const { provider, model } of [
  { provider: 'openrouter' as const, model: 'meta-llama/llama-3.3-8b-instruct:free' },
  { provider: 'openrouter' as const, model: 'anthropic/claude-sonnet-4' },
  { provider: 'anthropic' as const, model: 'claude-sonnet-4-20250514' },
]) {
  test(`${provider} ${model}: the actual script and SVG routes use the selected model and isolated key`, async (t) => {
    const calls: { url: string; drawing: boolean; body: any; headers: Headers }[] = [];
    const { req, settle, store } = await app(
      t,
      undefined,
      async (url, init) => {
        const body = JSON.parse(String(init?.body)),
          headers = new Headers(init?.headers),
          drawing = provider === 'openrouter' ? body.messages.length === 2 : !!body.system;
        calls.push({ url: String(url), drawing, body, headers });
        assert.equal(init?.redirect, 'error');
        assert.equal(init?.credentials, 'omit');
        const text = drawing ? JSON.stringify(stageReply(0)) : narration;
        return provider === 'openrouter'
          ? Response.json({
              model,
              choices: [{ finish_reason: 'stop', message: { content: text } }],
            })
          : Response.json({ model, stop_reason: 'end_turn', content: [{ type: 'text', text }] });
      },
      async () => {},
    );
    assert.equal(
      (await req('/settings/svg-planner/key/openrouter', { key: keyRouter })).status,
      200,
    );
    assert.equal(
      (await req('/settings/svg-planner/key/anthropic', { key: keyClaude })).status,
      200,
    );
    const configuration = {
      provider,
      openrouterModel: provider === 'openrouter' ? model : 'openrouter/free',
      anthropicModel: provider === 'anthropic' ? model : defaultAnthropicModel,
    };
    const settings = await (await req('/settings/svg-planner', configuration)).text();
    assert.ok(!settings.includes(keyRouter) && !settings.includes(keyClaude));
    assert.deepEqual(JSON.parse(settings).svgPlanner.keys, {
      groq: false,
      openrouter: true,
      anthropic: true,
    });
    const created: Project = await (
      await req('/projects', { topic: 'Karıncalar kışın nereye gider?' })
    ).json();
    const route = '/projects/' + created.id;
    let p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.equal(p.script, narration);
    p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
    assert.equal((await req(route + '/generate', { kind: 'board' }, p.rev)).status, 202);
    p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.equal(p.scenes.length, 1);
    assert.equal(p.scenes[0].choreography?.kind, 'objects-v2');
    assert.equal(p.scenes[0].choreography?.provider, provider);
    assert.equal(p.scenes[0].choreography?.model, model);
    assert.doesNotThrow(() =>
      motionFrame(store.dir(p.id), p.scenes[0].choreography, p.scenes[0].narration),
    );
    assert.deepEqual(
      calls.map((c) => c.drawing),
      [false, true],
    );
    for (const call of calls) {
      assert.equal(call.body.model, model);
      assert.equal(call.body.max_tokens, call.drawing ? 8192 : 4096);
      if (provider === 'openrouter') {
        assert.equal(call.url, 'https://openrouter.ai/api/v1/chat/completions');
        assert.equal(call.headers.get('authorization'), `Bearer ${keyRouter}`);
        assert.equal(call.headers.get('x-api-key'), null);
        assert.deepEqual(
          call.body.response_format,
          call.drawing ? { type: 'json_object' } : undefined,
        );
      } else {
        assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
        assert.equal(call.headers.get('x-api-key'), keyClaude);
        assert.equal(call.headers.get('anthropic-version'), '2023-06-01');
        assert.equal(call.headers.get('authorization'), null);
        assert.equal(call.body.response_format, undefined);
      }
    }
  });
}

test('selected provider failures never switch to another key/model or overwrite an approved script', async (t) => {
  const urls: string[] = [];
  const { req, settle, store } = await app(t, undefined, async (url) => {
    urls.push(String(url));
    return Response.json({ error: { message: `${keyRouter} ${keyClaude}` } }, { status: 503 });
  });
  await req('/settings/svg-planner/key/openrouter', { key: keyRouter });
  await req('/settings/svg-planner/key/anthropic', { key: keyClaude });
  await req('/settings/svg-planner', {
    provider: 'anthropic',
    anthropicModel: 'claude-test-20250101',
  });
  let p: Project = await (
    await req('/projects', { topic: 'Bilim', script: 'Korunan senaryo metni.' })
  ).json();
  const route = '/projects/' + p.id;
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  const original = p.script,
    approval = p.scriptApproval;
  assert.equal((await req(route + '/generate', { kind: 'script' }, p.rev)).status, 202);
  p = await settle(route);
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /Anthropic HTTP 503/);
  assert.equal(p.script, original);
  assert.equal(p.scriptApproval, approval);
  assert.deepEqual(urls, ['https://api.anthropic.com/v1/messages']);
  const log = fs.readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8');
  assert.ok(!log.includes(keyRouter) && !log.includes(keyClaude));
});

test('truncated or blocked Claude responses and secret-bearing envelopes are never accepted as script', async (t) => {
  let data: unknown = {
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: 'Yarım metin.' }],
  };
  const { req, settle } = await app(t, undefined, async () => Response.json(data));
  await req('/settings/svg-planner/key/anthropic', { key: keyClaude });
  await req('/settings/svg-planner', { provider: 'anthropic' });
  let p: Project = await (
    await req('/projects', { topic: 'Bilim', script: 'Değişmeyen senaryo.' })
  ).json();
  const route = '/projects/' + p.id;
  for (data of [
    { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'Yarım metin.' }] },
    { stop_reason: 'refusal', content: [{ type: 'text', text: 'Reddedildi.' }] },
    { error: { message: keyClaude } },
  ]) {
    await req(route + '/generate', { kind: 'script' }, p.rev);
    p = await settle(route);
    assert.equal(p.job.state, 'failed');
    assert.equal(p.script, 'Değişmeyen senaryo.');
    assert.ok(!p.job.label.includes(keyClaude));
  }
});

test('direct Claude drawing retries received 429 with the same model and payload, without another provider', async (t) => {
  const waits: number[] = [],
    bodies: string[] = [];
  const { req, settle } = await app(
    t,
    undefined,
    async (url, init) => {
      assert.equal(String(url), 'https://api.anthropic.com/v1/messages');
      bodies.push(String(init?.body));
      if (bodies.length < 3) return new Response(null, { status: 429 });
      return Response.json({
        model: 'claude-test-20250101',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(stageReply(0)) }],
      });
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  await req('/settings/svg-planner/key/openrouter', { key: keyRouter });
  await req('/settings/svg-planner/key/anthropic', { key: keyClaude });
  await req('/settings/svg-planner', {
    provider: 'anthropic',
    anthropicModel: 'claude-test-20250101',
  });
  let p: Project = await (
    await req('/projects', { topic: 'Karıncalar', script: narration })
  ).json();
  const route = '/projects/' + p.id;
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  await req(route + '/generate', { kind: 'board' }, p.rev);
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  assert.deepEqual(waits, [10000, 20000]);
  assert.equal(bodies.length, 3);
  assert.ok(bodies.every((body) => body === bodies[0]));
  assert.equal(p.scenes[0].choreography?.provider, 'anthropic');
});

test('stopping an in-flight direct Claude script aborts its request without fallback or overwriting the draft', async (t) => {
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const urls: string[] = [];
  let aborted = false;
  const { req, settle } = await app(t, undefined, async (url, init) => {
    urls.push(String(url));
    started();
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener(
        'abort',
        () => {
          aborted = true;
          reject(new Error('cancelled'));
        },
        { once: true },
      );
    });
  });
  await req('/settings/svg-planner/key/openrouter', { key: keyRouter });
  await req('/settings/svg-planner/key/anthropic', { key: keyClaude });
  await req('/settings/svg-planner', { provider: 'anthropic' });
  let p: Project = await (
    await req('/projects', { topic: 'Bilim', script: 'Korunan bir senaryo.' })
  ).json();
  const route = '/projects/' + p.id;
  p = await (await req(route + '/generate', { kind: 'script' }, p.rev)).json();
  await waiting;
  assert.ok(p.job.runId);
  assert.equal((await req('/operations/' + p.job.runId + '/stop', {})).status, 202);
  p = await settle(route);
  assert.equal(p.job.state, 'cancelled');
  assert.equal(p.script, 'Korunan bir senaryo.');
  assert.ok(aborted);
  assert.deepEqual(urls, ['https://api.anthropic.com/v1/messages']);
});

test('legacy drawing-disabled setting still permits explicitly authorized Gemini scripts', async (t) => {
  const posts: string[] = [];
  const { req, settle } = await app(t, undefined, async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'generativelanguage.googleapis.com');
    if (init?.method === 'GET')
      return Response.json({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      });
    posts.push(String(url));
    return Response.json({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: narration }] } }],
    });
  });
  await req('/settings/key', { key: 'isolated-gemini-secret' });
  assert.equal((await req('/settings/test', {})).status, 200);
  assert.equal(
    (await req('/settings/model', { kind: 'text', model: 'gemini-2.5-flash', consent: 'free' }))
      .status,
    200,
  );
  await req('/settings/svg-planner', { provider: 'disabled' });
  const created: Project = await (await req('/projects', { topic: 'Karıncalar' })).json();
  const route = '/projects/' + created.id;
  let p = await settle(route);
  assert.equal(p.script, narration);
  assert.equal(posts.length, 1);
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  await req(route + '/generate', { kind: 'board' }, p.rev);
  p = await settle(route);
  assert.equal(p.job.state, 'config');
  assert.equal(posts.length, 1, 'disabled drawing must not call any provider');
});
