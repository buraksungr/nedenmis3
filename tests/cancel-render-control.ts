/** Actual Remotion/FFmpeg interruption, through the same HTTP job as the UI.
 * A decoded two-scene MP4 after immediate restart is the release condition. */
import assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createStudio } from '../server/app';
import { Operation, operation } from '../server/operation';
import { verifyVideo } from '../server/media';
import { makeProject, scriptSig, approveBoard } from '../server/store';
import { STOPPED, jobActive, type Project } from '../shared/schema';
import { rigReply, stageReply } from './ant-motion-art';
import { completion } from './vector-test-data';
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-render-stop-'));
  const ctx = createStudio(
    { root, composition: path.resolve('build/composition'), pythonDir: path.resolve('python') },
    {
      seed: false,
      transport: async (u, o) => {
        assert.equal(String(u), 'https://openrouter.ai/api/v1/chat/completions');
        const i = JSON.parse(JSON.parse(String(o?.body)).messages[1].content).sahne;
        return completion(i ? stageReply(i - 1) : rigReply());
      },
    },
  );
  const server = ctx.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = async (route: string, b: object, rev?: number) => {
    const r = await fetch(origin + route, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(rev !== undefined ? { 'If-Match': String(rev) } : {}),
      },
      body: JSON.stringify(b),
    });
    const v = await r.json();
    assert.ok(r.ok, JSON.stringify(v));
    return v;
  };
  let p = ctx.store.create(
    makeProject('Durdurma denetimi', 'Karıncalar ormanda ilerler. Işık zemine ulaşır.'),
  );
  p.scriptApproval = scriptSig(p);
  ctx.store.save(p);
  const route = '/projects/' + p.id;
  const settled = async () => {
    for (let i = 0; i < 1500; i++) {
      const v = ctx.store.get(p.id);
      if (!jobActive(v.job)) return v;
      await delay(100);
    }
    throw Error('Job did not settle');
  };
  const observed = new Map<ChildProcess, Operation>(),
    c = channel('child_process');
  let signalMix!: () => void;
  const mixerStarted = new Promise<void>((r) => {
    signalMix = r;
  });
  const track = (m: unknown) => {
    const op = operation();
    if (op?.owner === p.id) {
      const proc = (m as { process: ChildProcess }).process;
      observed.set(proc, op);
      proc.once('spawn', () => {
        if (proc.spawnargs.some((a) => typeof a === 'string' && a.includes('sidechaincompress=')))
          signalMix();
      });
      proc.once('close', () => observed.delete(proc));
    }
  };
  c.subscribe(track);
  try {
    await post('/settings/svg-planner/key/openrouter', { key: 'isolated-render-control' });
    await post(route + '/generate', { kind: 'board' }, p.rev);
    p = await settled();
    assert.equal(p.job.state, 'done', p.job.label);
    const second = p.scenes[1];
    second.svgVoiceMode = 'existing-only';
    second.seconds = 5;
    approveBoard(p);
    ctx.store.save(p);
    await ctx.prod.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), p.scenes[0]);
    await ctx.prod.align(p, p.scenes[0], false, 'Açıkça tahmini test zamanları');
    p = ctx.store.get(p.id);
    const preview = structuredClone(p.scenes),
      voice = structuredClone(p.assets[p.scenes[0].id]),
      sig = p.boardApproval;
    const started: Project = await post(route + '/generate', { kind: 'all' }, p.rev);
    const timeout = Date.now() + 90000;
    let frameProgress = 0;
    while (Date.now() < timeout) {
      p = ctx.store.get(p.id);
      assert.ok(jobActive(p.job), p.job.label);
      if (
        p.job.kind === 'clip' &&
        p.job.scene === second.id &&
        p.job.progress &&
        p.job.progress < 100
      ) {
        frameProgress = p.job.progress;
        break;
      }
      await delay(25);
    }
    assert.ok(frameProgress, 'expected actual frame progress in second shot');
    const clip = structuredClone(p.assets[p.scenes[0].id].clip);
    assert.ok(clip);
    const children = [...observed.entries()]
      .filter(([, op]) => op.id === started.job.runId)
      .map(([proc]) => path.basename(proc.spawnfile));
    assert.ok(children.length, 'expected live render subprocesses');
    await post(`/operations/${started.job.runId}/stop`, {});
    p = await settled();
    assert.equal(p.job.label, STOPPED);
    assert.equal(p.job.state, 'cancelled');
    assert.equal(p.boardApproval, sig);
    assert.deepEqual(p.scenes, preview);
    assert.equal(p.final, undefined);
    assert.equal(p.assets[second.id]?.clip, undefined);
    assert.deepEqual(p.assets[p.scenes[0].id], { ...voice, clip });
    assert.deepEqual(
      [...observed.entries()]
        .filter(([, op]) => op.id === started.job.runId)
        .map(([proc]) => proc.spawnfile),
      [],
      'child still open after terminal state',
    );
    const cache = path.join(ctx.store.dir(p.id), 'cache');
    assert.deepEqual(
      fs.readdirSync(cache).filter((n) => n !== 'vector'),
      [],
    );
    const mixing: Project = await post(route + '/generate', { kind: 'all' }, p.rev);
    await Promise.race([
      mixerStarted,
      settled().then((v) => {
        throw Error(`Expected live final FFmpeg: ${v.job.label}`);
      }),
    ]);
    await post(`/operations/${mixing.job.runId}/stop`, {});
    p = await settled();
    assert.equal(p.job.label, STOPPED);
    assert.ok(p.assets[second.id].clip);
    assert.ok(!p.final && !p.subtitleFiles);
    assert.deepEqual(
      fs.readdirSync(cache).filter((n) => n !== 'vector'),
      [],
    );
    const completeAssets = structuredClone(p.assets);
    await post(route + '/generate', { kind: 'all' }, p.rev);
    p = await settled();
    assert.equal(p.job.state, 'done', p.job.label);
    assert.deepEqual(p.assets, completeAssets);
    assert.ok(p.final && fs.existsSync(ctx.prod.file(p, p.final.file)));
    assert.deepEqual(p.assets[p.scenes[0].id], { ...voice, clip });
    assert.deepEqual(
      fs.readdirSync(cache).filter((n) => n !== 'vector'),
      [],
    );

    // Cancelling a partial-export job must leave the completed voiced film and
    // all normal production files intact, release its children, and be resumable.
    const finalBeforeDraft = structuredClone(p.final),
      subtitlesBeforeDraft = structuredClone(p.subtitleFiles),
      assetsBeforeDraft = structuredClone(p.assets);
    const draftRun: Project = await post(route + '/generate', { kind: 'draft' }, p.rev);
    const draftTimeout = Date.now() + 90000;
    let draftProgress = 0;
    while (Date.now() < draftTimeout) {
      p = ctx.store.get(p.id);
      assert.ok(jobActive(p.job), p.job.label);
      if (p.job.kind === 'draft' && p.job.progress && p.job.progress < 100) {
        draftProgress = p.job.progress;
        break;
      }
      await delay(25);
    }
    assert.ok(draftProgress, 'expected actual progress during a silent draft');
    await post(`/operations/${draftRun.job.runId}/stop`, {});
    p = await settled();
    assert.equal(p.job.state, 'cancelled');
    assert.equal(p.job.label, STOPPED);
    assert.deepEqual(p.final, finalBeforeDraft);
    assert.deepEqual(p.subtitleFiles, subtitlesBeforeDraft);
    assert.deepEqual(p.assets, assetsBeforeDraft);
    assert.equal(p.draft, undefined);
    assert.deepEqual(
      [...observed.entries()].filter(([, op]) => op.id === draftRun.job.runId),
      [],
      'draft child still open after cancellation',
    );
    assert.deepEqual(
      fs.readdirSync(cache).filter((n) => n !== 'vector'),
      [],
    );
    await post(route + '/generate', { kind: 'draft' }, p.rev);
    p = await settled();
    assert.equal(p.job.state, 'done', p.job.label);
    assert.ok(p.draft && p.draft.asset.hasAudio === false);
    await verifyVideo(
      ctx.prod.file(p, p.draft.asset.file),
      p.draft.scenes.reduce((n, s) => n + s.frames, 0),
      false,
    );
    assert.deepEqual(p.final, finalBeforeDraft);
    assert.deepEqual(p.subtitleFiles, subtitlesBeforeDraft);
    assert.deepEqual(p.assets, assetsBeforeDraft);
    assert.deepEqual(
      fs.readdirSync(cache).filter((n) => n !== 'vector'),
      [],
    );

    const report = {
      stoppedAtPercent: frameProgress,
      stoppedDraftAtPercent: draftProgress,
      resumedSilentDraft: true,
      normalExportPreserved: true,
      interruptedChildren: children,
      previousClipReused: true,
      voiceAndTimingUnchanged: true,
      finalFfmpegStopped: true,
      tempFilesLeft: 0,
      verifiedMp4Seconds: p.final.duration,
    };
    fs.mkdirSync('out/render-control', { recursive: true });
    fs.writeFileSync('out/render-control/cancellation.json', JSON.stringify(report, null, 2));
    console.log(report);
  } finally {
    c.unsubscribe(track);
    await ctx.stopActive();
    await new Promise<void>((r) => server.close(() => r()));
    ctx.store.db.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch((e) => {
  console.error(e);
  // CI step annotations are the only readable log when the runner's log download fails.
  const detail = String(e instanceof Error ? e.message : e)
    .split('\n')
    .slice(0, 4)
    .join(' | ')
    .slice(0, 900);
  console.log(`::error title=Durdurma kontrolü::${detail}`);
  process.exitCode = 1;
});
