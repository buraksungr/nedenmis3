/** Real uploads, FFprobe, Remotion and FFmpeg. Only the deliberately invalid word timings are a fixture. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { testImages } from './offline';
import { verifyVideo } from '../server/media';
import { Production, framesForVoice } from '../server/production';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { blankScene } from '../shared/schema';
import { srtFromCues } from '../shared/captions';

export async function fallbackControl(output: string) {
  const root = path.join(output, 'fallback-data'),
    store = new Store(root, false);
  const paths = {
    root,
    pythonDir: path.resolve('python'),
    composition: path.resolve('build/composition'),
  };
  const originalPython = process.env.STUDIO_PYTHON;
  process.env.STUDIO_PYTHON = path.join(root, 'no-whisper-runtime', 'python.exe');
  try {
    let imageGets = 0;
    const images = testImages(store, async () => {
      imageGets++;
      return new Response(null, { status: 503 });
    });
    const g = new Gemini(store, memoryVault()),
      engine = new Production(store, g, paths, images);
    const lines = ['Karıncalar? Ormanda ilerler.', 'Balinalar sesle haberleşir.'];
    const p = makeProject('Tahmini altyazı kontrolü', lines.join(' '));
    p.scenes = lines.map((narration) => ({
      ...blankScene(randomUUID()),
      narration,
      description: narration,
      animation: 'Sakin takip',
    }));
    store.create(p);
    p.scriptApproval = scriptSig(p);
    approveBoard(p);
    store.save(p);
    for (const [i, s] of p.scenes.entries()) {
      if (i) await engine.import(p, 'image', fs.readFileSync('ui/public/art/ocean.jpg'), s);
      await engine.import(
        p,
        'voice',
        fs.readFileSync(`tests/fixtures/${i ? 'ocean' : 'forest'}.wav`),
        s,
      );
    }
    const pending = await engine.render(p, 'all');
    assert.equal(pending?.kind, 'manual-images');
    assert.equal(pending.scene, p.scenes[0].id);
    assert.match(pending.label, /HTTP 503/);
    assert.equal(imageGets, 1);
    assert.ok(!p.assets[p.scenes[0].id].image && !store.get(p.id).final);
    await engine.import(p, 'image', fs.readFileSync('ui/public/art/ants.jpg'), p.scenes[0]);
    const [a, b] = p.scenes,
      first = p.assets[a.id],
      second = p.assets[b.id];
    const d1 = first.voice!.duration!,
      d2 = second.voice!.duration!,
      offset = framesForVoice(d1) / 30;
    const badTimings = new Production(store, g, paths, testImages(store), async () => ({
      recognized: lines[0],
      words: [{ text: 'Karıncalar?', start: 0.32, end: 0.32 }],
    }));
    // Re-rendering a single scene must recover even without a prior alignment.
    await badTimings.render(p, 'clip', a.id);
    assert.ok(first.align?.method === 'estimated' && first.align.reason.includes('bitiş=0.32'));
    const clip = first.clip!.file;
    // Full render must still run if Whisper is absent before the second scene.
    await engine.render(p, 'all');
    assert.ok(
      second.align?.method === 'estimated' && /ön kontrolü.*ENOENT/.test(second.align.reason),
    );
    assert.equal(first.clip!.file, clip);
    assert.ok(p.final && p.subtitleFiles);
    assert.equal(
      imageGets,
      1,
      'Manual upload must resume the full render without repeating the provider call.',
    );
    const final = engine.file(p, p.final.file),
      srt = fs.readFileSync(engine.file(p, p.subtitleFiles.srt), 'utf8');
    await verifyVideo(final, framesForVoice(d1) + framesForVoice(d2), true);
    const expected = [
      { text: 'Karıncalar?', start: 0, end: Math.round(Math.floor(d1 * 1000) / 3) / 1000 },
      { text: 'Ormanda ilerler.', start: Math.round(Math.floor(d1 * 1000) / 3) / 1000, end: d1 },
      { text: lines[1], start: offset, end: offset + d2 },
    ];
    assert.equal(srt, srtFromCues(expected));
    const json = JSON.parse(fs.readFileSync(engine.file(p, p.subtitleFiles.json), 'utf8'));
    assert.deepEqual(json.words, []);
    assert.deepEqual(
      json.sentences,
      expected.map((c, i) => ({ ...c, scene: i < 2 ? a.id : b.id, estimated: true })),
    );
    const warnings = fs
      .readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
      .filter((e) => e.kind === 'align-fallback');
    assert.deepEqual(
      warnings.map((e) => e.scene),
      [a.id, b.id],
    );
    fs.copyFileSync(final, path.join(output, 'fallback-control.mp4'));
    fs.writeFileSync(path.join(output, 'fallback-control.srt'), srt);
    fs.copyFileSync(
      engine.file(p, p.subtitleFiles.json),
      path.join(output, 'fallback-control.json'),
    );
    fs.writeFileSync(
      path.join(output, 'fallback-diagnostics.ndjson'),
      warnings.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );
    console.log(
      'Validated fallback MP4, 3 sentence cues and diagnostics: invalid timestamps + unavailable Whisper.',
    );
  } finally {
    if (originalPython === undefined) delete process.env.STUDIO_PYTHON;
    else process.env.STUDIO_PYTHON = originalPython;
    store.db.close();
  }
}
