// Read-only atlas formats for pre-1.4 saved boards. Never used to generate new scenes.
import { z } from 'zod';
import { artRefSchema, keywordSchema, artMode } from './artwork';

// Known identifiers in historic project files.
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
// Display names and historic label slots for archived plates.
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
// These fields are read, not authored, in 1.4+. Old vocabulary and label counts
// varied between releases. Keep the saved words rather than invent replacements.
export const svgPlanSchema = z.strictObject({
  iconKeyword: keywordSchema.optional(),
  artMode: artMode.optional(),
  artwork: artRefSchema.optional(),
  ...style,
  template: z.enum(templates),
  icon: z.enum(icons),
  fromValue: number.nullable(),
  toValue: number.nullable(),
  title: z.string().max(72),
  labels: z.array(z.string().max(160)).max(4),
  unit: z.enum([...ratioUnits, ...scaleUnits]).optional(),
  midValue: number.optional(),
});
export type SvgPlan = z.infer<typeof svgPlanSchema>;
export type StoredSvgPlan = LegacySvgPlan | SvgPlan;
