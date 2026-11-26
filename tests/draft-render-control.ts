import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { blankScene, type Project, type Scene } from '../shared/schema';
import { Gemini } from '../server/gemini';
import { invalidate } from '../server/invalidate';
import { ff, probe, verifyVideo } from '../server/media';
import { saveMotion } from '../server/motion-files';
import { draftInputs, framesForVoice, Production } from '../server/production';
import { approveBoard, hash, makeProject, scriptSig, Store } from '../server/store';
import { memoryVault } from '../server/vault';

/** Real H.264 export. No cloud, TTS, Whisper, Foley, or music in the silent paths. */
export async function draftRenderControl(out: string) {
  const root = path.join(out, 'draft-data'),
    store = new Store(root, false),
    paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    };
  let network = 0,
    whisper = 0;
  const g = new Gemini(store, memoryVault(), async () => {
    network++;
    throw new Error('Silent export must never request a provider');
  });
  const prod = new Production(store, g, paths, async () => {
    whisper++;
    throw new Error('Silent export must never run Whisper');
  });
  const scene = (narration: string, seconds: number): Scene => ({
    ...blankScene(randomUUID()),
    visualMode: 'motion-svg',
    narration,
    seconds,
  });
  const draw = (p: Project, s: Scene, color: string) => {
    const svg = `<svg viewBox="0 0 1080 1920"><g id="layer-bg"><rect width="1080" height="1920" fill="${color}"/></g><g id="layer-main"><path d="M200 300L400 300L300 450Z" fill="#fff"/><path d="M450 450L600 450L525 550Z" fill="#fff"/><path d="M700 650L850 650L775 750Z" fill="#fff"/></g><g id="layer-fx"><circle cx="300" cy="800" r="8" data-anim="fall"/><circle cx="500" cy="800" r="8" data-anim="fall"/><circle cx="700" cy="800" r="8" data-anim="fall"/></g></svg>`;
    s.choreography = saveMotion(
      store.dir(p.id),
      {
        kind: 'objects-v1',
        title: 'Bilimsel Görünüm',
        narrationHash: hash(s.narration),
        provider: 'openrouter',
        model: 'silent-qa',
      },
      svg,
      { requireDetailedArt: true, narration: s.narration },
    );
  };
  const smallPixel = async (file: string, frame: number) => {
    const rgb = path.join(root, `frame-${frame}.rgb`);
    await ff([
      '-i',
      file,
      '-vf',
      `select=eq(n\\,${frame}),scale=90:160`,
      '-frames:v',
      '1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      rgb,
    ]);
    const data = fs.readFileSync(rgb);
    fs.rmSync(rgb);
    return [...data.subarray(0, 3)];
  };
  try {
    const p = makeProject(
      'Kısmi sessiz kontrol',
      'Birinci sahne. İkinci sahne. Üçüncü sahne. Dördüncü sahne.',
    );
    p.scenes = [
      scene('Birinci sahne.', 0.5),
      scene('İkinci sahne.', 0.6),
      scene('Üçüncü sahne.', 0.7),
      scene('Dördüncü sahne.', 0.8),
    ];
    store.create(p);
    p.scriptApproval = scriptSig(p);
    draw(p, p.scenes[0], '#e74721');
    draw(p, p.scenes[2], '#1c6ccf');
    draw(p, p.scenes[3], '#31a061');
    // A missing signed file is not ready, just like an undrawn scene.
    fs.rmSync(
      path.join(store.dir(p.id), 'media', 'motion', p.scenes[3].choreography!.digest + '.svg'),
    );
    const normal = `renders/${randomUUID()}.mp4`,
      sub = `subtitles/${randomUUID()}.srt`;
    fs.writeFileSync(path.join(store.dir(p.id), normal), 'existing normal export');
    fs.writeFileSync(path.join(store.dir(p.id), sub), 'existing subtitles');
    p.final = { file: normal, key: 'normal-cache' };
    p.subtitleFiles = { srt: sub, json: sub };
    p.assets[p.scenes[0].id] = {
      voice: { file: `audio/${randomUUID()}.wav`, key: 'existing-voice', duration: 12 },
      clip: { file: `scenes/${randomUUID()}.mp4`, key: 'existing-clip' },
      words: [{ text: 'Önceden', start: 0, end: 0.4 }],
    };
    store.save(p);
    const previous = structuredClone({
      final: p.final,
      subtitleFiles: p.subtitleFiles,
      assets: p.assets,
    });
    assert.deepEqual(
      prod.draftReadyScenes(p).map((s) => s.id),
      [p.scenes[0].id, p.scenes[2].id],
    );
    const result = await prod.exportDraft(p);
    assert.equal(result.label, '2/4 hazır sahne • Sessiz taslak');
    assert.ok(p.draft);
    assert.equal(p.draft.total, 4);
    assert.deepEqual(p.draft.scenes, [
      { id: p.scenes[0].id, frames: framesForVoice(0.5) },
      { id: p.scenes[2].id, frames: framesForVoice(0.7) },
    ]);
    assert.equal(p.boardApproval, null);
    assert.deepEqual(
      { final: p.final, subtitleFiles: p.subtitleFiles, assets: p.assets },
      previous,
    );
    assert.equal(
      fs.readFileSync(path.join(store.dir(p.id), normal), 'utf8'),
      'existing normal export',
    );
    const video = prod.file(p, p.draft.asset.file),
      frames = p.draft.scenes.reduce((sum, s) => sum + s.frames, 0),
      streams = (await probe(video)).streams;
    assert.equal(p.draft.asset.hasAudio, false);
    assert.ok(!streams.some((s: { codec_type: string }) => s.codec_type === 'audio'));
    await verifyVideo(video, frames, false);
    const first = await smallPixel(video, 3),
      third = await smallPixel(video, framesForVoice(0.5) + 3);
    assert.ok(first[0] > first[2] * 2, `first scene not red: ${first}`);
    assert.ok(third[2] > third[0] * 2, `third scene not blue or wrong ordering: ${third}`);
    const cached = p.draft.asset.file;
    await prod.exportDraft(p);
    assert.equal(p.draft.asset.file, cached);
    // A v1.7.1 draft can contain ghosted keywords. Re-render it instead of
    // returning the otherwise valid old MP4 when only the renderer changed.
    p.draft.asset.key = hash('silent-draft-render-v1', draftInputs(p), p.draft.scenes);
    await prod.exportDraft(p);
    assert.notEqual(p.draft.asset.file, cached, 'legacy draft cache must be regenerated');
    assert.deepEqual(
      { final: p.final, subtitleFiles: p.subtitleFiles, assets: p.assets },
      previous,
    );
    const beforeFailure = structuredClone(p);
    p.subtitleSize += 1;
    const broken = new Production(store, g, { ...paths, composition: path.join(root, 'missing') });
    await assert.rejects(broken.exportDraft(p), /yerel servisleri/);
    assert.deepEqual(
      p.draft,
      beforeFailure.draft,
      'failure must not replace the previously published draft',
    );
    assert.deepEqual(p.final, previous.final);
    invalidate(p, beforeFailure);
    assert.equal(p.draft, undefined, 'changed inputs invalidate only the separate draft');
    assert.ok(fs.existsSync(video), 'detached files remain available to project history');

    // A complete, explicitly unvoiced approved board also remains offline and silent.
    const full = makeProject('Sessiz tam kontrol', 'İlk kare. İkinci kare.');
    full.scenes = [scene('İlk kare.', 0.2), scene('İkinci kare.', 0.3)].map((s) => ({
      ...s,
      svgVoiceMode: 'existing-only',
    }));
    store.create(full);
    full.scriptApproval = scriptSig(full);
    draw(full, full.scenes[0], '#e74721');
    draw(full, full.scenes[1], '#1c6ccf');
    approveBoard(full);
    store.save(full);
    assert.equal(await prod.render(full, 'all'), undefined);
    assert.ok(full.final && full.subtitleFiles);
    assert.equal(full.final.hasAudio, false);
    const total = full.scenes.reduce((sum, s) => sum + framesForVoice(s.seconds), 0);
    await verifyVideo(prod.file(full, full.final.file), total, false);
    const normalCached = JSON.stringify([full.final, full.assets, full.subtitleFiles]);
    await prod.render(full, 'all');
    assert.equal(JSON.stringify([full.final, full.assets, full.subtitleFiles]), normalCached);
    assert.equal(network, 0);
    assert.equal(whisper, 0);
    fs.writeFileSync(
      path.join(out, 'draft-control-report.json'),
      JSON.stringify(
        {
          selected: '2/4',
          frames,
          firstPixel: first,
          thirdPixel: third,
          audioTracks: streams.filter((s: { codec_type: string }) => s.codec_type === 'audio')
            .length,
          normalUnvoicedFrames: total,
          network,
          whisper,
          normalCachesPreserved: true,
        },
        null,
        2,
      ),
    );
    console.log(
      `Verified 2/4 ordered ready scenes, ${frames} frames, no audio/TTS/Whisper, untouched normal caches and a complete silent export.`,
    );
  } finally {
    store.db.close();
  }
}
