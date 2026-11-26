import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ObjectScene } from '../composition/ObjectScene';
import { ScientificPlate } from '../composition/ScientificPlate';
import { dissolveAt } from '../composition/fade';
import { captionGroupAt, captionPages, srtFromCues } from '../shared/captions';
import legacyFlight from './fixtures/legacy-flight.json';
import { svgPlanSchema } from '../shared/svg';
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

test('planner rejects model-authored geometry and repairs a fragment title before publishing local art', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-quality-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const requests: { onarım?: string; rule: string }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, opts) => {
      const body = JSON.parse(String(opts?.body));
      requests.push({ ...JSON.parse(body.messages[1].content), rule: body.messages[0].content });
      const i = requests.length;
      return completion(
        i === 1
          ? { title: 'Kışın Eşiğinde', svg: svg(paths) }
          : { title: i === 2 ? 'Yerin Metrelerce' : 'Kışın Eşiğinde', template: 'soil-colony' },
      );
    },
  );
  models.key('openrouter', 'isolated-quality-test');
  const p = store.create(makeProject('Kışın karıncalar', 'Karıncalar kışın yuvada yaşar.'));
  p.scriptApproval = scriptSig(p);
  await new ObjectPlanner(store, models, async () => {}).plan(p, () => {});
  assert.equal(requests.length, 3);
  assert.match(requests[0].rule, /KESİNLİKLE SVG, XML, path, koordinat/);
  assert.match(requests[1].onarım!, /JSON Şema Hatası/);
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

test('long captions paginate for display without changing saved alignment or subtitle cues', () => {
  const line = 'Karıncalar toprağın altında yavaşça güvenli odalara ilerleyerek bekler.',
    original = [{ text: line, start: 0.2, end: 4.8 }],
    before = structuredClone(original),
    pages = captionPages(original);
  assert.ok(pages.length > 1);
  assert.ok(pages.every((p) => Array.from(p.map((w) => w.text).join(' ')).length <= 24));
  assert.equal(
    pages
      .flat()
      .map((w) => w.text)
      .join(' '),
    line,
  );
  assert.equal(pages[0][0].start, original[0].start);
  assert.equal(pages.at(-1)!.at(-1)!.end, original[0].end);
  assert.deepEqual(original, before);
  assert.equal(srtFromCues(original), srtFromCues(before));
  assert.equal(captionGroupAt(original, 0.1, true), undefined);
  for (const page of pages) {
    const selected = captionGroupAt(original, page[0].start + 0.001, true);
    assert.deepEqual(selected, page);
  }
  assert.equal(captionGroupAt(original, 4.8, true), undefined);

  const longWord = [{ text: 'W'.repeat(95), start: 0, end: 3 }],
    pieces = captionPages(longWord);
  assert.equal(
    pieces
      .flat()
      .map((w) => w.text)
      .join(''),
    longWord[0].text,
  );
  assert.ok(pieces.every((p) => Array.from(p.map((w) => w.text).join(' ')).length <= 24));
  assert.equal(pieces.at(-1)!.at(-1)!.end, 3);
});

test('all archived atlas templates keep at most two small keywords, not headings or hardcoded labels', () => {
  for (const old of legacyFlight) {
    const plan = svgPlanSchema.parse({
      ...old,
      title: 'Kışın Eşiğinde',
      labels: ['Isı akışı', 'Yalıtım', 'Üçüncü terim', 'Başka terim'],
    });
    const markup = renderToStaticMarkup(
      createElement(ScientificPlate, { plan, frame: 15, frames: 30 }),
    );
    const labels = [...markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
    assert.doesNotMatch(markup, /NaN|undefined/);
    assert.ok(labels.length <= 2, `${plan.template} rendered extra text`);
    for (const [, attrs, body] of labels) {
      assert.match(attrs, /data-science-keyword=""/);
      assert.ok(Number(/font-size="([^"]+)"/.exec(attrs)?.[1]) <= 20);
      assert.ok(Number(/\sy="([^"]+)"/.exec(attrs)?.[1]) <= 570);
      assert.doesNotMatch(body, /Kışın Eşiğinde|Üçüncü|Başka|DALGA|KATMAN|EVRE/);
    }
  }
});

test('background is outside the foreground clip; alternate viewBoxes map the bottom safety boundary', () => {
  const stage = parseStage(svg(`<g transform="translate(0 -800)">${paths}</g>`)).root;
  stage.attrs.viewBox = '0 0 540 960';
  const ref = { title: 'Kışın Eşiğinde', digest: 'quality' } as MotionRef;
  const markup = renderToStaticMarkup(
    createElement(ObjectScene, { scene: { stage, ref }, frame: 30 }),
  );
  const id = /<clipPath id="([^"]*safe-frame)"/.exec(markup)?.[1];
  assert.ok(id);
  assert.match(markup, /<rect x="0" y="0" width="540" height="730"/);
  assert.match(markup, /<svg data-fixed-camera=""[^>]*viewBox="0 0 540 960"/);
  assert.match(markup, /<g id="[^"]*layer-bg"><rect/);
  assert.ok(markup.includes(`<g clip-path="url(#${id})">`));
  assert.ok(markup.includes('data-anim="fall"'));
  assert.doesNotMatch(markup, /data-shot-title|<text/);
});

test('new movement is bounded in output pixels after scale and rotation, without rejecting signed archives', () => {
  const motion = (dx: number, scale: number) =>
    svg(
      `${paths}<g transform="rotate(20) scale(${scale})"><circle cx="100" cy="400" r="20" data-anim="move" data-dx="${dx}"/></g>`,
    );
  assert.doesNotThrow(() => validateNewStage(parseStage(motion(90, 2)).root));
  const extreme = parseStage(motion(130, 2));
  assert.throws(() => validateNewStage(extreme.root), /en fazla 240 piksel/);
  assert.doesNotThrow(() => parseStage(extreme.canonical)); // Older files still play.
  const nested = svg(
    `${paths}<g data-anim="move" data-dx="120"><circle cx="100" cy="400" r="20" data-anim="move" data-dx="130"/></g>`,
  );
  assert.throws(() => validateNewStage(parseStage(nested).root), /en fazla 240 piksel/);
});

test('only explicitly marked, small, safe scientific keywords survive; headings, sentences and tricks are dropped', () => {
  const text = (value: string, attrs = 'x="50" y="500" font-size="28"') =>
    `<text data-keyword="true" ${attrs}>${value}</text>`;
  const extras = [
    text('Yalıtım'),
    text('Isı akışı', 'x="400" y="800" font-size="32"'),
    text('Üçüncü'), // maximum two
    text('Yerin altındaki sıcak toprak'),
    text('Kışın Eşiğinde'),
    '<text x="30" y="50" font-size="24">Kış</text>',
  ].join('');
  const raw = svg(paths).replace('</g></svg>', `${extras}</g></svg>`),
    parsed = parseStage(raw, undefined, {
      title: 'Kışın Eşiğinde',
      narration: 'Kışın toprak ısınır.',
    });
  assert.match(parsed.canonical, />Yalıtım<\/text>/);
  assert.match(parsed.canonical, />Isı akışı<\/text>/);
  assert.equal((parsed.canonical.match(/<text /g) ?? []).length, 2);
  assert.equal(parseStage(parsed.canonical).canonical, parsed.canonical);
  const bad = [
    text('Kışın Eşiğinde'),
    text('Bir uzun bilimsel açıklama'),
    text('Toprak', 'x="50" y="1500" font-size="28"'),
    text('Toprak', 'x="50" y="500" font-size="100"'),
    text('Toprak', 'x="50" y="500" font-size="28" transform="translate(0 500)"'),
    text('Toprak', 'x="50" y="500" font-size="28" dx="900"'),
  ];
  for (const entry of bad.slice(0, -1)) {
    const result = parseStage(svg(paths).replace('</g></svg>', `${entry}</g></svg>`), undefined, {
      title: 'Kışın Eşiğinde',
      narration: 'Kışın toprak ısınır.',
    });
    assert.doesNotMatch(result.canonical, /<text/);
  }
  // Relative offsets and dangerous attributes are stripped, not executed.
  const clean = parseStage(svg(paths).replace('</g></svg>', `${bad.at(-1)}</g></svg>`));
  assert.match(clean.canonical, />Toprak<\/text>/);
  assert.doesNotMatch(clean.canonical, /\sdx=/);
  const ref = { title: 'Kışın Eşiğinde', digest: 'keyword' } as MotionRef;
  const markup = renderToStaticMarkup(
    createElement(ObjectScene, { scene: { stage: parsed.root, ref }, frame: 0 }),
  );
  assert.match(markup, /data-science-keyword=""[^>]*>Yalıtım<\/text>/);
  assert.doesNotMatch(markup, /data-shot-title/);
});
