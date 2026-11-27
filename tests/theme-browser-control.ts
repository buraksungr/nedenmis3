import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import type { Browser, Page } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import { parseStage } from '../server/motion-svg';
import { instantiateTemplate, type TemplateId } from '../server/science-templates';
import type { MotionRef } from '../shared/object-motion';

/** Count actual painted pixels, not merely changes to a data attribute. */
function changed(a: Buffer, b: Buffer) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  assert.equal(x.width, y.width);
  assert.equal(x.height, y.height);
  let count = 0;
  for (let i = 0; i < x.data.length; i += 4)
    if (
      Math.abs(x.data[i] - y.data[i]) +
        Math.abs(x.data[i + 1] - y.data[i + 1]) +
        Math.abs(x.data[i + 2] - y.data[i + 2]) >
      45
    )
      count++;
  return count;
}

type Sample = { id: TemplateId; title: string; source: string };
function renderer(page: Page, sample: Sample) {
  const stage = parseStage(
    instantiateTemplate(sample.id, { title: sample.title, template: sample.id }, sample.source),
  ).root;
  const ref = {
    kind: 'objects-v2',
    title: sample.title,
    digest: `theme-${sample.id}`,
  } as MotionRef;
  return async (frame: number) =>
    page.setContent(
      '<style>html,body{margin:0;width:100%;height:100%}</style>' +
        renderToStaticMarkup(createElement(ObjectScene, { scene: { ref, stage }, frame })),
    );
}

/** Exercise the actual Chromium SVG compositor, isolate camera, organ, light and
 * antenna motion, and measure attachment in screen coordinates. */
export async function themeBrowserControl(browser: Browser) {
  const out = path.resolve('out/template-visual/themes');
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
  });
  const report: Record<string, unknown> = {};
  try {
    const black = renderer(page, {
      id: 'orbit',
      title: 'Kara Deliğin Çevresi',
      source: 'Kara delik ışığı büker ve madde içeri akar.',
    });
    await black(0);
    assert.equal(await page.locator('[id$="black-hole-horizon"]').count(), 1);
    assert.equal(await page.locator('[id$="science-detail"]').count(), 0);
    const camera0 = await page.locator('[data-camera-motion]').first().getAttribute('transform');
    const flow0 = await page.locator('[data-object="infall-ray-a"]').innerHTML();
    const orbit0 = await page.locator('[data-object="accretion-orbit"]').innerHTML();
    const horizon0 = await page.locator('[id$="black-hole-horizon"]').boundingBox();
    assert.ok(camera0 && horizon0);
    await black(23);
    const horizon23 = await page.locator('[id$="black-hole-horizon"]').boundingBox();
    assert.ok(horizon23);
    assert.ok(
      Math.hypot(
        horizon23.x + horizon23.width / 2 - (horizon0.x + horizon0.width / 2),
        horizon23.y + horizon23.height / 2 - (horizon0.y + horizon0.height / 2),
      ) < 8,
      'black-hole center escaped bounded camera',
    );
    const actualBlack = await page.screenshot();
    fs.writeFileSync(path.join(out, 'black-hole.png'), actualBlack);
    const transforms = await page
      .locator('[data-camera-motion]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform')));
    assert.ok(
      transforms.length >= 2 && new Set(transforms).size === 1,
      'all subject and light paths must share one camera',
    );
    await page.locator('[data-object="infall-ray-a"]').evaluate((n, html) => {
      n.innerHTML = html;
    }, flow0);
    const lightPixels = changed(actualBlack, await page.screenshot());
    assert.ok(lightPixels >= 20, `inward light flow did not move in pixels: ${lightPixels}`);
    await black(23);
    await page.locator('[data-object="accretion-orbit"]').evaluate((n, html) => {
      n.innerHTML = html;
    }, orbit0);
    const orbitPixels = changed(actualBlack, await page.screenshot());
    assert.ok(orbitPixels >= 20, `accretion particle did not orbit in pixels: ${orbitPixels}`);
    await black(23);
    await page
      .locator('[data-camera-motion]')
      .evaluateAll(
        (nodes, transform) => nodes.forEach((n) => n.setAttribute('transform', transform)),
        camera0,
      );
    const cameraPixels = changed(actualBlack, await page.screenshot());
    assert.ok(cameraPixels >= 150, `camera movement not visible in pixels: ${cameraPixels}`);
    report.blackHole = { lightPixels, orbitPixels, cameraPixels };

    const heart = renderer(page, {
      id: 'heart',
      title: 'Kalbin Ritmi',
      source: 'Kalp kanı damarlara pompalar.',
    });
    await heart(0);
    const heart0 = await page.locator('[data-object="heart-organ"]').boundingBox();
    assert.ok(heart0);
    const beat0 = await page
      .locator('[data-object="heart-organ"] > g')
      .first()
      .getAttribute('style');
    assert.ok(beat0);
    const artery0 = await page.locator('[data-object="heart-arterial-flow"]').boundingBox();
    assert.ok(artery0);
    await heart(4);
    const heart4 = await page.locator('[data-object="heart-organ"]').boundingBox();
    const artery4 = await page.locator('[data-object="heart-arterial-flow"]').boundingBox();
    assert.ok(heart4 && artery4);
    assert.ok(
      heart4.width < heart0.width * 0.96,
      `the WHOLE heart did not contract: ${heart0.width}/${heart4.width}`,
    );
    assert.ok(
      Math.hypot(
        heart4.x + heart4.width / 2 - (heart0.x + heart0.width / 2),
        heart4.y + heart4.height / 2 - (heart0.y + heart0.height / 2),
      ) < 5,
      'heart drifted away from its center',
    );
    const relative = (part: typeof artery0, whole: typeof heart0) => ({
      x: (part.x - whole.x) / whole.width,
      y: (part.y - whole.y) / whole.height,
    });
    const a0 = relative(artery0, heart0),
      a4 = relative(artery4, heart4);
    assert.ok(
      Math.hypot(a0.x - a4.x, a0.y - a4.y) < 0.01,
      'arterial path detached from the beating organ',
    );
    const actualHeart = await page.screenshot();
    fs.writeFileSync(path.join(out, 'heart.png'), actualHeart);
    await page
      .locator('[data-object="heart-organ"] > g')
      .first()
      .evaluate((n, style) => n.setAttribute('style', style), beat0);
    const beatPixels = changed(actualHeart, await page.screenshot());
    assert.ok(beatPixels >= 500, `whole-organ heartbeat not visible in pixels: ${beatPixels}`);
    report.heart = {
      widthBefore: heart0.width,
      widthAtBeat: heart4.width,
      beatPixels,
      attachmentError: Math.hypot(a0.x - a4.x, a0.y - a4.y),
    };

    const ant = renderer(page, {
      id: 'focus',
      title: 'Karınca Yakın Planı',
      source: 'Karıncalar toprağın altında bir koloni kurar.',
    });
    await ant(0);
    const antenna0 = await page.locator('[data-object="focus-ant-a-antennae"]').innerHTML();
    await ant(23);
    const actualAnt = await page.screenshot();
    fs.writeFileSync(path.join(out, 'ant.png'), actualAnt);
    await page.locator('[data-object="focus-ant-a-antennae"]').evaluate((n, html) => {
      n.innerHTML = html;
    }, antenna0);
    const antennaPixels = changed(actualAnt, await page.screenshot());
    assert.ok(antennaPixels >= 15, `antenna movement not visible in pixels: ${antennaPixels}`);
    let maxAttachment = 0;
    for (const frame of [0, 10, 23, 60, 120]) {
      await ant(frame);
      const distance = await page.evaluate(() => {
        const body = document.querySelector<SVGGElement>('[data-object="focus-ant-a-body"]')!;
        const leg = body.querySelector<SVGPathElement>('path')!;
        const antenna = document
          .querySelector<SVGGElement>('[data-object="focus-ant-a-antennae"]')!
          .querySelector<SVGPathElement>('path')!;
        const legMatrix = leg.getScreenCTM()!,
          antennaMatrix = antenna.getScreenCTM()!;
        const expected = new DOMPoint(96, 26).matrixTransform(legMatrix),
          actual = new DOMPoint(96, 26).matrixTransform(antennaMatrix);
        return Math.hypot(expected.x - actual.x, expected.y - actual.y);
      });
      maxAttachment = Math.max(maxAttachment, distance);
      assert.ok(distance < 0.05, `ant antenna detached from head at frame ${frame}: ${distance}`);
    }
    report.ant = { antennaPixels, maxAttachment };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(
      'Verified topic-specific browser pixels, bounded camera and attached heart/ant structures:',
      JSON.stringify(report),
    );
  } finally {
    await page.close();
  }
}
