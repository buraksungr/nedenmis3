import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaxesParser } from 'saxes';
import { ScientificPlate } from '../composition/ScientificPlate';
/** Single production job; intercept only the provider transport. The aligner, renderer and mixer are not mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import thirst from './fixtures/thirst.json';
import flight from './fixtures/flight.json';
import whale from './fixtures/whale.json';
import { AtlasArt, readArtwork } from '../server/atlas-art';
import { safeSvg } from '../server/safe-svg';
import { grounded } from '../shared/svg-copy';
import { createHash } from 'node:crypto';
import { hookPixels } from './atlas-pixels';
import { validWords } from '../shared/captions';
import { svgPlanSchema, templates } from '../shared/svg';
import { SvgPlanner } from '../server/svg-planner';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { Production, framesForVoice } from '../server/production';
import { exec, python, probe, verifyVideo } from '../server/media';
import { testImages } from './offline';

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
    const p = store.create(makeProject(topic, lines.join(' ')));
    p.scriptApproval = scriptSig(p);
    // The whale control deliberately does NOT use a network fixture or pre-populated
    // Iconify cache. Save actual response hashes and compare the on-disk sanitized bytes.
    const trace: {
        url: string;
        status: number;
        sha256: string;
        length: number;
        ids?: string[];
        themed?: string;
      }[] = [],
      errors: string[] = [];
    const live: typeof fetch = async (url, opts) => {
      const u = new URL(String(url));
      assert.equal(u.origin, 'https://api.iconify.design');
      assert.ok(!new Headers(opts?.headers).has('authorization'));
      try {
        const r = await fetch(url, opts),
          bytes = Buffer.from(await r.clone().arrayBuffer());
        let themed: string | undefined;
        const sum = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
        if (u.pathname.endsWith('.svg') && r.ok)
          try {
            themed = sum(safeSvg(bytes.toString('utf8')));
          } catch {
            /* record rejected geometry too */
          }
        trace.push({
          url: r.url,
          status: r.status,
          sha256: sum(bytes),
          length: bytes.length,
          ids: r.ok && u.pathname === '/search' ? JSON.parse(bytes.toString()).icons : undefined,
          themed,
        });
        return r;
      } catch (e) {
        errors.push(String(url) + ': ' + String(e));
        throw e;
      }
    };
    const planner = new SvgPlanner(
      store,
      { groq: memoryVault(), openrouter: memoryVault() },
      async () => {
        throw Error('Expected offline text planning');
      },
      isWhale ? new AtlasArt(store, live) : undefined,
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
    const distinct = new Set(plans.map((s) => s.template));
    assert.ok(distinct.size >= 5);
    assert.ok(plans.every((s, i) => i === 0 || s.template !== plans[i - 1].template));
    if (isFlight)
      assert.deepEqual(
        distinct,
        new Set(templates),
        'The unmodified automatic flight plan must cover the whole atlas',
      );
    else assert.ok(plans.every((s) => s.icon !== 'leaf' && s.template !== 'ThermometerGaugeScene'));
    const visibleText: string[][] = [];
    if (isWhale) {
      const diagnostic = JSON.stringify({
        trace: trace.map((r) => [r.url, r.status, r.ids?.slice(0, 6)]),
        errors,
      });
      for (const [i, keyword] of [
        [0, 'whale'],
        [2, 'weight'],
        [3, 'lungs'],
        [4, 'skeleton'],
      ] as const) {
        const plan = plans[i];
        assert.equal(plan.iconKeyword, keyword);
        const ref = plan.artwork;
        assert.ok(
          ref?.source === 'iconify',
          `${keyword} was NOT fetched from live Iconify: ${diagnostic}`,
        );
        assert.ok(
          trace.some(
            (r) =>
              new URL(r.url).searchParams.get('query') === keyword && r.ids?.includes(ref.name),
          ),
        );
        assert.ok(
          trace.some(
            (r) =>
              r.status === 200 &&
              r.url === `https://api.iconify.design/${ref.name.replace(':', '/')}.svg` &&
              r.themed === ref.digest,
          ),
        );
        assert.ok(readArtwork(store.dir(p.id), ref.digest));
      }
      for (const [i, v] of plans.entries()) {
        assert.ok(
          [v.title, ...v.labels].every((l) => grounded(l, lines[i])),
          JSON.stringify(v),
        );
        // Inspect text emitted by the actual diagram, not just fields in the plan.
        const output: string[] = [];
        let within = false,
          run: string[] = [];
        const parser = new SaxesParser();
        parser.on('opentag', (tag) => {
          if (tag.name === 'text') {
            within = true;
            run = [];
          }
        });
        parser.on('text', (t) => {
          if (within && t.trim()) run.push(t.trim());
        });
        parser.on('closetag', (tag) => {
          if (tag.name === 'text') {
            within = false;
            output.push(run.join(' '));
          }
        });
        parser
          .write(
            renderToStaticMarkup(
              createElement(ScientificPlate, { plan: v, frame: 30, frames: 96 }),
            ),
          )
          .close();
        assert.ok(
          [v.title, ...v.labels].every((line) => output.includes(line)),
          JSON.stringify(output),
        );
        assert.doesNotMatch(
          output.join(' '),
          /suyun hareketi|su birikimi|yüzeyde akış|mercek altında/iu,
        );
        visibleText.push(output);
      }
      const n = trace.length;
      for (const [i, v] of plans.entries())
        if (v.artwork) {
          const again = await planner.illustrate(p, v, lines[i]);
          assert.deepEqual(again.plan.artwork, v.artwork);
        }
      assert.equal(trace.length, n, 'Cached art triggered a live search');
      console.log(
        `${process.env.GITHUB_ACTIONS ? '::notice title=Verified live scene artwork::' : ''}Verified live Iconify search, SVG response and cache hashes: ${plans.flatMap((p) => p.artwork?.name ?? []).join(', ')}`,
      );
    }
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
    const pixels = isWhale
      ? await hookPixels(
          out,
          final,
          plans[0],
          readArtwork(store.dir(p.id), plans[0].artwork!.digest)!,
          scenes[0].frames,
        )
      : undefined;
    if (isWhale) {
      fs.cpSync(path.join(store.dir(p.id), 'media', 'atlas'), path.join(out, 'drawings'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(out, 'iconify.json'),
        JSON.stringify({ trace, errors, pixels, visibleText }, null, 2),
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
          templates: [...distinct],
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
        `::notice title=Verified ${story} film::${scenes.length} scenes; ${distinct.size} different automatically selected templates; ${frames} frames at 30 FPS; ${subtitles.words.length} Whisper word times; ${calls.length} fixture TTS calls; ${imageCalls} image calls; cached second export.${pixels ? ` Decoded whale ROI mean error: ${pixels.toIconify.toFixed(2)} to live SVG vs ${pixels.toLocal.toFixed(2)} to local icon.` : ''}`,
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
