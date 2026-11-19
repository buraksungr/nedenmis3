/** No cloud requests: a real local composition/mix/export control, NOT the Gemini acceptance film. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { testImages } from './offline';
import { svgRenderControl } from './svg-render-control';
import { captionPlateControl } from './caption-plate-control';
import { staticFadeControl } from './static-fade-control';
import { fallbackControl } from './fallback-control';
import { acousticControl } from './acoustic-control';
import { probe, verifyVideo } from '../server/media';
import { Production, framesForVoice } from '../server/production';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { blankScene, type Word } from '../shared/schema';
async function main() {
  if (process.argv.includes('--whisper')) return acousticControl();
  const root = path.resolve('out/render-control');
  const store = new Store(root, false),
    paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    };
  // Feed a real still through the Pollinations download, validation and publication path,
  // then render that local asset alongside a manual upload. No provider is contacted.
  let imageGets = 0;
  const images = testImages(store, async () => {
    imageGets++;
    return new Response(new Uint8Array(fs.readFileSync('ui/public/art/ants.jpg')), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  });
  const prod = new Production(store, new Gemini(store, memoryVault()), paths, images);
  const tracks = ['forest', 'ocean'].map(
    (n) => JSON.parse(fs.readFileSync(`tests/fixtures/${n}.json`, 'utf8')) as Word[],
  );
  const lines = tracks.map((ws) => ws.map((w) => w.text).join(' '));
  const p = makeProject('Yerel render doğrulaması', lines.join(' '));
  p.scenes = lines.map((line, i) => ({
    ...blankScene(randomUUID()),
    narration: line,
    description: line,
    prompt: line,
    animation: i ? 'Sualtı akıntısı' : 'Karınca izini takip et',
    effect: i ? 'bubbles' : 'dust',
    camera: i ? 'pull' : 'track',
    transition: 'cut', // Legacy settings must not disable the new dissolve.
    object: i ? 'current' : 'trail',
  }));
  store.create(p);
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  store.save(p);
  for (const [i, s] of p.scenes.entries()) {
    if (i === 0) {
      await prod.asset(p, s, 'image', false);
      assert.equal(p.assets[s.id].image?.source, 'pollinations');
    } else await prod.import(p, 'image', fs.readFileSync('ui/public/art/ocean.jpg'), s);
    await prod.import(
      p,
      'voice',
      fs.readFileSync(`tests/fixtures/${i ? 'ocean' : 'forest'}.wav`),
      s,
    );
    p.assets[s.id].edits = tracks[i];
  }
  assert.equal(imageGets, 1);
  const end = p.scenes.reduce((n, s) => n + framesForVoice(p.assets[s.id].voice!.duration!), 0);
  for (const [i, s] of p.scenes.entries()) {
    const frames = framesForVoice(p.assets[s.id].voice!.duration!);
    console.log(`Rendering scene ${i + 1}: ${frames} frames`);
    await prod.clip(p, s, p.scenes[i + 1], frames);
  }
  await prod.finish(p);
  const final = prod.file(p, p.final!.file);
  const { streams, format } = await probe(final);
  await verifyVideo(final, end, true);
  assert.ok(fs.existsSync(prod.file(p, p.subtitleFiles!.srt)));
  const first = p.assets[p.scenes[0].id].clip!.file;
  await prod.clip(
    p,
    p.scenes[0],
    p.scenes[1],
    framesForVoice(p.assets[p.scenes[0].id].voice!.duration!),
  );
  assert.equal(
    p.assets[p.scenes[0].id].clip!.file,
    first,
    'Unchanged scene must not be rerendered',
  );
  fs.copyFileSync(final, path.join(root, 'local-render-control.mp4'));
  fs.writeFileSync(
    path.join(root, 'probe.json'),
    JSON.stringify({ frames: end, format, streams }, null, 2),
  );
  console.log(
    'Validated:',
    end,
    'frames;',
    streams.map((s: any) => [s.codec_name, s.width, s.height, s.duration]),
  );
  p.job = {
    state: 'done',
    kind: 'export',
    label: 'Yerel kontrol videosu doğrulandı',
    at: new Date().toISOString(),
  };
  store.save(p);
  console.log('Rendered control:', final);
  store.db.close();
  await fallbackControl(root);
  await staticFadeControl(root, framesForVoice(p.assets[p.scenes[0].id].voice!.duration!));
  await svgRenderControl(root);
  await captionPlateControl(root);
}
main().catch((e) => {
  console.error(e);
  if (process.env.GITHUB_ACTIONS)
    console.error(
      '::error title=Media control::' +
        String(e.message)
          .replace(/[\n\r]/g, ' ')
          .slice(0, 1500),
    );
  process.exitCode = 1;
});
