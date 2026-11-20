// Real HTTP job/stop routes, Gemini SDK request builder and disk, with controlled provider replies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { STOPPED, type Project } from '../shared/schema';
import type { PlannerWait } from '../server/planner-pacing';
import { rigReply, titles, lines, topic } from './ant-motion-art';
import { app } from './http-studio';
import { completion } from './vector-test-data';

type Provider = 'gemini' | 'openrouter';
const credential = 'isolated-planner-credential',
  model = 'gemini-test-alternate';
const http = (status: number) => Response.json({ error: { message: credential } }, { status });
const candidate = (text: string, finishReason = 'STOP') =>
  Response.json({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
const truncated = (provider: Provider) =>
  provider === 'gemini'
    ? candidate('{', 'MAX_TOKENS')
    : Response.json({ choices: [{ finish_reason: 'length', message: { content: '{' } }] });
const success = (provider: Provider, value: unknown) =>
  provider === 'gemini' ? candidate(JSON.stringify(value)) : completion(value);

// Compact, valid controlled replies. The richer archived motion fixtures remain unchanged.
function compactStage(scene: number) {
  const svg = `<svg viewBox="0 0 1080 1920"><g id="set"><rect width="1080" height="1920" fill="#194057"/><path d="M0 1100Q540 980 1080 1140V1920H0Z" fill="#6c4e3f"/></g><use href="#subject-main" x="140" y="1020" data-anim="move" data-dx="120"/><use href="#subject-main" x="610" y="1050" data-anim="move" data-dx="80"/><circle cx="240" cy="420" r="12" data-anim="fall"/><circle cx="580" cy="340" r="9" data-anim="fall"/><circle cx="810" cy="520" r="14" data-anim="fall"/></svg>`;
  assert.ok(svg.length < 3500);
  return { title: titles[scene - 1], svg };
}
async function fixture(
  t: TestContext,
  provider: Provider,
  scenes: number,
  reply: (scene: number) => Response | undefined,
  wait?: PlannerWait,
) {
  const posts: {
    scene: number;
    repair?: string;
    url: string;
    body: string;
    rule: string;
    tokens: number;
    at: number;
  }[] = [];
  const ctx = await app(
    t,
    undefined,
    async (url, init) => {
      if (init?.method === 'GET')
        return Response.json({
          models: [{ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] }],
        });
      const body = String(init?.body),
        b = JSON.parse(body),
        google = provider === 'gemini';
      const [rule, data] = google
        ? b.contents[0].parts[0].text.split('\nSahne verisi:\n')
        : b.messages.map((m: { content: string }) => m.content);
      const input = JSON.parse(data),
        scene = Number(input.sahne ?? 0);
      posts.push({
        scene,
        repair: input.onarım,
        url: String(url),
        body,
        rule,
        tokens: google ? b.generationConfig.maxOutputTokens : b.max_tokens,
        at: performance.now(),
      });
      return reply(scene) ?? success(provider, scene ? compactStage(scene) : rigReply());
    },
    wait,
  );
  if (provider === 'gemini') {
    ctx.g.key(credential);
    await ctx.g.test();
    ctx.g.configure('text', { model, consent: 'free' });
  } else assert.ok((await ctx.req('/settings/svg-planner/key/openrouter', { key: credential })).ok);
  assert.ok((await ctx.req('/settings/svg-planner', { provider })).ok);
  const p: Project = await (
    await ctx.req('/projects', { topic, script: lines.slice(0, scenes).join(' ') })
  ).json();
  const route = '/projects/' + p.id;
  assert.ok((await ctx.req(route + '/script', { text: p.script, approve: true }, p.rev)).ok);
  const disk = () => ctx.store.get(p.id);
  const start = async () => {
    const r = await ctx.req(route + '/generate', { kind: 'board' }, disk().rev);
    assert.equal(r.status, 202);
    return (await r.json()) as Project;
  };
  const finish = async (timeout?: number) => {
    await start();
    return ctx.settle(route, timeout);
  };
  const log = () => fs.readFileSync(path.join(ctx.store.dir(p.id), 'production.ndjson'), 'utf8');
  return { ...ctx, posts, route, disk, start, finish, log };
}

for (const provider of ['gemini', 'openrouter'] as const) {
  test(`${provider}: 5s between shots; 429/503/429, then success, identical POSTs and a complete drawing`, async (t) => {
    let n = 0;
    const recorded: number[] = [];
    // CI also runs this case with the actual production timers (no injected wait).
    const real = provider === 'gemini' && process.env.QA_PLANNER_REAL_CLOCK === '1';
    const f = await fixture(
      t,
      provider,
      2,
      (scene) => {
        if (scene === 2 && n++ < 3) return http(n === 2 ? 503 : 429);
      },
      real
        ? undefined
        : async (ms) => {
            recorded.push(ms);
          },
    );
    const p = await f.finish(real ? 120_000 : undefined);
    assert.equal(p.job.state, 'done', p.job.label);
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 1, 2, 2, 2, 2],
    );
    assert.equal(p.motionWork, undefined);
    const expected = [5000, 10000, 20000, 35000];
    if (real) {
      const measured = f.posts.slice(2).map((post, i) => Math.round(post.at - f.posts[i + 1].at));
      for (const [i, ms] of measured.entries())
        assert.ok(ms >= expected[i] - 20, `early POST at ${ms} ms`);
      const report = {
        provider: 'Gemini SDK, fixture transport (no cloud account)',
        requestedMs: expected,
        observedMs: measured,
        posts: f.posts.map((q) => q.scene),
        ready: p.scenes.map((s) => s.id),
      };
      fs.mkdirSync('out/render-control', { recursive: true });
      fs.writeFileSync('out/render-control/planner-clock.json', JSON.stringify(report, null, 2));
      console.log(`Verified planner waits (ms): ${measured.join(' / ')}; saved both scenes.`);
    } else assert.deepEqual(recorded, expected);
    const attempts = f.posts.slice(2);
    assert.equal(new Set(attempts.map((q) => q.body)).size, 1);
    assert.ok(
      f.posts.every(
        (q) =>
          q.url ===
          (provider === 'gemini'
            ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
            : 'https://openrouter.ai/api/v1/chat/completions'),
      ),
    );
    for (const q of f.posts) {
      assert.ok(q.tokens >= 8192);
      assert.match(q.rule, /3500 karakterin altında/);
      assert.match(q.rule, /tam sayı/);
      assert.match(q.rule, /uzun ondalıklar ve XML yorumları kullanma/);
      assert.match(q.rule, /<\/svg>/);
      assert.equal(q.repair, undefined);
    }
    const log = f.log();
    assert.ok(!log.includes(credential));
    for (const msg of [
      'Sonraki sahne için bekleniyor...',
      'HTTP 429 - Kota/Hız Sınırı',
      'HTTP 503 - Hizmet',
      '10 sn sonra yeniden denenecek (1/3)',
      '20 sn sonra yeniden denenecek (2/3)',
      '35 sn sonra yeniden denenecek (3/3)',
    ])
      assert.ok(log.includes(msg), msg);
    if (provider === 'gemini') assert.deepEqual(Object.values(f.g.settings().requests), [6]);
  });
  test(`${provider}: recover the common rig on the first retry, then start the first scene immediately with its own budget`, async (t) => {
    let rig = 0,
      shot = 0;
    const waits: number[] = [];
    const f = await fixture(
      t,
      provider,
      1,
      (i) => (i === 0 ? (rig++ === 0 ? http(503) : undefined) : shot++ < 3 ? http(429) : undefined),
      async (ms) => {
        waits.push(ms);
      },
    );
    const p = await f.finish();
    assert.equal(p.job.state, 'done', p.job.label);
    assert.ok(p.subjectRig && p.scenes[0].choreography?.rigDigest === p.subjectRig.digest);
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 0, 1, 1, 1, 1],
    );
    assert.deepEqual(waits, [10000, 10000, 20000, 35000]);
  });
  test(`${provider}: persistent 429 on shot 3 saves shots 1–2 before waiting, capped retries, reopen and only request missing 3–4`, async (t) => {
    let quota = true;
    const waits: number[] = [],
      snapshots: Project[] = [];
    const f = await fixture(
      t,
      provider,
      4,
      (scene) => (scene === 3 && quota ? http(429) : undefined),
      async (ms) => {
        waits.push(ms);
        snapshots.push(f.disk());
      },
    );
    const p = await f.finish();
    assert.equal(p.job.state, 'failed');
    assert.match(p.job.label, /Sahne 3\/4: HTTP 429 - Kota\/Hız Sınırı/);
    assert.equal(p.motionWork?.[p.scenes[2].id]?.detail, p.job.label);
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 1, 2, 3, 3, 3, 3],
    );
    assert.deepEqual(waits, [5000, 5000, 10000, 20000, 35000]);
    for (const [i, s] of snapshots.entries()) {
      const count = i === 0 ? 1 : 2;
      assert.equal(s.scenes.filter((x) => x.choreography).length, count);
      assert.equal(s.job.scene, s.scenes[count].id);
      for (const shot of s.scenes.slice(0, count)) assert.ok(!s.motionWork?.[shot.id]);
    }
    const completed = p.scenes.slice(0, 2),
      dir = path.join(f.store.dir(p.id), 'media', 'motion');
    const files = completed.map((s) => path.join(dir, s.choreography!.digest + '.svg'));
    const contents = files.map((file) => fs.readFileSync(file));
    for (const s of completed) assert.ok((await f.req(f.route + '/motion/' + s.id)).ok);
    assert.ok(!JSON.stringify(p).includes(credential));
    assert.ok(!f.log().includes(credential));
    quota = false;
    const done = await f.finish();
    assert.equal(done.job.state, 'done', done.job.label);
    assert.deepEqual(done.subjectRig, p.subjectRig);
    assert.deepEqual(done.scenes.slice(0, 2), completed);
    assert.deepEqual(
      files.map((file) => fs.readFileSync(file)),
      contents,
    );
    assert.equal(done.motionWork, undefined);
    await f.finish(); // all ready: not even the cooldown, nor a call for the template
    assert.deepEqual(waits, [5000, 5000, 10000, 20000, 35000, 5000]);
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 1, 2, 3, 3, 3, 3, 3, 4],
    );
  });
  test(`${provider}: MAX_TOKENS and XML are not HTTP retries; label the actual scene failure, never commit truncated or invalid SVG`, async (t) => {
    let kind: 'length' | 'xml' = 'length';
    const waits: number[] = [];
    const f = await fixture(
      t,
      provider,
      1,
      (shot) =>
        !shot
          ? undefined
          : kind === 'length'
            ? truncated(provider)
            : success(provider, {
                title: 'Güvenli Derinlikler',
                svg: '<svg viewBox="0 0 1080 1920"><g></svg>',
              }),
      async (ms) => {
        waits.push(ms);
      },
    );
    for (kind of ['length', 'xml'] as const) {
      const mark = f.posts.length,
        p = await f.finish();
      const cause =
        kind === 'length' ? /MAX_TOKENS - Yanıt Yarım Kaldı/ : /XML Hatası - Satır \d+, sütun \d+/;
      assert.equal(p.job.state, 'failed');
      assert.match(p.job.label, cause);
      assert.match(p.motionWork![p.scenes[0].id].detail!, cause);
      assert.equal(p.scenes[0].choreography, undefined);
      const posts = f.posts.slice(mark).filter((x) => x.scene);
      assert.equal(posts.length, 3);
      assert.equal(posts[0].repair, undefined);
      for (const q of posts.slice(1)) assert.match(q.repair!, cause);
    }
    assert.deepEqual(waits, []);
  });
  test(`${provider}: transport and non-retryable HTTP faults are single attempts, no fallback, no raw response in project or log`, async (t) => {
    let status = 0;
    const waits: number[] = [];
    const f = await fixture(
      t,
      provider,
      1,
      (shot) => {
        if (shot) {
          if (status === 200) return Response.json({ error: { code: 429, message: credential } });
          if (status === 0) throw new Error('503 ' + credential);
          return http(status);
        }
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    for (status of provider === 'gemini' ? [0, 400, 403, 500] : [0, 400, 403, 500, 200]) {
      const p = await f.finish();
      assert.equal(p.job.state, 'failed');
      assert.match(p.job.label, status === 0 ? /Ağ Hatası/ : new RegExp(`HTTP ${status}`));
      assert.ok(!JSON.stringify(p).includes(credential));
      assert.equal(p.scenes[0].choreography, undefined);
    }
    assert.deepEqual(
      f.posts.map((x) => x.scene),
      provider === 'gemini' ? [0, 1, 1, 1, 1] : [0, 1, 1, 1, 1, 1],
    );
    assert.deepEqual(waits, []);
    assert.ok(!f.log().includes(credential));
  });
}

test('an HTTP retry budget spans the two independent content repairs; 503 exhaustion cannot reset the same drawing budget', async (t) => {
  const responses = [
    http(429),
    truncated('openrouter'),
    http(503),
    completion('broken JSON'),
    http(503),
    http(503),
  ];
  const waits: number[] = [];
  const f = await fixture(
    t,
    'openrouter',
    1,
    (i) => (i ? responses.shift() : undefined),
    async (ms) => {
      waits.push(ms);
    },
  );
  const p = await f.finish();
  assert.equal(p.job.state, 'failed');
  assert.match(p.job.label, /Sahne 1\/1: HTTP 503/);
  assert.deepEqual(waits, [10000, 20000, 35000]);
  assert.equal(f.posts.length, 7);
  const repairs = f.posts.slice(1).map((q) => q.repair);
  assert.deepEqual(repairs.slice(0, 2), [undefined, undefined]);
  assert.match(repairs[2]!, /MAX_TOKENS/);
  assert.equal(repairs[3], repairs[2]);
  assert.match(repairs[4]!, /JSON Hatası/);
  assert.equal(repairs[5], repairs[4]);
  assert.equal(p.scenes[0].choreography, undefined);
});

test(
  'Durdur cancels a 35s Gemini retry immediately, releases the lease and makes no late POST; a new run resumes only the missing scene',
  { timeout: 8000 },
  async (t) => {
    let notify!: () => void,
      late!: () => void,
      quota = true,
      aborted = false;
    const entered = new Promise<void>((r) => {
      notify = r;
    });
    const f = await fixture(
      t,
      'gemini',
      2,
      (i) => (i === 2 && quota ? http(503) : undefined),
      async (ms, signal) => {
        if (ms !== 35000) return;
        assert.ok(signal);
        notify();
        // Simulate even a late timer resolution racing the abort; the operation must never POST again.
        await new Promise<void>((r) => {
          late = r;
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              r();
            },
            { once: true },
          );
        });
      },
    );
    const accepted = await f.start();
    await entered;
    const pending = f.disk();
    assert.match(pending.job.label, /35 sn.*3\/3/);
    const first = pending.scenes[0];
    assert.ok(first.choreography);
    assert.equal((await f.req('/operations/' + accepted.job.runId + '/stop', {})).status, 202);
    const p = await f.settle(f.route, 3000);
    assert.equal(p.job.state, 'cancelled');
    assert.equal(p.job.label, STOPPED);
    assert.ok(aborted);
    late();
    await sleep(0);
    assert.equal(await (await f.req('/operation')).json(), null);
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 1, 2, 2, 2],
    );
    assert.equal(p.motionWork?.[p.scenes[1].id]?.detail, undefined);
    quota = false;
    const done = await f.finish();
    assert.deepEqual(done.scenes[0], first);
    assert.equal(done.job.state, 'done');
    assert.deepEqual(
      f.posts.map((q) => q.scene),
      [0, 1, 2, 2, 2, 2],
    );
  },
);
