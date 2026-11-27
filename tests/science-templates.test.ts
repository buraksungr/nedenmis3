import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { objectPose } from '../composition/ObjectScene';
import { scienceLabel, scienceValue } from '../shared/science-label';
import type { Geometry } from '../shared/vector';
import type { MotionRef } from '../shared/object-motion';
import { parseStage, validateNewStage } from '../server/motion-svg';
import { motionFrame, saveMotion } from '../server/motion-files';
import { ObjectPlanner } from '../server/object-planner';
import { assertDistinctAdjacentTemplates } from '../server/template-guard';
import { imageKey, readyVisual } from '../server/visual-ready';
import { blankScene } from '../shared/schema';
import { SceneModels } from '../server/scene-models';
import { narrationHash } from '../server/vector-files';
import { Store, makeProject, scriptSig } from '../server/store';
import { memoryVault } from '../server/vault';
import {
  templateIds,
  scienceCatalog,
  scienceTheme,
  palettes,
  accents,
  templateReply,
  instantiateTemplate,
  templateIdInStage,
  matchingTemplates,
  selectTemplate,
  type TemplateId,
} from '../server/science-templates';
import { completion } from './vector-test-data';
import { lines, titles, topic } from './ant-motion-art';

const all = (n: Geometry): Geometry[] => [n, ...n.children.flatMap(all)];

test('all 33 distinct authored templates are safe, detailed, layered and deterministic for every palette and accent', () => {
  assert.ok(templateIds.length >= 25);
  const unique = new Set<string>();
  for (const id of templateIds) {
    let base = '';
    for (const palette of palettes)
      for (const accent of accents)
        for (const level of [0, 100]) {
          const reply = {
              title: 'Bilimsel Bakış',
              template: id,
              palette,
              accent,
              level,
              direction: 'reverse' as const,
            },
            xml = instantiateTemplate(id, reply, ''),
            result = parseStage(xml);
          assert.equal(result.root.attrs.viewBox, '0 0 1080 1920', id);
          assert.equal(result.cleanup, '', `${id} required sanitizer repair`);
          assert.equal(
            parseStage(result.canonical).canonical,
            result.canonical,
            `${id} canonical stability`,
          );
          assert.equal(templateIdInStage(result.root), id);
          assert.ok(result.actors >= 3 && result.actors <= 160, id);
          assert.doesNotThrow(
            () => validateNewStage(result.root),
            `${id}: ${palette}/${accent}/${level}`,
          );
          const background = result.root.children.find((n) => n.attrs.id === 'layer-bg')!;
          const full = background.children.find((n) => n.tag === 'rect')!;
          assert.equal(full.attrs.width, '1080');
          assert.equal(full.attrs.height, '1920');
          assert.ok(!full.attrs['data-anim'] && !background.attrs['data-anim']);
          const main = result.root.children.find((n) => n.attrs.id === 'layer-main')!;
          assert.ok(
            all(main).filter((n) => n.tag === 'path').length >= 3,
            `${id}: inadequate authored paths`,
          );
          for (const n of all(result.root).filter((n) =>
            ['move', 'sway'].includes(n.attrs['data-anim']),
          )) {
            assert.ok(
              Math.hypot(Number(n.attrs['data-dx'] ?? 0), Number(n.attrs['data-dy'] ?? 0)) <= 240,
              id,
            );
          }
          if (!base) base = result.canonical.replace(`tpl-v175-${id}`, 'tpl-v175-template');
        }
    unique.add(base);
    assert.equal(
      instantiateTemplate(id, { title: 'Bilimsel Bakış', template: id }, ''),
      instantiateTemplate(id, { title: 'Bilimsel Bakış', template: id }, ''),
    );
  }
  assert.equal(unique.size, templateIds.length, 'geometry, not just IDs, must differ');
});

test('prism rays meet the actual faces and bend toward the base on exit', () => {
  const svg = instantiateTemplate(
    'refraction',
    { title: 'Işığın Kırılması', template: 'refraction' },
    '',
  );
  const nodes = all(parseStage(svg).root);
  const path = (id: string) => {
    const d = nodes.find((n) => n.attrs.id === id)?.attrs.d;
    assert.ok(d, id);
    return d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  };
  const [ix, iy, ax, ay, bx, by] = path('incident-ray');
  const [rx, ry, ex, ey] = path('refracted-ray');
  const leftFace = 356 + ((899 - ay) * (540 - 356)) / (899 - 504);
  const rightFace = 540 + ((by - 504) * (740 - 540)) / (899 - 504);
  assert.ok(Math.abs(ax - leftFace) < 1 && Math.abs(bx - rightFace) < 1);
  assert.deepEqual([rx, ry], [bx, by]);
  const incidentSlope = (ay - iy) / (ax - ix),
    insideSlope = (by - ay) / (bx - ax),
    emergingSlope = (ey - ry) / (ex - rx);
  assert.ok(
    insideSlope > incidentSlope && emergingSlope > insideSlope,
    'the beam bends toward the entry normal and then toward the prism base',
  );
});

test('numbers and labels are bounded, escaped by grammar, sourced from narration and do not become headings', () => {
  for (const s of ['Işık', 'Göz bebeği', '-10°C', '+2.5%', '12 cm', 'DNA'])
    assert.ok(scienceLabel(s), s);
  for (const s of ['-10°C', '+2.5%', '12cm']) assert.ok(scienceValue(s), s);
  for (const s of [
    '',
    'a b c',
    '<script>',
    'a&b',
    'https://x',
    '1e300',
    '-10000°C',
    '20°C!',
    'x\ntext',
    'a'.repeat(29),
  ])
    assert.ok(!scienceLabel(s), s);
  for (const change of [
    { template: 'eye-front', title: 'Göz Bebeği', svg: '<svg/>' },
    { template: 'eye-front', title: 'Göz Bebeği', level: 101 },
    { template: 'eye-front', title: 'Göz Bebeği', label1: '<script>' },
    { template: 'eye-front', title: 'Göz Bebeği', accent: '#000' },
  ])
    assert.ok(!templateReply.safeParse(change).success, JSON.stringify(change));
  const reply = templateReply.parse({
    title: 'Göz Bebeği',
    template: 'eye-front',
    label1: 'Işık',
    value: '-10°C',
  });
  const texts = (source: string) =>
    all(parseStage(instantiateTemplate('eye-front', reply, source)).root)
      .filter((n) => n.tag === 'text')
      .map((n) => n.text);
  assert.deepEqual(texts('Işık ve -10°C'), ['Işık', '-10°C']);
  assert.deepEqual(texts('Işık 100°C'), ['Işık']);
  assert.deepEqual(texts('Başka bir anlatım'), []);
  const withEditorial = parseStage(
    instantiateTemplate('eye-front', reply, 'Işık -10°C'),
    undefined,
    { title: 'Işık', narration: 'Başka bir metin' },
  );
  assert.deepEqual(
    all(withEditorial.root)
      .filter((n) => n.tag === 'text')
      .map((n) => n.text),
    ['-10°C'],
  );
});

test('flow reverses only when opted in; fixed biological flow and signed legacy motion retain direction', () => {
  const pose = (attrs: Record<string, string>) =>
    objectPose({ tag: 'path', attrs, children: [] }, 24, 30, 1, true).flow;
  assert.equal(pose({ 'data-anim': 'flow', 'data-duration': '2' }), 0.4);
  assert.equal(pose({ 'data-anim': 'flow', 'data-duration': '2', 'data-dx': '-1' }), 0.4);
  const node = {
    tag: 'path',
    attrs: { 'data-anim': 'flow', 'data-duration': '2', 'data-flow-direction': '-1' },
    children: [],
  };
  assert.equal(objectPose(node, 24, 30).flow, -0.4);
  const fixed = parseStage(
    instantiateTemplate(
      'eye-cross',
      { title: 'Göz Bebeği', template: 'eye-cross', direction: 'reverse' },
      '',
    ),
  );
  const reversible = parseStage(
    instantiateTemplate(
      'orbit',
      { title: 'Uzay Yolculuğu', template: 'orbit', direction: 'reverse' },
      '',
    ),
  );
  assert.ok(
    all(fixed.root)
      .filter((n) => n.attrs['data-anim'] === 'flow')
      .every((n) => n.attrs['data-flow-direction'] === '1'),
  );
  assert.ok(all(reversible.root).some((n) => n.attrs['data-flow-direction'] === '-1'));
});

test('selection never forces a different scientific subject and cannot repeat either signed neighbor', () => {
  const ant = matchingTemplates(
    'Karıncalar birden gözden kaybolur.',
    'Karıncalar kışın nereye gider?',
  );
  assert.ok(ant.some((e) => e.id === 'soil-colony'));
  assert.ok(!ant.some((e) => e.id === 'eye-front' || e.id === 'eye-cross'), 'gözden is an idiom');
  const unknown = matchingTemplates('Bir taş eski çağda bulundu.', 'Tarih merakı');
  assert.ok(unknown.every((e) => e.category === 'diagram'));
  assert.equal(unknown.length, 8);
  assert.ok(templateReply.safeParse({ template: 'not-a-template', title: 'Göz Bebeği' }).success);
  assert.equal(
    templateReply.parse({ template: { unsafe: true }, title: 'Göz Bebeği' }).template,
    '',
  );
  assert.ok(unknown.some((e) => e.id === selectTemplate('heart', unknown, new Set(), new Set())));
  const eye = matchingTemplates('Göz bebeği genişler.', 'Göz anatomisi');
  assert.ok(!eye.some((e) => e.id === 'dna'), 'genişler is not genetics');
  assert.ok(
    !matchingTemplates('Kanal boyunca yürür.', 'Tarih').some((e) => e.id === 'circulation'),
    'kanal is not blood',
  );
  assert.equal(selectTemplate('overview', eye, new Set(), new Set()), 'eye-front');
  assert.ok(
    matchingTemplates('Küçük örnekler incelenir.', 'Mikroskop nasıl çalışır?').some(
      (e) => e.id === 'microscope',
    ),
    'generic subject matching also considers the project topic',
  );
  for (const before of templateIds)
    for (const after of templateIds) {
      const selected = selectTemplate(
        'heart',
        unknown,
        new Set(templateIds),
        new Set([before, after]),
      );
      assert.notEqual(selected, before);
      assert.notEqual(selected, after);
    }
});

test('partial retry, reload and targeted redraw respect BOTH neighbors and preserve untouched signed scenes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'science-selection-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let failed = true,
    requested: TemplateId = 'soil-colony';
  const calls: { scene: number; repair?: string }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, o) => {
      const q = JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
      calls.push({ scene: q.sahne, repair: q.onarım });
      if (failed && q.sahne === 2)
        return completion({ title: titles[1], svg: '<svg>not allowed</svg>' });
      return completion({ title: titles[q.sahne - 1], template: requested });
    },
  );
  models.key('openrouter', 'selection-fixture');
  const planner = new ObjectPlanner(store, models, async () => {});
  let p = store.create(makeProject(topic, lines.slice(0, 4).join(' ')));
  p.scriptApproval = scriptSig(p);
  await assert.rejects(
    planner.plan(p, () => {}),
    /1 sahne/,
  );
  p = store.get(p.id);
  assert.ok(p.scenes[0].choreography && !p.scenes[1].choreography && p.scenes[2].choreography);
  const getId = (index: number) =>
    templateIdInStage(
      motionFrame(store.dir(p.id), p.scenes[index].choreography, p.scenes[index].narration).stage,
    )!;
  requested = getId(2); // A weak model explicitly asks for the NEXT already-saved template.
  failed = false;
  const before = p.scenes.map((s) => s.choreography?.digest);
  await planner.plan(p, () => {}, p.scenes[1]);
  assert.notEqual(getId(1), getId(0));
  assert.notEqual(getId(1), getId(2));
  assert.equal(p.scenes[0].choreography?.digest, before[0]);
  assert.equal(p.scenes[2].choreography?.digest, before[2]);
  for (const target of [1, 0, 3]) {
    p = store.get(p.id);
    requested = getId(target === 0 ? 1 : target - 1);
    const preserved = p.scenes.map((s) => s.choreography!.digest);
    await planner.plan(p, () => {}, p.scenes[target], 'Farklı bir görünüm seç.');
    if (target > 0) assert.notEqual(getId(target), getId(target - 1));
    if (target + 1 < p.scenes.length) assert.notEqual(getId(target), getId(target + 1));
    p.scenes.forEach((s, i) => {
      if (i !== target) assert.equal(s.choreography!.digest, preserved[i]);
    });
  }
  assert.ok(calls.some((q) => q.repair?.includes('JSON Şema Hatası')));
  assert.equal(p.motionWork, undefined);
});

test('nearest verified scenes prevent repeats across unfinished draft gaps and full planning repairs them', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'science-draft-gaps-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const calls: { sahne: number; yasakKomşuŞablonlar: TemplateId[] }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_url, opts) => {
      const q = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content);
      calls.push(q);
      return completion({ title: titles[q.sahne - 1], template: 'soil-colony' });
    },
  );
  models.key('openrouter', 'offline-gap-fixture');
  const planner = new ObjectPlanner(store, models, async () => {});
  const p = makeProject(topic, lines.slice(0, 3).join(' '));
  p.scenes = lines.slice(0, 3).map((narration) => ({
    ...blankScene(randomUUID()),
    narration,
    visualMode: 'motion-svg' as const,
  }));
  store.create(p);
  p.scriptApproval = scriptSig(p);
  for (const i of [0, 2]) {
    const scene = p.scenes[i];
    scene.choreography = saveMotion(
      store.dir(p.id),
      {
        kind: 'objects-v2',
        title: titles[i],
        narrationHash: narrationHash(scene.narration),
        provider: 'openrouter',
        model: 'offline-gap-fixture',
      },
      instantiateTemplate(
        'soil-colony',
        { title: titles[i], template: 'soil-colony' },
        scene.narration,
      ),
    );
  }
  store.save(p);
  const id = (i: number) =>
    templateIdInStage(
      motionFrame(store.dir(p.id), p.scenes[i].choreography, p.scenes[i].narration).stage,
    );
  assert.throws(
    () => assertDistinctAdjacentTemplates(store.dir(p.id), [p.scenes[0], p.scenes[2]]),
    /aynı şablon/,
  );
  const firstDigest = p.scenes[0].choreography!.digest;
  const duplicate = p.scenes[2].choreography!;
  await planner.plan(p, () => {}, p.scenes[2], 'Daha yavaş hareket.');
  assert.ok(calls.at(-1)!.yasakKomşuŞablonlar.includes('soil-colony'));
  assert.notEqual(id(0), id(2), 'the skipped middle scene must not hide the prior ready template');
  assert.equal(p.scenes[0].choreography!.digest, firstDigest);
  assert.doesNotThrow(() =>
    assertDistinctAdjacentTemplates(store.dir(p.id), [p.scenes[0], p.scenes[2]]),
  );
  await planner.plan(p, () => {}, p.scenes[1]);
  assert.notEqual(id(1), id(0));
  assert.notEqual(id(1), id(2));
  // A full resume detects an existing duplicate across a missing scene too.
  delete p.scenes[1].choreography;
  p.scenes[2].choreography = duplicate;
  store.save(p);
  await planner.plan(p, () => {});
  assert.equal(p.scenes[0].choreography!.digest, firstDigest);
  assert.notEqual(id(0), id(1));
  assert.notEqual(id(1), id(2));
  assert.doesNotThrow(() => assertDistinctAdjacentTemplates(store.dir(p.id), p.scenes));
});

test('verified 1.7.2 and ready image scenes separate identical templates; missing images do not', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'science-legacy-gap-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const archiveDir = path.join('tests', 'fixtures', 'legacy-motion');
  const old = JSON.parse(fs.readFileSync(path.join(archiveDir, 'v1.7.2.json'), 'utf8')) as {
    sourceCommit: string;
    narration: string;
    ref: MotionRef;
  };
  assert.equal(old.sourceCommit, '3a32f6d89345db482c693b0330cf8731545cab4c');
  const narrations = [lines[0], old.narration, lines[2]];
  const p = makeProject(topic, narrations.join(' '));
  p.scenes = narrations.map((narration) => ({
    ...blankScene(randomUUID()),
    narration,
    visualMode: 'motion-svg' as const,
  }));
  store.create(p);
  p.scriptApproval = scriptSig(p);
  const projectRoot = store.dir(p.id);
  const templateRefs = [0, 2].map((i) => {
    const scene = p.scenes[i],
      title = titles[i];
    const ref = saveMotion(
      projectRoot,
      {
        kind: 'objects-v2',
        title,
        narrationHash: narrationHash(scene.narration),
        provider: 'openrouter',
        model: 'offline-legacy-separator',
      },
      instantiateTemplate('soil-colony', { title, template: 'soil-colony' }, scene.narration),
    );
    scene.choreography = ref;
    return ref;
  });
  const archiveFile = path.join(projectRoot, 'media', 'motion', `${old.ref.digest}.svg`);
  fs.copyFileSync(path.join(archiveDir, 'v1.7.2.svg'), archiveFile);
  p.scenes[1].choreography = old.ref;
  const originalBytes = fs.readFileSync(archiveFile);
  store.save(p);
  const calls: { sahne: number; yasakKomşuŞablonlar: TemplateId[] }[] = [];
  const models = new SceneModels(
    store,
    { groq: memoryVault(), openrouter: memoryVault() },
    async (_u, opts) => {
      const q = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content);
      calls.push(q);
      return completion({ title: titles[q.sahne - 1], template: 'soil-colony' });
    },
  );
  models.key('openrouter', 'legacy-separator-fixture');
  const planner = new ObjectPlanner(store, models, async () => {});
  assert.deepEqual(readyVisual(projectRoot, p, p.scenes[1]), { template: undefined });
  assert.doesNotThrow(() => assertDistinctAdjacentTemplates(projectRoot, p.scenes));
  await planner.plan(p, () => {});
  assert.equal(
    calls.length,
    0,
    'full resume must not rewrite non-adjacent templates or legacy scene',
  );
  assert.deepEqual([p.scenes[0].choreography, p.scenes[2].choreography], templateRefs);
  assert.deepEqual(p.scenes[1].choreography, old.ref);
  assert.deepEqual(fs.readFileSync(archiveFile), originalBytes);
  await planner.plan(p, () => {}, p.scenes[2], 'Daha yavaş hareket.');
  assert.ok(
    !calls.at(-1)!.yasakKomşuŞablonlar.includes('soil-colony'),
    'legacy is the real prior neighbor',
  );
  assert.deepEqual(p.scenes[1].choreography, old.ref);

  // The same distinction applies to an actual cached photo, not merely signed motion.
  p.scenes[1].visualMode = 'photo';
  delete p.scenes[1].choreography;
  const photo = path.join(projectRoot, 'media', 'legacy-photo.png');
  fs.copyFileSync('tests/fixtures/still-a.png', photo);
  p.assets[p.scenes[1].id] = {
    image: { file: 'media/legacy-photo.png', key: imageKey(p, p.scenes[1]) },
  };
  p.scenes[2].choreography = templateRefs[1];
  store.save(p);
  assert.deepEqual(readyVisual(projectRoot, p, p.scenes[1]), {});
  assert.doesNotThrow(() => assertDistinctAdjacentTemplates(projectRoot, p.scenes));
  await planner.plan(p, () => {}, p.scenes[2], 'Daha yavaş hareket.');
  assert.ok(
    !calls.at(-1)!.yasakKomşuŞablonlar.includes('soil-colony'),
    'ready photo is a separator',
  );
  // If the photo disappears, a partial draft skips it and the surrounding templates are adjacent.
  fs.rmSync(photo);
  p.scenes[2].choreography = templateRefs[1];
  store.save(p);
  assert.equal(readyVisual(projectRoot, p, p.scenes[1]), undefined);
  assert.throws(
    () => assertDistinctAdjacentTemplates(projectRoot, [p.scenes[0], p.scenes[2]]),
    /aynı şablon/,
  );
  await planner.plan(p, () => {}, p.scenes[2], 'Daha yavaş hareket.');
  assert.ok(
    calls.at(-1)!.yasakKomşuŞablonlar.includes('soil-colony'),
    'missing photo must be skipped',
  );
  assert.notEqual(
    templateIdInStage(
      motionFrame(projectRoot, p.scenes[2].choreography, p.scenes[2].narration).stage,
    ),
    'soil-colony',
  );
});

test('all 33 stable IDs have explicit bilingual usage contracts and concrete terms match in both languages', () => {
  assert.equal(templateIds.length, 33);
  assert.equal(scienceCatalog.length, 33);
  assert.deepEqual(new Set(scienceCatalog.map((e) => e.id)), new Set(templateIds));
  for (const entry of scienceCatalog) {
    assert.ok(entry.category && entry.scope.length > 12, entry.id);
    assert.ok(entry.keywords.tr.length && entry.keywords.en.length, entry.id);
  }
  const words: [TemplateId, string, string][] = [
    ['eye-front', 'Göz bebeği', 'human eye'],
    ['eye-cross', 'retina', 'cornea'],
    ['brain', 'beyin', 'brain'],
    ['neuron', 'nöron', 'axon'],
    ['heart', 'kalbin atışı', 'cardiac heartbeat'],
    ['circulation', 'kan dolaşımı', 'blood circulation'],
    ['cell', 'hücre', 'cell'],
    ['dna', 'genetik', 'chromosome'],
    ['lung', 'akciğer', 'respiration'],
    ['muscle-joint', 'eklem', 'bone'],
    ['soil-colony', 'karınca', 'ant'],
    ['ant-tunnel', 'karınca', 'ant'],
    ['colony-chamber', 'karınca', 'ant'],
    ['atmosphere', 'atmosfer', 'atmosphere'],
    ['ocean-depth', 'deniz', 'ocean'],
    ['water-cycle', 'yağmur', 'cloud'],
    ['plant', 'bitki', 'plant'],
    ['photosynthesis', 'fotosentez', 'photosynthesis'],
    ['refraction', 'prizma', 'prism'],
    ['magnetism', 'mıknatıs', 'magnet'],
    ['electricity', 'elektrik', 'circuit'],
    ['orbit', 'yörünge', 'orbit'],
    ['gravity', 'yerçekimi', 'gravity'],
    ['sound', 'ses', 'acoustic'],
    ['thermal', 'sıcaklık', 'temperature'],
  ];
  for (const [id, tr, en] of words)
    for (const word of [tr, en])
      assert.ok(
        matchingTemplates(word, 'Bilim').some((e) => e.id === id),
        `${id}: ${word}`,
      );
  for (const term of ['kara delik', 'kara deliğin', 'black hole', 'black-hole', 'event horizon'])
    assert.equal(scienceTheme(term, ''), 'black-hole', term);
  assert.equal(scienceTheme('Gözden kaybolan ışık', 'Kara delikler'), 'black-hole');
  assert.equal(scienceTheme('Yıldızın ışığı bükülür.', 'Kara delikler'), 'black-hole');
  assert.equal(scienceTheme('Astronotun kalbi hızlanır.', 'Uzay yolculuğu'), 'heart');
  assert.ok(
    matchingTemplates('Astronotun kalbi hızlanır.', 'Uzay yolculuğu').some((e) => e.id === 'heart'),
  );
  assert.equal(scienceTheme('Retina ışığı algılar.', 'Kara delikler'), 'other');
});

test('topic-safe variants stay unique until all relevant choices are used, then still forbid neighbors', () => {
  const cases = [
    {
      topic: 'Kara deliğin ışığı nasıl büktüğü',
      scene: 'Işık olay ufkuna yaklaşır.',
      theme: 'black-hole',
      primary: ['orbit', 'gravity'],
      marker: 'black-hole-horizon',
    },
    {
      topic: 'Black holes and accretion disks',
      scene: 'Light bends around the horizon.',
      theme: 'black-hole',
      primary: ['orbit', 'gravity'],
      marker: 'black-hole-horizon',
    },
    {
      topic: 'Kalbin çalışma ritmi',
      scene: 'Kan damarlara pompalanır.',
      theme: 'heart',
      primary: ['heart', 'circulation'],
      marker: 'heart',
    },
    {
      topic: 'Karıncalar kışın nereye gider?',
      scene: 'Koloni toprağın altında bekler.',
      theme: 'ant',
      primary: ['soil-colony', 'ant-tunnel', 'colony-chamber'],
      marker: 'ant-',
    },
  ] as const;
  for (const { topic, scene, theme, primary, marker } of cases) {
    assert.equal(scienceTheme(scene, topic), theme);
    const options = matchingTemplates(scene, topic),
      used = new Set<TemplateId>();
    assert.deepEqual(
      options.slice(0, primary.length).map((e) => e.id),
      [...primary],
    );
    assert.ok(
      !options.some((e) => e.id === 'eye-front' || e.id === 'eye-cross' || e.id === 'refraction'),
    );
    let previous: TemplateId | undefined;
    for (let i = 0; i < options.length; i++) {
      const chosen = selectTemplate(
        'eye-front',
        options,
        used,
        new Set(previous ? [previous] : []),
      );
      assert.ok(!used.has(chosen), `${topic}: reused ${chosen} with an unused relevant view`);
      const xml = instantiateTemplate(
        chosen,
        { title: 'Bilimsel Bakış', template: 'bogus' },
        `${scene} ${topic}`,
        theme,
      );
      const result = parseStage(xml);
      assert.equal(result.cleanup, '', `${topic}/${chosen}`);
      assert.doesNotThrow(
        () => validateNewStage(result.root, { topic, narration: scene }),
        `${topic}/${chosen}`,
      );
      assert.ok(xml.includes(marker), `${topic}/${chosen}: no subject-specific art`);
      assert.ok(!xml.includes('science-detail'), `${topic}/${chosen}: detached panel`);
      assert.ok(!xml.includes('tpl-v175-eye-') && !xml.includes('tpl-v175-refraction'));
      used.add(chosen);
      previous = chosen;
    }
    const reused = selectTemplate('missing-id', options, used, new Set([previous!]));
    assert.notEqual(reused, previous);
  }
});

test('invalid or unrelated provider IDs use project-and-scene context without repair, including reload and redraw', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'science-context-fallback-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const stories = [
    {
      topic: 'Kara deliğin çevresinde ışık',
      lines: [
        'Kara delik ışığı büker.',
        'Madde yörüngede dolanır.',
        'Bir ışın merkeze yaklaşır.',
        'Çevresindeki disk hızla döner.',
        'Olay ufku sınırı belirler.',
      ],
      marker: 'black-hole-horizon',
    },
    {
      topic: 'Kalbin kan dolaşımındaki görevi',
      lines: [
        'Kalp kanı pompalar.',
        'Damarlar kanı taşır.',
        'Döngü ritmik biçimde sürer.',
        'Kan tekrar geri döner.',
        'Bu süreç yaşamı destekler.',
      ],
      marker: 'heart',
    },
    {
      topic: 'Karıncalar ve yeraltı kolonisi',
      lines: [
        'Karıncalar yer altında yaşar.',
        'İşçiler tünelden geçer.',
        'Koloni odalarda toplanır.',
        'Yuva sıcaklığı korunur.',
        'İşçiler yeniden dışarı çıkar.',
      ],
      marker: 'ant-',
    },
  ];
  const headings = [
    'Bilimsel Başlangıç',
    'Hareketli Akış',
    'Yakın Çevre',
    'Düzenli Süreç',
    'Son Görünüm',
  ];
  for (const story of stories) {
    const calls: { sahne: number; onarım?: string; kullanılanŞablonlar: TemplateId[] }[] = [];
    const replies: unknown[] = ['not-a-template', 'eye-front', 'cell', 'overview', null];
    const models = new SceneModels(
      store,
      { groq: memoryVault(), openrouter: memoryVault() },
      async (_u, opts) => {
        const q = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content);
        calls.push(q);
        return completion({ title: headings[q.sahne - 1], template: replies[q.sahne - 1] });
      },
    );
    models.key('openrouter', 'context-fixture');
    const planner = new ObjectPlanner(store, models, async () => {});
    let project = store.create(makeProject(story.topic, story.lines.join(' ')));
    project.scriptApproval = scriptSig(project);
    await planner.plan(project, () => {});
    assert.equal(calls.length, 5, `${story.topic}: invalid ID must not trigger repair`);
    assert.ok(calls.every((q) => !q.onarım));
    const ids = () =>
      project.scenes.map((s) => {
        const frame = motionFrame(store.dir(project.id), s.choreography, s.narration);
        assert.ok(JSON.stringify(frame.stage).includes(story.marker));
        return templateIdInStage(frame.stage)!;
      });
    assert.equal(new Set(ids()).size, 5);
    assert.ok(ids().every((id) => !['eye-front', 'eye-cross', 'refraction', 'cell'].includes(id)));
    project = store.get(project.id);
    const before = project.scenes.map((s) => s.choreography!.digest);
    await planner.plan(project, () => {}, project.scenes[2], 'Farklı bir görünüm.');
    assert.equal(new Set(ids()).size, 5);
    assert.notEqual(project.scenes[2].choreography!.digest, before[2]);
    project.scenes.forEach((s, i) => {
      if (i !== 2) assert.equal(s.choreography!.digest, before[i]);
    });
    delete project.scenes[1].choreography;
    store.save(project);
    project = store.get(project.id);
    await planner.plan(project, () => {}, project.scenes[1]);
    assert.equal(new Set(ids()).size, 5);
    assert.ok(calls.at(-1)!.kullanılanŞablonlar.length >= 4);
  }
});
