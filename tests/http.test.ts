import { rigReply, stageReply } from './ant-motion-art';
import { completion } from './vector-test-data';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { app } from './http-studio';
import { voiceKey } from '../server/production';
import { STOPPED, STOPPING, blankScene, type Project } from '../shared/schema';
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
  // An existing schema-v1 manual board may still be opened and approved; no new raster board can be authored.
  assert.equal(
    (await req(route + '/board', { styleGuide: p.styleGuide, scenes: [s], approve: true }, p.rev))
      .status,
    422,
  );
  p.scenes = [s];
  store.save(p);
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

test('Gemini generateContent script, rig and independent object plans, then selected speaker through the real voice route', async (t) => {
  const lines = ['Kış yaklaşıyor.', 'İşçiler yuvaya dönüyor.'],
    text = lines.join(' '),
    model = 'gemini-2.5-flash',
    tts = 'gemini-test-tts',
    calls: string[] = [];
  const { req, settle } = await app(t, undefined, async (url, o) => {
    assert.equal(new URL(String(url)).host, 'generativelanguage.googleapis.com');
    assert.equal(new Headers(o?.headers).get('x-goog-api-key'), 'offline-test-credential');
    if (o?.method === 'GET')
      return Response.json({
        models: [model, tts].map((m) => ({
          name: 'models/' + m,
          supportedGenerationMethods: ['generateContent'],
        })),
      });
    const body = JSON.parse(String(o?.body));
    if (String(url).endsWith(':generateContent')) {
      const prompt = body.contents[0].parts[0].text,
        schema = body.generationConfig?.responseJsonSchema;
      let output = text;
      if (schema) {
        assert.equal(body.generationConfig.responseMimeType, 'application/json');
        const q = JSON.parse(prompt.split('Sahne verisi:\n').at(-1));
        calls.push(q.sahne ? 'scene' + q.sahne : 'rig');
        assert.deepEqual(schema.required, q.sahne ? ['title', 'svg'] : ['subject', 'svg']);
        output = JSON.stringify(q.sahne ? stageReply(q.sahne - 1) : rigReply());
      } else calls.push('script');
      return Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { thought: true, text: 'not narration' },
                { text: output.slice(0, 8) },
                { text: output.slice(8) },
              ],
            },
          },
        ],
      });
    }
    assert.ok(String(url).endsWith('/interactions'));
    calls.push(body.generation_config.speech_config[0].voice + ':' + body.input[0].content[0].text);
    return Response.json({
      status: 'completed',
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'audio',
              mime_type: 'audio/wav',
              data: fs.readFileSync('tests/fixtures/forest.wav').toString('base64'),
            },
          ],
        },
      ],
    });
  });
  assert.equal((await req('/settings/pollinations')).status, 404);
  assert.equal((await req('/settings/model', { kind: 'image', consent: 'blocked' })).status, 400);
  assert.equal((await req('/settings/speaker', { speaker: 'unknown' })).status, 400);
  await req('/settings/key', { key: 'offline-test-credential' });
  await req('/settings/test', {});
  for (const [kind, m] of [
    ['text', model],
    ['tts', tts],
  ])
    assert.equal((await req('/settings/model', { kind, model: m, consent: 'free' })).status, 200);
  await req('/settings/speaker', { speaker: 'Puck' });
  const v = await (await req('/projects', { topic: 'Karıncalar kışın nerede?' })).json(),
    route = '/projects/' + v.id;
  let p = await settle(route);
  assert.equal(p.script, text);
  assert.equal(p.voice, 'Puck');
  await req('/settings/speaker', { speaker: 'Kore' });
  p = await (await req(route + '/script', { text, approve: true }, p.rev)).json();
  assert.equal((await req(route + '/generate', { kind: 'photo-board' }, p.rev)).status, 400);
  await req(route + '/generate', { kind: 'board' }, p.rev);
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  assert.equal(p.subjectRig, undefined);
  assert.deepEqual(p.assets, {});
  assert.deepEqual(
    p.scenes.map((s) => s.narration),
    lines,
  );
  p = await (
    await req(
      route + '/board',
      { styleGuide: p.styleGuide, scenes: p.scenes, approve: true },
      p.rev,
    )
  ).json();
  assert.ok(p.boardApproval);
  for (const s of p.scenes) {
    await req(route + '/generate', { kind: 'voice', scene: s.id }, p.rev);
    p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.ok(p.assets[s.id]?.voice && !p.assets[s.id]?.image);
  }
  await req('/settings/speaker', { speaker: 'Leda' });
  assert.equal((await (await req(route)).json()).voice, 'Kore');
  assert.deepEqual(calls, ['script', 'scene1', 'scene2', ...lines.map((s) => 'Kore:' + s)]);
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
  assert.match(p.job.label, /yedek modele geçiliyor/);
  assert.equal(p.script, draft);
  assert.equal(p.scriptApproval, approval);
  assert.equal(g.settings().status, 'connected');
  assert.equal(g.settings().services.text?.status, 'quota');
  const log = fs.readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8');
  assert.ok(!log.includes(secret));
  for (const label of ['yedek modele geçiliyor']) assert.ok(log.includes(label));
});

test('no slide on provider failure; ready drawing, board approval and single directed redraw preserve narration/times and undo', async (t) => {
  let mode = 'fail';
  const prompts: Record<string, any>[] = [];
  const { req, store, settle, base } = await app(
    t,
    undefined,
    async (url, o) => {
      assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
      const input = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
      prompts.push(input);
      if (!input.sahne) return completion(rigReply());
      return mode === 'fail' && input.sahne === 1
        ? new Response('private-provider-error', { status: 503 })
        : mode === 'invalid'
          ? completion('broken')
          : completion(stageReply(input.sahne - 1, !!input.yönlendirme));
    },
    async () => {},
  );
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
  assert.equal((await gen({ kind: 'board' })).status, 409);
  p = await (await req(route + '/script', { text: p.script, approve: true }, p.rev)).json();
  await gen({ kind: 'board' });
  p = await settle(route);
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /503/);
  assert.equal(p.scenes.length, 3);
  assert.deepEqual(
    p.scenes.map((s) =>
      p.motionWork?.[s.id]?.detail ? 'failed' : s.choreography ? 'ready' : 'pending',
    ),
    ['failed', 'ready', 'ready'],
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
  await gen({ kind: 'board' });
  p = await settle(route);
  assert.equal(p.job.state, 'done', p.job.label);
  const board = (scenes = p.scenes) =>
    req(route + '/board', { scenes, styleGuide: p.styleGuide, approve: true }, p.rev);
  const fake = structuredClone(p.scenes);
  fake[1].choreography!.title = 'Yerel Uydurma';
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
  assert.deepEqual(
    prompts.map((q) => q.sahne ?? 0),
    [1, 2, 3, 1, 2, 2, 2, 2],
  );
  assert.equal(p.boardApproval, null);
  assert.deepEqual(p.scenes[0], old[0]);
  assert.deepEqual(p.scenes[2], old[2]);
  const ref = p.scenes[1].choreography!;
  assert.notEqual(ref.digest, s.choreography!.digest);
  for (const [i, v] of p.scenes.entries()) {
    const m = p.assets[v.id];
    assert.deepEqual(m.voice, audio[v.id].voice);
    assert.deepEqual(m.align, audio[v.id].align);
    assert.deepEqual(m.words, audio[v.id].words);
    assert.equal(!!m.clip, i === 2);
  }
  const file = await req(route + '/motion/' + s.id);
  assert.equal(file.headers.get('content-type')?.includes('application/json'), true);
  assert.equal((await file.json()).ref.rigDigest, undefined);
  assert.ok(!(await req('/projects/' + randomUUID() + '/motion/' + s.id)).ok);
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
      if (!i) return completion(rigReply());
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
      return completion(stageReply(i - 1));
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
      (await (await req(route + '/generate', { kind: 'board' }, p.rev)).json()) as Project;
    let accepted = await start();
    await entered.promise;
    const disk = store.get(p.id),
      first = disk.scenes[0];
    assert.ok(first.choreography);
    assert.equal(disk.scenes[1].choreography, undefined);
    const stop = '/operations/' + accepted.job.runId + '/stop';
    assert.equal((await req(stop, {})).status, 202);
    await observed.promise;
    p = store.get(p.id);
    assert.equal(p.job.state, 'stopping');
    assert.equal(p.job.label, STOPPING);
    assert.equal((await req(route + '/generate', { kind: 'board' }, p.rev)).status, 409);
    assert.equal((await req(stop, {})).status, 202);
    cleanup.open();
    p = await settle(route);
    assert.equal(p.job.state, 'cancelled');
    assert.equal(p.job.label, STOPPED);
    assert.deepEqual(calls, [1, 2]);
    assert.deepEqual(p.scenes[0], first);
    assert.equal(p.scriptApproval, script);
    assert.equal(p.scenes[1].choreography, undefined);
    accepted = await start();
    await again.promise;
    assert.notEqual('/operations/' + accepted.job.runId + '/stop', stop);
    assert.equal((await req(stop, {})).status, 409);
    finish.open();
    p = await settle(route);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.deepEqual(calls, [1, 2, 2, 3]);
    assert.deepEqual(p.scenes[0], first);
    assert.equal(p.motionWork, undefined);
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
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify(posts === 1 ? rigReply() : stageReply()) }] },
          },
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
    assert.equal(posts, 5);
    assert.equal(aborts, 2);
    assert.equal(g.raw().services.tts?.status, 'connected');
    assert.equal(g.raw().services.text?.status, 'connected');
    assert.deepEqual(
      fs.readdirSync(path.join(store.dir(p.id), 'cache')).filter((n) => n !== 'vector'),
      [],
    );
  },
);
