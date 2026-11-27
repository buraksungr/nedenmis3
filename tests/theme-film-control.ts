/** Real encoded H.264 controls for the black-hole and heart themes. Provider and
 * voice responses are NOT used; this verifies the local renderer and decoded pixels. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright-core';
import { ObjectScene } from '../composition/ObjectScene';
import { blankScene } from '../shared/schema';
import { Gemini } from '../server/gemini';
import { ff, verifyVideo } from '../server/media';
import { saveMotion, motionFrame } from '../server/motion-files';
import { Production } from '../server/production';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { instantiateTemplate, type TemplateId } from '../server/science-templates';
import { Store, approveBoard, makeProject, scriptSig } from '../server/store';
import { narrationHash } from '../server/vector-files';
import { memoryVault } from '../server/vault';
import { reduced, evidence } from './pixel-comparison';

type FilmCase = {
  name: string;
  topic: string;
  narration: string;
  title: string;
  template: TemplateId;
};
export async function themeFilmControl(out: string) {
  const root = path.resolve(out, 'theme-film-data'),
    store = new Store(root, false);
  const prod = new Production(
    store,
    new Gemini(store, memoryVault(), async () => {
      throw new Error('No provider in local pixel QA');
    }),
    {
      root,
      pythonDir: path.resolve('python'),
      composition: path.resolve('build/composition'),
    },
  );
  const cases: FilmCase[] = [
    {
      name: 'black-hole',
      topic: 'Kara delik ve olay ufku',
      narration: 'Kara delik ışığı büker ve madde içeri akar.',
      title: 'Kara Deliğin Çevresi',
      template: 'orbit',
    },
    {
      name: 'heart',
      topic: 'Kalbin kan dolaşımı',
      narration: 'Kalp kanı damarlara ritmik biçimde pompalar.',
      title: 'Kalbin Ritmi',
      template: 'heart',
    },
  ];
  const { puppeteerInstance: browser } = await openFirstBrowser(browserCandidates({}), (c) =>
    chromium.launch({
      executablePath: c.browserExecutable,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }),
  );
  const report: Record<string, unknown> = {};
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    const capture = async () =>
      reduced(await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1350 } }));
    for (const item of cases) {
      const p = makeProject(item.topic, item.narration);
      const scene = {
        ...blankScene(randomUUID()),
        narration: item.narration,
        visualMode: 'motion-svg' as const,
      };
      p.scenes = [scene];
      store.create(p);
      p.scriptApproval = scriptSig(p);
      scene.choreography = saveMotion(
        store.dir(p.id),
        {
          kind: 'objects-v2',
          title: item.title,
          narrationHash: narrationHash(scene.narration),
          provider: 'openrouter',
          model: 'offline-theme-film',
        },
        instantiateTemplate(
          item.template,
          { title: item.title, template: item.template },
          `${item.narration} ${item.topic}`,
        ),
        { requireDetailedArt: true, topic: item.topic, narration: item.narration },
      );
      approveBoard(p);
      store.save(p);
      await prod.import(p, 'voice', fs.readFileSync('tests/fixtures/forest.wav'), scene);
      p.assets[scene.id].edits = [{ text: 'Bitti.', start: 0, end: 0.3 }];
      const frames = 48;
      await prod.clip(p, scene, undefined, frames);
      const clip = prod.file(p, p.assets[scene.id].clip!.file);
      await verifyVideo(clip, frames, false);
      fs.copyFileSync(clip, path.join(out, `theme-${item.name}.mp4`));
      const signed = motionFrame(store.dir(p.id), scene.choreography, scene.narration);
      const show = async (frame: number) =>
        page.setContent(
          '<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}</style>' +
            renderToStaticMarkup(createElement(ObjectScene, { scene: signed, frame })),
        );
      await show(0);
      const camera0 = await page.locator('[data-camera-motion]').first().getAttribute('transform');
      const ids =
        item.name === 'black-hole' ? ['infall-ray-a', 'accretion-orbit'] : ['heart-arterial-flow'];
      const frozen = Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => [id, await page.locator(`[data-object="${id}"]`).innerHTML()]),
        ),
      );
      const beat0 =
        item.name === 'heart'
          ? await page.locator('[data-object="heart-organ"] > g').first().getAttribute('style')
          : null;
      assert.ok(camera0);
      const movements = [];
      for (const f of item.name === 'black-hole' ? [23] : [4, 23]) {
        const png = path.join(root, `${item.name}-${f}.png`);
        await ff(['-i', clip, '-an', '-vf', `select=eq(n\\,${f})`, '-frames:v', '1', png]);
        const film = reduced(fs.readFileSync(png));
        await show(f);
        const expected = await capture();
        let sum = 0;
        for (let i = 0; i < film.length; i++) sum += Math.abs(film[i] - expected[i]);
        const fullMAE = sum / film.length;
        assert.ok(
          fullMAE < 5,
          `${item.name} encoded frame ${f} differs from the actual composition: ${fullMAE}`,
        );
        if (f === 23) {
          for (const id of ids) {
            const node = page.locator(`[data-object="${id}"]`),
              current = await node.innerHTML();
            await node.evaluate((n, html) => {
              n.innerHTML = html;
            }, frozen[id]);
            movements.push({
              id,
              frame: f,
              ...evidence(film, expected, await capture(), `${item.name} frozen ${id}`),
            });
            await node.evaluate((n, html) => {
              n.innerHTML = html;
            }, current);
          }
          await page
            .locator('[data-camera-motion]')
            .evaluateAll(
              (nodes, value) => nodes.forEach((n) => n.setAttribute('transform', value)),
              camera0,
            );
          movements.push({
            id: 'bounded-camera',
            frame: f,
            ...evidence(film, expected, await capture(), `${item.name} frozen camera`),
          });
        }
        if (f === 4 && beat0) {
          await page
            .locator('[data-object="heart-organ"] > g')
            .first()
            .evaluate((n, value) => n.setAttribute('style', value), beat0);
          movements.push({
            id: 'whole-heart-contraction',
            frame: f,
            ...evidence(film, expected, await capture(), 'heart frozen contraction'),
          });
        }
      }
      report[item.name] = {
        frames,
        movements,
        provider: 'none; local authored drawing and fixture voice',
      };
    }
    fs.writeFileSync(path.join(out, 'theme-film-report.json'), JSON.stringify(report, null, 2));
    console.log(
      'Verified black-hole light/accretion and whole-heart/flow/camera motion in decoded H.264:',
      JSON.stringify(report),
    );
  } finally {
    await browser.close();
    store.db.close();
  }
}
