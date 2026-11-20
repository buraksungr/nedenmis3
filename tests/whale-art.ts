import assert from 'node:assert/strict';
import { SvgPlanner } from './legacy-layered-planner';
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
  const source = 'Archive QA replay: seven original layered-v1 drawings';
  const planner = new SvgPlanner(store, vaults, async (url, opts) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
    const q = JSON.parse(JSON.parse(String(opts?.body)).messages[1].content);
    assert.equal(q.anlatım, whale[q.sahne - 1]);
    textRequests++;
    return completion(sample(q.sahne - 1));
  });
  planner.key('openrouter', 'offline-contract-fixture');
  const scenes = await planner.plan(p);
  assert.ok(textRequests >= scenes.length && textRequests <= 3 * scenes.length);
  assert.deepEqual(
    scenes.map((s) => s.vector?.title),
    whale.map((_, i) => sample(i).title),
  );
  return { scenes, source, textRequests };
}
