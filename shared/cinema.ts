// Read-only compatibility: schemas and key material of signed 1.5.0 local raster assets.
import { z } from 'zod';
import { heading, digestSchema } from './vector';

export const STYLE_LOCK =
  'clean flat 2D vector science documentary illustration, Kurzgesagt inspired, rich dark moody background, crisp geometric shapes, glowing accent highlights, high contrast, no text, no letters, no watermark';
export const NEGATIVE_LOCK =
  'no text, no typography, no labels, no captions, no logos, no watermark';
// Input from the planner is descriptive prose, never markup, a model ID or a URL.
const english = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9 ,.'’():;!%\-/]+$/)
  .refine(
    (s) => /[a-z]{2}/i.test(s) && !s.includes('://'),
    'İngilizce bir görsel betimleme gerekli.',
  );
export const subjectSchema = english.min(3).max(140);
export const briefSchema = english.min(12).max(680);
export const cinematicPlan = z.strictObject({
  title: heading,
  brief: briefSchema,
  context: digestSchema,
});
