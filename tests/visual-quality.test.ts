import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseStage, validateNewStage } from '../server/motion-svg';
import { motionFrame, saveMotion } from '../server/motion-files';
import { ObjectPlanner } from '../server/object-planner';
import { SceneModels } from '../server/scene-models';
import { Store, hash, makeProject, scriptSig } from '../server/store';
import { memoryVault } from '../server/vault';
import { completion } from './vector-test-data';
import { eyeArt } from './eye-motion-art';

const effects = [1, 2, 3]
  .map((i) => `<circle cx="${i * 170}" cy="240" r="8" fill="#fff" data-anim="fall"/>`)
  .join('');
const drawing = (background: string, main: string, defs = '') =>
  `<svg viewBox="0 0 1080 1920">${defs}<g id="layer-bg"><rect width="1080" height="1920" fill="${background}"/></g><g id="layer-main">${main}</g><g id="layer-fx">${effects}</g></svg>`;
const organic = (a: string, b: string, c: string, attrs = '') =>
  `<g ${attrs}><path d="M80 400Q150 300 240 400L220 500H90Z" fill="${a}"/><path d="M300 400Q370 300 460 400L440 500H310Z" fill="${b}"/><path d="M520 400Q590 300 680 400L660 500H530Z" fill="${c}"/></g>`;
const dark = drawing('#05070c', organic('#282828', '#461416', '#34251a'));
const eye = eyeArt[0];

// The checks apply to newly generated scenes, not to already signed archive files.
test('contrast gate rejects plainly dark shapes on a near-black backdrop, inherited opacity and disappearing main art', () => {
  assert.throws(() => validateNewStage(parseStage(dark).root), /kontrast/i);
  const pathBackground = dark.replace(
    '<rect width="1080" height="1920" fill="#05070c"/>',
    '<path d="M0 0H1080V1920H0Z" fill="#05070c"/>',
  );
  assert.throws(() => validateNewStage(parseStage(pathBackground).root), /kontrast/i);
  const tinyHighlights =
    '<path d="M20 100Q35 70 50 100Z" fill="#fff"/><path d="M80 100Q95 70 110 100Z" fill="#fff"/>';
  assert.throws(
    () =>
      validateNewStage(
        parseStage(drawing('#000', organic('#222', '#321012', '#25211d') + tinyHighlights)).root,
      ),
    /kontrast/i,
  );
  const faint = drawing('#000', organic('#fff', '#ddd', '#fff', 'opacity="0.08"'));
  assert.throws(() => validateNewStage(parseStage(faint).root), /kontrast/i);
  const disappears = drawing('#000', organic('#fff', '#ddd', '#fff', 'data-anim="pop"'));
  assert.throws(() => validateNewStage(parseStage(disappears).root), /kontrast/i);
  const offscreen = drawing(
    '#000',
    organic('#fff', '#ddd', '#fff', 'transform="translate(4000 0)"'),
  );
  assert.throws(() => validateNewStage(parseStage(offscreen).root), /kontrast/i);
  assert.doesNotThrow(() => validateNewStage(parseStage(eye).root, { topic: 'Göz bebeği' }));
  assert.doesNotThrow(() =>
    validateNewStage(parseStage(drawing('#f4eee9', organic('#17252e', '#30404a', '#171717'))).root),
  );
});

test('contrast gate evaluates local gradients and alpha rather than accepting dark or transparent stops', () => {
  const defs = `<defs><linearGradient id="dark"><stop stop-color="#101010"/><stop offset="1" stop-color="#451010"/></linearGradient><linearGradient id="bright"><stop stop-color="#9be8f2"/><stop offset="1" stop-color="#5ccad3"/></linearGradient><linearGradient id="faint"><stop stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#fff" stop-opacity="0.05"/></linearGradient></defs>`;
  for (const fill of ['url(#dark)', 'url(#faint)'])
    assert.throws(
      () => validateNewStage(parseStage(drawing('#030507', organic(fill, fill, fill), defs)).root),
      /kontrast/i,
    );
  assert.doesNotThrow(() =>
    validateNewStage(
      parseStage(drawing('#030507', organic('url(#bright)', 'url(#bright)', '#111'), defs)).root,
    ),
  );
  const bgDefs = defs.replace(
    '</defs>',
    '<linearGradient id="night"><stop stop-color="#050608"/><stop offset="1" stop-color="#111822"/></linearGradient></defs>',
  );
  assert.throws(
    () =>
      validateNewStage(
        parseStage(drawing('url(#night)', organic('#282828', '#461416', '#34251a'), bgDefs)).root,
      ),
    /kontrast/i,
  );
  assert.doesNotThrow(() =>
    validateNewStage(
      parseStage(drawing('url(#night)', organic('#e8f4ee', '#49c9ca', '#17222a'), bgDefs)).root,
    ),
  );
});

test('eye topics reject empty rings and boxes, while a curved anatomical subject and unrelated abstract science remain possible', () => {
  const rings = `<path d="M440 600a100 100 0 1 0 200 0a100 100 0 1 0 -200 0Z" fill="#eee"/><path d="M470 600a70 70 0 1 0 140 0a70 70 0 1 0 -140 0Z" fill="#49c9ca"/><path d="M510 600a30 30 0 1 0 60 0a30 30 0 1 0 -60 0Z" fill="#111"/>`;
  const stage = parseStage(drawing('#000', rings)).root;
  assert.throws(
    () =>
      validateNewStage(stage, {
        topic: 'Göz bebeği neden büyür?',
        narration: 'Karanlıkta genişler.',
      }),
    /halka veya kutu/,
  );
  const invisibleDecoy = rings + '<path d="M50 500Q100 300 200 500Z" fill="none" stroke="none"/>';
  assert.throws(
    () =>
      validateNewStage(parseStage(drawing('#000', invisibleDecoy)).root, {
        topic: 'Göz anatomisi',
      }),
    /halka veya kutu/,
  );
  const cubic = [150, 100, 50]
    .map((r, i) => {
      const k = Math.round(r * 0.55),
        x = 540,
        y = 600;
      return `<path d="M${x - r} ${y}C${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r}C${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y}C${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r}C${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y}Z" fill="${['#eee', '#49c9ca', '#111'][i]}"/>`;
    })
    .join('');
  assert.throws(
    () => validateNewStage(parseStage(drawing('#000', cubic)).root, { topic: 'Göz anatomisi' }),
    /halka veya kutu/,
  );
  assert.doesNotThrow(() => validateNewStage(stage, { topic: 'Gezegen halkaları' }));
  const rectangles = organic('#eee', '#7dd', '#111').replaceAll(/Q\d+ \d+ \d+ \d+/g, 'L240 400');
  assert.throws(
    () =>
      validateNewStage(parseStage(drawing('#000', rectangles)).root, {
        narration: 'Görme nasıl gerçekleşir?',
      }),
    /halka veya kutu/,
  );
  assert.doesNotThrow(() => validateNewStage(parseStage(eye).root, { topic: 'Optik ve göz' }));
  // Straight iris fibres in a single path are meaningful detail, even when an
  // intentionally faceted eye uses only polygonal shapes rather than curves.
  const faceted = `<path d="M80 630L250 450L830 450L1000 630L830 810L250 810Z" fill="#eaf5f5"/><path d="M540 455L650 500L700 630L650 760L540 805L430 760L380 630L430 500Z" fill="#49c9ca"/><path d="M540 555L600 585L615 630L600 675L540 705L480 675L465 630L480 585Z" fill="#162a31"/><path d="M540 475V550M620 505L575 570M680 630H615M620 755L575 690M540 785V710M460 755L505 690M400 630H465M460 505L505 570" fill="none" stroke="#f0ffff" stroke-width="8"/>`;
  assert.doesNotThrow(() =>
    validateNewStage(parseStage(drawing('#101728', faceted)).root, { topic: 'Göz bebeği' }),
  );
});

test('planner asks for contrast and anatomical repairs before publishing a bright eye scene', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-eye-quality-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const rings = `<path d="M220 400H600V780H220Z" fill="#eee"/><path d="M290 470H530V710H290Z" fill="#49c9ca"/><path d="M360 540H460V640H360Z" fill="#111"/>`;
  const requests: { onarım?: string; rule: string }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      requests.push({ ...JSON.parse(body.messages[1].content), rule: body.messages[0].content });
      return completion({
        title: 'Işığın Yolculuğu',
        svg: [dark, drawing('#000', rings), eye][requests.length - 1],
      });
    },
  );
  models.key('openrouter', 'offline-test');
  const project = store.create(
    makeProject('Göz bebeği nasıl çalışır?', 'Karanlıkta ışık retinaya ulaşır.'),
  );
  project.scriptApproval = scriptSig(project);
  await new ObjectPlanner(store, models, async () => {}).plan(project, () => {});
  assert.equal(requests.length, 3);
  assert.match(requests[1].onarım!, /kontrast/i);
  assert.match(requests[2].onarım!, /halka veya kutu/i);
  for (const requirement of [
    /YÜKSEK KONTRAST ZORUNLU/,
    /radyal kas lifleri/,
    /kornea ve mercekte kırılıp retinaya/,
    /boş iç içe halkalar/,
    /her karede net seçilsin/,
  ])
    assert.match(requests[0].rule, requirement);
  assert.ok(project.scenes[0].choreography);
  assert.doesNotThrow(() =>
    motionFrame(store.dir(project.id), project.scenes[0].choreography, project.scenes[0].narration),
  );
});

test('previously signed low-contrast artwork still reopens unchanged', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-old-dark-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const narration = 'Göz bebeği karanlıkta büyür.';
  const ref = saveMotion(
    root,
    {
      kind: 'objects-v1',
      title: 'Göz Bebeği',
      narrationHash: hash(narration),
      provider: 'openrouter',
      model: 'old',
    },
    dark,
  );
  assert.equal(motionFrame(root, ref, narration).ref.digest, ref.digest);
});
