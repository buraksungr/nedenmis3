import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import type { Browser, Page } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import { CaptionOverlay } from '../composition/CaptionOverlay';
import { captionGroupAt } from '../shared/captions';
import { parseStage } from '../server/motion-svg';
import { instantiateTemplate, templateIds } from '../server/science-templates';
import type { MotionRef } from '../shared/object-motion';

/** Check authored leg endpoints against the actual rendered room/floor geometry.
 * Screen CTMs include each ant's scale and movement, so this catches geometry
 * regressions rather than merely re-checking a separate table of coordinates. */
async function antFloorControl(page: Page, template: string) {
  const results = await page.evaluate((kind) => {
    const ants = [...document.querySelectorAll<SVGGElement>('[data-object][data-anim="move"]')];
    return ants
      .map((ant) => {
        const id = ant.getAttribute('data-object')!;
        const leg = ant.querySelector<SVGPathElement>('path');
        if (!leg) throw new Error(`No leg geometry for ${id}`);
        const segments = [
          ...(leg.getAttribute('d') ?? '').matchAll(
            /M\s*[-\d.]+\s+[-\d.]+\s+L\s*[-\d.]+\s+[-\d.]+\s+L\s*([-\d.]+)\s+([-\d.]+)/g,
          ),
        ];
        if (segments.length < 3) throw new Error(`Cannot find leg endpoints for ${id}`);
        const suffix =
          kind === 'soil-colony'
            ? `colony-room-${id.at(-1)}`
            : kind === 'ant-tunnel'
              ? 'tunnel-floor'
              : 'chamber-floor';
        const floor = document.querySelector<SVGGeometryElement>(`[id$="${suffix}"]`);
        if (!floor) throw new Error(`No actual floor geometry ${suffix}`);
        const a = leg.getScreenCTM(),
          b = floor.getScreenCTM();
        if (!a || !b) throw new Error(`Missing SVG transform for ${id}`);
        return segments.slice(0, 3).map((part) => {
          const point = new DOMPoint(Number(part[1]), Number(part[2]))
            .matrixTransform(a)
            .matrixTransform(b.inverse());
          let y: number;
          if (floor instanceof SVGEllipseElement) {
            const cx = floor.cx.baseVal.value,
              cy = floor.cy.baseVal.value,
              rx = floor.rx.baseVal.value,
              ry = floor.ry.baseVal.value;
            y = cy + ry * Math.sqrt(1 - ((point.x - cx) / rx) ** 2);
          } else {
            const path = floor as SVGPathElement,
              length = path.getTotalLength();
            let best = Infinity;
            y = NaN;
            for (let i = 0; i <= length; i += 1) {
              const sample = path.getPointAtLength(i),
                distance = Math.abs(sample.x - point.x);
              if (distance < best) {
                best = distance;
                y = sample.y;
              }
            }
            if (best > 2) throw new Error(`${id}: leg is outside its floor`);
          }
          return { id, x: point.x, foot: point.y, floor: y, above: y - point.y };
        });
      })
      .flat();
  }, template);
  assert.equal(results.length, template === 'ant-tunnel' ? 6 : 9, template);
  assert.ok(
    results.every((foot) => Number.isFinite(foot.floor) && foot.above >= -8 && foot.above <= 18),
    `${template}: feet not near their actual floor: ${JSON.stringify(results)}`,
  );
}

/** Render every shipped template with the actual browser and v2 compositor.
 * Screenshots and metrics are QA evidence, never bundled as user project content. */
export async function templateBrowserControl(browser: Browser) {
  const out = path.resolve('out/template-visual');
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
  });
  const report: { id: string; changedPixels: number; animated: number; captionGap: number }[] = [];
  try {
    for (const id of templateIds) {
      const stage = parseStage(
        instantiateTemplate(
          id,
          {
            title: 'Bilimsel Bakış',
            template: id,
            label1: 'Bilim',
            label2: '-10°C',
          },
          'Bilim ve -10°C',
        ),
      ).root;
      const ref = {
        kind: 'objects-v2',
        title: 'Bilimsel Bakış',
        digest: `template-${id}`,
      } as MotionRef;
      const render = (frame: number) =>
        page.setContent(
          `<style>html,body{margin:0;width:100%;height:100%}</style>${renderToStaticMarkup(createElement(ObjectScene, { scene: { stage, ref }, frame }))}`,
        );
      const pictures: PNG[] = [];
      let animated = 0;
      for (const frame of [0, 23]) {
        await render(frame);
        assert.equal(await page.locator('[data-shot-title]').count(), 0, id);
        const words = page.locator('[data-science-keyword]');
        assert.equal(await words.count(), 2, `${id}: missing short labels`);
        for (const word of await words.all()) {
          const box = await word.boundingBox();
          assert.ok(
            box &&
              box.x >= 10 &&
              box.x + box.width <= 530 &&
              box.y >= 10 &&
              box.y + box.height <= 610,
            `${id}: keyword outside safe region`,
          );
        }
        const boxes = await page.locator('[data-object][data-anim]').evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return {
              id: node.getAttribute('data-object'),
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              w: r.width,
              h: r.height,
            };
          }),
        );
        animated = boxes.length;
        assert.ok(animated >= 3, `${id}: fewer than 3 animated elements`);
        for (const b of boxes) {
          assert.ok(
            b.x >= -1 && b.right <= 541 && b.y >= -1 && b.bottom <= 731,
            `${id}: ${JSON.stringify(b)} outside safe foreground`,
          );
          assert.ok(b.w > 0 || b.h > 0, `${id}: invisible animated object ${b.id}`);
        }
        const buffer = await page.screenshot();
        if (frame === 0) fs.writeFileSync(path.join(out, `${id}.png`), buffer);
        pictures.push(PNG.sync.read(buffer));
      }
      const [first, later] = pictures;
      let changedPixels = 0;
      for (let y = 120; y < 730; y++)
        for (let x = 0; x < 540; x++) {
          const k = (y * 540 + x) * 4;
          if (
            Math.abs(first.data[k] - later.data[k]) +
              Math.abs(first.data[k + 1] - later.data[k + 1]) +
              Math.abs(first.data[k + 2] - later.data[k + 2]) >
            45
          )
            changedPixels++;
        }
      assert.ok(changedPixels >= 50, `${id}: movement not visible in pixels (${changedPixels})`);
      for (const [x, y] of [
        [5, 5],
        [534, 5],
        [5, 954],
        [534, 954],
      ]) {
        const k = (y * 540 + x) * 4,
          rgba = [...first.data.subarray(k, k + 4)];
        assert.ok(
          rgba[3] === 255 && rgba[0] + rgba[1] + rgba[2] > 20,
          `${id}: background missing ${rgba}`,
        );
      }
      if (['soil-colony', 'ant-tunnel', 'colony-chamber'].includes(id)) {
        for (const frame of [0, 180]) {
          await render(frame);
          await antFloorControl(page, id);
        }
      }
      if (id === 'eye-front') {
        const pupil = [];
        for (const frame of [0, 24, 72]) {
          await render(frame);
          const box = await page.locator('[data-object="pupil"]').boundingBox();
          assert.ok(box);
          pupil.push({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width });
        }
        for (const sample of pupil.slice(1)) {
          assert.ok(
            Math.abs(sample.x - pupil[0].x) < 0.1 && Math.abs(sample.y - pupil[0].y) < 0.1,
            `authored pupil center drifted: ${JSON.stringify(pupil)}`,
          );
        }
        assert.ok(
          pupil[1].width > pupil[0].width * 1.1 && pupil[2].width < pupil[0].width * 0.9,
          `authored pupil did not dilate and contract: ${JSON.stringify(pupil)}`,
        );
      }
      // Render the actual caption plate at the largest user-selectable size,
      // with a long word paginated exactly as in the film. Check real browser
      // rectangles rather than assuming the two coordinate regions are safe.
      const time = 2.5;
      const captionWords = captionGroupAt([{ text: 'W'.repeat(100), start: 0, end: 5 }], time);
      assert.ok(captionWords);
      const art = renderToStaticMarkup(
        createElement(ObjectScene, { scene: { stage, ref }, frame: 15 }),
      );
      const caption = renderToStaticMarkup(
        createElement(CaptionOverlay, {
          words: captionWords,
          time,
          size: 88,
          highlight: true,
          estimated: false,
        }),
      );
      await page.setContent(
        `<style>html,body{margin:0}.canvas{position:absolute;width:1080px;height:1920px;transform:scale(.5);transform-origin:top left}</style><div class="canvas">${art}${caption}</div>`,
      );
      const plate = await page.locator('[data-caption]').boundingBox();
      assert.ok(plate && plate.height > 0, `${id}: no caption`);
      let captionGap = Infinity;
      for (const word of await page.locator('[data-science-keyword]').all()) {
        const box = await word.boundingBox();
        assert.ok(box, `${id}: no visible keyword`);
        captionGap = Math.min(captionGap, plate.y - (box.y + box.height));
      }
      assert.ok(captionGap > 0, `${id}: caption overlaps keyword (${captionGap}px)`);
      const inset = page.locator('[id$="science-detail"]');
      if (await inset.count()) {
        const box = await inset.boundingBox();
        assert.ok(box && box.y + box.height < plate.y, `${id}: caption covers the inset diagram`);
      }
      assert.ok(
        await page.locator('[data-caption]').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${id}: caption overflows`,
      );
      if (['eye-front', 'soil-colony', 'photosynthesis'].includes(id))
        fs.writeFileSync(path.join(out, `${id}-caption.png`), await page.screenshot());
      report.push({ id, changedPixels, animated, captionGap });
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(
      `Verified ${report.length} locally authored templates, visible motion, actual caption separation and ant-floor bounds.`,
    );
  } finally {
    await page.close();
  }
}
