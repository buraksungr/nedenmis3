import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { Store } from '../server/store';

const host = 'https://generativelanguage.googleapis.com';
const model = 'gemini-test-text',
  key = 'isolated-test-credential';
const output = () =>
  Response.json({
    candidates: [
      { finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'Korunan anlatım.' }] } },
    ],
  });
async function setup(t: TestContext, respond: (attempt: number) => Response) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-script-'));
  const store = new Store(dir, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const posts: { url: string; body: string }[] = [],
    delays: number[] = [];
  const g = new Gemini(
    store,
    memoryVault(),
    async (url, init) => {
      assert.equal(new Headers(init?.headers).get('x-goog-api-key'), key);
      if (init?.method === 'GET') {
        const ids =
          String(url) === `${host}/v1/models?pageSize=1000`
            ? [model]
            : ['gemini-preview-only', 'gemini-test-tts', 'gemini-test-image'];
        return Response.json({
          models: ids.map((id) => ({
            name: 'models/' + id,
            supportedGenerationMethods: ['generateContent'],
          })),
        });
      }
      assert.equal(init?.redirect, 'error');
      posts.push({ url: String(url), body: String(init?.body) });
      return respond(posts.length);
    },
    async (ms) => {
      delays.push(ms);
    },
  );
  g.key(key);
  await g.test();
  assert.deepEqual(
    g.settings().catalog.map((m) => m.id),
    [model, 'gemini-test-tts'],
  );
  g.configure('text', { model, consent: 'free' });
  return { g, posts, delays };
}
test('stable script endpoint: 503, 503, 503, success resends the same authorized POST after 1, 2, 4 seconds', async (t) => {
  const { g, posts, delays } = await setup(t, (n) =>
    n < 4 ? new Response('unavailable', { status: 503 }) : output(),
  );
  const notices: string[] = [];
  assert.equal(await g.text('Senaryo', undefined, (msg) => notices.push(msg)), 'Korunan anlatım.');
  assert.deepEqual(delays, [1000, 2000, 4000]);
  assert.equal(notices.length, 3);
  for (const [i, msg] of notices.entries())
    assert.ok(msg.includes(`(${i + 1}/3)`) && !msg.includes(key));
  assert.equal(posts.length, 4);
  assert.ok(
    posts.every(
      (p) =>
        p.url === `${host}/v1/models/${model}:generateContent` &&
        p.body === posts[0].body &&
        !p.body.includes(key),
    ),
  );
  assert.deepEqual(Object.values(g.settings().requests), [4]);
  assert.equal(g.settings().services.text?.status, 'connected');
});
test('honor a longer server cooldown and stop on the first success', async (t) => {
  const { g, delays, posts } = await setup(t, (n) =>
    n === 1 ? new Response(null, { status: 503, headers: { 'retry-after': '120' } }) : output(),
  );
  assert.equal(await g.text('Kısa'), 'Korunan anlatım.');
  assert.deepEqual(delays, [120000]);
  assert.equal(posts.length, 2);
});
test('non-503, indeterminate network failures, structured boards and media are single attempts', async (t) => {
  let status = 429;
  const { g, posts, delays } = await setup(t, () => {
    if (!status) throw new Error(key);
    return new Response(null, { status });
  });
  for (status of [429, 400, 403, 404, 500, 0]) await assert.rejects(g.text('Senaryo'));
  status = 503;
  await assert.rejects(g.text('Storyboard', { type: 'object' }), /HTTP 503/);
  g.configure('tts', { model: 'gemini-test-tts', consent: 'free' });
  await assert.rejects(g.voice('Ses.', 'Charon', 'Sakin'), /HTTP 503/);
  g.configure('text', { model, consent: 'blocked' });
  await assert.rejects(g.text('Senaryo'), /kullanım iznini/);
  assert.equal(posts.length, 8);
  assert.deepEqual(delays, []);
  assert.ok(!JSON.stringify(g.settings()).includes(key));
});
