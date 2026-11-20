/** Verify signed archive drawing, title and each visible static layer in the decoded film. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright-core';
import { reduced, evidence } from './pixel-comparison';
import { VectorScene } from '../composition/VectorScene';
import { layers, type VectorFrame } from '../shared/vector';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { ff } from '../server/media';
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
        await g.evaluate((e) => e.removeAttribute('visibility'));
        assert.equal(await g.getAttribute('transform'), null);
        motion.push({ layer: l, removed, stationary: true });
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
