import type { Scene } from './schema';

// Zero-based position on the approved timeline, not a random draw during React rendering.
const cycle = ['pan-right', 'breathe', 'float-up', 'pan-left', 'breathe', 'float-down'] as const;
export const motionForScene = (index: number) => cycle[index % cycle.length];
export const motionNames = {
  'pan-right': 'Sağa kayma',
  'pan-left': 'Sola kayma',
  'float-up': 'Yukarı süzülme',
  'float-down': 'Aşağı süzülme',
  breathe: 'Nefes hareketi',
} as const;

// Everything visible at the incoming shot's first frame (apart from its image).
export type ShotVisual = Pick<Scene, 'camera' | 'motion' | 'effect' | 'object'>;
export const visualOf = ({ camera, motion, effect, object }: Scene): ShotVisual => ({
  camera,
  motion,
  effect,
  object,
});
