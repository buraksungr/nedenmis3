/** No cloud requests: a real local composition/mix/export control, NOT the Gemini acceptance film. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Gemini, memoryVault } from '../server/gemini';
import { probe, verifyVideo } from '../server/media';
import { Production, framesForVoice } from '../server/production';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { blankScene, type Word } from '../shared/schema';
async function main() {
  const root = path.resolve('out/render-control');
  const store = new Store(root, false),
    paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    };
  const prod = new Production(store, new Gemini(store, memoryVault()), paths);
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
    object: i ? 'current' : 'trail',
  }));
  store.create(p);
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  store.save(p);
  for (const [i, s] of p.scenes.entries()) {
    await prod.import(p, 'image', fs.readFileSync(`ui/public/art/${i ? 'ocean' : 'ants'}.jpg`), s);
    await prod.import(
      p,
      'voice',
      fs.readFileSync(`tests/fixtures/${i ? 'ocean' : 'forest'}.wav`),
      s,
    );
    p.assets[s.id].edits = tracks[i];
  }
  let end = 0;
  for (const [i, s] of p.scenes.entries()) {
    const next = end + framesForVoice(p.assets[s.id].voice!.duration!);
    console.log(`Rendering scene ${i + 1}: ${next - end} frames`);
    await prod.clip(p, s, p.scenes[i + 1], next - end);
    end = next;
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
  console.log('Rendered control:', final);
  store.db.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
