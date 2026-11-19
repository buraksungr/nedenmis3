import assert from 'node:assert/strict';
import { SvgPlanner } from '../server/svg-planner';
import { Gemini } from '../server/gemini';
import type { Store } from '../server/store';
import { memoryVault } from '../server/vault';
import { sample, completion } from './vector-test-data';
import whale from './fixtures/whale.json';
import type { Project } from '../shared/schema';
/** Only public test narration is sent. Production has no fixture flag/path. A configured
 * live run which fails MUST fail the job, never silently retry against snapshots. */
export async function whaleBoard(store: Store, p: Project) {
  const vaults = { openrouter: memoryVault(), groq: memoryVault() };
  let textRequests = 0;
  const key = process.env.QA_OPENROUTER_KEY,
    geminiKey = process.env.QA_GEMINI_KEY,
    model = process.env.QA_GEMINI_TEXT_MODEL;
  const source = key
    ? 'Live OpenRouter'
    : geminiKey && model
      ? 'Live Gemini'
      : 'QA replay: original agent-authored SVG and titles, not a live provider call';
  if (process.argv.includes('--require-live') || process.env.QA_REQUIRE_LIVE === 'true')
    assert.ok(
      key || (geminiKey && model),
      'No authorized live drawing provider configured for this CI run.',
    );
  const real: typeof fetch = (url, o) => {
    if (o?.method === 'POST') textRequests++;
    return fetch(url, o);
  };
  let planner: SvgPlanner;
  if (key) {
    planner = new SvgPlanner(store, vaults, real);
    planner.key('openrouter', key);
    planner.configure({ provider: 'openrouter' });
  } else if (geminiKey && model) {
    const gemini = new Gemini(store, memoryVault(), real);
    gemini.key(geminiKey);
    await gemini.test();
    gemini.configure('text', { model, consent: 'free' });
    planner = new SvgPlanner(store, vaults, real, gemini);
    planner.configure({ provider: 'gemini' });
  } else {
    planner = new SvgPlanner(store, vaults, async (url, opts) => {
      assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
      const q = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content);
      assert.equal(q.anlatım, whale[q.sahne - 1]);
      textRequests++;
      return completion(sample(q.sahne - 1));
    });
    planner.key('openrouter', 'offline-contract-fixture');
  }
  const scenes = await planner.plan(p);
  assert.ok(textRequests >= scenes.length && textRequests <= 2 * scenes.length);
  if (source.startsWith('QA'))
    assert.deepEqual(
      scenes.map((s) => s.vector?.title),
      whale.map((_, i) => sample(i).title),
    );
  return { scenes, source, textRequests };
}
