/** Compare every shot in the DECODED final film against independently drawn DOM
 * stills. For each group both absence and a frame-zero pose must be distinguishable
 * from the actual encoded pose. Metadata or a storyboard screenshot isn't evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { pose, VectorScene } from '../composition/VectorScene';
import { layers, type VectorFrame } from '../shared/vector';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { ff } from '../server/media';
function reduced(png: Buffer) {
  const { data, width, height } = PNG.sync.read(png);
  assert.equal(width, 1080);
  assert.ok(height >= 1350);
  const rgb = Buffer.alloc(540 * 675 * 3);
  for (let y = 0; y < 675; y++)
    for (let x = 0; x < 540; x++) {
      const a = (y * 2 * 1080 + x * 2) * 4,
        b = (y * 540 + x) * 3;
      for (let c = 0; c < 3; c++)
        rgb[b + c] = (data[a + c] + data[a + 4 + c] + data[a + 4320 + c] + data[a + 4324 + c]) / 4;
    }
  return rgb;
}
function evidence(film: Buffer, reference: Buffer, alternative: Buffer, description: string) {
  let n = 0,
    expected = 0,
    other = 0;
  for (let j = 0; j < film.length; j += 3) {
    let separation = 0;
    for (let c = 0; c < 3; c++) separation += Math.abs(reference[j + c] - alternative[j + c]);
    if (separation < 60) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      expected += Math.abs(film[j + c] - reference[j + c]);
      other += Math.abs(film[j + c] - alternative[j + c]);
    }
  }
  const result = {
    changedPixels: n,
    toReference: expected / (n * 3),
    toAlternative: other / (n * 3),
  };
  assert.ok(
    n >= 30 && result.toReference < result.toAlternative * 0.6,
    description + ': ' + JSON.stringify(result),
  );
  return result;
}
export async function verifyScenePixels(
  out: string,
  final: string,
  shots: { v: VectorFrame; frames: number }[],
) {
  const files = path.join(out, 'frames');
  fs.mkdirSync(files, { recursive: true });
  const { puppeteerInstance: browser } = await openFirstBrowser(browserCandidates({}), (c) =>
    chromium.launch({
      executablePath: c.browserExecutable,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }),
  );
  let offset = 0;
  const results = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    const capture = async () =>
      reduced(await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1350 } }));
    for (const [i, { v, frames }] of shots.entries()) {
      const f = Math.min(32, Math.floor(frames * 0.48)),
        abs = offset + f,
        file = path.join(files, `${i + 1}.png`);
      offset += frames;
      await ff(['-i', final, '-an', '-vf', `select=eq(n\\,${abs})`, '-frames:v', '1', file]);
      const film = reduced(fs.readFileSync(file));
      await page.setContent(
        '<style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}</style>' +
          renderToStaticMarkup(createElement(VectorScene, { scene: v, frame: f })),
      );
      const root = page.locator('[data-vector-scene]'),
        title = root.locator(':scope > text');
      assert.equal(await title.count(), 1);
      assert.equal(await title.textContent(), v.ref.title);
      const bounds = await title.boundingBox();
      assert.ok(
        bounds &&
          bounds.x >= 8 &&
          bounds.x + bounds.width <= 1072 &&
          bounds.y > 0 &&
          bounds.y + bounds.height < 186,
        'Title cropped or outside safe area: ' + v.ref.title,
      );
      const expected = await capture();
      let total = 0;
      for (let i = 0; i < film.length; i++) total += Math.abs(film[i] - expected[i]);
      const fullMAE = total / film.length;
      assert.ok(fullMAE < 5, 'Decoded shot differs from its reference: ' + fullMAE);
      await title.evaluate((e) => e.setAttribute('visibility', 'hidden'));
      const lettering = evidence(film, expected, await capture(), v.ref.title + ' lettering');
      await title.evaluate((e) => e.removeAttribute('visibility'));
      const motion = [];
      for (const l of layers) {
        const g = root.locator(`[data-vector-layer="${l}"]`);
        await g.evaluate((e) => e.setAttribute('visibility', 'hidden'));
        const removed = evidence(film, expected, await capture(), v.ref.title + ' removed ' + l);
        const set = async (frame: number) =>
          g.evaluate(
            (e, p) => {
              e.removeAttribute('visibility');
              e.setAttribute('transform', p.transform);
              e.setAttribute('opacity', String(p.opacity));
            },
            pose(l, frame, v.ref.fx),
          );
        await set(0);
        const frozen = evidence(film, expected, await capture(), v.ref.title + ' frozen ' + l);
        await set(f);
        motion.push({ layer: l, removed, frozen });
      }
      const labels = await root.locator('[data-vector-layer] text').allTextContents();
      assert.ok(labels.length <= 2 && labels.every((s) => s.trim().split(/\s+/).length <= 2));
      results.push({
        title: v.ref.title,
        labels,
        frameInFilm: abs,
        frameInScene: f,
        fullMAE,
        lettering,
        motion,
      });
    }
    return results;
  } finally {
    await browser.close();
  }
}
