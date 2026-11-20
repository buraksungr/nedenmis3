/** Opt-in ONLY. Never fall back to QA drawings on a live acceptance run. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { Store, makeProject, scriptSig, approveBoard } from '../server/store';
import { Gemini } from '../server/gemini';
import { SceneModels } from '../server/scene-models';
import { memoryVault } from '../server/vault';
import { ObjectPlanner } from '../server/object-planner';
import lines from './fixtures/ant.json';
async function main() {
  const store = new Store(path.resolve('out/live-ant-board'), false);
  try {
    const vaults = { openrouter: memoryVault(), groq: memoryVault() },
      g = new Gemini(store, memoryVault()),
      models = new SceneModels(store, vaults, fetch, g);
    if (process.env.QA_OPENROUTER_KEY) {
      models.key('openrouter', process.env.QA_OPENROUTER_KEY);
      models.configure({ provider: 'openrouter' });
    } else {
      assert.ok(
        process.env.QA_GEMINI_KEY && process.env.QA_GEMINI_TEXT_MODEL,
        'Authorized live text provider required.',
      );
      g.key(process.env.QA_GEMINI_KEY);
      await g.test();
      g.configure('text', { model: process.env.QA_GEMINI_TEXT_MODEL, consent: 'free' });
      models.configure({ provider: 'gemini' });
    }
    const p = store.create(makeProject('Karıncalar kışın nereye gider?', lines.join(' ')));
    p.scriptApproval = scriptSig(p);
    await new ObjectPlanner(store, models).plan(p, () => {});
    approveBoard(p);
    store.save(p);
    console.log(
      'Live object board:',
      p.scenes.map((s) => ({
        model: s.choreography!.model,
        title: s.choreography!.title,
        objects: s.choreography!.objects,
      })),
    );
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
