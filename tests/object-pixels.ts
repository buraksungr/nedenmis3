/** Verify the ENCODED film, not just model replies or transforms in a DOM. Two distant physical
 * landmarks per shot are registered throughout; separately, freeze exactly one actor at a time
 * while leaving the set and every other actor at the measured frame. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement as el } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright-core';
import { ff } from '../server/media';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { ObjectScene } from '../composition/ObjectScene';
import type { ObjectFrame } from '../shared/object-motion';
import { reduced, evidence } from './pixel-comparison';
// Intrinsic, visible artwork: a root and chamber edge, the tunnel roof,
// the colony-chamber rim, the lens rim and the overview's two nodes. No
// synthetic test markers are drawn on top of the user's video.
const landmarks = [
  [
    [60, 540],
    [448, 627],
  ],
  [
    [250, 660],
    [850, 680],
  ],
  [
    [206, 821],
    [874, 821],
  ],
  [
    [246, 685],
    [746, 685],
  ],
  [
    [237, 526],
    [843, 526],
  ],
];
async function fixedLandmark(
  file: string,
  tmp: string,
  [x, y]: number[],
  start: number,
  count: number,
) {
  const w = 84,
    h = 60,
    size = w * h,
    filter = `select=between(n\\,${start}\\,${start + count - 1}),crop=${w}:${h}:${x - w / 2}:${y - h / 2},format=gray`;
  await ff([
    '-i',
    file,
    '-an',
    '-vf',
    filter,
    '-vsync',
    '0',
    '-frames:v',
    String(count),
    '-f',
    'rawvideo',
    tmp,
  ]);
  const bytes = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  assert.equal(bytes.length, size * count);
  // Work on contrast edges only, so a solid fill can never pass as a stationary landmark.
  const edge: number[] = [];
  for (let y = 3; y < h - 3; y++)
    for (let x = 3; x < w - 3; x++) {
      const i = y * w + x;
      if (Math.abs(bytes[i - 1] - bytes[i + 1]) + Math.abs(bytes[i - w] - bytes[i + w]) >= 17)
        edge.push(i);
    }
  assert.ok(edge.length >= 70, `Landmark ${x},${y} has too few contrast edges: ${edge.length}`);
  let worst = 0;
  for (let f = 1; f < count; f++) {
    let best = Infinity,
      bestX = 0,
      bestY = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const k = f * size + dy * w + dx;
        let sum = 0;
        for (const q of edge) sum += Math.abs(bytes[q] - bytes[k + q]);
        if (sum < best) {
          best = sum;
          bestX = dx;
          bestY = dy;
        }
      }
    assert.ok(
      bestX === 0 && bestY === 0,
      `Landmark ${x},${y} moved ${bestX},${bestY} at film frame ${start + f}`,
    );
    worst = Math.max(worst, best / edge.length);
  }
  assert.ok(worst < 5.5, `Unstable contrast edges (${x},${y}): ${worst}`);
  return {
    center: [x, y],
    edges: edge.length,
    frames: count,
    maxOffsetPixels: 0,
    worstEdgeMAE: worst,
  };
}
const targets = [
  ['colony-ant-a', 'colony-ant-b', 'colony-ant-c', 'tunnel-trace'],
  ['tunnel-ant-a', 'tunnel-ant-b', 'tunnel-air'],
  ['chamber-ant-a', 'chamber-ant-b', 'chamber-queen', 'chamber-warmth-a', 'chamber-warmth-b'],
  ['focus-ring-a', 'focus-ring-b'],
  ['overview-link-a', 'overview-link-b'],
];
export async function objectPixels(
  out: string,
  file: string,
  scenes: { v: ObjectFrame; frames: number }[],
) {
  const dir = path.join(out, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const { puppeteerInstance: browser } = await openFirstBrowser(browserCandidates({}), (c) =>
    chromium.launch({
      executablePath: c.browserExecutable,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }),
  );
  try {
    const pg = await browser.newPage({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
      }),
      capture = async () =>
        reduced(await pg.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1350 } }));
    let start = 0;
    const report = [];
    for (const [i, { v, frames }] of scenes.entries()) {
      const title = v.ref.title;
      const show = (frame: number) =>
        pg.setContent(
          '<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}</style>' +
            renderToStaticMarkup(
              el(
                'main',
                { style: { position: 'relative', width: 1080, height: 1920 } },
                el(ObjectScene, { scene: v, frame }),
              ),
            ),
        );
      await show(0);
      const zero = await pg
        .locator('[data-object]')
        .evaluateAll((els) =>
          Object.fromEntries(els.map((n) => [n.getAttribute('data-object')!, n.innerHTML])),
        );
      const objects = [],
        sampleFrames: number[] = [],
        errors: number[] = [];
      // Two distinct times per actor increase temporal coverage without adding
      // synthetic motion or relaxing the per-pose pixel thresholds.
      for (const [sample, fraction] of [0.3, 0.41].entries()) {
        const f = Math.floor(frames * fraction),
          png = path.join(dir, sample ? `${i + 1}.png` : `${i + 1}-early.png`);
        sampleFrames.push(start + f);
        await ff(['-i', file, '-an', '-vf', `select=eq(n\\,${start + f})`, '-frames:v', '1', png]);
        const film = reduced(fs.readFileSync(png));
        await show(f);
        assert.equal(await pg.locator('[data-shot-title]').count(), 0);
        const expected = await capture();
        let sum = 0;
        for (let j = 0; j < film.length; j++) sum += Math.abs(film[j] - expected[j]);
        const fullMAE = sum / film.length;
        errors.push(fullMAE);
        assert.ok(fullMAE < 5, `${title}: wrong scene (${fullMAE})`);
        for (const id of targets[i]) {
          const node = pg.locator('[data-fixed-camera]').locator(`[data-object="${id}"]`).first(),
            current = await node.innerHTML();
          await node.evaluate((n, html) => {
            n.innerHTML = html;
          }, zero[id]);
          const test = evidence(
            film,
            expected,
            await capture(),
            `${title} frozen ${id} at frame ${f}`,
          );
          await node.evaluate((n, html) => {
            n.innerHTML = html;
          }, current);
          objects.push({
            id,
            frameInFilm: start + f,
            kind: await node.getAttribute('data-anim'),
            ...test,
          });
        }
      }
      const staticLandmarks = [];
      const count =
        frames - (i + 1 === scenes.length ? 0 : Math.min(20, Math.floor((frames - 1) / 3)));
      for (const marker of landmarks[i])
        staticLandmarks.push(
          await fixedLandmark(file, path.join(out, 'roi.gray'), marker, start, count),
        );
      report.push({
        title,
        sampleFrames,
        frames,
        fullMAE: Math.max(...errors),
        noFixedHeading: true,
        objects,
        landmarks: staticLandmarks,
      });
      start += frames;
    }
    return report;
  } finally {
    await browser.close();
  }
}
