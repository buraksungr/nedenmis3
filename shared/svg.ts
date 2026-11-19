import { z } from 'zod';

// The entire language accepted by the drawing engine. No markup, URLs, style objects or code slots.
export const templates = [
  'CrossSectionScene',
  'ThermometerGaugeScene',
  'FocusCalloutScene',
  'ComparisonScene',
  'ProcessFlowScene',
] as const;
export const templateNames = {
  CrossSectionScene: 'Katman kesiti',
  ThermometerGaugeScene: 'Termometre',
  FocusCalloutScene: 'Odak ve açıklama',
  ComparisonScene: 'Karşılaştırma',
  ProcessFlowScene: 'Üç adımlı süreç',
} as const;
export type Template = (typeof templates)[number];
export const icons = [
  'cell',
  'water',
  'brain',
  'molecule',
  'blood',
  'leaf',
  'earth',
  'flame',
] as const;
export type ScienceIcon = (typeof icons)[number];
export const iconNames: Record<ScienceIcon, string> = {
  cell: 'Hücre',
  water: 'Su damlası',
  brain: 'Beyin',
  molecule: 'Molekül',
  blood: 'Kan damlası',
  leaf: 'Yaprak',
  earth: 'Dünya',
  flame: 'Isı / enerji',
};
export const labelCount: Record<Template, number> = {
  CrossSectionScene: 2,
  ThermometerGaugeScene: 0,
  FocusCalloutScene: 2,
  ComparisonScene: 2,
  ProcessFlowScene: 3,
};
const number = z.number().min(-1000000).max(1000000);
const common = {
  template: z.enum(templates),
  weather: z.enum(['snow', 'rain', 'none']),
  accentColor: z
    .string()
    .length(7)
    .regex(/^#[\da-fA-F]{6}$/),
};
// Read-only compatibility: never change a 1.1.0 scene in place (board approvals hash the original JSON).
export const legacySvgPlanSchema = z.strictObject({
  ...common,
  title: z.string().trim().min(1).max(72),
  subtitle: z.string().trim().max(160),
  fromValue: number,
  toValue: number,
});
export type LegacySvgPlan = z.infer<typeof legacySvgPlanSchema>;
export const titleSchema = z
  .string()
  .trim()
  .max(60)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{M}\p{N}'’–-]*(?: +[\p{L}\p{N}][\p{L}\p{M}\p{N}'’–-]*){1,3}$/u,
    'Başlık 2–4 sözcükten oluşmalı.',
  );
export const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(36)
  .refine(
    (s) =>
      s.split(/\s+/u).length <= 4 &&
      !/[|\r\n]/u.test(s) &&
      !/^(?:0?[123]\s+)?(?:başlangıç|dönüşüm|sonuç|incelenen yapı|odak noktası|ilk değer|ikinci değer)$/u.test(
        s.toLocaleLowerCase('tr'),
      ),
    'Konuya özgü, en fazla dört sözcüklük bir etiket gir.',
  );
export const svgPlanSchema = z
  .strictObject({
    ...common,
    title: titleSchema,
    icon: z.enum(icons),
    labels: z.array(labelSchema).max(3),
    fromValue: number.nullable(),
    toValue: number.nullable(),
  })
  .refine(
    (p) =>
      p.labels.length === labelCount[p.template] &&
      new Set(p.labels.map((l) => l.toLocaleLowerCase('tr'))).size === p.labels.length,
    'Şablon için doğru sayıda farklı etiket gir.',
  )
  .refine(
    (p) =>
      (p.fromValue !== null && p.toValue !== null) ||
      (p.template === 'ComparisonScene' && p.fromValue === null && p.toValue === null),
    'Ölçümler çift olmalı. Yalnız nitel karşılaştırmada iki değer null olabilir.',
  );
export type SvgPlan = z.infer<typeof svgPlanSchema>;
export type StoredSvgPlan = LegacySvgPlan | SvgPlan;
export const plannerProviders = ['local', 'groq', 'openrouter', 'ollama'] as const;
export type PlannerProvider = (typeof plannerProviders)[number];
export const plannerLabels: Record<PlannerProvider, string> = {
  local: 'Yerel şablonlar',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: 'Yerel Ollama',
};
export const plannerConfigSchema = z.strictObject({
  provider: z.enum(plannerProviders),
  ollamaModel: z
    .string()
    .trim()
    .min(1)
    .max(96)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/)
    .refine((m) => !m.toLowerCase().includes('cloud') && !m.includes('..')),
  groqFreeConfirmed: z.boolean(),
});
export type PlannerConfig = z.infer<typeof plannerConfigSchema>;
export type PlannerSettings = PlannerConfig & { keys: Record<'groq' | 'openrouter', boolean> };
