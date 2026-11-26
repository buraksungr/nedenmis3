import fs from 'node:fs';
import path from 'node:path';
import { STYLE_LOCK, NEGATIVE_LOCK } from '../shared/cinema';
import { legacyPlate } from '../shared/legacy-atlas';
import type { Project, Scene } from '../shared/schema';
import { motionFrame } from './motion-files';
import { templateIdInStage, type TemplateId } from './science-templates';
import { hash } from './store';
import { verifiedFrame } from './vector-files';

export const imageKey = (p: Project, s: Scene) =>
  s.visualMode === 'illustration'
    ? hash('science-image-v1', p.cinema?.subject, s.cinema?.brief, STYLE_LOCK, NEGATIVE_LOCK)
    : hash('image-v1', p.styleGuide, s.description, s.prompt, s.angle, s.environment);

/** Exactly the visuals that a silent partial draft can output, with a verified template
 * identity when present. An empty object is a real legacy/non-template separator;
 * undefined is a missing scene which will be skipped in the draft. */
export function readyVisual(
  root: string,
  project: Project,
  scene: Scene,
): { template?: TemplateId } | undefined {
  try {
    if (scene.visualMode === 'motion-svg') {
      const frame = motionFrame(root, scene.choreography, scene.narration);
      return { template: templateIdInStage(frame.stage) };
    }
    if (scene.visualMode === 'svg') {
      if (scene.vector) verifiedFrame(root, scene.vector, scene.narration);
      else if (scene.svgPlan) legacyPlate(scene.svgPlan);
      else return undefined;
      return {};
    }
    const image = project.assets[scene.id]?.image;
    if (!image || image.key !== imageKey(project, scene)) return undefined;
    const file = path.resolve(root, image.file);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).size === 0)
      return undefined;
    return {};
  } catch {
    return undefined;
  }
}
