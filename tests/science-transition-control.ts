import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { blankScene } from '../shared/schema';
import { Gemini } from '../server/gemini';
import { ff, verifyVideo } from '../server/media';
import { saveMotion } from '../server/motion-files';
import { Production } from '../server/production';
import { instantiateTemplate } from '../server/science-templates';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { narrationHash } from '../server/vector-files';
import { memoryVault } from '../server/vault';

/** Decode both real local-template H.264 clips: neither keyword may ghost during a dissolve. */
export async function scienceTransitionControl(out: string) {
  const root = path.resolve(out, 'template-transition-data'),
    store = new Store(root, false);
  const g = new Gemini(store, memoryVault(), async () => {
    throw new Error('No provider in pixel QA');
  });
  const prod = new Production(store, g, {
    root,
    pythonDir: path.resolve('python'),
    composition: path.resolve('build/composition'),
  });
  const lines = ['İris ışığı denetler.', 'Mercek ışığı retinaya yönlendirir.'];
  const p = makeProject('Gözün anatomisi', lines.join(' '));
  p.scenes = lines.map((narration) => ({
    ...blankScene(randomUUID()),
    narration,
    visualMode: 'motion-svg' as const,
  }));
  try {
    store.create(p);
    p.scriptApproval = scriptSig(p);
    for (const [i, s] of p.scenes.entries()) {
      const template = i ? 'eye-cross' : 'eye-front';
      const title = i ? 'Işığın Yolculuğu' : 'Göz Bebeği';
      const xml = instantiateTemplate(
        template,
        {
          title,
          template,
          label1: i ? 'Mercek' : 'İris',
          label2: i ? 'retinaya' : 'ışığı',
        },
        `${s.narration} ${p.topic}`,
      );
      s.choreography = saveMotion(
        store.dir(p.id),
        {
          kind: 'objects-v2',
          title,
          narrationHash: narrationHash(s.narration),
          provider: 'openrouter',
          model: 'offline-template-qa',
        },
        xml,
        { requireDetailedArt: true, topic: p.topic, narration: s.narration },
      );
    }
    approveBoard(p);
    store.save(p);
    for (const s of p.scenes) {
      await prod.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), s);
      // Leave time for the compositor's real dissolve after the caption has ended.
      p.assets[s.id].edits = [{ text: 'Bitti.', start: 0, end: 0.35 }];
    }
    const frames = 36;
    await prod.clip(p, p.scenes[0], p.scenes[1], frames);
    await prod.clip(p, p.scenes[1], undefined, frames);
    const files = p.scenes.map((s) => prod.file(p, p.assets[s.id].clip!.file));
    for (const file of files) await verifyVideo(file, frames, false);
    const samples = [];
    // Both label zones are clear of eye anatomy and the top detail panel.
    for (const [name, x, y] of [
      ['upper', 80, 320],
      ['lower', 710, 1105],
    ] as const) {
      const width = 300,
        height = 72,
        size = width * height * 3;
      const raw: Buffer[] = [];
      for (const [i, file] of files.entries()) {
        const target = path.join(root, `${name}-${i}.rgb`);
        await ff([
          '-i',
          file,
          '-an',
          '-vf',
          `crop=${width}:${height}:${x}:${y}`,
          '-pix_fmt',
          'rgb24',
          '-f',
          'rawvideo',
          target,
        ]);
        const bytes = fs.readFileSync(target);
        fs.rmSync(target);
        assert.equal(bytes.length, size * frames);
        raw.push(bytes);
      }
      const white = (shot: number, frame: number) => {
        const bytes = raw[shot];
        let count = 0;
        for (let i = frame * size; i < (frame + 1) * size; i += 3)
          if (bytes[i] > 170 && bytes[i + 1] > 170 && bytes[i + 2] > 170) count++;
        return count;
      };
      const before = white(0, 10),
        overlap = [25, 27, 30, 35].map((frame) => white(0, frame)),
        incoming = white(1, 0);
      assert.ok(
        before > 35 && incoming > 35,
        `${name}: authored keyword not visible ${before}/${incoming}`,
      );
      assert.ok(
        overlap.every((count) => count < 8),
        `${name}: keyword ghost during dissolve ${overlap}`,
      );
      samples.push({ name, before, overlap, incoming });
    }
    const projectDir = store.dir(p.id),
      list = path.join(projectDir, 'template-clips.txt');
    fs.writeFileSync(
      list,
      p.scenes.map((s) => `file '${p.assets[s.id].clip!.file.replaceAll('\\', '/')}'`).join('\n'),
    );
    const film = path.resolve(out, 'template-transition-control.mp4');
    await ff(
      [
        '-f',
        'concat',
        '-safe',
        '1',
        '-i',
        'template-clips.txt',
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
    fs.writeFileSync(
      path.join(out, 'template-transition-report.json'),
      JSON.stringify({ samples, framesPerScene: frames }, null, 2),
    );
    console.log(
      'Verified both local-template keywords in encoded H.264, with no ghost during transition.',
      JSON.stringify(samples),
    );
  } finally {
    store.db.close();
  }
}
