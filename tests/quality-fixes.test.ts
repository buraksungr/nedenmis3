import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ObjectScene } from '../composition/ObjectScene';
import { dissolveAt } from '../composition/fade';
import { captionGroupAt } from '../shared/captions';
import { motionHeading, motionRefSchema, type MotionRef } from '../shared/object-motion';
import { isCompleteTitle, uniqueSceneTitle } from '../shared/topics';
import { parseIllustration } from '../server/layered-svg';
import { parseStage, validateNewStage } from '../server/motion-svg';
import { motionFrame, saveMotion } from '../server/motion-files';
import { ObjectPlanner } from '../server/object-planner';
import { SceneModels } from '../server/scene-models';
import { Store, hash, makeProject, scriptSig } from '../server/store';
import { memoryVault } from '../server/vault';
import { completion } from './vector-test-data';

const moving = [1, 2, 3]
  .map((i) => `<circle cx="${100 * i}" cy="600" r="10" data-anim="fall"/>`)
  .join('');
const paths =
  '<path d="M10 400L80 420L60 450Z" fill="#a86"/>' +
  '<path d="M100 400Q140 360 180 410Z" fill="#c97"/>' +
  '<path d="M200 400L240 450" fill="none" stroke="#fff"/>';
const svg = (main: string, extra = '') =>
  `<svg viewBox="0 0 1080 1920">${extra}<g id="layer-bg"><rect width="1080" height="1920" fill="#123"/></g><g id="layer-main">${main}</g><g id="layer-fx">${moving}</g></svg>`;

test('new art requires three visible paths in layer-main, including nested groups but excluding definitions', () => {
  const main = `<g transform="translate(10 20)">${paths}</g>`;
  assert.doesNotThrow(() => validateNewStage(parseStage(svg(main)).root));
  const rejects = [
    '<circle cx="50" cy="400" r="20"/><rect x="70" y="400" width="20" height="30"/>',
    `<defs><g id="not-painted">${paths}</g></defs><circle cx="50" cy="400" r="20"/>`,
    `<g opacity="0">${paths}</g>`,
    `<g transform="scale(0)">${paths}</g>`,
    '<path d="M10 400"/><path d="M20 400L20 400"/><path d="M40 400L80 450" fill="none" stroke="none"/>',
    `<g fill="none" stroke="none">${paths.replace(/ fill="[^"]*"/g, '').replace(/ stroke="[^"]*"/g, '')}</g>`,
  ];
  for (const content of rejects)
    assert.throws(() => validateNewStage(parseStage(svg(content)).root), /en az 3.*<path>/);
  const missingLayer = svg(paths).replace('id="layer-fx"', 'id="effects"');
  assert.throws(
    () => validateNewStage(parseStage(missingLayer).root),
    /layer-bg, layer-main ve layer-fx/,
  );
});

test('planner repairs a primitive-only drawing and a fragment title before publishing', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-quality-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const requests: { onarım?: string }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, opts) => {
      const body = JSON.parse(String(opts?.body));
      requests.push(JSON.parse(body.messages[1].content));
      const i = requests.length;
      return completion({
        title: i === 2 ? 'Yerin Metrelerce' : 'Kışın Eşiğinde',
        svg: svg(i === 1 ? '<circle cx="100" cy="600" r="50"/>' : `<g>${paths}</g>`),
      });
    },
  );
  models.key('openrouter', 'isolated-quality-test');
  const p = store.create(makeProject('Kışın karıncalar', 'Karıncalar kışın yuvada yaşar.'));
  p.scriptApproval = scriptSig(p);
  await new ObjectPlanner(store, models, async () => {}).plan(p, () => {});
  assert.equal(requests.length, 3);
  assert.equal(requests[0].onarım, undefined);
  assert.match(requests[1].onarım!, /en az 3.*<path>/);
  assert.match(requests[2].onarım!, /Başlık Hatası/);
  assert.equal(p.scenes[0].choreography?.title, 'Kışın Eşiğinde');
  validateNewStage(
    motionFrame(store.dir(p.id), p.scenes[0].choreography, p.scenes[0].narration).stage,
  );
});

test('old signed motion art and empty layered illustrations remain readable', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-old-art-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const narration = 'Önceden kaydedilmiş sahne.';
  const ref = saveMotion(
    root,
    {
      kind: 'objects-v1',
      title: 'Yerin Metrelerce',
      narrationHash: hash(narration),
      provider: 'openrouter',
      model: 'archived',
    },
    svg('<circle cx="100" cy="600" r="50"/>'),
  );
  assert.ok(motionRefSchema.safeParse(ref).success);
  assert.equal(motionFrame(root, ref, narration).ref.digest, ref.digest);
  const oldLayered =
    '<svg viewBox="0 0 1080 1350"><g id="layer-bg"/><g id="layer-main"/><g id="layer-fx"/></svg>';
  const parsed = parseIllustration(oldLayered);
  assert.deepEqual(parseIllustration(parsed.canonical), parsed);
});

test('new Turkish headings reject reported fragments without rejecting complete titles', () => {
  for (const title of ['Kışın Eşiğinde', 'Güvenli Derinlikler', 'Karada Isı Kaybı']) {
    assert.ok(motionHeading.safeParse(title).success, title);
    assert.ok(isCompleteTitle(title), title);
  }
  for (const title of ['Yerin Metrelerce', 'Burada Birbirlerine', 'Hava Soğuyunca']) {
    assert.ok(!motionHeading.safeParse(title).success, title);
    assert.ok(!isCompleteTitle(title), title);
  }
  const fallback = uniqueSceneTitle('Yerin metrelerce altında karıncalar yaşıyor.', new Set());
  assert.ok(motionHeading.safeParse(fallback).success);
  assert.notEqual(fallback, 'Yerin Metrelerce');
});

test('caption selection and motion transition respect scene-local cue boundaries', () => {
  const first = [
    { text: 'İlk', start: 0.1, end: 0.4 },
    { text: 'sahne.', start: 0.4, end: 0.8 },
  ];
  const second = [{ text: 'Sonraki sahne.', start: 0.2, end: 1 }];
  assert.equal(captionGroupAt(first, 0.09), undefined);
  assert.equal(
    captionGroupAt(first, 0.3)
      ?.map((w) => w.text)
      .join(' '),
    'İlk sahne.',
  );
  assert.equal(captionGroupAt(first, 0.85), undefined);
  assert.equal(captionGroupAt(second, 0.19, true), undefined);
  assert.equal(captionGroupAt(second, 0.2, true)?.[0].text, 'Sonraki sahne.');
  // With speech through 2.5 seconds, no incoming art or title can appear beneath it.
  for (let f = 0; f < 76; f++) assert.equal(dissolveAt(f, 30, 91, 2.5), 0);
  assert.ok(dissolveAt(83, 30, 91, 2.5) > 0);
  assert.equal(dissolveAt(90, 30, 91, 2.5), 1);
  assert.equal(dissolveAt(90, 30, 91, Infinity), 0);
  assert.equal(dissolveAt(90, 30, 91, 3), 0);
});

test('safe-frame clip wraps the fitted SVG, so alternate viewBoxes and animations stay inside output bounds', () => {
  const stage = parseStage(svg(`<g transform="translate(0 -800)">${paths}</g>`)).root;
  stage.attrs.viewBox = '0 0 540 960';
  const ref = { title: 'Kışın Eşiğinde', digest: 'quality' } as MotionRef;
  const markup = renderToStaticMarkup(
    createElement(ObjectScene, { scene: { stage, ref }, frame: 30 }),
  );
  const id = /<clipPath id="([^"]*safe-frame)">/.exec(markup)?.[1];
  assert.ok(id);
  assert.match(markup, /<rect x="0" y="220" width="1080" height="1240"/);
  assert.ok(markup.includes(`<g clip-path="url(#${id})"><svg data-fixed-camera=""`));
  assert.ok(markup.includes('viewBox="0 0 540 960"'));
  assert.ok(markup.includes('data-anim="fall"'));
});
