import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { AtlasArt, candidates, readArtwork } from '../server/atlas-art';
import { SVG_LIMIT, safeSvg } from '../server/safe-svg';
import { Store, makeProject, scriptSig } from '../server/store';
import { storyboardPlans, defaultSvg } from '../shared/svg-story';
import { grounded } from '../shared/svg-copy';
import { SvgPlanner } from '../server/svg-planner';
import { Gemini } from '../server/gemini';
import { memoryVault } from '../server/vault';
import whale from './fixtures/whale.json';
const xml =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor"><path d="M2 8Q5 4 10 8L20 12Z"/></g></svg>';
const svgResponse = (s: string) =>
  new Response(s, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
function setup(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-art-')),
    store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { force: true, recursive: true });
  });
  const p = store.create(makeProject('Konu başlığından kelime alınmaz', whale[0]));
  p.scriptApproval = scriptSig(p);
  return { store, p };
}
test('static SVG geometry is rebuilt and themed idempotently, not served as raw XML', () => {
  const safe = safeSvg(xml);
  assert.equal(safeSvg(safe), safe);
  assert.match(safe, /viewBox="0 0 24 24"/);
  assert.match(safe, /#EDF5EE/);
  assert.match(safe, /#9ADBC1/);
  assert.doesNotMatch(safe, /currentColor|width="24"/);
  for (const body of [
    '<script/>',
    '<foreignObject/>',
    '<use href="#a"/>',
    '<image/>',
    '<path d="M0 0Z" style="fill:red"/>',
    '<animate/>',
    '<style/>',
    '<path d="M0 0Z" onload="ignore"/>',
    '<circle r="4" fill="url(#id)"/>',
    '<path d="M0 1e999Z"/>',
    '<ellipse rx="x"/>',
    '<g>'.repeat(20) + '</g>'.repeat(20),
  ])
    assert.throws(() => safeSvg(xml.replace('<g fill', body + '<g fill')));
  for (const v of [
    xml.replace('0 0 24 24', '0 0 -1 0'),
    xml.replace('viewBox', 'other'),
    xml.repeat(2),
    '<!DOCTYPE svg>' + xml,
    xml.replace('</svg>', ''),
    xml + ' '.repeat(SVG_LIMIT),
  ])
    assert.throws(() => safeSvg(v));
});
test('Iconify uses only a fixed anonymous search + relevant file; project cache, credits, corruption and isolation', async (t) => {
  const { store, p } = setup(t),
    requests: string[] = [];
  let calls = 0;
  const art = new AtlasArt(store, async (url, opts) => {
    const u = new URL(String(url));
    requests.push(u.href);
    assert.equal(u.origin, 'https://api.iconify.design');
    assert.equal(opts?.redirect, 'error');
    assert.equal(opts?.credentials, 'omit');
    assert.equal(new Headers(opts?.headers).get('authorization'), null);
    if (u.pathname === '/search') {
      assert.equal(u.searchParams.get('query'), 'whale');
      return Response.json({
        icons: ['tabler:whalebone', 'unknown:whale', 'ph:whale', 'tabler:heart', 'lucide:../bad'],
      });
    }
    assert.equal(u.pathname, '/ph/whale.svg');
    return svgResponse(xml);
  });
  const plan = defaultSvg(whale[0]),
    model = {
      name: 'test',
      draw: async () => {
        calls++;
        return xml;
      },
    };
  const [first, concurrent] = await Promise.all([
    art.resolve(p.id, plan, p.script, 'hybrid', model),
    art.resolve(p.id, plan, p.script, 'hybrid', model),
  ]);
  assert.equal(first.ref?.name, 'ph:whale');
  assert.deepEqual(first, concurrent);
  const id = first.ref!.digest,
    root = store.dir(p.id);
  assert.equal(readArtwork(root, id), safeSvg(xml));
  assert.equal((await art.resolve(p.id, plan, p.script, 'offline')).cached, true);
  assert.equal(calls, 0);
  assert.equal(requests.length, 2);
  const creditDir = path.join(root, 'media', 'atlas', 'credits'),
    credit = JSON.parse(
      fs.readFileSync(path.join(creditDir, fs.readdirSync(creditDir)[0]), 'utf8'),
    );
  assert.ok(credit.notice.includes('Copyright') && credit.ref.digest === id);
  assert.equal(credit.url, 'https://api.iconify.design/ph/whale.svg');
  fs.writeFileSync(path.join(root, 'media', 'atlas', id + '.svg'), xml);
  assert.equal(readArtwork(root, id), undefined);
  assert.ok(!(await art.resolve(p.id, plan, p.script, 'offline')).ref);
  const other = store.create(makeProject('Yalıtılmış'));
  assert.equal(readArtwork(store.dir(other.id), id), undefined);
  assert.deepEqual(candidates(['ph:whalebone', 'ph:lungs-off', 'ph:some-whale'], 'whale'), [
    'ph:some-whale',
  ]);
});
test('no hit → model; specialized diagrams use model first; rejected or oversized geometry and offline stay local', async (t) => {
  const { store, p } = setup(t);
  let n = 0,
    draws = 0,
    reply = () => Response.json({ icons: ['ph:heart'] });
  const art = new AtlasArt(store, async () => {
    n++;
    return reply();
  });
  const plan = defaultSvg(whale[3]);
  const artist = {
    name: 'gemini-test',
    draw: async (text: string) => {
      draws++;
      assert.equal(text, whale[3]);
      return xml;
    },
  };
  assert.ok(!(await art.resolve(p.id, plan, whale[3], 'offline', artist)).ref);
  assert.equal(n, 0);
  assert.equal(draws, 0);
  const r = await art.resolve(p.id, plan, whale[3], 'hybrid', artist);
  assert.equal(r.ref?.source, 'llm');
  assert.equal(draws, 1);
  assert.equal(n, 1);
  assert.equal(
    (await art.resolve(p.id, { ...plan, artMode: 'custom' }, whale[3], 'hybrid', artist)).cached,
    true,
  );
  assert.equal(n, 1);
  assert.equal(draws, 1);
  const custom = { ...plan, artMode: 'custom' as const, iconKeyword: 'gravity' };
  assert.equal((await art.resolve(p.id, custom, whale[3], 'hybrid', artist)).ref?.source, 'llm');
  assert.equal(n, 1);
  assert.equal(draws, 2);
  reply = () =>
    new Response('x'.repeat(SVG_LIMIT + 1), { headers: { 'Content-Type': 'application/json' } });
  assert.ok(
    !(
      await art.resolve(p.id, { ...plan, iconKeyword: 'dna' }, 'DNA molekülü', 'hybrid', {
        name: 'other',
        draw: async () => xml.replace('<g fill', '<script/><g fill'),
      })
    ).ref,
  );
});
test('local and remote copy stays within the individual narration; English queries are not limited to 20 glyphs', () => {
  const hints = whale.map(() => ({
    title: 'Su Birikimi',
    labels: ['Yüzeyde akış', 'Su birikimi'],
    iconKeyword: 'water',
    keywordEvidence: 'su',
  }));
  for (const pref of [[], hints]) {
    const p = storyboardPlans(whale, 'Bir yaprağın su ile hareketi', pref);
    assert.ok(p.every((v, i) => [v.title, ...v.labels].every((l) => grounded(l, whale[i]))));
    assert.deepEqual(
      p.slice(0, 5).map((v) => v.iconKeyword),
      ['whale', 'buoyancy', 'weight', 'lungs', 'skeleton'],
    );
    assert.deepEqual(
      p.slice(1, 4).map((v) => v.title),
      ['Suyun Kaldırma Kuvveti', 'Devasa Vücut Ağırlığı', 'Akciğerlere Binen Basınç'],
    );
  }
  for (const [n, k] of [
    ['Yanardağın altında magma birikir.', 'volcano'],
    ['DNA zincirinde genetik bilgi bulunur.', 'dna'],
    ['Yer çekimi balinayı aşağı çeker.', 'gravity'],
    ['Zürafanın boynu uzundur.', 'giraffe'],
  ])
    assert.equal(defaultSvg(n).iconKeyword, k);
  assert.equal(defaultSvg('Yer çekimi balinayı aşağı çeker.').artMode, 'custom');
  const [open] = storyboardPlans(['Kuarkların farklı türleri bulunur.'], '', [
    { iconKeyword: 'quark', keywordEvidence: 'Kuarkların' },
  ]);
  assert.equal(open.iconKeyword, 'quark');
});
test('custom generation uses the selected text consent (never the TTS key or an implicit paid model)', async (t) => {
  const { store, p } = setup(t),
    vault = memoryVault(),
    calls: string[] = [];
  const model = 'gemini-2.5-flash';
  const g = new Gemini(store, vault, async (url, opts) => {
    const u = String(url);
    if (opts?.method === 'GET')
      return Response.json({
        models: [{ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] }],
      });
    calls.push(u);
    assert.ok(u.endsWith('/' + model + ':generateContent'));
    const body = JSON.parse(String(opts?.body));
    assert.ok(body.contents[0].parts[0].text.includes(p.script));
    return Response.json({
      candidates: [
        {
          finishReason: 'STOP',
          content: { role: 'model', parts: [{ text: JSON.stringify({ svg: xml }) }] },
        },
      ],
    });
  });
  const art = new AtlasArt(store, async () => Response.json({ icons: [] })),
    planner = new SvgPlanner(
      store,
      { groq: memoryVault(), openrouter: memoryVault() },
      async () => {
        throw Error('Wrong provider');
      },
      art,
      g,
    );
  g.key('isolated-text-fixture');
  await g.test();
  const plan = defaultSvg(p.script);
  assert.ok(!(await planner.illustrate(p, plan, p.script)).plan.artwork);
  assert.equal(calls.length, 0);
  g.configure('text', { model, consent: 'free' });
  const r = await planner.illustrate(p, plan, p.script);
  assert.equal(r.plan.artwork?.source, 'llm');
  assert.equal(r.plan.artwork?.name, model);
  assert.equal(calls.length, 1);
  planner.configure({ ...planner.config(), artworkPolicy: 'iconify' });
  assert.ok(!(await planner.illustrate(p, plan, p.script)).plan.artwork);
  assert.equal(calls.length, 1);
});
