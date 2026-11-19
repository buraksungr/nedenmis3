import { Operation } from '../server/operation';
import { createServer } from 'node:net';
import { STOPPED } from '../shared/schema';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { sentenceEstimates, verifiedAlignment } from '../server/alignment';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { testImages } from './offline';
import { exec } from '../server/media';
import { Production } from '../server/production';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { captionEntries, srtFromCues, validWords } from '../shared/captions';
import { blankScene } from '../shared/schema';

test('estimated Turkish sentence cues cover measured audio in proportion to word count', () => {
  assert.deepEqual(sentenceEstimates('  Su 2.5 derece. “Kış mı?”\nYuva sıcak… ', 7), [
    { text: 'Su 2.5 derece.', start: 0, end: 3 },
    { text: '“Kış mı?”', start: 3, end: 5 },
    { text: 'Yuva sıcak…', start: 5, end: 7 },
  ]);
  assert.deepEqual(sentenceEstimates('Noktasız anlatım', 1.76843), [
    { text: 'Noktasız anlatım', start: 0, end: 1.76843 },
  ]);
  const text = 'Kış! '.repeat(150).trim(),
    d = 0.0511,
    many = sentenceEstimates(text, d);
  assert.equal(many.map((c) => c.text).join(' '), text);
  assert.ok(validWords(many, d));
  assert.equal(many.at(-1)?.end, d);
  assert.ok(
    many.every(
      (c, i) =>
        (!i || c.start === many[i - 1].end) &&
        Math.round(c.end * 1000) > Math.round(c.start * 1000),
    ),
  );
  assert.ok(srtFromCues(many).includes('00:00:00,051'));
  for (const duration of [NaN, Infinity, 0, -1])
    assert.throws(() => sentenceEstimates('Kış.', duration));
  assert.throws(() => sentenceEstimates('  ', 5));
});

test('timing diagnostics identify missing output, the first bad span, overlap or duration overrun', () => {
  const w = { text: 'Kış', start: 0, end: 0.6 };
  for (const [words, why] of [
    [[], /boş/],
    [[null], /1\. kayıt: metin/],
    [[{ ...w, start: NaN }], /sonlu/],
    [[{ ...w, end: 0 }], /başlangıç=0, bitiş=0/],
    [[w, { ...w, start: 0.4 }], /2\. kayıt.*önceki bitiş=0.6/],
    [[{ ...w, start: 1.01, end: 1.02 }], /başlangıç=1.01.*dışında/],
    [[{ ...w, end: 9 }], /bitiş=9.*ses süresini \(1 sn\)/],
  ] as const)
    assert.throws(() => verifiedAlignment({ recognized: 'Kış', words }, 1), why);
  assert.throws(() => verifiedAlignment({ words: [w] }, 1), /transkripsiyonu boş/);
  assert.deepEqual(verifiedAlignment({ recognized: 'Kış', words: [w] }, 1).words, [w]);
});

test('fallback is versioned, editable, cached and replaceable with a verified track; bad audio is not a timing fallback', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-hizalama-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const text = 'Karıncalar? Ormanda ilerler.',
    p = makeProject('Altyazı', text);
  const scene = {
    ...blankScene(randomUUID()),
    narration: text,
    description: text,
    animation: 'Pan',
  };
  p.scenes = [scene];
  store.create(p);
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  let attempts = 0,
    working = false;
  const engine = new Production(
    store,
    new Gemini(store, memoryVault()),
    { root, pythonDir: 'python', composition: 'build/composition' },
    testImages(store),
    async () => {
      attempts++;
      return {
        recognized: text,
        words: working
          ? [
              { text: 'Karıncalar?', start: 0, end: 0.4 },
              { text: 'Ormanda', start: 0.5, end: 0.8 },
              { text: 'ilerler.', start: 0.9, end: 1.4 },
            ]
          : [{ text: 'Karıncalar?', start: 0.42, end: 0.42 }],
      };
    },
  );
  const warn = t.mock.method(console, 'warn', () => {});
  await engine.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), scene);
  const m = p.assets[scene.id],
    duration = m.voice!.duration!;
  m.voice!.duration = 30; // stale estimate must not become the clock
  await engine.align(p, scene);
  const first = store.get(p.id).assets[scene.id].align!;
  assert.equal(first.method, 'estimated');
  assert.equal(m.voice!.duration, duration);
  assert.ok(first.method === 'estimated' && first.sentences.at(-1)!.end === duration);
  assert.ok(!m.recognized && !m.words);
  assert.match(warn.mock.calls[0].arguments[0], /bitiş=0.42/);
  const log = fs
    .readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .find((e) => e.kind === 'align-fallback');
  assert.equal(log.scene, scene.id);
  assert.equal(log.audio, m.voice!.file);
  assert.equal(log.duration, duration);
  assert.ok(log.python && log.ffmpeg && log.ffprobe);
  m.edits = captionEntries(m).map((c, i) => ({ ...c, text: i ? 'Düzenlendi.' : c.text }));
  store.save(p);
  const loaded = store.get(p.id);
  await engine.align(loaded, scene);
  assert.equal(attempts, 1);
  await engine.align(p, scene, true);
  assert.equal(attempts, 2);
  assert.deepEqual(store.get(p.id).assets[scene.id].align, first);
  assert.equal(m.edits[1].text, 'Düzenlendi.');
  working = true;
  await engine.align(p, scene, true);
  assert.equal(m.align?.method, 'whisper');
  assert.notEqual(m.align?.file, first.file);
  assert.ok(fs.existsSync(engine.file(p, first.file)));
  assert.equal(m.recognized, text);
  assert.equal(m.edits, undefined);
  working = false;
  await engine.align(p, scene, true);
  assert.equal(m.align?.method, 'whisper');
  assert.equal(m.recognized, text);
  fs.writeFileSync(engine.file(p, m.voice!.file), 'not audio');
  await assert.rejects(() => engine.align(p, scene, true), /Ses dosyası okunamadı.*FFprobe/);
  assert.equal(m.align?.method, 'whisper');
});

test('process diagnostics distinguish missing executable, stderr/exit code and timeout', async () => {
  await assert.rejects(exec(path.join(os.tmpdir(), 'missing-' + randomUUID()), []), /ENOENT/);
  await assert.rejects(
    exec(process.execPath, ['-e', "console.error('decoder failure');process.exit(7)"]),
    /çıkış=7.*decoder failure/,
  );
  await assert.rejects(
    exec(process.execPath, ['-e', 'setTimeout(()=>{},5000)'], 200),
    /süre sınırı/,
  );
});

test(
  'stop a running recognizer and its descendant; release the open file and listening port before returning, never publish estimated subtitles',
  { timeout: 20000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-stop-align-')),
      store = new Store(root, false);
    t.after(() => {
      store.db.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const s = { ...blankScene(randomUUID()), narration: 'Ormanda ilerler.', description: 'Yuva' },
      p = makeProject('Hizalama', s.narration);
    p.scenes = [s];
    p.scriptApproval = scriptSig(p);
    approveBoard(p);
    store.create(p);
    let ready!: (port: number) => void;
    const entered = new Promise<number>((r) => {
      ready = r;
    });
    const engine = new Production(
      store,
      new Gemini(store, memoryVault()),
      { root, pythonDir: 'python', composition: 'build/composition' },
      testImages(store),
      async (_paths, _wav, _txt, out) => {
        const child = `require('node:fs').openSync(process.argv[1],'w');const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`;
        await exec(
          process.execPath,
          [
            '-e',
            `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(child)},process.argv[1]],{stdio:'inherit'});`,
            out,
          ],
          10000,
          (line) => ready(Number(line)),
        );
        throw Error('unexpected recognition exit');
      },
    );
    await engine.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), s);
    const before = structuredClone(p.assets[s.id]);
    const op = new Operation(p.id, 'Whisper');
    const finished = assert.rejects(
      op.run(() => engine.align(p, s, true)),
      new RegExp(STOPPED),
    );
    const port = await entered;
    assert.ok(port > 0);
    op.stop();
    await finished;
    const socket = createServer();
    await new Promise<void>((resolve, reject) =>
      socket.once('error', reject).listen(port, '127.0.0.1', resolve),
    );
    await new Promise<void>((r) => socket.close(() => r()));
    assert.deepEqual(store.get(p.id).assets[s.id], before);
    assert.deepEqual(fs.readdirSync(path.join(store.dir(p.id), 'cache')), []);
    assert.deepEqual(fs.readdirSync(path.join(store.dir(p.id), 'subtitles')), []);
    assert.doesNotMatch(
      fs.readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8'),
      /align-fallback/,
    );
  },
);
