import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createStudio } from '../server/app';
import { blankScene, type Project } from '../shared/schema';
async function app(t: any, token?: string, transport?: typeof fetch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nedenmis-http-'));
  const ctx = createStudio(
    { root, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
    { seed: false, desktopToken: token, transport },
  );
  const server = ctx.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    ctx.store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const req = (route: string, body?: unknown, rev?: number, headers?: Record<string, string>) =>
    fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(rev === undefined ? {} : { 'If-Match': String(rev) }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { ...ctx, req, base, root };
}
test('HTTP workflow: stale writes rejected; both reviews required, then missing key is actionable', async (t) => {
  const { req, store } = await app(t);
  const created = await req('/projects', {
    topic: 'Karıncalar kışın neden ortadan kaybolur?',
    script: 'Karıncalar yuvasında kalır.',
  });
  assert.equal(created.status, 201);
  let p = (await created.json()) as Project;
  const route = '/projects/' + p.id;
  for (const kind of ['all', 'image', 'voice', 'align', 'clip', 'board'])
    assert.equal((await req(route + '/generate', { kind }, p.rev)).status, 409);
  assert.equal(
    (await req(route + '/script', { text: p.script, approve: true }, p.rev + 5)).status,
    412,
  );
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  assert.ok(p.scriptApproval);
  assert.equal((await req(route + '/generate', { kind: 'all' }, p.rev)).status, 409);
  const s = {
    ...blankScene(randomUUID()),
    narration: p.script,
    prompt: 'Karınca yuvası',
    description: 'Yerin altındaki yuva',
    animation: 'Kamera yuvaya yaklaşır.',
  };
  p = await (
    await req(route + '/board', { styleGuide: p.styleGuide, scenes: [s], approve: true }, p.rev)
  ).json();
  assert.ok(p.boardApproval);
  assert.ok(fs.existsSync(path.join(store.dir(p.id), 'storyboard', p.boardApproval + '.json')));
  const result = await req(route + '/generate', { kind: 'all' }, p.rev);
  assert.equal(result.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  p = await (await req(route)).json();
  assert.equal(p.job.state, 'config');
  assert.match(p.job.label, /Seslendirme/);
  assert.equal(p.final, undefined);
  assert.equal(p.assets[s.id]?.image, undefined);
  const zip = await req(route + '/backup');
  assert.equal(zip.status, 200);
  assert.equal(
    Buffer.from(await zip.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    'PK',
  );
  p = await (await req(route + '/script', { text: 'Farklı anlatım.' }, p.rev)).json();
  assert.equal(p.boardApproval, null);
  assert.equal((await req(route + '/generate', { kind: 'all' }, p.rev)).status, 409);
});
test('API rejects cross-origin mutations and desktop routes require a session proof', async (t) => {
  const { req } = await app(t, 'test-session-proof');
  assert.equal((await req('/settings')).status, 403);
  const h = { 'x-studio-session': 'test-session-proof' };
  const set = await req('/settings/key', { key: 'unit-test-not-a-real-key' }, undefined, h);
  assert.equal(set.status, 200);
  const body = await set.text();
  assert.ok(!body.includes('unit-test-not-a-real-key'));
  assert.equal(JSON.parse(body).status, 'untested');
  assert.equal(
    (
      await req('/projects', { topic: 'Başka kaynak' }, undefined, {
        ...h,
        origin: 'https://unrelated.invalid',
      })
    ).status,
    403,
  );
  assert.equal((await req('/projects/invalid', undefined, undefined, h)).status, 404);
});
test('missing credentials never fabricate a script or a successful export', async (t) => {
  const { req } = await app(t);
  const p = await (
    await req('/projects', { topic: 'Karıncalar kışın neden ortadan kaybolur?' })
  ).json();
  await new Promise((resolve) => setImmediate(resolve));
  const check = await (await req('/projects/' + p.id)).json();
  assert.equal(check.script, '');
  assert.equal(check.scenes.length, 0);
  assert.equal(check.job.state, 'config');
  assert.equal(check.final, undefined);
});

test('preview writes work under the iframe proxy without opening cross-site access', async (t) => {
  const { req } = await app(t);
  const headers = { origin: 'https://5173-studio-test.e2b.app', 'sec-fetch-site': 'same-origin' };
  assert.equal(
    (
      await req(
        '/projects',
        { topic: 'Yerel yapım', script: 'Kaydedilen anlatım.' },
        undefined,
        headers,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await req('/projects', { topic: 'Başka kaynak' }, undefined, {
        ...headers,
        'sec-fetch-site': 'cross-site',
      })
    ).status,
    403,
  );
});

test('free text + selected TTS with no image model: narration first, manual placeholders, no image validation or calls', async (t) => {
  const lines = [
    'Kış geldi.',
    'Karıncalar yavaşladı.',
    'Yuvaya çekildiler.',
    'Toprak onları korur.',
    'İlkbaharda geri dönerler.',
  ];
  const text = lines.join(' '),
    wav = fs.readFileSync('tests/fixtures/forest.wav').toString('base64');
  const calls: { model: string; voice?: string; line?: string }[] = [];
  const { req, g, base } = await app(t, undefined, async (_url, opts) => {
    if (opts?.method === 'GET')
      return Response.json({
        models: ['gemini-test-flash', 'gemini-test-tts'].map((id) => ({
          name: `models/${id}`,
          supportedGenerationMethods: ['generateContent'],
        })),
      });
    const b = JSON.parse(String(opts?.body));
    calls.push({
      model: b.model,
      voice: b.generation_config?.speech_config[0]?.voice,
      line: b.input?.[0]?.content?.[0]?.text,
    });
    const part =
      b.model === 'gemini-test-tts'
        ? { type: 'audio', mime_type: 'audio/wav', data: wav }
        : {
            type: 'text',
            text: b.response_format
              ? JSON.stringify({
                  styleGuide: 'Sinematik doğa çizimi',
                  scenes: lines.map((n) => ({
                    ...blankScene(randomUUID()),
                    narration: n,
                    description: n,
                    animation: 'Kamera yaklaşır.',
                  })),
                })
              : text,
          };
    return Response.json({
      status: 'completed',
      steps: [{ type: 'model_output', content: [part] }],
    });
  });
  const permissions = t.mock.method(g, 'allowed');
  const settle = async (route: string): Promise<Project> => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const p: Project = await (await req(route)).json();
      if (p.job.state !== 'working') return p;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error('Background production did not settle');
  };
  // No key or catalog is needed to disable images or choose a default speaker.
  assert.equal((await req('/settings/model', { kind: 'image', consent: 'blocked' })).status, 200);
  assert.equal((await req('/settings/speaker', { speaker: 'not-a-voice' })).status, 400);
  assert.equal((await req('/settings/speaker', { speaker: 'Puck' })).status, 200);
  await req('/settings/key', { key: 'offline-test-credential' });
  const settings = await (await req('/settings/test', {})).json();
  assert.equal(settings.defaultSpeaker, 'Puck');
  assert.deepEqual(settings.models.image, { model: '', consent: 'blocked' });
  for (const [kind, model] of [
    ['text', 'gemini-test-flash'],
    ['tts', 'gemini-test-tts'],
  ])
    assert.equal((await req('/settings/model', { kind, model, consent: 'free' })).status, 200);
  const created: Project = await (
    await req('/projects', { topic: 'Karıncalar kışın nerede?' })
  ).json();
  const route = `/projects/${created.id}`;
  let p = await settle(route);
  assert.equal(p.voice, 'Puck');
  assert.equal(p.script, text);
  await req('/settings/speaker', { speaker: 'Kore' }); // applies to existing unvoiced drafts, too
  p = await (await req(route + '/script', { text, approve: true }, p.rev)).json();
  assert.equal((await req(route + '/generate', { kind: 'board' }, p.rev)).status, 202);
  p = await settle(route);
  assert.equal(p.scenes.length, lines.length);
  assert.deepEqual(p.assets, {});
  assert.equal((await req(route + '/generate', { kind: 'all' }, p.rev)).status, 409);
  assert.equal((await req(route + '/preferences', { voice: 'unknown' }, p.rev)).status, 400);
  p = await (
    await req(
      route + '/board',
      { scenes: p.scenes, styleGuide: p.styleGuide, approve: true },
      p.rev,
    )
  ).json();
  assert.ok(p.boardApproval); // empty image prompts are valid in manual mode
  const all = async () => {
    assert.equal((await req(route + '/generate', { kind: 'all' }, p.rev)).status, 202);
    return settle(route);
  };
  p = await all();
  assert.equal(p.job.state, 'waiting', p.job.label);
  assert.equal(p.job.kind, 'manual-images');
  assert.match(p.job.label, /5 sahne/);
  assert.equal(p.final, undefined);
  const voices = p.scenes.map((s) => p.assets[s.id].voice!.file);
  assert.deepEqual(
    calls.map((c) => c.model),
    ['gemini-test-flash', 'gemini-test-flash', ...lines.map(() => 'gemini-test-tts')],
  );
  assert.deepEqual(
    calls.slice(2).map((c) => [c.voice, c.line]),
    lines.map((line) => ['Kore', line]),
  );
  for (const m of Object.values(p.assets)) assert.ok(!m.image && !m.clip && !m.align);
  const first = p.scenes[0].id;
  assert.equal(
    (await req(route + '/generate', { kind: 'image', scene: first }, p.rev)).status,
    409,
  );
  const upload = await fetch(`${base}${route}/import/image?scene=${first}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'If-Match': String(p.rev) },
    body: fs.readFileSync('ui/public/art/ants.jpg'),
  });
  assert.equal(upload.status, 200);
  p = await upload.json();
  assert.match(p.job.label, /4 sahne/);
  await req('/settings/speaker', { speaker: 'Leda' }); // never invalidate published narration via a global default
  p = await all();
  assert.equal(p.voice, 'Kore');
  assert.equal(calls.length, 7);
  assert.deepEqual(
    p.scenes.map((s) => p.assets[s.id].voice?.file),
    voices,
  );
  assert.equal(p.assets[first].image?.source, 'import');
  p = await (await req(route + '/preferences', { voice: 'Zephyr' }, p.rev)).json();
  assert.ok(p.assets[first].image && !p.assets[first].voice);
  assert.equal(
    (await req(route + '/generate', { kind: 'voice', scene: first }, p.rev)).status,
    202,
  );
  p = await settle(route);
  assert.equal(p.job.state, 'done');
  assert.equal(calls.at(-1)?.voice, 'Zephyr');
  assert.equal(g.raw().services.image, undefined);
  assert.ok(!permissions.mock.calls.some((c) => c.arguments[0] === 'image'));
});
