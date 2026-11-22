import { z } from 'zod';
import { digestSchema, heading, vectorProvider, type Geometry } from './vector';
export const animKinds = [
  'move',
  'fall',
  'rise',
  'draw',
  'pulse',
  'swing',
  'wiggle',
  'pop',
] as const;
export type AnimKind = (typeof animKinds)[number];
// Do not change the validator for already signed layered-v1 projects.
export const motionHeading = heading.refine((s) => {
  const last = s.toLocaleLowerCase('tr').split(' ').at(-1)!;
  return (
    !/^(kim|kimler|kimi|hangi|hangisi|neler|neden|niçin|nerede|nereye|nasıl|ne|mi|mı|mu|mü|ki|henüz|daha|çok|hem|yahut)$/u.test(
      last,
    ) && !/(?:sına|sine|suna|süne)$/u.test(last)
  );
}, 'Soru veya cümle parçası değil, tamamlanmış bir Türkçe başlık kullan.');
const source = { provider: vectorProvider, model: z.string().min(1).max(120) };
export const rigSchema = z.strictObject({
  kind: z.literal('subject-rig-v1'),
  subject: z.string().trim().min(2).max(100),
  scriptHash: digestSchema,
  ...source,
  digest: digestSchema,
});
export const motionRefSchema = z.strictObject({
  kind: z.literal('objects-v1'),
  title: motionHeading,
  rigDigest: digestSchema,
  narrationHash: digestSchema,
  ...source,
  actors: z.number().int().min(1).max(40),
  objects: z.number().int().min(1).max(160),
  digest: digestSchema,
});
export type RigRef = z.infer<typeof rigSchema>;
export type MotionRef = z.infer<typeof motionRefSchema>;
export type ObjectFrame = { ref: MotionRef; rig: Geometry; stage: Geometry };
