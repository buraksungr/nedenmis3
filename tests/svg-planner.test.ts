import thirst from './fixtures/thirst.json';
import flight from './fixtures/flight.json';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { z } from 'zod';
import { defaultSvg, diagramLabels, displayPlan, storyboardPlans } from '../shared/svg-story';
import { catalogue, icons, svgPlanSchema, templates, type LegacySvgPlan } from '../shared/svg';
import { blankScene, normalize } from '../shared/schema';
import { Store, makeProject, scriptSig, approveBoard, approved } from '../server/store';
import { SvgPlanner } from '../server/svg-planner';
import { memoryVault } from '../server/vault';
import { invalidate } from '../server/invalidate';
import { imageKey, voiceKey } from '../server/production';
function setup(t: TestContext, transport: typeof fetch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-svg-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const keys = { groq: memoryVault(), openrouter: memoryVault() },
    planner = new SvgPlanner(store, keys, transport);
  const p = makeProject(
    'Kış',
    'Toprak yüzeyi karla kaplanır. Sıcaklık -5 dereceden +4 dereceye çıkar.',
  );
  p.scriptApproval = scriptSig(p);
  return { store, planner, p, keys };
}
const valid = defaultSvg('Toprakta kök gelişimi.');
test('strict JSON Schema branches require meaningful headings and every template-specific slot', () => {
  const json = z.toJSONSchema(svgPlanSchema);
  assert.equal(templates.length, 12);
  assert.equal(icons.length, 20);
  assert.equal(json.oneOf?.length, templates.length);
  assert.ok(json.oneOf?.every((b) => typeof b === 'object' && b.additionalProperties === false));
  for (const t of templates) {
    const p = defaultSvg('Toprakta kök gelişimi.', 0, '', t),
      [min, max] = catalogue[t].slots;
    assert.ok(svgPlanSchema.safeParse(p).success, t);
    assert.equal(
      svgPlanSchema.safeParse({ ...p, labels: p.labels.slice(0, min - 1) }).success,
      false,
    );
    assert.equal(
      svgPlanSchema.safeParse({
        ...p,
        labels: Array.from({ length: max + 1 }, (_, i) => 'Toprak ' + i),
      }).success,
      false,
    );
    assert.equal(
      svgPlanSchema.safeParse({ ...p, labels: p.labels.map((v, i) => (i ? v : '   ')) }).success,
      false,
    );
  }
  for (const invalid of [
    { ...valid, other: 'markup' },
    { ...valid, toValue: '4' },
    { ...valid, fromValue: Infinity },
    { ...valid, template: 'CustomJSX' },
    { ...valid, weather: 'storm' },
    { ...valid, accentColor: 'url(example)' },
    { ...valid, title: '' },
    { ...valid, subtitle: 'Eski açıklama' },
    { ...valid, icon: 'script' },
    { ...valid, icon: undefined },
    { ...valid, labels: ['Odak noktası', 'İncelenen yapı'] },
    { ...valid, labels: [] },
    { ...valid, title: 'Uzun anlatı cümlesini olduğu gibi yazma' },
    { ...valid, title: 'Tek' },
    { ...valid, fromValue: null },
  ])
    assert.equal(svgPlanSchema.safeParse(invalid).success, false);
  assert.ok(svgPlanSchema.safeParse(defaultSvg('🍃'.repeat(120))).success);
});
test('local planning keeps approved narration verbatim, needs neither keys nor transport', async (t) => {
  let calls = 0;
  const { planner, p } = setup(t, async () => {
    calls++;
    throw Error();
  });
  const result = await planner.plan(p);
  assert.equal(calls, 0);
  assert.equal(result.warning, '');
  assert.equal(normalize(result.scenes.map((s) => s.narration).join(' ')), normalize(p.script));
  assert.ok(
    result.scenes.every(
      (s) => s.visualMode === 'svg' && svgPlanSchema.safeParse(s.svgPlan).success,
    ),
  );
  assert.equal(result.scenes[1].svgPlan.template, 'ThermometerGaugeScene');
  assert.deepEqual([result.scenes[1].svgPlan.fromValue, result.scenes[1].svgPlan.toValue], [-5, 4]);
  p.scriptApproval = null;
  await assert.rejects(planner.plan(p), /onay/);
});
test('OpenAI-compatible planners target only their selected host and validate the entire JSON plan', async (t) => {
  const calls: { url: string; h: Headers; b: any; redirect: RequestRedirect | undefined }[] = [];
  const { planner, p } = setup(t, async (url, opts) => {
    calls.push({
      url: String(url),
      h: new Headers(opts?.headers),
      b: JSON.parse(String(opts?.body)),
      redirect: opts?.redirect,
    });
    if (String(url).endsWith('/api/show'))
      return Response.json({ model_info: { 'general.architecture': 'qwen2' } });
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              scenes: [
                { ...valid, title: 'Karlı Toprak' },
                { ...valid, title: 'Toprağın Sıcaklığı' },
              ],
            }),
          },
        },
      ],
    });
  });
  for (const provider of ['groq', 'openrouter', 'ollama'] as const) {
    if (provider !== 'ollama') planner.key(provider, provider + '-isolated-secret');
    planner.configure({ provider, ollamaModel: 'qwen2.5:7b', groqFreeConfirmed: true });
    const r = await planner.plan(p);
    assert.equal(r.warning, '');
    assert.deepEqual(
      r.scenes.map((s) => s.svgPlan.title),
      ['Karlı Toprak', 'Toprağın Sıcaklığı'],
    );
  }
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      'https://api.groq.com/openai/v1/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
      'http://127.0.0.1:11434/api/show',
      'http://127.0.0.1:11434/v1/chat/completions',
    ],
  );
  assert.deepEqual(
    calls.map((c) => c.h.get('authorization')),
    ['Bearer groq-isolated-secret', 'Bearer openrouter-isolated-secret', null, null],
  );
  assert.equal(calls[1].b.model, 'openrouter/free');
  assert.ok(
    calls.every((c) => c.redirect === 'error' && !JSON.stringify(c.b).includes('isolated-secret')),
  );
  assert.ok(calls[0].b.messages[0].content.includes('additionalProperties'));
  assert.equal(calls[0].b.response_format.type, 'json_object');
  assert.ok(!JSON.stringify(planner.settings()).includes('secret'));
  planner.key('groq', 'another-free-account');
  assert.equal(planner.settings().groqFreeConfirmed, false);
  planner.key('openrouter');
  assert.deepEqual(planner.settings().keys, { groq: true, openrouter: false });
});
test('503, timeout, missing key, truncated/invalid/extra JSON and cloud Ollama all fall back without replay or losing authored fields', async (t) => {
  let calls = 0,
    reply: () => Response = () => new Response(null, { status: 503 });
  const { p, planner } = setup(t, async () => {
    calls++;
    return reply();
  });
  const manual = { ...valid, title: 'Benim şemam' };
  p.scenes = [
    {
      ...blankScene(randomUUID()),
      narration: p.script,
      description: p.script,
      visualMode: 'svg',
      svgPlan: manual,
    },
  ];
  planner.configure({
    provider: 'openrouter',
    ollamaModel: 'qwen2.5:7b',
    groqFreeConfirmed: false,
  });
  assert.match((await planner.plan(p)).warning, /anahtarı yok/);
  assert.equal(calls, 0);
  planner.key('openrouter', 'fixture-only-secret');
  for (reply of [
    () => new Response(null, { status: 503 }),
    () => {
      throw Error('fixture-only-secret');
    },
    () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    ...[
      'not JSON',
      JSON.stringify({ scenes: [] }),
      JSON.stringify({ scenes: [{ ...valid, code: 'untrusted text' }] }),
    ].map(
      (content) => () =>
        Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] }),
    ),
  ]) {
    const n: number = calls,
      r = await planner.plan(p);
    assert.equal(calls, n + 1);
    assert.match(r.warning, /Yerel şablon/);
    assert.ok(!r.warning.includes('fixture-only-secret'));
    assert.deepEqual(r.scenes[0].svgPlan, manual);
    assert.equal(r.scenes[0].id, p.scenes[0].id);
  }
  assert.throws(() =>
    planner.configure({ provider: 'groq', ollamaModel: 'local', groqFreeConfirmed: false }),
  );
  planner.configure({ provider: 'ollama', ollamaModel: 'local', groqFreeConfirmed: false });
  reply = () =>
    Response.json({ remote_host: 'remote', model_info: { 'general.architecture': 'remote' } });
  const n: number = calls;
  assert.match((await planner.plan(p)).warning, /yerel Ollama/);
  assert.equal(calls, n + 1);
});
test('SVG edits detach only dependent clips, keep old photo and voice assets, and require review', () => {
  const p = makeProject('Katman', 'Bir. İki. Üç.');
  p.scenes = ['Bir.', 'İki.', 'Üç.'].map((n) => ({
    ...blankScene(randomUUID()),
    description: n,
    narration: n,
  }));
  const [a, b, c] = p.scenes;
  for (const s of p.scenes)
    p.assets[s.id] = {
      image: { file: s.id + '.jpg', key: imageKey(p, s) },
      voice: { file: s.id + '.wav', key: voiceKey(p, s) },
      clip: { file: s.id + '.mp4', key: 'clip' },
    };
  p.scriptApproval = scriptSig(p);
  approveBoard(p);
  const photo = structuredClone(p);
  b.visualMode = 'svg';
  b.svgPlan = valid;
  invalidate(p, photo);
  assert.ok(!p.assets[a.id].clip && !p.assets[b.id].clip && p.assets[c.id].clip);
  assert.deepEqual(p.assets[b.id].image, photo.assets[b.id].image);
  assert.deepEqual(p.assets[b.id].voice, photo.assets[b.id].voice);
  assert.throws(() => approved(p));
  approveBoard(p);
  const orig = structuredClone(p);
  p.assets[a.id].clip = photo.assets[a.id].clip;
  p.assets[b.id].clip = photo.assets[b.id].clip;
  b.svgPlan = { ...valid, accentColor: '#FF9900' };
  invalidate(p, orig);
  assert.ok(!p.assets[a.id].clip && !p.assets[b.id].clip && p.assets[c.id].clip);
});

test('content and sequence guide both offline and repetitive remote plans, without inventing measurements', () => {
  for (const hints of [
    [],
    thirst.map(() => ({
      ...defaultSvg('Yaprağın yapısı'),
      template: 'FocusCalloutScene' as const,
      labels: ['Yaprak ayası', 'Ana damar'],
    })),
  ]) {
    const plans = storyboardPlans(thirst, 'Susama', hints);
    assert.ok(
      plans.every(
        (p) =>
          svgPlanSchema.safeParse(p).success &&
          p.icon !== 'leaf' &&
          p.template !== 'ThermometerGaugeScene',
      ),
    );
    assert.ok(plans.every((p, i) => i === 0 || p.template !== plans[i - 1].template));
    assert.ok(new Set(plans.map((p) => p.template)).size >= 5);
    for (const p of plans.filter((p) => p.template === 'ComparisonScene'))
      assert.deepEqual([p.fromValue, p.toValue], [null, null]);
  }
  const inferred = [
    'Hücre zarı',
    'Su damlası',
    'Beyin dalgaları',
    'Molekül yapısı',
    'Kan dolaşımı',
    'Bir yaprak',
    'Dünya dönüyor',
    'Alev ısı yayar.',
    'Yolcu uçağı',
    'Güneş ışınları',
    'Kar kristali',
    'Karıncaların yuvası',
    'Göz merceği',
    'Kalp ritmi',
    'Atom çekirdeği',
    'Ses dalgaları',
    'Koruyucu tabaka',
    'Bir saat',
    'Yerkürenin enlemleri',
    'Şimşek çaktı.',
  ].map((t) => defaultSvg(t).icon);
  assert.deepEqual(inferred, icons);
});
test('1.1.0 plans retain original signed data; old prose never becomes a second caption', () => {
  const old: LegacySvgPlan = {
    template: 'FocusCalloutScene',
    title: 'İnsan beyninin merkezinde bulunan sinir hücreleri düzenli',
    subtitle: 'Bu yarım anlatım alta yazılmamalı.',
    weather: 'none',
    accentColor: '#FFAA00',
    fromValue: 4,
    toValue: 7,
  };
  const saved = JSON.stringify(old);
  const resolved = displayPlan(old, 'Beyin susama sinyali verir.');
  assert.ok(svgPlanSchema.safeParse(resolved).success);
  assert.equal(resolved.icon, 'brain');
  assert.equal(resolved.title, 'Beynin Susama Sinyali');
  assert.equal(JSON.stringify(old), saved);
  assert.ok(!JSON.stringify(resolved).includes('yarım anlatım'));
  const custom = displayPlan(
    { ...old, subtitle: 'Hipotalamus | Sinir hücresi', title: 'Susama Sinyali' },
    'Beyindeki susama merkezi.',
  );
  assert.deepEqual(custom.labels, ['Hipotalamus', 'Sinir hücresi']);
  assert.equal(custom.title, 'Susama Sinyali');
});

test('a fresh flight script plans the entire atlas in order without authored scene/template hints', async (t) => {
  const { planner, p } = setup(t, async () => {
    throw Error('No network');
  });
  p.topic = 'Uçaklar neden yüksekten uçar?';
  p.script = flight.join(' ');
  p.scriptApproval = scriptSig(p);
  const { scenes } = await planner.plan(p);
  assert.deepEqual(
    scenes.map((s) => s.narration),
    flight,
  );
  const plans = scenes.map((s) => svgPlanSchema.parse(s.svgPlan));
  assert.deepEqual(new Set(plans.map((s) => s.template)), new Set(templates));
  assert.deepEqual(plans.filter((s) => s.template === 'LayerStackScene')[0].labels, [
    'Mezosfer',
    'Stratosfer',
    'Troposfer',
  ]);
  assert.deepEqual(plans.at(-1)?.labels, ['Kalkış', 'Tırmanış', 'Seyir', 'İniş']);
  assert.equal(plans[0].icon, 'airplane');
  const scale = plans.find((p) => p.template === 'TimelineScaleScene')!;
  assert.deepEqual([scale.fromValue, scale.midValue, scale.toValue, scale.unit], [0, 5, 10, 'km']);
  const ring = plans.find((p) => p.template === 'RatioGaugeScene')!;
  assert.deepEqual([ring.toValue, ring.unit], [21, '%']);
});
test('model holes are repaired per field, not by discarding the scene or the other boards', async (t) => {
  const drafts = [
    {
      template: 'TitleHookScene',
      title: '  ',
      icon: 'airplane',
      labels: ['Uçuş rotası'],
      accentColor: '#123456',
    },
    {
      template: 'CycleLoopScene',
      icon: null,
      title: 'Uçuşun Dört Evresi',
      labels: [null, 'Yükselme', 'Etiket 3', 'İniş'],
    },
    { template: 'RatioGaugeScene', title: null, labels: null, unit: '×', toValue: 999 },
    {
      template: 'LayerStackScene',
      title: 'Atmosfer ve',
      labels: ['Üst atmosfer', '  ', 'Üst atmosfer'],
    },
  ];
  const { planner, p } = setup(t, async () =>
    Response.json({
      choices: [
        { finish_reason: 'stop', message: { content: JSON.stringify({ scenes: drafts }) } },
      ],
    }),
  );
  planner.key('openrouter', 'isolated-only');
  planner.configure({ provider: 'openrouter', groqFreeConfirmed: false, ollamaModel: 'local' });
  p.topic = 'Uçuş';
  p.script = [flight[0], flight[11], flight[6], flight[2]].join(' ');
  p.scriptApproval = scriptSig(p);
  const { scenes, warning } = await planner.plan(p);
  assert.equal(warning, '');
  const [hook, cycle, ratio, stack] = scenes.map((s) => svgPlanSchema.parse(s.svgPlan));
  assert.equal(hook.accentColor, '#123456');
  assert.deepEqual(hook.labels, ['Uçuş rotası']);
  assert.equal(hook.title, 'Uçakların Seyir Yüksekliği');
  assert.equal(cycle.title, drafts[1].title);
  assert.equal(cycle.icon, 'airplane');
  assert.deepEqual(cycle.labels, ['Kalkış', 'Yükselme', 'Seyir', 'İniş']);
  assert.deepEqual([ratio.toValue, ratio.unit, ...ratio.labels], [21, '%', 'Oksijen']);
  assert.equal(stack.title, 'Atmosferin Katmanları');
  assert.deepEqual(stack.labels, ['Üst atmosfer', 'Stratosfer', 'Troposfer']);
});
test('short and homogeneous boards honor adjacency and the distinct-template budget, even with repetitive model hints', () => {
  for (const len of [1, 2, 4, 5, 6, 12, 24])
    for (const hints of [false, true]) {
      const rows = Array<string>(len).fill('Bir mercek ışığı toplar.');
      const plans = storyboardPlans(
        rows,
        'Mercek',
        hints
          ? rows.map(() => ({
              template: 'FocusCalloutScene',
              icon: 'leaf',
              title: 'Yaprağın Yapısı',
            }))
          : [],
      );
      assert.ok(
        plans.every(
          (s, i) =>
            svgPlanSchema.safeParse(s).success && (!i || s.template !== plans[i - 1].template),
        ),
      );
      assert.ok(new Set(plans.map((s) => s.template)).size >= Math.min(5, len));
      assert.ok(
        plans.every(
          (s) =>
            !['ThermometerGaugeScene', 'RatioGaugeScene'].includes(s.template) && s.icon !== 'leaf',
        ),
      );
    }
});
test('ratio and scale keep actual units; no fictitious measurements from hints or unrelated numerals', () => {
  for (const [line, amt, unit] of [
    ['Karınca ağırlığının 50 katını taşır.', 50, '×'],
    ['Kütlesi 50x artar.', 50, '×'],
    ['Bir karışımın %70,5 kadarı sudur.', 70.5, '%'],
    ['Havanın yüzde yirmi biri oksijendir.', 21, '%'],
  ] as const) {
    const [p] = storyboardPlans([line], '');
    assert.deepEqual([p.template, p.toValue, p.unit], ['RatioGaugeScene', amt, unit]);
  }
  for (const line of [
    'Uçak 10 km yukarıdadır.',
    '20 Fahrenheit ve 35 Fahrenheit ölçüldü.',
    'Açı 30 dereceden 60 dereceye çıkar.',
    '2 sensör sıcaklığı 20 derece ölçtü.',
  ]) {
    const [p] = storyboardPlans([line], '', [
      { template: 'ThermometerGaugeScene', fromValue: 2, toValue: 60 },
    ]);
    assert.notEqual(p.template, 'ThermometerGaugeScene');
  }
  const [p] = storyboardPlans(['Yol 0 ile 10 km arasında uzanır.'], '');
  assert.deepEqual([p.unit, p.midValue], ['km', 5]);
  assert.equal(svgPlanSchema.safeParse({ ...p, midValue: 11 }).success, false);
  const ring = defaultSvg('%70 su', 0, '', 'RatioGaugeScene');
  assert.equal(svgPlanSchema.safeParse({ ...ring, toValue: 101 }).success, false);
  assert.equal(svgPlanSchema.safeParse({ ...ring, unit: undefined }).success, false);
  assert.deepEqual(
    diagramLabels('CycleLoopScene', 'Buharlaşma, yoğuşma ve yağış sürekli bir döngü oluşturur.'),
    ['Buharlaşma', 'Yoğuşma', 'Yağış'],
  );
  assert.deepEqual(
    diagramLabels('LayerStackScene', 'Yer kabuğu, manto, dış çekirdek ve iç çekirdek farklıdır.'),
    ['Yer kabuğu', 'Manto', 'Dış çekirdek', 'İç çekirdek'],
  );
});
test('an approved 1.1.1 thermometer is projected without rewriting its signed content or measurements', () => {
  const old = {
    ...defaultSvg('Toprak sıcaklığı', 0, '', 'ThermometerGaugeScene'),
    labels: [],
    fromValue: -5,
    toValue: 4,
  };
  const before = JSON.stringify(old);
  assert.equal(svgPlanSchema.safeParse(old).success, false);
  const p = displayPlan(old, 'Toprakta iki sıcaklık ölçüldü.');
  assert.ok(svgPlanSchema.safeParse(p).success);
  assert.deepEqual(
    [p.fromValue, p.toValue, ...p.labels],
    [-5, 4, 'Toprak sıcaklığı', 'Sıcaklık aralığı'],
  );
  assert.equal(JSON.stringify(old), before);
});
