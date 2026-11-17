import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Gemini, memoryVault, wav } from '../server/gemini';
import { invalidate } from '../server/invalidate';
import { framesForVoice, imageKey, Production, voiceKey } from '../server/production';
import {
  approveBoard,
  approved,
  changeScript,
  makeProject,
  now,
  scriptSig,
  Store,
} from '../server/store';
import { groups, srt, validWords } from '../shared/captions';
import { blankScene } from '../shared/schema';
function temp(t: any) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nedenmis-unit-'));
  const s = new Store(root, false);
  t.after(() => {
    s.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return s;
}
function draft() {
  const p = makeProject(
    'Karıncalar kışın neden ortadan kaybolur?',
    'Kış geldi. Koloni yer altında.',
  );
  p.scenes = ['Kış geldi.', 'Koloni yer altında.'].map((n) => ({
    ...blankScene(randomUUID()),
    narration: n,
    prompt: n,
    description: n,
    animation: 'Yavaş odak geçişi.',
  }));
  return p;
}
test('fixed production defaults and content-bound approval gates', () => {
  const p = draft();
  assert.equal(p.voice, 'Charon');
  assert.equal(p.intensity, 'Orta');
  assert.throws(() => approved(p), /senaryoyu/);
  assert.throws(() => approveBoard(p), /onayı/);
  p.scriptApproval = scriptSig(p);
  assert.throws(() => approved(p), /storyboard/);
  approveBoard(p);
  approved(p);
  p.scenes[0].prompt += ' değişti';
  assert.throws(() => approved(p), /storyboard/);
  changeScript(p, 'Yeni metin.');
  assert.equal(p.boardApproval, null);
  assert.equal(p.scriptApproval, null);
});
test('board cannot drop, paraphrase or reorder any approved narration', () => {
  const p = draft();
  p.scriptApproval = scriptSig(p);
  p.scenes.reverse();
  assert.throws(() => approveBoard(p), /aynı sırayla/);
  p.scenes.reverse();
  p.scenes[1].narration = 'Farklı cümle.';
  assert.throws(() => approveBoard(p));
  p.scenes = [];
  assert.throws(() => approveBoard(p));
});
test('undo is persistent and divergent edits do not overwrite older versions', (t) => {
  const s = temp(t),
    p = s.create(draft());
  s.checkpoint(p);
  p.title = 'İkinci';
  s.save(p);
  s.checkpoint(p);
  p.title = 'Üçüncü';
  s.save(p);
  const old = s.undo(p);
  assert.equal(old.title, 'İkinci');
  s.checkpoint(old);
  old.title = 'Ayrı düzenleme';
  s.save(old);
  assert.equal(old.history, 3);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(s.dir(p.id), 'versions/2.json'), 'utf8')).title,
    'İkinci',
  );
  assert.equal(s.get(p.id).title, 'Ayrı düzenleme');
});
test('startup recovery preserves outputs and reports interrupted work', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nedenmis-recover-'));
  const s = new Store(root, false),
    p = s.create(draft());
  p.scriptApproval = scriptSig(p);
  p.job = { at: now(), state: 'working', kind: 'tts', label: 'Ses üretiliyor' };
  const img = 'images/' + randomUUID() + '.jpg';
  fs.copyFileSync('ui/public/art/ants.jpg', path.join(s.dir(p.id), img));
  p.assets[p.scenes[0].id] = { image: { key: imageKey(p, p.scenes[0]), file: img } };
  s.save(p);
  s.db.close();
  const reopened = new Store(root, false);
  assert.equal(reopened.get(p.id).job.state, 'failed');
  assert.equal(reopened.get(p.id).scriptApproval, p.scriptApproval);
  assert.ok(fs.existsSync(path.join(reopened.dir(p.id), img)));
  reopened.db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test('changing a shot preserves unrelated media and invalidates only dependent outputs', () => {
  const p = draft();
  for (const s of p.scenes)
    p.assets[s.id] = {
      image: { key: imageKey(p, s), file: s.id + '.jpg' },
      voice: { key: voiceKey(p, s), file: s.id + '.wav' },
      clip: { key: 'old', file: s.id + '.mp4' },
    };
  const old = structuredClone(p);
  p.scenes[0].description = 'Yeni betimleme';
  invalidate(p, old);
  assert.equal(p.assets[p.scenes[0].id].image, undefined);
  assert.ok(p.assets[p.scenes[0].id].voice);
  assert.deepEqual(p.assets[p.scenes[1].id], old.assets[p.scenes[1].id]);
  const v = structuredClone(p);
  p.voice = 'Orus';
  invalidate(p, v);
  assert.ok(p.assets[p.scenes[1].id].image);
  assert.equal(p.assets[p.scenes[1].id].voice, undefined);
});
test('caption timing uses audio bounds, real milliseconds and sentence breaks', () => {
  const words = [
    { text: 'Kış', start: 0.14, end: 0.58 },
    { text: 'geldi.', start: 0.61, end: 1.24 },
  ];
  assert.ok(validWords(words, 1.25));
  assert.ok(!validWords([{ ...words[0], start: 1 }], 1.25));
  assert.ok(!validWords(words, 0.65));
  assert.ok(!validWords([words[1], words[0]], 2));
  assert.match(srt(words), /00:00:00,140 --> 00:00:01,240\nKış geldi\./);
  assert.equal(
    groups([...words, ...words.map((w) => ({ ...w, start: w.start + 2, end: w.end + 2 }))]).length,
    2,
  );
  assert.equal(framesForVoice(1.767), 54);
  const b = wav(Buffer.alloc(48000), 24000);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.readUInt32LE(40), 48000);
});
test('one key; discovery is read-only, paginated, and does not authorize generation', async (t) => {
  const store = temp(t),
    calls: string[] = [];
  const transport = async (url: any, opts: any) => {
    calls.push(String(url));
    assert.ok(opts.headers['x-goog-api-key']);
    assert.equal(opts.method, 'GET');
    const page = String(url).includes('pageToken');
    return Response.json({
      models: (page ? ['gemini-test-image'] : ['gemini-test-flash', 'gemini-test-tts']).map(
        (id) => ({ name: 'models/' + id, supportedGenerationMethods: ['generateContent'] }),
      ),
      nextPageToken: page ? '' : 'second',
    });
  };
  const g = new Gemini(store, memoryVault(), transport);
  assert.equal(g.settings().status, 'not-configured');
  const secret = 'test-only-credential';
  g.key(secret);
  assert.equal(g.settings().status, 'untested');
  const s = await g.test();
  assert.equal(s.status, 'connected');
  assert.equal(s.catalog.length, 3);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((u) => !u.includes(secret)));
  assert.equal(s.services.text, undefined);
  assert.throws(() => g.allowed('text'));
  assert.throws(
    () => g.configure('image', { model: 'gemini-test-image', consent: 'free' }),
    /ücretsiz/,
  );
  g.configure('text', { model: 'gemini-test-flash', consent: 'free' });
  assert.equal(g.allowed('text'), 'gemini-test-flash');
  g.key('updated-test-credential');
  assert.equal(g.settings().models.text.consent, 'blocked');
  assert.ok(!JSON.stringify(g.settings()).includes(secret));
  g.key();
  assert.equal(g.settings().hasKey, false);
  assert.equal(calls.length, 2);
});
test('invalid keys, quota and outages stay distinguishable; no automatic paid retries', async (t) => {
  const store = temp(t);
  for (const [status, expected] of [
    [400, 'invalid'],
    [429, 'quota'],
    [503, 'unavailable'],
  ] as const) {
    let attempts = 0;
    const g = new Gemini(store, memoryVault(), async () => {
      attempts++;
      return Response.json(
        { error: { details: [{ reason: 'API_KEY_INVALID' }] } },
        { status, headers: { 'retry-after': '17' } },
      );
    });
    g.key('local-test-input');
    if (status === 503) {
      const unavailable = new Gemini(store, memoryVault(), async () => {
        throw new Error('network');
      });
      unavailable.key('local-test-input');
      await assert.rejects(() => unavailable.test());
      assert.equal(unavailable.settings().status, 'unavailable');
      continue;
    }
    await assert.rejects(() => g.test());
    assert.equal(g.settings().status, expected);
    assert.equal(attempts, 1);
    if (status === 429) assert.match(g.settings().message, /17 sn/);
  }
});
test('adapter sends verbatim narration, parses WAV/PCM and keeps per-service evidence', async (t) => {
  const store = temp(t);
  const calls: any[] = [];
  const g = new Gemini(store, memoryVault(), async (_url, opts) => {
    if (opts?.method === 'GET')
      return Response.json({
        models: [
          { name: 'models/gemini-test-tts', supportedGenerationMethods: ['generateContent'] },
        ],
      });
    const body = JSON.parse(String(opts?.body));
    calls.push(body);
    return Response.json({
      status: 'completed',
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'audio',
              mime_type: 'audio/L16;rate=24000',
              data: Buffer.alloc(24000).toString('base64'),
            },
          ],
        },
      ],
    });
  });
  g.key('local-test-input');
  await g.test();
  g.configure('tts', { model: 'gemini-test-tts', consent: 'free' });
  const bytes = await g.voice('Kış geldi.', 'Charon', 'Sakin anlat.');
  assert.equal(calls[0].input[0].content[0].text, 'Kış geldi.');
  assert.equal(calls[0].store, false);
  assert.equal(calls[0].generation_config.speech_config[0].voice, 'Charon');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(g.settings().services.tts?.status, 'connected');
  assert.equal(g.settings().services.image, undefined);
});
test('damaged image import and unavailable TTS preserve previously verified assets', async (t) => {
  const store = temp(t),
    p = store.create(draft());
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  const engine = new Production(store, new Gemini(store, memoryVault()), {
    root: store.root,
    pythonDir: 'python',
    composition: 'build/composition',
  });
  await engine.import(p, 'image', fs.readFileSync('ui/public/art/ants.jpg'), p.scenes[0]);
  const a = structuredClone(p.assets[p.scenes[0].id].image);
  await assert.rejects(() => engine.import(p, 'image', Buffer.from('not an image'), p.scenes[0]));
  await assert.rejects(() => engine.asset(p, p.scenes[0], 'voice', true));
  assert.deepEqual(p.assets[p.scenes[0].id].image, a);
  assert.ok(fs.existsSync(engine.file(p, a!.file)));
  await engine.asset(p, p.scenes[0], 'image', false);
  assert.deepEqual(p.assets[p.scenes[0].id].image, a);
});
