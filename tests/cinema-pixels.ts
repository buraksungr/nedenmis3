/** Compare actual decoded final-film frames to browser stills. Disabling only the title or
 * freezing only the camera must distinguish the expected shot from the counterfactual. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createElement as el } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright-core';
import { CinematicPlate, ShotTitle, cameraPose } from '../composition/CinematicPlate';
import { ff } from '../server/media';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { cameraNames } from '../shared/cinema';
import { reduced, evidence } from './pixel-comparison';
export async function verifyCinema(
  out: string,
  mp4: string,
  shots: { title: string; image: string; frames: number }[],
) {
  const dir = path.join(out, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const { puppeteerInstance: browser } = await openFirstBrowser(browserCandidates({}), (c) =>
    chromium.launch({
      executablePath: c.browserExecutable,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }),
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    const capture = async () =>
      reduced(await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1350 } }));
    let at = 0;
    const checks = [];
    for (const [index, { title, image, frames }] of shots.entries()) {
      const frame = Math.floor(frames * 0.56),
        file = path.join(dir, `${index + 1}.png`),
        abs = at + frame;
      at += frames;
      await ff(['-i', mp4, '-an', '-vf', `select=eq(n\\,${abs})`, '-frames:v', '1', file]);
      const film = reduced(fs.readFileSync(file));
      await page.setContent(
        '<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}</style>' +
          renderToStaticMarkup(
            el(
              'main',
              { style: { position: 'relative', width: 1080, height: 1920 } },
              el(CinematicPlate, {
                shot: { title, index },
                frame,
                frames,
                children: el('img', {
                  src: 'data:image/jpeg;base64,' + fs.readFileSync(image).toString('base64'),
                  style: { width: '100%', height: '100%', objectFit: 'cover' },
                }),
              }),
              el(ShotTitle, { title }),
            ),
          ),
      );
      await page.locator('img').evaluate((img: HTMLImageElement) => img.decode());
      const text = page.locator('[data-shot-title]');
      assert.equal(await text.textContent(), title);
      const bounds = await text.evaluate((n) => {
        const r = document.createRange();
        r.selectNodeContents(n);
        return Array.from(r.getClientRects()).map((v) => v.toJSON());
      });
      assert.ok(
        bounds.length === 1 &&
          bounds[0].x >= 54 &&
          bounds[0].right <= 1026 &&
          bounds[0].top >= 100 &&
          bounds[0].bottom < 340,
        'Title outside safe single line: ' + title,
      );
      const expected = await capture();
      let mae = 0;
      for (let j = 0; j < film.length; j++) mae += Math.abs(film[j] - expected[j]);
      mae /= film.length;
      assert.ok(mae < 5, `Scene ${index + 1} has wrong art/camera: ${mae}`);
      await text.evaluate((n) => (n.style.visibility = 'hidden'));
      const lettering = evidence(film, expected, await capture(), title);
      await text.evaluate((n) => (n.style.visibility = 'visible'));
      await page
        .locator('[data-camera]')
        .evaluate((n, t) => (n.style.transform = t), cameraPose(index, 0, frames));
      const motion = evidence(film, expected, await capture(), title + ' frozen camera');
      checks.push({
        title,
        camera: cameraNames[index % 4],
        frame: abs,
        mae,
        lettering,
        motion,
        bounds: bounds[0],
      });
    }
    return checks;
  } finally {
    await browser.close();
  }
}
