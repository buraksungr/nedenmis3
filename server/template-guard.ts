import type { Scene } from '../shared/schema';
import { motionFrame } from './motion-files';
import { templateIdInStage, type TemplateId } from './science-templates';
import { requireThat } from './store';

/** Identity is read from the verified, narration-bound SVG, never an unsigned project field.
 * Archived motion SVGs and other visual modes have no template marker and are left alone. */
export function signedTemplate(root: string, scene: Scene): TemplateId | undefined {
  if (scene.visualMode !== 'motion-svg') return undefined;
  return templateIdInStage(motionFrame(root, scene.choreography, scene.narration).stage);
}

/** Call with the actual output sequence (which may omit unfinished draft scenes). */
export function assertDistinctAdjacentTemplates(root: string, scenes: readonly Scene[]) {
  let previous: TemplateId | undefined;
  for (const [index, scene] of scenes.entries()) {
    const current = signedTemplate(root, scene);
    requireThat(
      !current || current !== previous,
      `Ardışık hazır sahnelerde aynı şablon var (çıktıda ${index}. ve ${index + 1}. sahne). İkincisini yeniden üretin.`,
      422,
    );
    // A verified legacy scene or non-template visual really does separate the two.
    previous = current;
  }
}
