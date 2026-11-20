/** Opt-in CPU integration test. Only QA downloads this pinned public speech sample. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { ff, probe, setupPython, verifyVideo } from '../server/media';
import { Production, framesForVoice } from '../server/production';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { blankScene } from '../shared/schema';
import { validWords } from '../shared/captions';
const ref = 'ce0c9e6f1cafaaf3fcb696a2c36d1b61d2b6ba08',
  source = `https://github.com/rhasspy/piper-samples/blob/${ref}/samples/tr/tr_TR/dfki/medium/`;
const transcript =
  'Gökkuşağı, güneş ışınlarının yağmur damlalarında veya sis bulutlarında yansıması ve kırılmasıyla meydana gelen ve ışık tayfı renklerinin bir yay şeklinde göründüğü meteorolojik bir olaydır.';
export async function acousticControl() {
  const root = path.resolve('out/acoustic-control'),
    paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    };
  fs.mkdirSync(root, { recursive: true });
  if (process.argv.includes('--setup-python')) await setupPython(paths, console.log);
  const sample = await fetch(
    `https://api.github.com/repos/rhasspy/piper-samples/contents/samples/tr/tr_TR/dfki/medium/speaker_0.mp3?ref=${ref}`,
    { signal: AbortSignal.timeout(30000) },
  );
  assert.ok(sample.ok, 'Unable to fetch pinned Turkish acoustic fixture');
  const audio = Buffer.from((await sample.json()).content, 'base64');
  assert.equal(
    createHash('sha256').update(audio).digest('hex'),
    '993e516d9ee02197a3fa6a82b2a129864c57a8d585a30551f0069fe24124d255',
  );
  const store = new Store(root, false);
  try {
    const engine = new Production(store, new Gemini(store, memoryVault()), paths);
    const create = () => {
      const p = makeProject('Akustik hizalama denetimi', transcript);
      const s = {
        ...blankScene(randomUUID()),
        narration: transcript,
        description: 'Ormanda güneş ışığı ve sis',
        prompt: 'Yerel test görseli',
        animation: 'Ormanda ışık huzmeleri',
        effect: 'rays' as const,
      };
      p.scenes = [s];
      store.create(p);
      p.scriptApproval = scriptSig(p);
      approveBoard(p);
      store.save(p);
      return { p, s };
    };
    const { p, s } = create();
    await engine.import(p, 'voice', audio, s);
    const originalVoice = p.assets[s.id].voice!.file;
    assert.equal((await engine.render(p, 'all'))?.kind, 'manual-images');
    assert.ok(!p.assets[s.id].image && !p.assets[s.id].clip && !store.get(p.id).final);
    await engine.import(p, 'image', fs.readFileSync('ui/public/art/forest-studio.jpg'), s);
    // No injected timestamps: full production preflight → ASR → forced alignment → render → mix.
    await engine.render(p, 'all');
    const m = p.assets[s.id];
    assert.equal(m.voice?.file, originalVoice);
    assert.equal(m.align?.method, 'whisper', 'An estimate must never pass the acoustic control');
    assert.ok(m.words && m.recognized && m.voice?.duration && p.final && p.subtitleFiles);
    assert.ok(validWords(m.words, m.voice.duration));
    assert.ok(m.words.length > 15);
    const frames = framesForVoice(m.voice.duration),
      video = engine.file(p, p.final.file);
    await verifyVideo(video, frames, true);
    fs.copyFileSync(video, path.join(root, 'local-render-control.mp4'));
    fs.writeFileSync(path.join(root, 'probe.json'), JSON.stringify(await probe(video), null, 2));
    // The transcript stays identical. Measured word boundaries must respond to acoustic delay.
    const delayed = path.join(root, 'delayed.wav');
    await ff([
      '-i',
      engine.file(p, m.voice.file),
      '-af',
      'adelay=800',
      '-c:a',
      'pcm_s16le',
      delayed,
    ]);
    const c = create();
    await engine.import(c.p, 'voice', fs.readFileSync(delayed), c.s);
    await engine.align(c.p, c.s);
    assert.equal(c.p.assets[c.s.id].align?.method, 'whisper');
    const shifted = c.p.assets[c.s.id].words!;
    assert.equal(shifted.length, m.words.length);
    const errors = shifted
      .map((w, i) => Math.abs(w.start - m.words![i].start - 0.8))
      .sort((a, b) => a - b);
    const median = errors[Math.floor(errors.length / 2)];
    assert.ok(median < 0.2, 'Alignment did not track the 800 ms waveform shift');
    const report = {
      source,
      attribution:
        'Rhasspy/Piper Turkish DFKI OT demonstration. Dataset: DFKI OT / MaryTTS, CC BY-NC-SA 4.0. QA only; imported speech, not Gemini.',
      transcript,
      recognized: m.recognized,
      aligned: m.words,
      shifted,
      medianShiftErrorSeconds: median,
      frames,
    };
    fs.writeFileSync(path.join(root, 'alignment-report.json'), JSON.stringify(report, null, 2));
    console.log(
      'Actual CPU transcription and alignment passed:',
      m.words.length,
      'words;',
      median,
      's median shift error.',
    );
  } finally {
    store.db.close();
  }
}
