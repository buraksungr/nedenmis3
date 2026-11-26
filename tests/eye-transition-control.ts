import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { blankScene } from '../shared/schema';
import { Gemini } from '../server/gemini';
import { ff, verifyVideo } from '../server/media';
import { saveMotion } from '../server/motion-files';
import { Production } from '../server/production';
import { Store, approveBoard, hash, makeProject, scriptSig } from '../server/store';
import { memoryVault } from '../server/vault';
import { eyeArt } from './eye-motion-art';

/** Real encoded H.264 clips, not a model output: check eye art, exact join and keyword pixels. */
export async function eyeTransitionControl(out: string) {
  const root = path.resolve(out, 'eye-data'),
    store = new Store(root, false);
  const paths = {
    root,
    pythonDir: path.resolve('python'),
    composition: path.resolve('build/composition'),
  };
  let network = 0;
  const g = new Gemini(store, memoryVault(), async () => {
    network++;
    throw new Error('Offline QA');
  });
  const prod = new Production(store, g, paths),
    lines = ['İris ışığı denetler.', 'Mercek ışığı retinaya yönlendirir.'];
  const p = makeProject('Göz bebeği nasıl çalışır?', lines.join(' '));
  p.scenes = lines.map((narration) => ({
    ...blankScene(randomUUID()),
    narration,
    visualMode: 'motion-svg' as const,
  }));
  try {
    store.create(p);
    p.scriptApproval = scriptSig(p);
    for (const [i, s] of p.scenes.entries()) {
      s.choreography = saveMotion(
        store.dir(p.id),
        {
          kind: 'objects-v1',
          title: i ? 'Işığın Yolculuğu' : 'Göz Bebeği',
          narrationHash: hash(s.narration),
          provider: 'openrouter',
          model: 'offline-eye-qa',
        },
        eyeArt[i],
        { requireDetailedArt: true, narration: s.narration, topic: p.topic },
      );
    }
    approveBoard(p);
    store.save(p);
    for (const s of p.scenes) {
      await prod.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), s);
      // Deliberately end the subtitle early, so the real motion-scene dissolve has room to run.
      p.assets[s.id].edits = [{ text: 'Bitti.', start: 0, end: 0.35 }];
    }
    store.save(p);
    const save = store.save.bind(store);
    let injected = false;
    store.save = (project) => {
      if (!injected && project.job.kind === 'clip' && (project.job.progress ?? 0) > 0) {
        injected = true;
        throw Object.assign(new Error('simulated EPERM in render progress'), { code: 'EPERM' });
      }
      return save(project);
    };
    const frames = 36;
    await prod.clip(p, p.scenes[0], p.scenes[1], frames);
    await prod.clip(p, p.scenes[1], undefined, frames);
    assert.ok(injected, 'a real render progress save must exercise the EPERM guard');
    assert.equal(network, 0);
    const files = p.scenes.map((s) => prod.file(p, p.assets[s.id].clip!.file));
    for (const file of files) await verifyVideo(file, frames, false);

    const w = 270,
      h = 64,
      size = w * h * 3;
    const samples: Buffer[] = [];
    for (const [i, file] of files.entries()) {
      const raw = path.join(root, `label-${i}.rgb`);
      await ff([
        '-i',
        file,
        '-an',
        '-vf',
        `crop=${w}:${h}:70:164`,
        '-pix_fmt',
        'rgb24',
        '-f',
        'rawvideo',
        raw,
      ]);
      const data = fs.readFileSync(raw);
      fs.rmSync(raw);
      assert.equal(data.length, size * frames);
      samples.push(data);
    }
    const whitePixels = (scene: number, frame: number) => {
      const data = samples[scene],
        start = frame * size;
      let white = 0;
      for (let i = start; i < start + size; i += 3)
        if (data[i] > 170 && data[i + 1] > 170 && data[i + 2] > 170) white++;
      return white;
    };
    const oldLabel = whitePixels(0, 10),
      beforeFade = whitePixels(0, 24),
      overlap = [25, 27, 30, 35].map((frame) => ({ frame, white: whitePixels(0, frame) })),
      newLabel = whitePixels(1, 0);
    assert.ok(
      oldLabel > 50 && beforeFade > 50,
      `outgoing keyword missing: ${oldLabel}/${beforeFade}`,
    );
    assert.ok(
      overlap.every((v) => v.white < 8),
      `keyword ghost during dissolve: ${JSON.stringify(overlap)}`,
    );
    assert.ok(newLabel > 50, `incoming keyword missing at the scene boundary: ${newLabel}`);

    const projectDir = store.dir(p.id),
      list = path.join(projectDir, 'eye-clips.txt');
    fs.writeFileSync(
      list,
      p.scenes.map((s) => `file '${p.assets[s.id].clip!.file.replaceAll('\\', '/')}'`).join('\n'),
    );
    const film = path.resolve(out, 'eye-transition-control.mp4');
    await ff(
      [
        '-f',
        'concat',
        '-safe',
        '1',
        '-i',
        'eye-clips.txt',
        '-an',
        '-c:v',
        'copy',
        '-movflags',
        '+faststart',
        film,
      ],
      180000,
      projectDir,
    );
    await verifyVideo(film, frames * 2, false);
    const report = {
      offlineFixture: true,
      framesPerScene: frames,
      oldLabel,
      beforeFade,
      overlap,
      newLabel,
      injectedProgressEPERM: injected,
      providerCalls: network,
    };
    fs.writeFileSync(path.join(out, 'eye-transition-report.json'), JSON.stringify(report, null, 2));
    console.log('Verified encoded eye transition and progress EPERM:', JSON.stringify(report));
  } finally {
    store.db.close();
  }
}
