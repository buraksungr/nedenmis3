import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import type { Browser, Locator } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import { parseStage } from '../server/motion-svg';
import type { MotionRef } from '../shared/object-motion';

/** Check real Chromium/Edge geometry and pixels, not just serialized CSS. */
export async function centeredMotionBrowserControl(browser: Browser) {
  const ref = {
    kind: 'objects-v2',
    title: 'Bilimsel Sahne',
    digest: 'centered-motion-browser',
  } as MotionRef;
  const stage = parseStage(`<svg viewBox="0 0 540 960">
    <g id="layer-bg"><rect width="540" height="960" fill="#13222b"/></g>
    <g id="layer-main">
      <path id="pupil" transform="translate(24 12) rotate(17 150 270)" d="M80 220Q145 180 205 240L190 320Q125 355 80 290Z" fill="#1ddd9e" data-anim="dilate" data-duration="1" data-amplitude="0.3"/>
      <g id="iris" transform="translate(8 15) rotate(-13 360 370)" data-anim="pulse" data-duration="1" data-amplitude="0.2">
        <path d="M300 300Q375 270 420 335L410 420Q350 460 300 405Z" fill="#e49a53"/>
        <circle cx="365" cy="360" r="18" fill="#ffe69a"/>
      </g>
    </g>
    <g id="layer-fx"><path id="flow" d="M50 650H490" fill="none" stroke="#ffe36b" stroke-width="8" data-anim="flow" data-duration="1"/></g>
  </svg>`).root;
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
  });
  const center = (locator: Locator) =>
    locator.evaluate((element) => {
      const node = element as SVGGraphicsElement,
        box = node.getBBox(),
        matrix = node.getScreenCTM();
      if (!matrix) throw new Error('missing SVG CTM');
      const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
          matrix,
        ),
        bounds = node.getBoundingClientRect();
      return { x: point.x, y: point.y, width: bounds.width, height: bounds.height };
    });
  const setFrame = async (scene: typeof stage, frame: number) => {
    const html = renderToStaticMarkup(
      createElement(ObjectScene, { scene: { ref, stage: scene }, frame }),
    );
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}</style>${html}`);
  };
  try {
    const samples: {
        pupil: Awaited<ReturnType<typeof center>>;
        iris: Awaited<ReturnType<typeof center>>;
      }[] = [],
      screenshots: Buffer[] = [];
    for (const frame of [0, 7, 22]) {
      await setFrame(stage, frame);
      const pupil = page.locator('[data-object="pupil"] > g > path'),
        iris = page.locator('[data-object="iris"] > g > g');
      const wrapper = page.locator('[data-object="pupil"] > g');
      const css = await wrapper.evaluate((element) => ({
        box: (element as SVGElement).style.transformBox,
        origin: (element as SVGElement).style.transformOrigin,
      }));
      assert.equal(css.box, 'fill-box');
      assert.match(css.origin, /center/);
      assert.equal(
        await page.locator('[data-object="pupil"]').getAttribute('transform'),
        'translate(24 12) rotate(17 150 270)',
      );
      assert.equal(
        await page.locator('[data-object="iris"]').getAttribute('transform'),
        'translate(8 15) rotate(-13 360 370)',
      );
      samples.push({ pupil: await center(pupil), iris: await center(iris) });
      if (frame !== 22) screenshots.push(await page.screenshot());
    }
    for (const part of ['pupil', 'iris'] as const) {
      for (const sample of samples.slice(1)) {
        assert.ok(
          Math.abs(sample[part].x - samples[0][part].x) < 0.05,
          `${part} center moved horizontally`,
        );
        assert.ok(
          Math.abs(sample[part].y - samples[0][part].y) < 0.05,
          `${part} center moved vertically`,
        );
      }
      assert.ok(samples[1][part].width > samples[0][part].width * 1.1, `${part} did not grow`);
      assert.ok(samples[2][part].width < samples[0][part].width * 0.9, `${part} did not shrink`);
    }
    const [first, next] = screenshots.map((v) => PNG.sync.read(v));
    let changed = 0;
    for (let x = 50; x < 490; x++) {
      const i = (650 * first.width + x) * 4;
      if (Math.abs(first.data[i] - next.data[i]) > 60) changed++;
    }
    assert.ok(changed > 100, `stroke-dashoffset did not visibly flow (${changed} pixels)`);

    // Oversized v2 moves are clamped after the actual authored scale and
    // rotation. The 540px preview is half the output.
    const big = parseStage(`<svg viewBox="0 0 1080 1920">
      <g id="layer-bg"><rect width="1080" height="1920" fill="#123"/></g>
      <g id="layer-main"><g transform="translate(100 100) rotate(20) scale(2)">
        <g id="outer-move" data-anim="move" data-dx="500" data-duration="1">
          <circle id="traveler" cx="120" cy="180" r="15" fill="#fff" data-anim="move" data-dx="500" data-duration="1"/>
        </g>
      </g></g>
      <g id="layer-fx"><circle cx="200" cy="500" r="8" data-anim="fall"/><circle cx="300" cy="500" r="8" data-anim="pulse"/></g>
    </svg>`).root;
    await setFrame(big, 0);
    const start = await center(page.locator('[data-object="traveler"] circle'));
    for (const frame of [7, 15, 30]) {
      await setFrame(big, frame);
      const end = await center(page.locator('[data-object="traveler"] circle')),
        distance = Math.hypot(end.x - start.x, end.y - start.y);
      assert.ok(
        distance <= 120.1,
        `nested movement escaped the 240px output limit: ${distance * 2}`,
      );
      if (frame === 30)
        assert.ok(distance > 119.8, `expected a visible bounded move, got ${distance}`);
    }
  } finally {
    await page.close();
  }
  console.log(
    'Verified centered pupil/group scaling, flowing stroke pixels and bounded nested movement in the browser.',
  );
}
