/** Single production job; intercept only the provider transport. The aligner, renderer and mixer are not mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import lines from './fixtures/thirst.json';
import { validWords } from '../shared/captions';
import { svgPlanSchema } from '../shared/svg';
import { SvgPlanner } from '../server/svg-planner';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { Production, framesForVoice } from '../server/production';
import { probe, verifyVideo } from '../server/media';
import { testImages } from './offline';

async function main() {
  const root = path.resolve('out/acoustic-control'),
    out = path.resolve('out/thirst-control'),
    audio = path.resolve('out/thirst-speech'),
    strict = !process.argv.includes('--allow-estimate');
  const paths = {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    },
    store = new Store(out, false);
  let imageCalls = 0;
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
    const images = testImages(store, async () => {
        imageCalls++;
        throw Error('SVG may not request images');
      }),
      engine = new Production(store, g, paths, images);
    const p = store.create(
      makeProject('Tatlı yediğimizde neden hemen su içmek isteriz?', lines.join(' ')),
    );
    p.scriptApproval = scriptSig(p);
    const planner = new SvgPlanner(
      store,
      { groq: memoryVault(), openrouter: memoryVault() },
      async () => {
        throw Error('Expected offline planning');
      },
    );
    const plan = await planner.plan(p);
    assert.equal(plan.warning, '');
    p.scenes = plan.scenes;
    assert.deepEqual(
      p.scenes.map((s) => s.narration),
      lines,
    );
    approveBoard(p);
    store.save(p);
    const plans = plan.scenes.map((s) => svgPlanSchema.parse(s.svgPlan));
    assert.ok(new Set(plans.map((s) => s.template)).size >= 3);
    assert.ok(
      plans.every(
        (s, i) =>
          s.icon !== 'leaf' &&
          s.template !== 'ThermometerGaugeScene' &&
          (i === 0 || s.template !== plans[i - 1].template),
      ),
    );
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
        plan: s.svgPlan,
        method: m.align.method,
        recognized: m.recognized,
        frames: framesForVoice(m.voice.duration!),
        words: m.words?.length ?? 0,
      };
    });
    const frames = scenes.reduce((n, s) => n + s.frames, 0),
      final = engine.file(p, p.final.file);
    await verifyVideo(final, frames, true);
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
    fs.copyFileSync(final, path.join(out, 'tatli-ve-susama.mp4'));
    fs.copyFileSync(engine.file(p, p.subtitleFiles.srt), path.join(out, 'tatli-ve-susama.srt'));
    fs.copyFileSync(engine.file(p, p.subtitleFiles.json), path.join(out, 'tatli-ve-susama.json'));
    const source = JSON.parse(fs.readFileSync(path.join(audio, 'source.json'), 'utf8'));
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          source,
          provider: 'Offline Gemini TTS response fixture, no external generation or paid requests',
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
        `::notice title=Verified narrated SVG film::${scenes.length} scenes; ${frames} frames at 30 FPS; ${subtitles.words.length} Whisper word times; ${calls.length} fixture TTS calls; ${imageCalls} image calls; cached second export.`,
      );
    console.log(
      `Validated ${scenes.length} narrated thirst scenes, ${frames} frames at 30 FPS (${(frames / 30).toFixed(2)}s). TTS fixture calls: ${calls.length}, image calls: ${imageCalls}. Alignment: ${scenes.map((s) => s.method).join(', ')}. MP4: ${path.join(out, 'tatli-ve-susama.mp4')}`,
    );
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e);
  if (process.env.GITHUB_ACTIONS)
    console.error(
      '::error title=Thirst film::' +
        String(e.message)
          .replace(/[\n\r]+/g, ' ')
          .slice(0, 1500),
    );
  process.exitCode = 1;
});
