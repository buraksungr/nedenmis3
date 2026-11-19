import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { blankScene, type Scene } from '../shared/schema';
import { type SvgPlan, templates } from '../shared/svg';
import legacyFlight from './fixtures/legacy-flight.json';
import flight from './fixtures/flight.json';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { framesForVoice, Production } from '../server/production';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { testImages } from './offline';
import { ff, verifyVideo } from '../server/media';

/** Export using the real batch, clip, transition and audio paths. Both cloud transports are tripwires. */
export async function svgRenderControl(out: string) {
  const root = path.join(out, 'atlas-data'),
    store = new Store(root, false),
    paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    };
  let requests = 0;
  const offline: typeof fetch = async () => {
    requests++;
    throw new Error('No network in atlas control');
  };
  const images = testImages(store, offline),
    prod = new Production(store, new Gemini(store, memoryVault(), offline), paths, images);
  const plans: SvgPlan[] = legacyFlight as SvgPlan[];
  assert.deepEqual(new Set(plans.map((s) => s.template)), new Set(templates));
  const scenes: Scene[] = plans.map((plan, i) => ({
    ...blankScene(randomUUID()),
    narration: flight[i],
    description: plan.title,
    seconds: 1.6,
    visualMode: 'svg',
    svgVoiceMode: 'existing-only', // Explicit offline export, never an implicit fallback for a missing voice.
    svgPlan: plan,
  }));
  const photo = {
    ...blankScene(randomUUID()),
    narration: 'Ormanda ilerler.',
    description: 'Yerel fotoğraf kontrolü',
  };
  scenes.splice(2, 0, photo);
  const p = makeProject(
    'Bilim atlası · karma render kontrolü',
    scenes.map((s) => s.narration).join(' '),
  );
  p.scenes = scenes;
  const original = process.env.STUDIO_PYTHON;
  process.env.STUDIO_PYTHON = path.join(root, 'no-python', 'python.exe');
  try {
    store.create(p);
    p.scriptApproval = scriptSig(p);
    approveBoard(p);
    store.save(p);
    await prod.import(p, 'image', fs.readFileSync('ui/public/art/ants.jpg'), photo);
    await prod.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), photo);
    const photoFile = p.assets[photo.id].image!.file;
    // Manual photo waiting must never include an SVG shot. Run with auto-fill on, too.
    images.setAutoFill(false);
    assert.equal(prod.waitingForImages(p), undefined);
    images.setAutoFill(true);
    assert.equal(await prod.render(p, 'all'), undefined);
    assert.ok(p.final && p.subtitleFiles);
    assert.equal(requests, 0);
    const frameCounts = p.scenes.map((s) => Math.round(p.assets[s.id].clip!.duration! * 30)),
      total = frameCounts.reduce((a, b) => a + b, 0);
    for (const s of p.scenes.filter((s) => s.visualMode === 'svg')) {
      const m = p.assets[s.id];
      assert.ok(m.clip && !m.voice && !m.align && !m.image);
      assert.equal(Math.round(m.clip.duration! * 30), framesForVoice(s.seconds));
    }
    assert.equal(p.assets[photo.id].image!.file, photoFile);
    const final = prod.file(p, p.final.file);
    await verifyVideo(final, total, true);
    const subs = JSON.parse(fs.readFileSync(prod.file(p, p.subtitleFiles.json), 'utf8'));
    assert.equal(
      subs.sentences.filter((s: any) => s.timing === 'scene-duration').length,
      plans.length,
    );
    const file = path.join(out, 'svg-atlas-control.mp4');
    fs.copyFileSync(final, file);
    const rawFile = path.join(root, 'pixels.rgb'),
      w = 90,
      h = 160,
      stride = w * h * 3;
    try {
      await ff([
        '-i',
        final,
        '-an',
        '-vf',
        `scale=${w}:${h}`,
        '-pix_fmt',
        'rgb24',
        '-f',
        'rawvideo',
        rawFile,
      ]);
      const raw = fs.readFileSync(rawFile);
      assert.equal(raw.length, total * stride);
      // Measure the diagram area only (exclude captions, header, footer). Join differences
      // compare consecutive encoded frames, so allow small H.264 quantization differences.
      const diff = (a: number, b: number) => {
        let sum = 0,
          n = 0;
        for (let y = 50; y < 111; y++)
          for (let x = 6; x < 84; x++)
            for (let ch = 0; ch < 3; ch++) {
              const i = (w * y + x) * 3 + ch;
              sum += Math.abs(raw[a * stride + i] - raw[b * stride + i]);
              n++;
            }
        return sum / n;
      };
      let start = 0;
      const measurements = p.scenes.map((s, i) => {
        const count = frameCounts[i],
          motion = diff(start + 2, start + Math.floor(count * 0.6)),
          join = start ? diff(start - 1, start) : null;
        assert.ok(
          s.visualMode === 'svg' ? motion > 0.45 : motion < 1.3,
          `${s.svgPlan?.template ?? 'photo'}: ${motion}`,
        );
        assert.ok(join === null || join < 3, `Boundary error: ${join}`);
        start += count;
        return { template: s.svgPlan?.template ?? 'photo', frames: count, motion, join };
      });
      const report = {
        width: 1080,
        height: 1920,
        fps: 30,
        totalFrames: total,
        providerRequests: requests,
        measurements,
      };
      fs.writeFileSync(path.join(out, 'svg-atlas-report.json'), JSON.stringify(report, null, 2));
      console.log('Validated mixed photo/SVG atlas:', JSON.stringify(report));
    } finally {
      fs.rmSync(rawFile, { force: true });
    }
  } finally {
    if (original === undefined) delete process.env.STUDIO_PYTHON;
    else process.env.STUDIO_PYTHON = original;
    store.db.close();
  }
}
