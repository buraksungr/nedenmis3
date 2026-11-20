import {
  lines as antLines,
  topic as antTopic,
  shots as antShots,
  subject as antSubject,
  direction as antDirection,
  closer,
  planned,
  imageRequest,
  antImage,
  shotFile,
} from './ant-fixtures';
import { sample, completion } from './vector-test-data';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createStudio } from '../server/app';
import { voiceKey } from '../server/production';
import { noNetwork } from './offline';
import { STOPPED, STOPPING, jobActive, blankScene, type Project } from '../shared/schema';
async function app(t: any, token?: string, transport: typeof fetch = noNetwork) {
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
  const settle = async (route: string): Promise<Project> => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const p: Project = await (await req(route)).json();
      if (!jobActive(p.job)) return p;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error('Background production did not settle');
  };
  return { ...ctx, req, settle, base, root };
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

test('gemini-2.5-flash generateContent script and JSON board, then chosen TTS without any image service', async (t) => {
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
  const host = 'https://generativelanguage.googleapis.com';
  const api = `${host}/v1beta`;
  const textModel = 'gemini-2.5-flash';
  const { req, settle, g, base } = await app(t, undefined, async (url, opts) => {
    assert.equal(new Headers(opts?.headers).get('x-goog-api-key'), 'offline-test-credential');
    if (
      opts?.method === 'GET' &&
      [`${api}/models?pageSize=1000`, `${host}/v1/models?pageSize=1000`].includes(String(url))
    )
      return Response.json({
        models: [textModel, 'gemini-test-tts'].map((id) => ({
          name: `models/${id}`,
          supportedGenerationMethods: ['generateContent'],
        })),
      });
    const b = JSON.parse(String(opts?.body));
    if (
      opts?.method === 'POST' &&
      url === `${b.generationConfig ? api : host + '/v1'}/models/${textModel}:generateContent`
    ) {
      const prompt = b.contents[0].parts[0].text;
      assert.match(prompt, /Karıncalar kışın nerede\?/);
      const config = b.generationConfig;
      if (config) {
        assert.equal(config.responseMimeType, 'application/json');
        const schema = config.responseJsonSchema;
        assert.deepEqual(schema.required, ['styleGuide', 'scenes']);
        assert.equal(schema.properties.scenes.minItems, 5);
        assert.equal(schema.properties.scenes.items.properties.narration.type, 'string');
        assert.equal(schema.properties.scenes.items.properties.animation, undefined);
        assert.equal(schema.properties.scenes.items.properties.camera, undefined);
        assert.doesNotMatch(JSON.stringify(schema), /"(?:minLength|maxLength)"/);
      }
      assert.deepEqual(b, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(config ? { generationConfig: config } : {}),
      });
      calls.push({ model: textModel });
      const output = config
        ? JSON.stringify({
            styleGuide: 'Sinematik doğa çizimi',
            scenes: lines.map((n) => ({
              ...blankScene(randomUUID()),
              narration: n,
              description: n,
              animation: 'Kamera yaklaşır.',
            })),
          })
        : text;
      return Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              role: 'model',
              parts: [
                { thought: true, text: 'Not part of the narration.' },
                { text: output.slice(0, 7) },
                { text: output.slice(7) },
              ],
            },
          },
          {
            finishReason: 'STOP',
            content: { parts: [{ text: 'Alternative; not part of the selected candidate.' }] },
          },
        ],
      });
    }
    if (opts?.method === 'POST' && url === `${api}/interactions` && b.model === 'gemini-test-tts') {
      calls.push({
        model: b.model,
        voice: b.generation_config.speech_config[0].voice,
        line: b.input[0].content[0].text,
      });
      return Response.json({
        status: 'completed',
        steps: [
          { type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wav }] },
        ],
      });
    }
    return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
  });

  // No key or catalog is needed to disable images or choose a default speaker.
  assert.equal((await req('/settings/model', { kind: 'image', consent: 'blocked' })).status, 400);
  assert.equal((await req('/settings/pollinations', { autoFill: false })).status, 200);
  assert.equal((await req('/settings/speaker', { speaker: 'not-a-voice' })).status, 400);
  assert.equal((await req('/settings/speaker', { speaker: 'Puck' })).status, 200);
  await req('/settings/key', { key: 'offline-test-credential' });
  const settings = await (await req('/settings/test', {})).json();
  assert.equal(settings.defaultSpeaker, 'Puck');
  assert.equal(settings.models.image, undefined);
  assert.deepEqual(settings.pollinations, { hasKey: false, autoFill: false, storage: 'session' });
  for (const [kind, model] of [
    ['text', textModel],
    ['tts', 'gemini-test-tts'],
  ])
    assert.equal((await req('/settings/model', { kind, model, consent: 'free' })).status, 200);
  const created: Project = await (
    await req('/projects', { topic: 'Karıncalar kışın nerede?' })
  ).json();
  const route = `/projects/${created.id}`;
  let p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  assert.equal(p.voice, 'Puck');
  assert.equal(p.script, text);
  await req('/settings/speaker', { speaker: 'Kore' }); // applies to existing unvoiced drafts, too
  p = await (await req(route + '/script', { text, approve: true }, p.rev)).json();
  assert.equal((await req(route + '/generate', { kind: 'photo-board' }, p.rev)).status, 202);
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
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
    [textModel, textModel, ...lines.map(() => 'gemini-test-tts')],
  );
  assert.deepEqual(
    calls.slice(2).map((c) => [c.voice, c.line]),
    lines.map((line) => ['Kore', line]),
  );
  for (const m of Object.values(p.assets)) assert.ok(!m.image && !m.clip && !m.align);
  const first = p.scenes[0].id;
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
  assert.ok(!('image' in g.raw().services));
});

test('a listed text model can still return 404: preserve the draft, show the actual model, never retry or switch automatically', async (t) => {
  const key = 'offline-test-credential';
  const model = 'gemini-test-alternate'; // select a catalog model other than 2.5 Flash
  const path = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;
  const posts: string[] = [];
  let available = false;
  const { req, settle, g, store } = await app(t, undefined, async (url, opts) => {
    if (opts?.method === 'GET')
      return Response.json({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: `  models/${model}\t`, supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-other', supportedGenerationMethods: ['countTokens'] },
          { name: `models/${model}/extra`, supportedGenerationMethods: ['generateContent'] },
        ],
      });
    posts.push(String(url));
    return available && url === path
      ? Response.json({
          candidates: [
            { finishReason: 'STOP', content: { parts: [{ text: 'Yenilenen senaryo.' }] } },
          ],
        })
      : Response.json(
          { error: { status: 'NOT_FOUND', message: `Private provider detail: ${key}` } },
          { status: 404 },
        );
  });
  g.key(key);
  assert.deepEqual(
    (await g.test()).catalog.map((m) => m.id),
    ['gemini-2.5-flash', model],
  );
  for (const invalid of [
    `models/models/${model}`,
    `${model}/extra`,
    'gemini-other',
    'gemini-test alternate',
  ])
    assert.equal(
      (await req('/settings/model', { kind: 'text', model: invalid, consent: 'free' })).status,
      400,
    );
  const saved = await (
    await req('/settings/model', { kind: 'text', model: ` models/${model} `, consent: 'free' })
  ).json();
  assert.deepEqual(saved.models.text, { model, consent: 'free' });
  // Also normalize older on-disk selections at generation time, without another discovery or opt-in.
  const old = g.raw();
  old.models.text.model = `models/${model} `;
  store.set('gemini', old);
  let p: Project = await (
    await req('/projects', { topic: 'Kışın karıncalar', script: 'Önceki senaryo.' })
  ).json();
  const route = `/projects/${p.id}`;
  const generate = async () => {
    assert.equal((await req(route + '/generate', { kind: 'script' }, p.rev)).status, 202);
    return settle(route);
  };
  p = await generate();
  assert.equal(p.job.state, 'config');
  assert.ok(p.job.label.includes(`/v1/models/${model}:generateContent`));
  assert.match(p.job.label, /HTTP 404/);
  assert.ok(!p.job.label.includes(key));
  assert.equal(p.script, 'Önceki senaryo.');
  assert.equal(g.settings().status, 'connected'); // discovery is still valid, generation is not
  assert.equal(g.settings().services.text?.status, 'unavailable');
  assert.deepEqual(posts, [path]);
  available = true;
  p = await generate(); // explicit retry on the same project and model
  assert.equal(p.job.state, 'done');
  assert.equal(p.script, 'Yenilenen senaryo.');
  assert.equal(g.settings().services.text?.status, 'connected');
  assert.deepEqual(posts, [path, path]);
  assert.equal(
    Object.values(g.raw().requests).reduce((a, b) => a + b, 0),
    2,
  );
});

test('persistent script HTTP 503 stops the background job after four real SDK requests, preserves the draft and logs safe progress', async (t) => {
  const model = 'gemini-test-script',
    secret = 'private-test-credential';
  let posts = 0;
  const { req, g, settle, store } = await app(t, undefined, async (url, init) => {
    if (init?.method === 'GET')
      return Response.json({
        models: [{ name: `models/${model}`, supportedGenerationMethods: ['generateContent'] }],
      });
    assert.equal(
      String(url),
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    );
    posts++;
    return Response.json({ error: { message: secret, status: 'UNAVAILABLE' } }, { status: 503 });
  });
  g.key(secret);
  await g.test();
  g.configure('text', { model, consent: 'free' });
  const draft = 'Onaylı taslak değişmemeli.';
  let p: Project = await (await req('/projects', { topic: 'Doğa', script: draft })).json();
  const route = `/projects/${p.id}`;
  p = await (await req(route + '/script', { text: draft, approve: true }, p.rev)).json();
  const approval = p.scriptApproval;
  assert.equal((await req(route + '/generate', { kind: 'script' }, p.rev)).status, 202);
  p = await settle(route);
  assert.equal(posts, 4);
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /4 isteğe.*HTTP 503/);
  assert.equal(p.script, draft);
  assert.equal(p.scriptApproval, approval);
  assert.equal(g.settings().status, 'connected');
  assert.equal(g.settings().services.text?.status, 'unavailable');
  const log = fs.readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8');
  assert.ok(!log.includes(secret));
  for (const label of ['(1/3)', '(2/3)', '(3/3)']) assert.ok(log.includes(label));
});

test('storyboard uses one key-selected Pollinations route, publishes locally, and allows upload after either route fails', async (t) => {
  const prompt = 'Kış / göl? %20 & ışık#🍃',
    suffix = ', nostalgic 2D pixel art style, highly detailed, nature documentary aesthetic';
  const gemini = 'isolated-gemini-secret',
    key = 'sk_pollinations-first-secret',
    rotated = 'sk_pollinations-rotated-secret';
  const calls: {
    url: string;
    method: string | undefined;
    auth: string | null;
    google: string | null;
    redirect: RequestRedirect | undefined;
  }[] = [];
  let mode: 'image' | 'unavailable' | 'invalid' = 'unavailable';
  const { req, settle, base, store, prod, g } = await app(t, undefined, async (url, options) => {
    const h = new Headers(options?.headers);
    calls.push({
      url: String(url),
      method: options?.method,
      auth: h.get('authorization'),
      google: h.get('x-goog-api-key'),
      redirect: options?.redirect,
    });
    if (mode === 'unavailable') return new Response(rotated, { status: 503 });
    // JPEG magic is not enough: this must fail the local decode/size check.
    const bytes =
      mode === 'image'
        ? fs.readFileSync('ui/public/art/ocean.jpg')
        : Buffer.from([255, 216, 255, 0, 1]);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  g.key(gemini);
  const originalGemini = g.raw();
  let p: Project = await (
    await req('/projects', { topic: 'Kış belgeseli', script: 'Kuşlar gölde dinlenir.' })
  ).json();
  const route = '/projects/' + p.id;
  const s = {
    ...blankScene(randomUUID()),
    description: 'Gölde dinlenen kuşlar',
    narration: p.script,
    prompt,
  };
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  p = await (await req(route + '/board', { scenes: [s], styleGuide: p.styleGuide }, p.rev)).json();
  assert.equal((await req(route + '/generate', { kind: 'image', scene: s.id }, p.rev)).status, 409);
  p = await (
    await req(route + '/board', { scenes: [s], styleGuide: p.styleGuide, approve: true }, p.rev)
  ).json();
  assert.equal(calls.length, 0);
  const gen = async () => {
    assert.equal(
      (await req(route + '/generate', { kind: 'image', scene: s.id }, p.rev)).status,
      202,
    );
    p = await settle(route);
  };
  const saveKey = async (secret: string) => {
    const r = await req('/settings/pollinations/key', { key: secret });
    assert.equal(r.status, 200);
    const body = await r.text();
    assert.ok(![key, rotated, gemini].some((x) => body.includes(x)));
    assert.deepEqual(JSON.parse(body).pollinations, {
      autoFill: true,
      hasKey: true,
      storage: 'session',
    });
    assert.deepEqual(g.raw(), originalGemini);
  };
  await gen();
  assert.equal(p.job.state, 'waiting');
  assert.match(p.job.label, /HTTP 503.*Görsel yükle/);
  assert.equal(p.assets[s.id]?.image, undefined);
  const upload = await fetch(base + route + '/import/image?scene=' + s.id, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'If-Match': String(p.rev) },
    body: fs.readFileSync('ui/public/art/ants.jpg'),
  });
  assert.equal(upload.status, 200);
  p = await upload.json();
  const imported = p.assets[s.id].image!;
  assert.equal(imported.source, 'import');
  await saveKey(key);
  mode = 'image';
  await gen();
  assert.equal(p.job.state, 'done', p.job.label);
  const img = p.assets[s.id].image!;
  assert.equal(img.source, 'pollinations');
  assert.match(img.file, /^media\/storyboard\/[\da-f-]{36}\.jpg$/);
  const disk = fs.readFileSync(prod.file(p, img.file));
  assert.deepEqual(store.get(p.id).assets[s.id].image, img);
  const mediaResponse = await fetch(base + route + '/media/' + img.file.slice('media/'.length));
  assert.equal(mediaResponse.status, 200);
  assert.match(mediaResponse.headers.get('content-type') || '', /image\/jpeg/);
  assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), disk);
  assert.equal(
    p.cover,
    route.replace('/projects', '/api/projects') + '/media/' + img.file.slice('media/'.length),
  );
  await saveKey(rotated);
  mode = 'invalid';
  await gen();
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /Görsel yükle/);
  assert.deepEqual(p.assets[s.id].image, img);
  assert.deepEqual(fs.readFileSync(prod.file(p, img.file)), disk);
  assert.ok(fs.existsSync(prod.file(p, imported.file)));
  const del = await fetch(base + '/settings/pollinations/key', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(del.status, 200);
  assert.equal((await del.json()).pollinations.hasKey, false);
  assert.deepEqual(g.raw(), originalGemini);
  await prod.asset(p, s, 'image', false);
  assert.equal(calls.length, 3); // successful local asset reused regardless of route
  mode = 'image';
  await gen();
  assert.equal(p.job.state, 'done', p.job.label);
  assert.deepEqual(
    calls.map((c) => c.auth),
    [null, 'Bearer ' + key, 'Bearer ' + rotated, null],
  );
  const pathPart = encodeURIComponent(prompt + suffix);
  for (const [i, c] of calls.entries()) {
    assert.equal(c.method, 'GET');
    assert.equal(c.google, null);
    assert.equal(c.redirect, 'error');
    assert.equal(
      c.url,
      i === 0 || i === 3
        ? `https://image.pollinations.ai/prompt/${pathPart}?width=1080&height=1920&nologo=true`
        : `https://gen.pollinations.ai/image/${pathPart}?width=1080&height=1920`,
    );
  }
  const serialized =
    JSON.stringify([p, g.settings(), await (await req('/settings')).json()]) +
    fs.readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8');
  for (const secret of [gemini, key, rotated]) assert.ok(!serialized.includes(secret));
});

test('no slide on provider failure; ready drawing, board approval and single directed redraw preserve narration/times and undo', async (t) => {
  let mode = 'fail';
  const prompts: Record<string, any>[] = [];
  const { req, store, settle, base } = await app(t, undefined, async (url, o) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
    const input = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
    prompts.push(input);
    return mode === 'fail'
      ? new Response('private-provider-error', { status: 503 })
      : mode === 'invalid'
        ? completion('broken')
        : completion(sample(input.yönlendirme ? 4 : input.sahne - 1));
  });
  const key = 'isolated-openrouter-fixture';
  const settings = await (await req('/settings/svg-planner/key/openrouter', { key })).text();
  assert.ok(!settings.includes(key));
  assert.deepEqual(JSON.parse(settings).svgPlanner.keys, { groq: false, openrouter: true });
  let p: Project = await (
    await req('/projects', {
      topic: 'Karaya vuran balinalar',
      script:
        'Balinanın derisi kurur. Ağırlık solunumu zorlaştırır. Suda kaldırma kuvveti etkilidir.',
    })
  ).json();
  const route = '/projects/' + p.id;
  const gen = (b: Record<string, string>, rev = p.rev) => req(route + '/generate', b, rev);
  assert.equal((await gen({ kind: 'svg-board' })).status, 409);
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  await gen({ kind: 'svg-board' });
  p = await settle(route);
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /503/);
  assert.equal(p.scenes.length, 3);
  assert.deepEqual(
    p.scenes.map((s) => p.vectorWork?.[s.id].state),
    ['failed', 'pending', 'pending'],
  );
  assert.equal(
    (
      await req(
        route + '/board',
        { scenes: p.scenes, styleGuide: p.styleGuide, approve: true },
        p.rev,
      )
    ).status,
    422,
  );
  mode = 'draw';
  await gen({ kind: 'svg-board' });
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  const board = (scenes = p.scenes) =>
    req(route + '/board', { scenes, styleGuide: p.styleGuide, approve: true }, p.rev);
  const fake = structuredClone(p.scenes);
  fake[1].vector!.title = 'Yerel Uydurma';
  assert.equal((await board(fake)).status, 422);
  p = await (await board()).json();
  assert.ok(p.boardApproval);
  const old = structuredClone(p.scenes);
  const s = p.scenes[1];
  assert.equal((await gen({ kind: 'image', scene: s.id })).status, 409);
  for (const v of p.scenes) {
    p.assets[v.id] = {
      clip: { key: 'clip', file: 'clip.mp4' },
      voice: { key: voiceKey(p, v), file: 'voice.wav' },
      align: { key: 'aligned', file: 'a.json', method: 'whisper' },
      words: [{ text: v.narration, start: 0, end: 1 }],
    };
  }
  store.save(p);
  const audio = structuredClone(p.assets);
  const b = { kind: 'redraw-vector', scene: s.id, instruction: 'Belirgin kırmızı oklar çiz.' };
  assert.equal((await gen(b, p.rev - 1)).status, 412);
  mode = 'invalid';
  await gen(b);
  p = await settle(route);
  assert.equal(p.job.state, 'failed');
  assert.ok(p.boardApproval);
  assert.deepEqual(p.scenes, old);
  assert.deepEqual(p.assets, audio);
  mode = 'draw';
  await gen(b);
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  assert.equal(prompts.at(-1)?.yönlendirme, b.instruction);
  assert.equal(prompts.length, 8);
  assert.equal(p.boardApproval, null);
  assert.deepEqual(p.scenes[0], old[0]);
  assert.deepEqual(p.scenes[2], old[2]);
  const ref = p.scenes[1].vector!;
  assert.notEqual(ref.digest, s.vector!.digest);
  for (const [i, v] of p.scenes.entries()) {
    const m = p.assets[v.id];
    assert.deepEqual(m.voice, audio[v.id].voice);
    assert.deepEqual(m.align, audio[v.id].align);
    assert.deepEqual(m.words, audio[v.id].words);
    assert.equal(!!m.clip, i === 2);
  }
  const file = await req(route + '/illustrations/' + ref.digest);
  assert.equal(file.headers.get('content-type')?.includes('application/json'), true);
  assert.equal((await file.json()).drawing.layers['layer-main'].tag, 'g');
  assert.ok(!(await req('/projects/' + randomUUID() + '/illustrations/' + ref.digest)).ok);
  assert.ok(
    !(
      await fetch(base + route + '/scene-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).ok,
  );
  p = await (await req(route + '/undo', {}, p.rev)).json();
  assert.deepEqual(p.scenes, old);
  assert.ok(p.boardApproval);
});

// Pause a real transport call until cancellation has reached it. Deliberately
// delay its cleanup so the test can inspect the *stopping*, still-locked state.
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((r) => {
    open = r;
  });
  return { promise, open };
}
test(
  'stop during scene 2 is durable, aborts the request, holds its lease through cleanup; stale stop cannot cancel a resumed board',
  { timeout: 20000 },
  async (t) => {
    const entered = gate(),
      observed = gate(),
      cleanup = gate(),
      again = gate(),
      finish = gate(),
      calls: number[] = [];
    const { req, settle, store } = await app(t, undefined, async (_url, opts) => {
      const i = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content).sahne;
      calls.push(i);
      if (calls.length === 2) {
        entered.open();
        await once(opts!.signal!, 'abort');
        observed.open();
        await cleanup.promise;
      } // even a late response may not be committed
      if (calls.length === 3) {
        again.open();
        await finish.promise;
      }
      return completion(sample(i - 1));
    });
    await req('/settings/svg-planner/key/openrouter', { key: 'isolated-cancel-test' });
    let p: Project = await (
      await req('/projects', {
        topic: 'Yerel çizim',
        script: 'Balinalar yüzer. Yüzgeçler hareket eder. Ağırlık dağılır.',
      })
    ).json();
    const route = '/projects/' + p.id;
    p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
    const script = p.scriptApproval;
    const start = async () =>
      (await (await req(route + '/generate', { kind: 'svg-board' }, p.rev)).json()) as Project;
    let accepted = await start();
    await entered.promise;
    const disk = store.get(p.id),
      first = disk.scenes[0];
    assert.ok(first.vector);
    assert.equal(disk.scenes[1].vector, undefined);
    const stop = '/operations/' + accepted.job.runId + '/stop';
    assert.equal((await req(stop, {})).status, 202);
    await observed.promise;
    p = store.get(p.id);
    assert.equal(p.job.state, 'stopping');
    assert.equal(p.job.label, STOPPING);
    assert.equal((await req(route + '/generate', { kind: 'svg-board' }, p.rev)).status, 409);
    assert.equal((await req(stop, {})).status, 202);
    cleanup.open();
    p = await settle(route);
    assert.equal(p.job.state, 'cancelled');
    assert.equal(p.job.label, STOPPED);
    assert.deepEqual(calls, [1, 2]);
    assert.deepEqual(p.scenes[0], first);
    assert.equal(p.scriptApproval, script);
    assert.equal(p.scenes[1].vector, undefined);
    accepted = await start();
    await again.promise;
    assert.notEqual('/operations/' + accepted.job.runId + '/stop', stop);
    assert.equal((await req(stop, {})).status, 409);
    finish.open();
    p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.deepEqual(calls, [1, 2, 2, 3]);
    assert.deepEqual(p.scenes[0], first);
    assert.equal(p.vectorWork, undefined);
  },
);

test(
  'stopping Gemini redraw or TTS aborts the active fetch with no repair, no replaced approved drawing/recording and no provider fault',
  { timeout: 20000 },
  async (t) => {
    let holding = false,
      entered = gate(),
      aborts = 0,
      posts = 0;
    const { req, settle, store, g } = await app(t, undefined, async (url, opts) => {
      if (opts?.method === 'GET')
        return Response.json({
          models: ['gemini-2.5-flash', 'gemini-test-tts'].map((id) => ({
            name: 'models/' + id,
            supportedGenerationMethods: ['generateContent'],
          })),
        });
      posts++;
      if (holding) {
        entered.open();
        await once(opts!.signal!, 'abort');
        aborts++;
        throw Error('transport aborted');
      }
      if (String(url).endsWith('/interactions'))
        return Response.json({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'audio',
                  data: fs.readFileSync('tests/fixtures/forest.wav').toString('base64'),
                },
              ],
            },
          ],
        });
      return Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(sample()) }] } },
        ],
      });
    });
    g.key('isolated-cancel-key');
    await g.test();
    g.configure('text', { model: 'gemini-2.5-flash', consent: 'free' });
    g.configure('tts', { model: 'gemini-test-tts', consent: 'free' });
    await req('/settings/svg-planner', { provider: 'gemini' });
    let p: Project = await (
      await req('/projects', { topic: 'Bir çizim', script: 'Ormanda yürür.' })
    ).json();
    const route = '/projects/' + p.id;
    p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
    const gen = async (kind: string) =>
      (await (
        await req(route + '/generate', { kind, scene: p.scenes[0]?.id }, p.rev)
      ).json()) as Project;
    await gen('svg-board');
    p = await settle(route);
    p = await (
      await req(
        route + '/board',
        { scenes: p.scenes, styleGuide: p.styleGuide, approve: true },
        p.rev,
      )
    ).json();
    await gen('voice');
    p = await settle(route);
    assert.equal(p.job.state, 'done');
    const before = structuredClone(p);
    holding = true;
    for (const kind of ['redraw-vector', 'voice']) {
      entered = gate();
      const job = await gen(kind);
      await entered.promise;
      assert.equal((await req(`/operations/${job.job.runId}/stop`, {})).status, 202);
      p = await settle(route);
      assert.equal(p.job.label, STOPPED);
      assert.deepEqual(p.scenes, before.scenes);
      assert.equal(p.boardApproval, before.boardApproval);
      assert.deepEqual(p.assets, before.assets);
    }
    assert.equal(posts, 4);
    assert.equal(aborts, 2);
    assert.equal(g.raw().services.tts?.status, 'connected');
    assert.equal(g.raw().services.text?.status, 'connected');
    assert.deepEqual(
      fs.readdirSync(path.join(store.dir(p.id), 'cache')).filter((n) => n !== 'vector'),
      [],
    );
  },
);

test('default science board: stop in the second image body, resume only missing plates; directed replacement is transactional', async (t) => {
  const headers: string[] = [],
    requests: { name: string; seed: string | null }[] = [],
    plans: Record<string, unknown>[] = [];
  let hold = true,
    wasAborted = false,
    bodyCancelled = false,
    badResponse = false,
    reached!: () => void;
  const bodyStarted = new Promise<void>((r) => {
    reached = r;
  });
  const { req, store, settle, prod } = await app(t, undefined, async (url, o) => {
    const u = new URL(String(url));
    if (u.host === 'openrouter.ai') {
      const body = JSON.parse(String(o?.body)),
        input = JSON.parse(body.messages[1].content);
      plans.push(input);
      headers.push(body.messages[0].content);
      return planned(input);
    }
    assert.equal(u.host, 'gen.pollinations.ai');
    assert.equal(
      new Headers(o?.headers).get('authorization'),
      'Bearer sk_offline-illustration-fixture',
    );
    const name = shotFile(imageRequest(u));
    requests.push({ name, seed: u.searchParams.get('seed') });
    if (hold && name === '02') {
      o?.signal?.addEventListener('abort', () => {
        wasAborted = true;
      });
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([255, 216]));
            reached();
          },
          cancel() {
            bodyCancelled = true;
          },
        }),
        { headers: { 'content-type': 'image/jpeg' } },
      );
    }
    if (badResponse) return new Response('<html>Not an image</html>');
    return antImage(name);
  });
  await req('/settings/svg-planner/key/openrouter', { key: 'isolated-model-fixture' });
  await req('/settings/pollinations/key', { key: 'sk_offline-illustration-fixture' });
  let p: Project = await (
    await req('/projects', { topic: antTopic, script: antLines.join('\n\n') })
  ).json();
  const route = '/projects/' + p.id;
  const start = async (kind: string, extra: Record<string, string> = {}) => {
    const r = await req(route + '/generate', { kind, ...extra }, p.rev);
    assert.equal(r.status, 202, await r.text());
  };
  const finish = async () => {
    p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
  };
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  await start('board');
  await finish();
  assert.equal(plans.length, 1 + antLines.length);
  assert.ok(headers[0].includes('one recurring subject'));
  assert.equal(p.cinema?.subject, antSubject);
  assert.deepEqual(
    p.scenes.map((s) => s.cinema?.title),
    antShots.map((x) => x.title),
  );
  assert.ok(p.scenes.every((s) => s.visualMode === 'illustration' && !s.vector));
  assert.equal(requests.length, 0);
  assert.equal((await req(route + '/generate', { kind: 'illustrations' }, p.rev)).status, 409);
  p = await (
    await req(
      route + '/board',
      { styleGuide: p.styleGuide, scenes: p.scenes, approve: true },
      p.rev,
    )
  ).json();
  assert.ok(p.boardApproval);
  const approval = p.boardApproval;
  await start('illustrations');
  await bodyStarted;
  const op = await (await req('/operation')).json();
  assert.equal((await req('/operations/' + op.id + '/stop', {})).status, 202);
  p = await settle(route);
  assert.equal(p.job.state, 'cancelled');
  assert.ok(wasAborted && bodyCancelled);
  assert.deepEqual(
    requests.map((x) => x.name),
    ['01', '02'],
  );
  const first = p.assets[p.scenes[0].id].image!;
  assert.ok(first && fs.existsSync(prod.file(p, first.file)));
  assert.ok(!p.assets[p.scenes[1].id]?.image);
  assert.equal(p.boardApproval, approval);
  hold = false;
  await start('illustrations');
  await finish();
  assert.deepEqual(
    requests.map((x) => x.name),
    ['01', '02', '02', '03', '04', '05'],
  );
  assert.equal(new Set(requests.map((x) => x.seed)).size, 1);
  assert.deepEqual(p.assets[p.scenes[0].id].image, first);
  await start('illustrations');
  await finish();
  assert.equal(requests.length, 6);
  // Distinct sentinels for externally acquired voice + timing files. No other service is allowed in this transport.
  for (const s of p.scenes) {
    const m = p.assets[s.id];
    m.voice = { key: voiceKey(p, s), file: `audio/${s.id}.wav`, duration: 4 };
    m.align = { file: `subtitles/${s.id}.json`, key: 'aligned', method: 'whisper' };
    m.words = [{ text: s.narration, start: 0, end: 3 }];
    m.clip = { file: `scenes/${s.id}.mp4`, key: 'clip' };
  }
  p.final = { file: 'renders/control.mp4', key: 'control' };
  store.save(p);
  const assets = structuredClone(p.assets),
    board = structuredClone(p.scenes),
    target = p.scenes[1];
  badResponse = true;
  await start('regenerate-illustration', { scene: target.id });
  p = await settle(route);
  assert.equal(p.job.state, 'failed');
  assert.deepEqual(p.assets, assets);
  assert.deepEqual(p.final, { file: 'renders/control.mp4', key: 'control' });
  badResponse = false;
  await start('regenerate-illustration', { scene: target.id, instruction: antDirection });
  await finish();
  assert.equal(plans.length, 7);
  assert.equal(plans.at(-1)?.direction, antDirection);
  assert.deepEqual(
    requests.slice(-2).map((x) => x.name),
    ['02', 'tunnel-close'],
  );
  assert.equal(p.final, undefined);
  assert.equal(p.boardApproval, approval);
  assert.deepEqual(p.scenes, board);
  for (const [i, s] of p.scenes.entries()) {
    const m = p.assets[s.id],
      prev = assets[s.id];
    assert.deepEqual(m.voice, prev.voice);
    assert.deepEqual(m.align, prev.align);
    assert.deepEqual(m.words, prev.words);
    if (i < 2) assert.equal(m.clip, undefined);
    else assert.deepEqual(m.clip, prev.clip);
    if (i !== 1) assert.deepEqual(m.image, prev.image);
    else {
      assert.notEqual(m.image?.file, prev.image?.file);
      assert.equal(m.image?.illustration?.brief, closer);
      assert.notEqual(m.image?.illustration?.seed, prev.image?.illustration?.seed);
      assert.notDeepEqual(
        fs.readFileSync(prod.file(p, m.image!.file)),
        fs.readFileSync(prod.file(p, prev.image!.file)),
      );
    }
  }
  const n = requests.length;
  await start('illustrations');
  await finish();
  assert.equal(requests.length, n);
  assert.ok(fs.readdirSync(path.join(store.dir(p.id), 'cache')).length === 0);
  assert.equal((await req('/operations/' + op.id + '/stop', {})).status, 409);
});
