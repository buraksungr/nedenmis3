import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validWords } from '../shared/captions';
import { makeProject, Store, scriptSig, approveBoard } from '../server/store';
import { memoryVault } from '../server/vault';
import { Production, framesForVoice } from '../server/production';
import { SceneModels } from '../server/scene-models';
import { ObjectPlanner } from '../server/object-planner';
import { Gemini } from '../server/gemini';
import { probe, verifyVideo } from '../server/media';
import { motionFrame } from '../server/motion-files';
import { templateIdInStage } from '../server/science-templates';
import { completion } from './vector-test-data';
import { lines, topic, titles } from './ant-motion-art';
import { planReply } from './template-test-data';
import { objectPixels } from './object-pixels';
async function main() {
  const out = path.resolve('out/ant-motion-control'),
    speech = path.resolve('out/ant-speech'),
    store = new Store(out, false),
    strict = !process.argv.includes('--allow-estimate');
  const paths = {
    root: path.resolve('out/acoustic-control'),
    composition: path.resolve('build/composition'),
    pythonDir: path.resolve('python'),
  };
  const textCalls: number[] = [],
    ttsCalls: string[] = [];
  try {
    const models = new SceneModels(
      store,
      { openrouter: memoryVault(), groq: memoryVault() },
      async (url, o) => {
        assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
        const q = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
        textCalls.push(q.sahne ?? 0);
        // Production starts directly with Sahne 1/5; no common rig (scene 0) call anymore.
        assert.ok(q.sahne, 'expected a scene number, no rig request');
        assert.equal(q.anlatım, lines[q.sahne - 1]);
        return completion(planReply(q.sahne - 1, !!q.yönlendirme));
      },
    );
    models.key('openrouter', 'offline-motion-replay');
    const planner = new ObjectPlanner(store, models),
      p = store.create(makeProject(topic, lines.join(' ')));
    p.scriptApproval = scriptSig(p);
    await planner.plan(p, () => {});
    approveBoard(p);
    store.save(p);
    assert.deepEqual(textCalls, [1, 2, 3, 4, 5]);
    assert.deepEqual(
      p.scenes.map((s) => s.choreography!.title),
      titles,
    );
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
    const engine = new Production(store, g, paths);
    assert.equal(await engine.render(p, 'all'), undefined);
    assert.ok(p.final && p.subtitleFiles);
    assert.deepEqual(ttsCalls, lines);
    const scenes = p.scenes.map((s) => {
      const m = p.assets[s.id];
      assert.ok(!m.image && m.voice && m.align && m.clip);
      if (strict) {
        assert.equal(m.align.method, 'whisper', JSON.stringify(m.align));
        assert.ok(m.recognized && m.words && validWords(m.words, m.voice.duration!));
      }
      return {
        ...s.choreography!,
        narration: s.narration,
        method: m.align.method,
        recognized: m.recognized,
        words: m.words?.length ?? 0,
        frames: framesForVoice(m.voice.duration!),
      };
    });
    assert.equal(new Set(scenes.map((s) => s.digest)).size, scenes.length);
    const templateNames = p.scenes.map((s) =>
      templateIdInStage(motionFrame(store.dir(p.id), s.choreography, s.narration).stage),
    );
    assert.deepEqual(templateNames, [
      'soil-colony',
      'ant-tunnel',
      'colony-chamber',
      'focus',
      'overview',
    ]);
    for (let i = 1; i < templateNames.length; i++)
      assert.notEqual(templateNames[i], templateNames[i - 1]);
    const frames = scenes.reduce((n, s) => n + s.frames, 0),
      mp4 = engine.file(p, p.final.file);
    await verifyVideo(mp4, frames, true);
    const pixels = await objectPixels(
      out,
      mp4,
      p.scenes.map((s, i) => ({
        v: motionFrame(store.dir(p.id), s.choreography, s.narration),
        frames: scenes[i].frames,
      })),
    );
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
    assert.deepEqual(ttsCalls, lines);
    const projectDir = store.dir(p.id),
      drawings = path.join(out, 'drawings');
    fs.mkdirSync(drawings, { recursive: true });
    const copy = (d: string, name: string) =>
      fs.copyFileSync(
        path.join(projectDir, 'media', 'motion', d + '.svg'),
        path.join(drawings, name + '.svg'),
      );
    // No common rig (scene 0) anymore; only per-scene drawings are copied.
    p.scenes.forEach((s, i) => copy(s.choreography!.digest, 'scene-' + (i + 1)));
    const original = structuredClone(p.assets),
      refs = p.scenes.map((s) => s.choreography!.digest),
      direction = 'Daha sıcak renkler ve yavaş hareket.';
    await planner.plan(p, () => {}, p.scenes[1], direction);
    assert.deepEqual(textCalls, [1, 2, 3, 4, 5, 2]);
    assert.equal(p.boardApproval, null);
    assert.equal(p.final, undefined);
    assert.notEqual(refs[1], p.scenes[1].choreography!.digest);
    for (const [i, s] of p.scenes.entries()) {
      const m = p.assets[s.id],
        old = original[s.id];
      for (const key of ['voice', 'align', 'words', 'edits', 'recognized'] as const)
        assert.deepEqual(m[key], old[key]);
      if (i !== 1) assert.equal(s.choreography!.digest, refs[i]);
      if (i < 2) assert.equal(m.clip, undefined);
      else assert.deepEqual(m.clip, old.clip);
    }
    const tests = pixels.flatMap((s) => s.objects),
      roiFrames = pixels.flatMap((s) => s.landmarks).reduce((n, r) => n + r.frames, 0);
    assert.equal(tests.length, 32);
    assert.equal(new Set(tests.map((v) => v.id)).size, 16);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          topic,
          plannerSource:
            'Offline template-ID and Turkish title selections replayed at the text transport; production instantiates its local template library. No live model or image API.',
          voiceSource: JSON.parse(fs.readFileSync(path.join(speech, 'source.json'), 'utf8')),
          textCalls,
          ttsCalls: ttsCalls.length,
          frames,
          seconds: frames / 30,
          words: timings.words.length,
          scenes,
          templateNames,
          pixels,
          roiFrames,
          cachedSecondExport: true,
          revision: { direction, scene: 2, unchangedAcoustics: true },
          streams: (await probe(mp4)).streams,
        },
        null,
        2,
      ),
    );
    console.log(
      `::notice title=Verified fixed-camera SVG ant film::${scenes.length} scenes; ${frames} frames / ${(frames / 30).toFixed(2)}s; ${timings.words.length} Whisper words, ${scenes.filter((s) => s.method === 'estimated').length} estimates. ${roiFrames} landmark frames at 0px displacement. ${tests.length} frozen-pose checks in decoded MP4 (16 independent actors at two times each: ants, air/heat flow and focus diagrams). ${scenes.map((s) => s.actors).join('/')} animated objects. Five local templates; no rig or image API. One directed redraw, all voice and timings preserved. Titles: ${titles.join(' / ')}`,
    );
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e);
  if (process.env.GITHUB_ACTIONS)
    console.error(
      '::error title=Fixed-camera ant film::' +
        String(e.message)
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 1500),
    );
  process.exitCode = 1;
});
