import { z } from 'zod';
export const layers = ['layer-bg', 'layer-main', 'layer-fx'] as const;
export type Layer = (typeof layers)[number];
export type Geometry = {
  tag: string;
  attrs: Record<string, string>;
  children: Geometry[];
  text?: string;
};
export type Drawing = { defs: Geometry[]; layers: Record<Layer, Geometry> };
// Validate editorial output; never shorten, complete, or derive a title from narration.
export const heading = z
  .string()
  .trim()
  .max(40)
  .regex(/^\p{L}[\p{L}\p{M}\p{N}'’-]*(?: \p{L}[\p{L}\p{M}\p{N}'’-]*){1,2}$/u)
  .refine((s) => {
    const w = s.toLocaleLowerCase('tr').split(' ');
    return (
      !/^(ve|veya|ile|olan|olarak|ise|ama|çünkü|bir|için|gibi|kadar|örneğin|nasıl|böylece)$/u.test(
        w.at(-1)!,
      ) &&
      !/^(yapar|eder|olur)$/u.test(w[0]) &&
      !/(?:daki|deki|taki|teki|nın|nin|nun|nün)$/u.test(w.at(-1)!) &&
      !/^(sahne|başlık|örnek başlık|kısa başlık)(?: |$)/u.test(s.toLocaleLowerCase('tr'))
    );
  }, 'Tam bir Türkçe ad öbeği gerekli.');
export const motion = z.enum(['rise', 'fall', 'pulse', 'drift']);
export const vectorProvider = z.enum(['gemini', 'openrouter']);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const vectorSchema = z.strictObject({
  kind: z.literal('layered-v1'),
  title: heading,
  fx: motion,
  provider: vectorProvider,
  model: z.string().min(1).max(120),
  narrationHash: digestSchema,
  digest: digestSchema,
});
export type VectorRef = z.infer<typeof vectorSchema>;
export type VectorFrame = { ref: VectorRef; drawing: Drawing };
export const plannerConfigSchema = z.strictObject({
  provider: z.enum(['auto', 'gemini', 'openrouter', 'disabled']),
});
export type PlannerConfig = z.infer<typeof plannerConfigSchema>;
export const providerNames = {
  auto: 'Bağlı metin modeli',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  disabled: 'Yeni çizim kapalı',
};
export type PlannerSettings = PlannerConfig & { keys: { openrouter: boolean; groq: boolean } };
