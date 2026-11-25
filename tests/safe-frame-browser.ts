import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import type { Browser } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import { CaptionOverlay } from '../composition/CaptionOverlay';
import { captionGroupAt } from '../shared/captions';
import { parseStage } from '../server/motion-svg';
import type { MotionRef } from '../shared/object-motion';

/** Actual browser pixels, including full-bleed backgrounds and transformed objects. */
export async function safeFrameBrowserControl(browser: Browser) {
  const svg = `<svg viewBox="0 0 540 960">
    <g id="layer-bg"><rect width="540" height="960" fill="#ff2100"/></g>
    <g id="layer-main">
      <g id="set"><path d="M420 0H540V960H420Z" fill="#705030"/></g>
      <g transform="translate(0 -100)">
        <path d="M0 -200H100V1400H0Z" fill="#0066ff"/>
        <circle cx="200" cy="700" r="50" fill="#00ff00" data-anim="move" data-dy="100" data-duration="1"/>
      </g>
    </g>
    <g id="layer-fx">
      <circle cx="400" cy="280" r="4" fill="#fff" data-anim="fall"/>
      <circle cx="400" cy="350" r="4" fill="#fff" data-anim="fall"/>
      <text data-keyword="true" x="130" y="590" font-size="18" fill="#fff">Toprak</text>
      <text data-keyword="true" x="130" y="800" font-size="18">Çakışma</text>
    </g>
  </svg>`;
  const stage = parseStage(svg).root,
    ref = { title: 'Güvenli Derinlikler', digest: 'safe-frame-qa' } as MotionRef;
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
  });
  try {
    for (const frame of [0, 30]) {
      const content = renderToStaticMarkup(
        createElement(ObjectScene, { scene: { ref, stage }, frame }),
      );
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}</style>${content}`);
      const image = PNG.sync.read(await page.screenshot());
      const pixel = (x: number, y: number) => {
        const i = (y * image.width + x) * 4;
        return [...image.data.subarray(i, i + 3)];
      };
      // At half scale, the entire red background reaches both frame edges.
      for (const y of [15, 100, 750, 900, 945]) {
        const [r, g, b] = pixel(270, y);
        assert.ok(r > 230 && g < 60 && b < 30, `background missing at y=${y * 2}: ${r},${g},${b}`);
      }
      // Foreground is allowed at the top, but is clipped before the bottom caption area.
      for (const y of [15, 120, 700]) {
        const [r, g, b] = pixel(20, y);
        assert.ok(b > 220 && g > 80 && r < 30, `foreground missing at y=${y * 2}: ${r},${g},${b}`);
      }
      const [r, g, b] = pixel(20, 750);
      assert.ok(r > 230 && g < 60 && b < 30, 'foreground leaked into caption area');
      const [sr, sg, sb] = pixel(480, 900);
      assert.ok(sr > 90 && sg > 50 && sb > 30, 'legacy nested set must extend to bottom edge');
      const keywords = page.locator('[data-science-keyword]');
      assert.equal(await keywords.count(), 1);
      assert.equal(await keywords.textContent(), 'Toprak');
      const bounds = await keywords.boundingBox();
      assert.ok(bounds && bounds.y + bounds.height <= 610, 'keyword overlaps caption region');
      assert.equal(await page.locator('[data-shot-title]').count(), 0);
    }
    // Older drawings may nest reusable definitions inside a layer. Their local
    // <use> references must still resolve after the background is partitioned.
    const nested = parseStage(`<svg viewBox="0 0 540 960">
      <g id="layer-bg"><rect width="540" height="960" fill="#ff2100"/></g>
      <g id="layer-main"><g><defs><g id="subject-main"><rect x="180" y="260" width="120" height="90" fill="#00ff00"/></g></defs></g><use href="#subject-main" data-anim="move" data-dx="5"/></g>
      <g id="layer-fx"><circle cx="400" cy="280" r="4" data-anim="fall"/><circle cx="400" cy="350" r="4" data-anim="fall"/></g>
    </svg>`).root;
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}</style>${renderToStaticMarkup(
        createElement(ObjectScene, { scene: { ref, stage: nested }, frame: 0 }),
      )}`,
    );
    const nestedPixels = PNG.sync.read(await page.screenshot()),
      green = (300 * nestedPixels.width + 220) * 4;
    assert.ok(
      nestedPixels.data[green] < 30 && nestedPixels.data[green + 1] > 220,
      'nested legacy subject definition no longer renders',
    );

    // Exercise the real caption component with maximum subtitle size and long
    // estimated and measured cues. Its pages must never reach the keyword region.
    const art = renderToStaticMarkup(
      createElement(ObjectScene, { scene: { ref, stage }, frame: 0 }),
    );
    for (const { entries, estimated } of [
      {
        entries: [
          {
            text: 'Karıncalar kış aylarında toprağın altında uzun süre güvenle bekler.',
            start: 0,
            end: 5,
          },
        ],
        estimated: true,
      },
      { entries: [{ text: 'W'.repeat(100), start: 0, end: 5 }], estimated: false },
    ]) {
      for (const time of [0.2, 2.5, 4.8]) {
        const words = captionGroupAt(entries, time, estimated);
        assert.ok(words);
        const caption = renderToStaticMarkup(
          createElement(CaptionOverlay, { words, time, size: 88, highlight: true, estimated }),
        );
        await page.setContent(
          `<style>html,body{margin:0}.canvas{position:absolute;width:1080px;height:1920px;transform:scale(.5);transform-origin:top left}</style><div class="canvas">${art}${caption}</div>`,
        );
        const keyword = await page.locator('[data-science-keyword]').boundingBox(),
          plate = await page.locator('[data-caption]').boundingBox(),
          fits = await page
            .locator('[data-caption]')
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        assert.ok(
          keyword && plate && keyword.y + keyword.height < plate.y,
          `caption overlaps keyword: ${JSON.stringify({ keyword, plate, text: words.map((w) => w.text).join(' '), estimated, time })}`,
        );
        assert.ok(fits, 'an unusually long caption overflows the sides');
      }
    }
  } finally {
    await page.close();
  }
  console.log(
    'Verified full-frame background, clipped foreground and safe optional keyword pixels.',
  );
}
