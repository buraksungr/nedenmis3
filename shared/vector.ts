import { z } from 'zod';
export const layers = ['layer-bg', 'layer-main', 'layer-fx'] as const;
export type Layer = (typeof layers)[number];
export type Geometry = {
  tag: string;
  attrs: Record<string, string>;
  children: Geometry[];
  text?: string;
};
export type Drawing = { viewBox?: string; defs: Geometry[]; layers: Record<Layer, Geometry> };
// Validate editorial output; never shorten, complete, or derive a title from narration.
export const heading = z
  .string()
  .trim()
  .max(40)
  .regex(/^\p{L}[\p{L}\p{M}\p{N}'’-]*(?: \p{L}[\p{L}\p{M}\p{N}'’-]*){1,3}$/u)
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
// New providers are additive: previously signed Gemini/OpenRouter references remain valid.
export const vectorProvider = z.enum(['gemini', 'openrouter', 'anthropic']);
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
export const defaultRouterModel = 'openrouter/free';
export const defaultAnthropicModel = 'claude-sonnet-4-20250514';
const provider = z.enum(['auto', 'gemini', 'openrouter', 'anthropic', 'disabled']);
// Model IDs are sent in JSON, never interpolated into a URL or a header. This accepts
// OpenRouter's provider/model and :free suffixes as well as Anthropic's Claude IDs.
const modelId = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
export const plannerConfigSchema = z.strictObject({
  provider,
  openrouterModel: modelId.default(defaultRouterModel),
  anthropicModel: modelId.default(defaultAnthropicModel),
});
// Old clients submit only {provider}; retain the user's other model choices.
export const plannerConfigPatchSchema = z.strictObject({
  provider: provider.optional(),
  openrouterModel: modelId.optional(),
  anthropicModel: modelId.optional(),
});
export type PlannerConfig = z.infer<typeof plannerConfigSchema>;
export const providerNames = {
  auto: 'Bağlı metin modeli',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic Claude',
  disabled: 'Yeni çizim kapalı',
};
export type PlannerSettings = PlannerConfig & {
  keys: { openrouter: boolean; anthropic: boolean; groq: boolean };
};
