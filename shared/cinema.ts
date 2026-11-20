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
export const shotReply = cinematicPlan.omit({ context: true });
export function illustrationPrompt(subject: string, brief: string) {
  return [
    `Vertical 9:16, full bleed. Recurring subject: ${subjectSchema.parse(subject)}.`,
    `Shot: ${briefSchema.parse(brief)}.`,
    `Make the same ${subject} clearly recognizable, either prominently in frame or in a directly related close-up or habitat cross-section with the subject visible. Preserve its colors, proportions and identifying features across shots.`,
    'Layered navy and deep teal surroundings, coral and warm gold accents. Keep the central action clear and the top and bottom quiet for editorial overlays.',
    NEGATIVE_LOCK,
    STYLE_LOCK,
  ].join(' ');
}
export const cameraNames = [
  'Yavaş yaklaşma',
  'Yavaş uzaklaşma',
  'Yatay kaydırma',
  'Dikey kaydırma',
] as const;
