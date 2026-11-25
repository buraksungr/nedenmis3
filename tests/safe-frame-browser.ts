import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import type { Browser } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import type { MotionRef } from '../shared/object-motion';
import type { Geometry } from '../shared/vector';

/** Check actual browser pixels, not just the presence of a clipPath attribute. */
export async function safeFrameBrowserControl(browser: Browser) {
  const stage: Geometry = {
    tag: 'svg',
    // A non-standard viewBox tests that clipping happens in OUTPUT coordinates.
    attrs: { viewBox: '0 0 540 960' },
    children: [
      {
        tag: 'g',
        attrs: { transform: 'translate(0 -100)' },
        children: [
          {
            tag: 'path',
            attrs: { d: 'M0 -200H540V1400H0Z', fill: '#ff2100' },
            children: [],
          },
          {
            tag: 'circle',
            attrs: {
              cx: '270',
              cy: '100',
              r: '90',
              fill: '#00ff00',
              'data-anim': 'move',
              'data-dy': '180',
              'data-duration': '1',
            },
            children: [],
          },
        ],
      },
    ],
  };
  const ref = { title: 'Güvenli Derinlikler', digest: 'safe-frame-qa' } as MotionRef;
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
  });
  try {
    for (const frame of [0, 30]) {
      const svg = renderToStaticMarkup(
        createElement(ObjectScene, { scene: { ref, stage }, frame }),
      );
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}</style>${svg}`);
      const image = PNG.sync.read(await page.screenshot());
      const pixel = (x: number, y: number) => {
        const i = (y * image.width + x) * 4;
        return [...image.data.subarray(i, i + 3)];
      };
      // Rendered at half resolution: y 110 and 730 correspond to 220 and 1460.
      for (const y of [40, 100, 750, 900]) {
        const [r, g, b] = pixel(270, y);
        assert.ok(
          r < 100 && g < 100 && b < 140,
          `foreground escaped at y=${y * 2}, frame=${frame}: ${r},${g},${b}`,
        );
      }
      for (const y of [130, 700]) {
        const [r, g, b] = pixel(80, y);
        assert.ok(
          r > 120 && r > g * 2 && r > b * 2,
          `safe content missing at y=${y * 2}, frame=${frame}: ${r},${g},${b}`,
        );
      }
    }
  } finally {
    await page.close();
  }
  console.log(
    'Verified safe-frame pixels at y=220–1460 for transformed/animated art and an alternate viewBox.',
  );
}
