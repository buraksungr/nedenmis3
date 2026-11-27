import { z } from 'zod';
import { digestSchema, heading, vectorProvider, type Geometry } from './vector';
export const animKinds = [
  'move',
  'sway',
  'fall',
  'rise',
  'draw',
  'flow',
  'orbit',
  'heartbeat',
  'pulse',
  'dilate',
  'swing',
  'wiggle',
  'pop',
] as const;
export type AnimKind = (typeof animKinds)[number];
// Existing signed references keep the validator they were saved with. The stricter
// editorial rules below are applied to new model replies, not to archived projects.
const archivedMotionHeading = heading.refine((s) => {
  const last = s.toLocaleLowerCase('tr').split(' ').at(-1)!;
  return (
    !/^(kim|kimler|kimi|hangi|hangisi|neler|neden|niçin|nerede|nereye|nasıl|ne|mi|mı|mu|mü|ki|henüz|daha|çok|hem|yahut)$/u.test(
      last,
    ) && !/(?:sına|sine|suna|süne)$/u.test(last)
  );
}, 'Soru veya cümle parçası değil, tamamlanmış bir Türkçe başlık kullan.');
export const motionHeading = archivedMotionHeading.refine((s) => {
  const words = s.toLocaleLowerCase('tr').split(' '),
    last = words.at(-1)!;
  return (
    !/^(de|da|ya|ıçin)$/u.test(last) &&
    !/^(yapan|eden|giden|olan)$/u.test(words[0]) &&
    !/(?:larca|lerce|larça|lerçe|larına|lerine|yınca|yince|yunca|yünce)$/u.test(last)
  );
}, 'Başlık kesilmiş bir cümle değil, tamamlanmış bir Türkçe ad öbeği olmalı.');
const source = { provider: vectorProvider, model: z.string().min(1).max(120) };
export const rigSchema = z.strictObject({
  kind: z.literal('subject-rig-v1'),
  subject: z.string().trim().min(2).max(100),
  scriptHash: digestSchema,
  ...source,
  digest: digestSchema,
});
export const motionRefSchema = z.strictObject({
  // The kind is part of the signed digest. v1 keeps the original pulse and
  // movement semantics; newly planned v2 scenes use centered, bounded motion.
  kind: z.enum(['objects-v1', 'objects-v2']),
  title: archivedMotionHeading,
  narrationHash: digestSchema,
  ...source,
  actors: z.number().int().min(1).max(40),
  objects: z.number().int().min(1).max(160),
  digest: digestSchema,
});
export type RigRef = z.infer<typeof rigSchema>;
export type MotionRef = z.infer<typeof motionRefSchema>;
export type ObjectFrame = { ref: MotionRef; stage: Geometry };
