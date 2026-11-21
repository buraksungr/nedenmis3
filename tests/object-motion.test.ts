import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaxesParser } from 'saxes';
import { motionHeading, animKinds, type MotionRef } from '../shared/object-motion';
import { objectPose, ObjectScene } from '../composition/ObjectScene';
import { parseRig, parseStage } from '../server/motion-svg';
import { saveRig, saveMotion, motionFrame } from '../server/motion-files';
import { ObjectPlanner } from '../server/object-planner';
import { SceneModels } from '../server/scene-models';
import { Store, makeProject, scriptSig, approveBoard, hash } from '../server/store';
import { memoryVault } from '../server/vault';
import { rigReply, stageReply, lines, topic } from './ant-motion-art';
import { completion } from './vector-test-data';
const template = rigReply(),
  rig = parseRig(template.svg, template.subject).root;
const scene = (actors: string, decor = '', extra = '') =>
    `<svg viewBox="0 0 1080 1920">${decor}${actors}${extra}</svg>`,
  actor = (x: number, a = 'move', target = '#subject-main') =>
    `<use x="${x}" y="270" href="${target}" data-anim="${a}" data-dx="65"/>`;
const actors = actor(50) + actor(420),
  flakes = [1, 2, 3]
    .map((i) => `<circle cx="${120 * i}" cy="740" r="10" data-anim="fall"/>`)
    .join('');
test('complete Turkish titles, never cropped from narration', () => {
  for (const s of [
    'Donan Toprak Altı',
    'Kış Uykusu Değil',
    'Güvenli Derinlikler',
    'Isı Paylaşımı',
    'Doğanın Dayanışması',
  ])
    assert.ok(motionHeading.safeParse(s).success, s);
  for (const s of [
    'Donan Toprakta Kimler',
    'Karıncalar Kışın Uykusuna',
    'Toprağın Altındaki',
    'Yuvanın',
    'Kış Gelirken Ve',
    'Bu Başlık Çok Uzun Olsun Artık',
  ])
    assert.ok(!motionHeading.safeParse(s).success, s);
});
test('rig is a coherent reusable group: morphology and articulated parts, no recursive references', () => {
  assert.throws(
    () => parseRig(template.svg.replace('id="leg-four"', 'id="four"'), template.subject),
    /altı/,
  );
  assert.throws(
    () =>
      parseRig(
        template.svg.replaceAll('data-anim="wiggle"', 'data-anim="pulse"'),
        template.subject,
      ),
    /antenna/,
  );
  assert.throws(() => parseRig(template.svg.replace('id="subject-main"', 'id="colony"')));
  const recursive = parseRig(
    template.svg.replace('</g></defs>', '<use href="#subject-main"/></g></defs>'),
    template.subject,
  );
  assert.ok(!/<use/.test(recursive.canonical));
  assert.match(recursive.canonical, /x-nedenmis-clean=/);
  const whale =
    '<svg><defs><g id="subject-main"><path id="body" d="M5 70 Q90 20 190 75 L240 79 Q90 120 5 70Z"/><path id="tail" d="M190 75 L244 54 239 78 252 96Z"/><path id="flipper" d="M80 86 Q94 121 124 111 L105 83Z"/></g></defs></svg>';
  assert.ok(parseRig(whale, 'Mavi balina'));
  assert.throws(() => parseRig(whale.replace('id="tail"', 'id="fin"'), 'Mavi balina'));
});
test('flat or gradient sets are preserved untouched; old layer wrappers, hidden or co-located subjects cannot fake five objects', () => {
  for (const decor of [
    '<rect width="100%" height="100%" fill="#223344"/>',
    '<defs><linearGradient id="sky"><stop stop-color="#def"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sky)"/>',
  ]) {
    const v = parseStage(scene(actors, decor, flakes), rig);
    assert.equal(v.actors, 2);
    assert.equal(v.objects, 5);
    assert.equal(parseStage(v.canonical, rig).canonical, v.canonical);
  }
  for (const svg of [
    scene(actors),
    scene(actor(50) + actor(50), '', flakes),
    scene(actor(30) + actor(30000), '', flakes),
    scene(actor(50) + `<g opacity="0">${actor(450)}</g>`, '', flakes),
    scene(`<g data-anim="pulse">${actors}</g>`, '', flakes),
    scene(actors, '<rect width="100%" height="100%" data-anim="pulse"/>', flakes),
    scene(actors, '', flakes.replaceAll('fall', 'draw')),
  ])
    assert.throws(() => parseStage(svg, rig));
});
test('only the fixed local rig can be instantiated, and the error names the exact element', () => {
  const rejects: [string, RegExp][] = [
    [scene(actors, '', flakes.replace('fall', 'invented')), /<circle> için bilinmeyen data-anim/],
    [
      scene(actors, '', flakes.replace('r="10"', 'r="10" data-delay="-1"')),
      /<circle> geçersiz hareket parametresi data-delay=-1/,
    ],
    [
      scene(actors, '', flakes.replace('r="10"', 'r="10" data-dx="Infinity"')),
      /<circle> için geçersiz data-dx/,
    ],
  ];
  for (const [xml, message] of rejects) assert.throws(() => parseStage(xml, rig), message);

  // JS olay özniteliği ve harici bağlantı silinir; sahne reddedilmez.
  const cleanedEvent = parseStage(
    scene(actors, '', flakes.replace('r="10"', 'r="10" onclick="0"')),
    rig,
  );
  assert.ok(!/onclick\s*=/.test(cleanedEvent.canonical));
  assert.match(cleanedEvent.canonical, /x-nedenmis-clean=/);
  const cleanedHref = parseStage(
    scene(actor(42, 'move', 'http://example.test/s.svg#subject-main') + actor(500), '', flakes),
    rig,
  );
  assert.ok(!cleanedHref.canonical.includes('example.test'));
  assert.ok(!cleanedHref.canonical.includes('href="http'));
  assert.match(cleanedHref.canonical, /x-nedenmis-clean=/);
});

test('<use> doğrudan <svg> altında yerel referansla sorunsuz geçer; dış bağlantı temizlenir', () => {
  const v = parseStage(
    `<svg viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs><g id="subject-main"><circle id="bug" cx="5" cy="5" r="3" fill="#000"/></g></defs>
      <g id="set"><rect width="1080" height="1920" fill="#194057"/></g>
      <use href="#subject-main" x="140" y="1020" data-anim="move" data-dx="120" data-duration="2"/>
      <use href="#subject-main" x="610" y="1050" data-anim="move" data-dx="80" data-duration="3"/>
      <circle cx="240" cy="420" r="12" data-anim="fall" data-duration="4"/>
      <circle cx="580" cy="340" r="9" data-anim="fall" data-duration="5"/>
      <circle cx="810" cy="520" r="14" data-anim="wiggle" data-pivot-x="7" data-pivot-y="7" data-angle="12" data-duration="6"/>
      <g id="a1" data-anim="swing" data-pivot-x="10" data-pivot-y="10" data-angle="10" data-duration="4"><rect x="10" y="10" width="40" height="40" fill="blue"/></g>
      <g id="a2" data-anim="pulse" data-delay="0" data-duration="3"><rect x="110" y="110" width="40" height="40" fill="yellow"/></g>
    </svg>`,
    rig,
  );
  assert.equal(v.actors, 2);
  assert.ok(v.objects >= 5);
  assert.ok(v.canonical.includes('href="#subject-main"'));
  assert.equal(parseStage(v.canonical, rig).canonical, v.canonical);

  // Yer dışındaki use href silinir, sahne reddedilmez.
  const external = parseStage(
    v.canonical.replace(
      'href="#subject-main" x="140"',
      'href="http://example.test/x#subject-main" x="140"',
    ),
    rig,
  );
  assert.ok(!external.canonical.includes('example.test'));
  assert.ok(!external.canonical.includes('href="http'));
  assert.match(external.canonical, /x-nedenmis-clean=/);
});
test('unsupported but harmless SVG is sanitized into a signed scene; only active content is removed', () => {
  const dirty = scene(
    actors,
    '<title>Karıncalar</title><desc>not</desc><style>g{opacity:.4}</style>' +
      '<metadata><x/></metadata><g id="set" class="shadow">' +
      '<rect width="1080" height="1920" fill="#194057"/>' +
      '<animate attributeName="opacity" values="0;1"/>' +
      '<animateTransform attributeName="transform" type="rotate"/>' +
      '<path d="M0 0L8 8" stroke="red"><animateMotion path="M0 0"/></path>' +
      '<image href="https://example.test/a.png"/>' +
      '<foreignObject><div/></foreignObject>' +
      '<script>alert(1)</script></g>' +
      '<g id="glow" data-anim="pulse" data-duration="3">' +
      '<circle cx="640" cy="880" r="70" fill="none" stroke="#ffbe75" stroke-width="6" ' +
      'filter="url(#blur)" clip-path="url(#ring)"/></g>',
    flakes,
  );
  const v = parseStage(dirty, rig);
  assert.match(v.canonical, /x-nedenmis-clean="[^"]*&lt;image&gt; etkin içerik olarak temizlendi/);
  for (const tag of [
    '<title',
    '<desc',
    '<style',
    '<metadata',
    '<animate',
    '<animateTransform',
    '<animateMotion',
    '<image',
    '<foreignObject',
    '<script',
    'class=',
  ])
    assert.ok(!v.canonical.includes(tag), tag);
  assert.ok(v.canonical.includes('data-anim="pulse"'));
  // An undefined local filter is dropped from the shape, not treated as a scene failure.
  assert.ok(!v.canonical.includes('filter='));
  assert.match(v.canonical, /tanımsız yerel başvuru temizlendi/);
  assert.equal(parseStage(v.canonical, rig).canonical, v.canonical);
});
test('eight deterministic frame-based primitives: travel in units, looping weather, normalized trace, pivot, spring overshoot', () => {
  const at = (kind: string, f: number, extra = {}) =>
    objectPose(
      {
        tag: 'path',
        attrs: {
          'data-anim': kind,
          'data-duration': '1',
          'data-dx': '120',
          'data-dy': '60',
          'data-pivot-x': '10',
          'data-pivot-y': '20',
          ...extra,
        },
        children: [],
      },
      f,
      30,
    );
  assert.equal(animKinds.length, 8);
  assert.equal(at('move', 30, { 'data-delay': '.5' }).transform, 'translate(60 30)');
  assert.equal(at('draw', 15).reveal, 0.5);
  assert.equal(at('fall', 15).transform, 'translate(60 30)');
  assert.deepEqual(at('fall', 15), at('fall', 45));
  assert.equal(at('rise', 15).transform, 'translate(60 -30)');
  assert.ok(at('pulse', 18).opacity! < at('pulse', 3).opacity!);
  for (const k of ['swing', 'wiggle']) assert.ok(at(k, 7).transform?.endsWith(' 10 20)'));
  assert.equal(at('pop', 2, { 'data-delay': '.2' }).opacity, 0);
  assert.ok(
    Array.from({ length: 30 }, (_, f) =>
      Number(at('pop', f).transform?.match(/scale\(([^)]+)/)?.[1]),
    ).some((v) => v > 1),
  );
});
test('frame renderer: unchanged camera and set; non-colliding rig references on a dissolve; draw normalizes the actual path', () => {
  const stage = parseStage(stageReply(1).svg, rig).root,
    ref = { title: 'Güvenli Derinlikler', digest: 'demo' } as MotionRef;
  const nodes = (frame: number) => {
      const tree = renderToStaticMarkup(
        createElement(
          'div',
          {},
          ...[0, 1].map((i) =>
            createElement(ObjectScene, { key: i, scene: { rig, stage, ref }, frame }),
          ),
        ),
      );
      const tags: Record<string, string>[] = [];
      const parser = new SaxesParser();
      parser.on('opentag', (v) => {
        tags.push({ tag: v.name, ...v.attributes });
      });
      parser.write(tree).close();
      return tags;
    },
    a = nodes(0),
    b = nodes(30);
  assert.deepEqual(
    a.filter((n) => 'data-fixed-camera' in n),
    b.filter((n) => 'data-fixed-camera' in n),
  );
  assert.equal(b.filter((n) => 'data-fixed-camera' in n).length, 2);
  assert.deepEqual(
    a.filter((n) => n.id?.endsWith('set-set')),
    b.filter((n) => n.id?.endsWith('set-set')),
  );
  const ids = b.map((n) => n.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(b.filter((n) => n.tag === 'use').map((n) => n.href)).size, 2);
  for (const n of b.filter((n) => n.tag === 'use')) assert.ok(ids.includes(n.href.slice(1)));
  assert.ok(
    b.some((n) => n.tag === 'path' && n.pathLength === '1' && Number(n['stroke-dashoffset']) < 1),
  );
});

test('tekrarlanan sahne başlığı otomatik benzersiz başlıkla değiştirilir', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-title-')),
    store = new Store(dir, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, o) => {
      const sahne = JSON.parse(JSON.parse(String(o?.body)).messages[1].content).sahne ?? 0;
      return completion(
        sahne === 0
          ? rigReply()
          : sahne === 1 || sahne === 2
            ? { ...stageReply(0), title: 'Kışın Eşiğinde' }
            : stageReply(sahne - 1),
      );
    },
  );
  models.key('openrouter', 'unique-title-test');
  const planner = new ObjectPlanner(store, models, async () => {});
  let p = store.create(makeProject(topic, lines.slice(0, 2).join(' ')));
  p.scriptApproval = scriptSig(p);
  await planner.plan(p, () => {});
  const saved = store.get(p.id);
  assert.ok(saved.scenes[0].choreography && saved.scenes[1].choreography);
  assert.notEqual(saved.scenes[0].choreography!.title, saved.scenes[1].choreography!.title);
  for (const scene of saved.scenes) {
    assert.ok(motionHeading.safeParse(scene.choreography!.title).success);
    assert.ok(
      scene.choreography!.title.trim().split(' ').length >= 2 &&
        scene.choreography!.title.trim().split(' ').length <= 4,
    );
  }
  assert.equal(saved.motionWork, undefined);
});
test('content address binds scene to narration and the exact project rig; offline tampering cannot become a rendered frame', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = { provider: 'openrouter' as const, model: 'qa' },
    r = saveRig(
      root,
      { kind: 'subject-rig-v1', subject: template.subject, scriptHash: hash(topic), ...source },
      template.svg,
    ),
    s = stageReply(),
    ref = saveMotion(
      root,
      r,
      { kind: 'objects-v1', title: s.title, narrationHash: hash(lines[0]), ...source },
      s.svg,
    );
  assert.equal(motionFrame(root, r, ref, lines[0]).ref.objects, 23);
  assert.throws(() => motionFrame(root, r, ref, lines[1]));
  assert.throws(() => motionFrame(root, { ...r, subject: 'Başka özne' }, ref, lines[0]));
  assert.throws(() => motionFrame(root, r, { ...ref, title: 'Sahte Çizim' }, lines[0]));
  fs.appendFileSync(path.join(root, 'media', 'motion', r.digest + '.svg'), ' ');
  assert.throws(() => motionFrame(root, r, ref, lines[0]));
});
test('one broken middle heading: two repairs, later sibling saved, reload and retry only the missing shot and never request the rig again', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-plan-')),
    store = new Store(dir, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const calls: number[] = [];
  let bad = true;
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_, o) => {
      const q = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
      calls.push(q.sahne ?? 0);
      return completion(
        q.sahne
          ? {
              ...stageReply(q.sahne - 1),
              ...(bad && q.sahne === 2
                ? { title: q.onarım ? 'Karıncalar Kışın Uykusuna' : 'Donan Toprakta Kimler' }
                : {}),
            }
          : template,
      );
    },
  );
  models.key('openrouter', 'offline-drawing-test');
  const planner = new ObjectPlanner(store, models, async () => {});
  let p = store.create(makeProject(topic, lines.slice(0, 3).join(' ')));
  p.scriptApproval = scriptSig(p);
  await assert.rejects(
    planner.plan(p, () => {}),
    /1 sahne/,
  );
  p = store.get(p.id);
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3]);
  const before = p.scenes.map((s) => s.choreography?.digest);
  assert.ok(before[0] && !before[1] && before[2]);
  assert.throws(() => approveBoard(p));
  bad = false;
  await planner.plan(p, () => {}, p.scenes[1]);
  assert.deepEqual(calls, [0, 1, 2, 2, 2, 3, 2]);
  assert.equal(p.motionWork, undefined);
  approveBoard(p);
  const sig = p.boardApproval;
  await planner.plan(p, () => {});
  assert.equal(p.boardApproval, sig);
  assert.equal(p.scenes[0].choreography?.digest, before[0]);
  assert.equal(p.scenes[2].choreography?.digest, before[2]);
  assert.equal(calls.length, 7);
});
test('an allowed filter/clip/mask/pattern is rendered by React, never stripped to text or rejected', () => {
  const stage = parseStage(
    `<svg viewBox="0 0 1080 1920">
      <defs>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="3" dy="4" stdDeviation="2.5" flood-color="#081528"/>
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
        </filter>
        <clipPath id="ring"><circle cx="540" cy="700" r="90"/></clipPath>
        <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2" fill="#ffbe75"/>
        </pattern>
      </defs>
      <g id="set"><rect width="1080" height="1920" fill="url(#dots)"/></g>
      <path id="halo" d="M420 600Q540 520 660 600Z" fill="none" stroke="#ffbe75" stroke-width="8"
            filter="url(#soft)" clip-path="url(#ring)" data-anim="pulse"/>
      ${actors.replaceAll('data-anim="move"', 'data-anim="move"')}
      ${flakes}
    </svg>`,
    rig,
  ).root;
  const tree = renderToStaticMarkup(
    createElement(ObjectScene, {
      scene: { rig, stage, ref: { title: 'Güvenli Derinlikler', digest: 'filters' } as MotionRef },
      frame: 12,
    }),
  );
  for (const expected of [
    '<filter',
    '<feDropShadow dx="3" dy="4" stdDeviation="2.5" flood-color="#081528">',
    '<feGaussianBlur in="SourceAlpha" stdDeviation="2">',
    '<clipPath',
    'clip-path="url(#',
    '<pattern',
    'filter="url(#',
  ])
    assert.ok(tree.includes(expected), expected);
});
test('the reported regression: title/style/animate/text no longer stop a storyboard; <mask> is named if truly invalid', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-sanitize-')),
    store = new Store(dir, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const replied = `<svg viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <title>Kışın Eşiği</title><desc>model açıklaması</desc><metadata>x</metadata>
    <style>.a { opacity: .5; }</style>
    <defs><linearGradient id="sky"><stop stop-color="#194057"/></linearGradient></defs>
    <g id="set"><rect width="1080" height="1920" fill="url(#sky)"/>
      <animate attributeName="opacity" values="0;1"/>
      <text x="30" y="60" font-size="24">kış</text></g>
    ${stageReply(0)
      .svg.replace(/^<svg[^>]*>/, '')
      .replace('</svg>', '')}
  </svg>`;
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, o) =>
      completion(
        JSON.parse(JSON.parse(String(o?.body)).messages[1].content).sahne === 1
          ? { title: 'Kışın Eşiği', svg: replied }
          : template,
      ),
  );
  models.key('openrouter', 'sanitize-regression');
  const planner = new ObjectPlanner(store, models, async () => {}),
    p = store.create(makeProject(topic, lines[0]));
  p.scriptApproval = scriptSig(p);
  await planner.plan(p, () => {});
  const saved = store.get(p.id);
  assert.equal(saved.motionWork, undefined);
  assert.ok(saved.scenes[0].choreography);
  const frame = motionFrame(
    store.dir(p.id),
    saved.subjectRig,
    saved.scenes[0].choreography,
    lines[0],
  );
  assert.ok(frame.stage.children.length > 1);
  // The signed file records what was removed; the renderer only receives safe geometry.
  assert.match(saved.scenes[0].choreography!.digest, /^[0-9a-f]{64}$/);
  const file = fs.readFileSync(
    path.join(store.dir(p.id), 'media', 'motion', saved.scenes[0].choreography!.digest + '.svg'),
    'utf8',
  );
  assert.match(file, /x-nedenmis-clean=/);
  assert.doesNotMatch(file, /<(?:style|animate|text|title|desc|metadata)/);

  // Yanlış yerleştirilmiş <mask> (doğrudan <svg> altında) sahneyi reddetmez;
  // sanitizer içeriği temizleyip kaydeder.
  const cleanedMask = parseStage(
    replied.replace('<defs>', '<mask><g/></mask><defs>'),
    parseRig(template.svg, template.subject).root,
  );
  assert.ok(!/<mask/.test(cleanedMask.canonical));
  assert.match(cleanedMask.canonical, /x-nedenmis-clean=/);
});
