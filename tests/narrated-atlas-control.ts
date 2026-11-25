/** Single production job; intercept only the provider transport. The aligner, renderer and mixer are not mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import thirst from './fixtures/thirst.json';
import flight from './fixtures/flight.json';
import whale from './fixtures/whale.json';
import { validWords } from '../shared/captions';
import { svgPlanSchema } from '../shared/svg';
import { blankScene } from '../shared/schema';
import { randomUUID } from 'node:crypto';
import legacyThirst from './fixtures/legacy-thirst.json';
import legacyFlight from './fixtures/legacy-flight.json';
import { verifiedFrame } from '../server/vector-files';
import { verifyScenePixels } from './vector-pixels';
import { whaleBoard } from './whale-art';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { Production, framesForVoice } from '../server/production';
import { exec, python, probe, verifyVideo } from '../server/media';

async function main() {
  const isFlight = process.argv.includes('--flight'),
    isWhale = process.argv.includes('--whale');
  const lines = isWhale ? whale : isFlight ? flight : thirst,
    story = isWhale ? 'whale' : isFlight ? 'flight' : 'thirst',
    filename = isWhale
      ? 'karaya-vuran-balinalar'
      : isFlight
        ? 'ucuslar-ve-irtifa'
        : 'tatli-ve-susama',
    topic = isWhale
      ? 'Karaya vuran balinalar neden ölür?'
      : isFlight
        ? 'Uçaklar neden yüksekten uçar?'
        : 'Tatlı yediğimizde neden hemen su içmek isteriz?';
  const root = path.resolve('out/acoustic-control'),
    out = path.resolve(`out/${story}-control`),
    audio = path.resolve(`out/${story}-speech`),
    strict = !process.argv.includes('--allow-estimate');
  const paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    },
    store = new Store(out, false);
  // No image provider exists in the production API.
  const imageCalls = 0;
  const model = 'gemini-test-tts',
    calls: string[] = [];
  try {
    const g = new Gemini(store, memoryVault(), async (url, opts) => {
      if (opts?.method === 'GET')
        return Response.json({
          models: [{ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] }],
        });
      assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/interactions');
      const body = JSON.parse(String(opts?.body)),
        text = body.input[0].content[0].text,
        index = lines.indexOf(text);
      assert.equal(body.model, model);
      assert.ok(index !== -1);
      calls.push(text);
      const wav = fs.readFileSync(path.join(audio, `${index}.wav`));
      return Response.json({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'audio', mime_type: 'audio/wav', data: wav.toString('base64') }],
          },
        ],
      });
    });
    const engine = new Production(store, g, paths);
    const p = store.create(makeProject(topic, lines.join(' ')));
    p.scriptApproval = scriptSig(p);
    const art = isWhale ? await whaleBoard(store, p) : null;
    p.scenes =
      art?.scenes ??
      lines.map((narration, i) => ({
        ...blankScene(randomUUID()),
        narration,
        visualMode: 'svg' as const,
        svgPlan: svgPlanSchema.parse((isFlight ? legacyFlight : legacyThirst)[i]),
      }));
    assert.deepEqual(
      p.scenes.map((s) => s.narration),
      lines,
    );
    if (art) {
      assert.ok(p.scenes.every((s) => s.vector && !s.svgPlan));
      assert.equal(new Set(p.scenes.map((s) => s.vector!.digest)).size, lines.length);
      assert.equal(new Set(p.scenes.map((s) => s.vector!.title)).size, lines.length);
    }
    approveBoard(p);
    store.save(p);
    // No key cannot quietly turn an intended documentary into an unvoiced MP4.
    await assert.rejects(engine.render(p, 'all'), /Seslendirme/);
    assert.equal(store.get(p.id).final, undefined);
    assert.equal(calls.length, 0);
    g.key('isolated-qa-voice');
    await g.test();
    g.configure('tts', { model, consent: 'free' });
    assert.equal(await engine.render(p, 'all'), undefined);
    assert.ok(p.final && p.subtitleFiles);
    assert.deepEqual(calls, lines);
    assert.equal(imageCalls, 0);
    // On failure diagnose only this public QA fixture (never a user's production log).
    // The independently decoded transcript is diagnostic, NOT supplied to the aligner.
    if (strict && process.env.GITHUB_ACTIONS) {
      for (const [i, s] of p.scenes.entries()) {
        const m = p.assets[s.id];
        if (m.align?.method !== 'estimated' || !m.voice) continue;
        const heard = await exec(python(paths), [
          '-c',
          "import sys,torch,stable_whisper; torch.set_num_threads(2); m=stable_whisper.load_model('base',device='cpu',download_root=sys.argv[1]); print(m.transcribe(sys.argv[2],language='tr',fp16=False,verbose=None).text)",
          path.join(root, 'models'),
          engine.file(p, m.voice.file),
        ]);
        console.error(
          `::error title=QA speech ${i + 1}::${m.align.reason}; expected: ${s.narration}; recognized: ${heard.trim().split('\n').at(-1)}`,
        );
      }
    }
    const scenes = p.scenes.map((s) => {
      const m = p.assets[s.id];
      assert.ok(m.voice && m.align && m.clip);
      assert.ok(!m.image);
      if (strict) {
        assert.equal(m.align.method, 'whisper', JSON.stringify(m.align));
        assert.ok(m.recognized && m.words && validWords(m.words, m.voice.duration!));
      }
      return {
        narration: s.narration,
        plan: s.vector ?? s.svgPlan,
        method: m.align.method,
        recognized: m.recognized,
        frames: framesForVoice(m.voice.duration!),
        words: m.words?.length ?? 0,
      };
    });
    const frames = scenes.reduce((n, s) => n + s.frames, 0),
      final = engine.file(p, p.final.file);
    await verifyVideo(final, frames, true);
    const pixels = isWhale
      ? await verifyScenePixels(
          out,
          final,
          p.scenes.map((s, i) => ({
            v: verifiedFrame(store.dir(p.id), s.vector!, s.narration),
            frames: scenes[i].frames,
          })),
        )
      : undefined;
    if (isWhale) {
      fs.cpSync(path.join(store.dir(p.id), 'media', 'illustrations'), path.join(out, 'drawings'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(out, 'layers.json'),
        JSON.stringify(
          { source: art!.source, stage: '1080×1350 (70.3125% of 1920)', shots: pixels },
          null,
          2,
        ),
      );
    }
    const subtitles = JSON.parse(fs.readFileSync(engine.file(p, p.subtitleFiles.json), 'utf8'));
    if (strict) {
      assert.equal(
        subtitles.words.length,
        scenes.reduce((n, s) => n + s.words, 0),
      );
      assert.ok(subtitles.sentences.every((c: { estimated: boolean }) => !c.estimated));
    }
    const events = fs
      .readFileSync(path.join(store.dir(p.id), 'production.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).kind)
      .filter((k) => ['voice', 'align', 'export'].includes(k));
    assert.deepEqual(events, [...lines.flatMap(() => ['voice', 'align']), 'export']);
    const before = p.scenes.map((s) => structuredClone(p.assets[s.id])),
      exported = p.final.file;
    await engine.render(p, 'all');
    assert.deepEqual(calls, lines);
    assert.equal(p.final.file, exported);
    assert.deepEqual(
      p.scenes.map((s) => p.assets[s.id]),
      before,
    );
    fs.copyFileSync(final, path.join(out, filename + '.mp4'));
    fs.copyFileSync(engine.file(p, p.subtitleFiles.srt), path.join(out, filename + '.srt'));
    fs.copyFileSync(engine.file(p, p.subtitleFiles.json), path.join(out, filename + '.json'));
    const source = JSON.parse(fs.readFileSync(path.join(audio, 'source.json'), 'utf8'));
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          source,
          topic,
          pixels,
          drawingSource: art?.source ?? 'Playback of saved historical QA board',
          drawingRequests: art?.textRequests ?? 0,
          voiceTransport: 'Offline Gemini TTS response fixture; no live voice requests',
          ttsRequests: calls.length,
          imageCalls,
          frames,
          scenes,
          streams: (await probe(final)).streams,
        },
        null,
        2,
      ),
    );
    if (strict && process.env.GITHUB_ACTIONS)
      console.log(
        `::notice title=Verified ${story} film::${scenes.length} scenes; ${frames} frames at 30 FPS; ${subtitles.words.length} Whisper word times; ${calls.length} fixture TTS calls; ${imageCalls} image calls; cached second export. ${art ? `${art.source}. No fixed headings; all ${scenes.length * 3} static archive layers distinguished in decoded film. Metadata titles: ${p.scenes.map((s) => s.vector!.title).join(' / ')}` : 'Legacy board playback.'}`,
      );
    console.log(
      `Validated ${scenes.length} narrated ${story} scenes, ${frames} frames at 30 FPS (${(frames / 30).toFixed(2)}s). TTS fixture calls: ${calls.length}, image calls: ${imageCalls}. Alignment: ${scenes.map((s) => s.method).join(', ')}. MP4: ${path.join(out, filename + '.mp4')}`,
    );
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e);
  if (process.env.GITHUB_ACTIONS)
    console.error(
      '::error title=Narrated atlas film::' +
        String(e.message)
          .replace(/[\n\r]+/g, ' ')
          .slice(0, 1500),
    );
  process.exitCode = 1;
});
