import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validWords } from '../shared/captions';
import { makeProject, Store, scriptSig, approveBoard, hash } from '../server/store';
import { memoryVault } from '../server/vault';
import { Production, framesForVoice } from '../server/production';
import { Pollinations } from '../server/pollinations';
import { SceneModels } from '../server/scene-models';
import { CinemaPlanner } from '../server/cinema-planner';
import { Gemini } from '../server/gemini';
import { probe, verifyVideo } from '../server/media';
import { verifyCinema } from './cinema-pixels';
import {
  lines,
  topic,
  shots,
  direction,
  planned,
  imageRequest,
  antImage,
  shotFile,
} from './ant-fixtures';

async function main() {
  const out = path.resolve('out/ant-control'),
    speech = path.resolve('out/ant-speech'),
    store = new Store(out, false),
    strict = !process.argv.includes('--allow-estimate'),
    live = process.env.QA_LIVE_ANT === 'true';
  const paths = {
    root: path.resolve('out/acoustic-control'),
    composition: path.resolve('build/composition'),
    pythonDir: path.resolve('python'),
  };
  const imageSource = live
    ? 'Live Pollinations'
    : 'Image-generated QA artwork, replayed through the Pollinations HTTP transport; not live Pollinations';
  const plannerSource = live ? 'Live OpenRouter' : 'QA editorial responses, not a live text model';
  try {
    let textCalls = 0;
    const prompts: string[] = [],
      ttsCalls: string[] = [];
    const models = new SceneModels(
      store,
      { openrouter: memoryVault(), groq: memoryVault() },
      (url, o) => {
        textCalls++;
        return live
          ? fetch(url, o)
          : Promise.resolve(planned(JSON.parse(JSON.parse(String(o?.body)).messages[1].content)));
      },
    );
    if (live)
      assert.ok(
        process.env.QA_OPENROUTER_KEY && process.env.QA_POLLINATIONS_KEY,
        'Live ant QA requires explicitly authorized OpenRouter + Pollinations keys.',
      );
    models.key('openrouter', live ? process.env.QA_OPENROUTER_KEY : 'qa-editorial-replay');
    const p = store.create(makeProject(topic, lines.join(' ')));
    p.scriptApproval = scriptSig(p);
    const planner = new CinemaPlanner(store, models);
    await planner.plan(p, () => {});
    approveBoard(p);
    store.save(p);
    assert.deepEqual(
      p.scenes.map((s) => s.narration),
      lines,
    );
    assert.ok(
      p.scenes.every((s) => s.visualMode === 'illustration' && s.cinema && !s.vector && !s.svgPlan),
    );
    assert.ok(p.cinema);
    if (!live)
      assert.deepEqual(
        p.scenes.map((s) => s.cinema!.title),
        shots.map((s) => s.title),
      );
    const images = new Pollinations(store, memoryVault(), async (url, o) => {
      const prompt = imageRequest(new URL(String(url)), p.cinema!.subject);
      prompts.push(prompt);
      return live ? fetch(url, o) : antImage(shotFile(prompt));
    });
    if (live) images.key(process.env.QA_POLLINATIONS_KEY);
    const model = 'gemini-test-tts',
      g = new Gemini(store, memoryVault(), async (url, o) => {
        if (o?.method === 'GET')
          return Response.json({
            models: [{ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] }],
          });
        assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/interactions');
        const body = JSON.parse(String(o?.body)),
          text = body.input[0].content[0].text,
          i = lines.indexOf(text);
        assert.equal(body.model, model);
        assert.ok(i >= 0);
        ttsCalls.push(text);
        return Response.json({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'audio',
                  mime_type: 'audio/wav',
                  data: fs.readFileSync(path.join(speech, i + '.wav')).toString('base64'),
                },
              ],
            },
          ],
        });
      });
    g.key('qa-narration-replay');
    await g.test();
    g.configure('tts', { model, consent: 'free' });
    const engine = new Production(store, g, paths, images);
    assert.equal(await engine.render(p, 'all'), undefined);
    assert.ok(p.final && p.subtitleFiles);
    assert.deepEqual(ttsCalls, lines);
    assert.equal(prompts.length, lines.length);
    const plates = path.join(out, 'plates');
    fs.mkdirSync(plates, { recursive: true });
    const scenes = p.scenes.map((s, i) => {
      const m = p.assets[s.id];
      assert.ok(m.image && m.voice && m.align && m.clip);
      const src = engine.file(p, m.image.file);
      fs.copyFileSync(src, path.join(plates, `${i + 1}.jpg`));
      if (strict) {
        assert.equal(m.align.method, 'whisper', JSON.stringify(m.align));
        assert.ok(m.recognized && m.words && validWords(m.words, m.voice.duration!));
      }
      return {
        title: s.cinema!.title,
        narration: s.narration,
        brief: s.cinema!.brief,
        method: m.align.method,
        recognized: m.recognized,
        words: m.words?.length ?? 0,
        frames: framesForVoice(m.voice.duration!),
        image: src,
        sha256: hash(fs.readFileSync(src)),
      };
    });
    assert.equal(new Set(scenes.map((s) => s.sha256)).size, scenes.length);
    const frames = scenes.reduce((n, s) => n + s.frames, 0),
      mp4 = engine.file(p, p.final.file);
    await verifyVideo(mp4, frames, true);
    const pixels = await verifyCinema(out, mp4, scenes);
    const prefixes = 'karincalar-kisin-nereye-gider';
    fs.copyFileSync(mp4, path.join(out, prefixes + '.mp4'));
    for (const ext of ['srt', 'json'] as const)
      fs.copyFileSync(engine.file(p, p.subtitleFiles[ext]), path.join(out, prefixes + '.' + ext));
    const timings = JSON.parse(fs.readFileSync(engine.file(p, p.subtitleFiles.json), 'utf8'));
    if (strict) {
      assert.equal(
        timings.words.length,
        scenes.reduce((sum, s) => sum + s.words, 0),
      );
      assert.ok(timings.sentences.every((s: { estimated: boolean }) => !s.estimated));
    }
    const before = JSON.stringify([p.final, p.assets, p.subtitleFiles]);
    await engine.render(p, 'all');
    assert.equal(JSON.stringify([p.final, p.assets, p.subtitleFiles]), before);
    assert.equal(prompts.length, lines.length);
    assert.deepEqual(ttsCalls, lines);
    // Now revise a single shot on the completed film, with the actual WAVs, words and clips in place.
    const original = structuredClone(p.assets),
      approved = p.boardApproval,
      second = p.scenes[1],
      brief = await planner.directed(p, second, direction);
    await engine.asset(p, second, 'image', true, brief);
    assert.equal(p.boardApproval, approved);
    assert.equal(p.final, undefined);
    assert.equal(prompts.length, lines.length + 1);
    assert.deepEqual(ttsCalls, lines);
    for (const [i, s] of p.scenes.entries()) {
      const prev = original[s.id],
        now = p.assets[s.id];
      for (const k of ['voice', 'align', 'words', 'edits', 'recognized'] as const)
        assert.deepEqual(now[k], prev[k]);
      if (i !== 1) assert.deepEqual(prev.image, now.image);
      else assert.notEqual(now.image?.file, prev.image?.file);
      if (i < 2) assert.equal(now.clip, undefined);
      else assert.deepEqual(now.clip, prev.clip);
    }
    const updated = engine.file(p, p.assets[second.id].image!.file),
      revisedHash = hash(fs.readFileSync(updated));
    assert.notEqual(revisedHash, scenes[1].sha256);
    fs.copyFileSync(updated, path.join(plates, '2-revision.jpg'));
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          topic,
          subject: p.cinema.subject,
          plannerSource,
          textCalls,
          imageSource,
          imageCalls: prompts.length,
          prompts,
          voiceSource: JSON.parse(fs.readFileSync(path.join(speech, 'source.json'), 'utf8')),
          ttsCalls: ttsCalls.length,
          frames,
          seconds: frames / 30,
          scenes: scenes.map(({ image, ...s }) => s),
          pixels,
          streams: (await probe(mp4)).streams,
          cachedSecondExport: true,
          revision: {
            scene: 2,
            direction,
            brief,
            revisedHash,
            otherImagesPreserved: scenes.length - 1,
            allVoiceAndTimingPreserved: true,
          },
        },
        null,
        2,
      ),
    );
    console.log(
      `::notice title=Verified ant film::${scenes.length} locked full-bleed illustrations; ${frames} frames / ${(frames / 30).toFixed(2)}s; ${timings.words.length} Whisper word times; ${scenes.filter((s) => s.method === 'estimated').length} estimates. Each camera pose and one-line title verified in decoded MP4. Directed replacement: 1 image changed, all WAVs and timings retained. ${imageSource}; ${plannerSource}; QA speech. Titles: ${scenes.map((s) => s.title).join(' / ')}`,
    );
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e);
  if (process.env.GITHUB_ACTIONS)
    console.error(
      '::error title=Ant cinema control::' +
        String(e.message)
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 1500),
    );
  process.exitCode = 1;
});
