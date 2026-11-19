import { z } from 'zod';
import { artRefSchema, keywordSchema, artMode, artworkPolicy } from './artwork';

// The entire language accepted by the drawing engine. No markup, URLs, style objects or code slots.
const originalTemplates = [
  'CrossSectionScene',
  'ThermometerGaugeScene',
  'FocusCalloutScene',
  'ComparisonScene',
  'ProcessFlowScene',
] as const;
export const templates = [
  ...originalTemplates,
  'TitleHookScene',
  'CycleLoopScene',
  'RatioGaugeScene',
  'LayerStackScene',
  'WavePulseScene',
  'SplitCauseEffectScene',
  'TimelineScaleScene',
] as const;
export type Template = (typeof templates)[number];
// One catalogue for the JSON contract, automatic repair, editor and model instructions.
export const catalogue = {
  CrossSectionScene: { name: 'Katman kesiti', slots: [2, 2], use: 'Üst ve alt bölge' },
  ThermometerGaugeScene: {
    name: 'Termometre',
    slots: [2, 2],
    use: 'Sıcaklığı ölçülen ortam ve ölçüm aralığı (°C)',
  },
  FocusCalloutScene: {
    name: 'Odak ve açıklama',
    slots: [2, 2],
    use: 'Tek bilim ikonuna iki açıklama',
  },
  ComparisonScene: { name: 'Karşılaştırma', slots: [2, 2], use: 'İki nesne veya değer' },
  ProcessFlowScene: { name: 'Üç adımlı süreç', slots: [3, 3], use: 'Birbirini izleyen üç adım' },
  TitleHookScene: {
    name: 'Açılış kancası',
    slots: [1, 1],
    use: 'Filmin açılış sorusu; tek konu etiketi',
  },
  CycleLoopScene: { name: 'Döngü', slots: [3, 4], use: 'Başlangıca dönen üç veya dört aşama' },
  RatioGaugeScene: {
    name: 'Oran göstergesi',
    slots: [1, 1],
    use: 'Anlatımda geçen yüzde veya kat ve neyin oranı olduğu',
  },
  LayerStackScene: {
    name: 'Katman dizisi',
    slots: [3, 4],
    use: 'Yukarıdan aşağıya üç veya dört katman adı',
  },
  WavePulseScene: {
    name: 'Dalga ve sinyal',
    slots: [2, 2],
    use: 'Dalganın kaynağı ve ulaştığı yer',
  },
  SplitCauseEffectScene: {
    name: 'Neden ve sonuç',
    slots: [2, 2],
    use: 'Neden ve etkisi veya önce ve sonra',
  },
  TimelineScaleScene: {
    name: 'Üç noktalı ölçek',
    slots: [3, 3],
    use: 'Zaman, mesafe veya yükseklik ekseninde başlangıç, orta nokta ve bitiş etiketleri',
  },
} as const satisfies Record<
  Template,
  { name: string; slots: readonly [number, number]; use: string }
>;
export const templateNames = Object.fromEntries(
  templates.map((t) => [t, catalogue[t].name]),
) as Record<Template, string>;
export const icons = [
  'cell',
  'water',
  'brain',
  'molecule',
  'blood',
  'leaf',
  'earth',
  'flame',
  'airplane',
  'sun',
  'snowflake',
  'ant',
  'eye',
  'heart',
  'atom',
  'soundwave',
  'shield',
  'clock',
  'globe',
  'lightning',
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
  airplane: 'Uçak',
  sun: 'Güneş',
  snowflake: 'Kar kristali',
  ant: 'Karınca',
  eye: 'Göz',
  heart: 'Kalp',
  atom: 'Atom',
  soundwave: 'Ses dalgası',
  shield: 'Koruyucu kalkan',
  clock: 'Saat',
  globe: 'Yerküre',
  lightning: 'Şimşek',
};
export const ratioUnits = ['%', '×'] as const,
  scaleUnits = ['km', 'm', 'cm', 's', 'dk', 'sa', 'gün', 'yıl', 'sıra'] as const;
const number = z.number().min(-1000000).max(1000000);
const style = {
  weather: z.enum(['snow', 'rain', 'none']),
  accentColor: z
    .string()
    .length(7)
    .regex(/^#[\da-fA-F]{6}$/),
};
// Never mutate a signed 1.1.x plan in place when adapting it for display.
export const legacySvgPlanSchema = z.strictObject({
  ...style,
  template: z.enum(originalTemplates),
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
  )
  .refine(
    (s) =>
      /\p{L}/u.test(s) &&
      !/(?:^| )(?:ve|ile|ama|veya|için|bir|bu|gibi)$/u.test(s.toLocaleLowerCase('tr')) &&
      !/^(?:sahne|başlık|şablon|örnek başlık|sahne başlığı|başlık buraya|buraya başlık|kısa başlık|scene|title|test)(?: \d+)?$/u.test(
        s.toLocaleLowerCase('tr'),
      ),
    'Tam ve konuya özgü bir başlık gir.',
  );
export const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(36)
  .refine(
    (s) =>
      /[\p{L}\p{N}]/u.test(s) &&
      !/[\p{Cf}]/u.test(s) &&
      s.split(/\s+/u).length <= 4 &&
      !/[|\r\n]/u.test(s) &&
      !/^(?:0?[123]\s+)?(?:başlangıç|dönüşüm|sonuç|incelenen yapı|odak noktası|ilk değer|ikinci değer|(?:adım|etiket|aşama|label|stage|step) *[1-9]?|yer tutucu|placeholder)$/u.test(
        s.toLocaleLowerCase('tr'),
      ),
    'Konuya özgü, en fazla dört sözcüklük bir etiket gir.',
  );
const unit = z.enum([...ratioUnits, ...scaleUnits]);
const artFields = {
  iconKeyword: keywordSchema.optional(),
  artMode: artMode.optional(),
  artwork: artRefSchema.optional(),
};
const base = {
  ...artFields,
  ...style,
  template: z.enum(templates),
  icon: z.enum(icons),
  fromValue: number.nullable(),
  toValue: number.nullable(),
};
const planBase = z.strictObject({
  ...base,
  title: titleSchema,
  labels: z.array(labelSchema),
  unit: unit.optional(),
  midValue: number.optional(),
});
export type SvgPlan = z.infer<typeof planBase>;
// Tolerate absent or blank planner fields, but never accept extra keys, unknown enum
// identifiers, markup as geometry, or objects in place of plain editorial text.
const blank = z.string().trim().length(0);
export const plannerDraftSchema = z.strictObject({
  iconKeyword: keywordSchema.or(blank).nullish(),
  keywordEvidence: z.string().max(100).nullish(),
  artMode: artMode.optional(),
  template: base.template.or(blank).nullish(),
  icon: base.icon.or(blank).nullish(),
  weather: style.weather.or(blank).nullish(),
  accentColor: style.accentColor.or(blank).nullish(),
  fromValue: number.nullish(),
  toValue: number.nullish(),
  unit: unit.or(blank).nullish(),
  midValue: number.nullish(),
  title: z.string().max(512).nullish(),
  labels: z.array(z.string().max(512).nullable()).max(12).nullish(),
});
export type PlannerDraft = z.infer<typeof plannerDraftSchema>;
// Each literal JSON Schema branch declares its required fields and array bounds. The
// additional refinements below also run on save, approval and before rendering.
const [first, ...rest] = templates.map((t) => {
  const [min, max] = catalogue[t].slots;
  const fields = {
    ...base,
    template: z.literal(t),
    title: titleSchema,
    labels: z.array(labelSchema).min(min).max(max),
  };
  if (t === 'RatioGaugeScene')
    return z.strictObject({
      ...fields,
      unit: z.enum(ratioUnits),
      fromValue: z.literal(0),
      toValue: number.nonnegative(),
    });
  if (t === 'TimelineScaleScene')
    return z.strictObject({
      ...fields,
      unit: z.enum(scaleUnits),
      fromValue: number,
      midValue: number,
      toValue: number,
    });
  if (t === 'ComparisonScene') return z.strictObject(fields);
  return z.strictObject({ ...fields, fromValue: number, toValue: number });
});
export const svgPlanSchema: z.ZodType<SvgPlan> = z
  .discriminatedUnion('template', [first, ...rest])
  .superRefine((p: SvgPlan, ctx) => {
    if (
      new Set(p.labels.map((l) => l.normalize('NFC').toLocaleLowerCase('tr'))).size !==
      p.labels.length
    )
      ctx.addIssue({ code: 'custom', path: ['labels'], message: 'Her etiket farklı olmalı.' });
    if ((p.fromValue === null) !== (p.toValue === null))
      ctx.addIssue({ code: 'custom', message: 'Karşılaştırma değerleri çift olmalı.' });
    if (p.unit === '%' && p.toValue !== null && p.toValue > 100)
      ctx.addIssue({
        code: 'custom',
        path: ['toValue'],
        message: 'Yüzde 0–100 aralığında olmalı.',
      });
    if (
      p.midValue !== undefined &&
      p.fromValue !== null &&
      p.toValue !== null &&
      (p.midValue < Math.min(p.fromValue, p.toValue) ||
        p.midValue > Math.max(p.fromValue, p.toValue) ||
        p.fromValue === p.toValue)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['midValue'],
        message: 'Orta nokta iki farklı uç arasında olmalı.',
      });
  });
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
  artworkPolicy: artworkPolicy.default('hybrid'),
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
