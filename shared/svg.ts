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
export const svgPlanSchema = z.strictObject({
  template: z.enum(templates),
  title: z.string().trim().min(1).max(72),
  subtitle: z.string().trim().max(160),
  fromValue: z.number().min(-1000000).max(1000000),
  toValue: z.number().min(-1000000).max(1000000),
  weather: z.enum(['snow', 'rain', 'none']),
  accentColor: z
    .string()
    .length(7)
    .regex(/^#[\da-fA-F]{6}$/),
});
export type SvgPlan = z.infer<typeof svgPlanSchema>;
export type Template = SvgPlan['template'];
export function defaultSvg(text: string, index = 0): SvgPlan {
  const lower = text.toLocaleLowerCase('tr'),
    numbers = (text.match(/[-−+]?\d+(?:[.,]\d+)?/g) ?? [])
      .map((n) => Number(n.replace('−', '-').replace(',', '.')))
      .filter((n) => Number.isFinite(n) && Math.abs(n) <= 1000000);
  const template: Template =
    /sıcaklık|derece|°c|termometre/u.test(lower) && numbers.length >= 2
      ? 'ThermometerGaugeScene'
      : /toprak|katman|kök|yeralt|yuva|yağmur|kar yağ/u.test(lower)
        ? 'CrossSectionScene'
        : numbers.length >= 2
          ? 'ComparisonScene'
          : /aşama|süreç|adım|önce|ardından/u.test(lower)
            ? 'ProcessFlowScene'
            : 'FocusCalloutScene';
  const words = text.trim().split(/\s+/u),
    title =
      words
        .slice(0, 6)
        .join(' ')
        .slice(0, 70)
        .replace(/[\uD800-\uDBFF]$/u, '') || `Sahne ${index + 1}`;
  return {
    template,
    title,
    subtitle: words.slice(6).join(' ').slice(0, 150),
    fromValue: numbers[0] ?? 0,
    toValue: numbers[1] ?? numbers[0] ?? 0,
    weather: /kar yağ|karlı/u.test(lower) ? 'snow' : /yağmur/u.test(lower) ? 'rain' : 'none',
    accentColor: ['#9ADBC1', '#F1BB79', '#8FCDE5', '#C5B8EB', '#D1D986'][index % 5],
  };
}
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
