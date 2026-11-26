/** Opt-in ONLY. Never fall back to QA drawings on a live acceptance run. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { Store, makeProject, scriptSig, approveBoard } from '../server/store';
import { Gemini } from '../server/gemini';
import { SceneModels } from '../server/scene-models';
import { memoryVault } from '../server/vault';
import { ObjectPlanner } from '../server/object-planner';
import { assertDistinctAdjacentTemplates } from '../server/template-guard';
import { motionFrame } from '../server/motion-files';
import { templateIdInStage } from '../server/science-templates';
import lines from './fixtures/ant.json';
async function main() {
  const store = new Store(path.resolve('out/live-ant-board'), false);
  try {
    const vaults = { openrouter: memoryVault(), groq: memoryVault() },
      g = new Gemini(store, memoryVault()),
      models = new SceneModels(store, vaults, fetch, g);
    if (process.env.QA_OPENROUTER_KEY) {
      models.key('openrouter', process.env.QA_OPENROUTER_KEY);
      models.configure({
        provider: 'openrouter',
        openrouterModel: process.env.QA_OPENROUTER_MODEL || 'openrouter/free',
      });
    } else if (process.env.QA_ANTHROPIC_KEY) {
      assert.ok(
        process.env.QA_ANTHROPIC_MODEL,
        'Explicit Anthropic model required for a live paid call.',
      );
      models.key('anthropic', process.env.QA_ANTHROPIC_KEY);
      models.configure({ provider: 'anthropic', anthropicModel: process.env.QA_ANTHROPIC_MODEL });
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
    assertDistinctAdjacentTemplates(store.dir(p.id), p.scenes);
    const board = p.scenes.map((s) => ({
      model: s.choreography!.model,
      title: s.choreography!.title,
      template: templateIdInStage(motionFrame(store.dir(p.id), s.choreography, s.narration).stage),
      objects: s.choreography!.objects,
    }));
    assert.ok(
      board.every((s) => s.template),
      'every live selection must instantiate a local template',
    );
    approveBoard(p);
    store.save(p);
    console.log('Live local-template board:', board);
  } finally {
    store.db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
