import { z } from 'zod';
import { motionHeading } from '../shared/object-motion';
import { scienceLabel, scienceValue } from '../shared/science-label';
import type { Geometry } from '../shared/vector';
import { anatomy } from './science-art/anatomy';
import { ecology } from './science-art/ecology';
import { physics } from './science-art/physics';
import { generic } from './science-art/generic';
import { details } from './science-art/details';
import type { ArtContext } from './science-art/common';

// Stable names are embedded INSIDE the signed canonical SVG, not in an unsigned
// project field. Old objects-v1/v2 signatures and renderer semantics are unchanged.
export const templateIds = [
  'eye-front',
  'eye-cross',
  'brain',
  'neuron',
  'heart',
  'circulation',
  'cell',
  'dna',
  'lung',
  'muscle-joint',
  'soil-colony',
  'ant-tunnel',
  'colony-chamber',
  'atmosphere',
  'ocean-depth',
  'water-cycle',
  'plant',
  'photosynthesis',
  'refraction',
  'magnetism',
  'electricity',
  'orbit',
  'gravity',
  'sound',
  'thermal',
  'overview',
  'focus',
  'detail',
  'comparison',
  'cause-effect',
  'timeline',
  'microscope',
  'balance',
] as const;
export type TemplateId = (typeof templateIds)[number];
type Entry = { id: TemplateId; description: string; match?: RegExp };
// Prefixes deliberately operate on accent-folded Turkish/English. An ambiguous
// "gözden kaybolmak" is NOT an eye. Unknown subjects use neutral diagrams.
const catalog: Entry[] = [
  {
    id: 'eye-front',
    description: 'Gözün önden görünümü, göz kapağı, iris lifleri ve göz bebeği',
    match: /\b(?:goz(?!den|lem|lemevi)\w*|iris\w*|pupil\w*|eye\w*|gorme\w*)/,
  },
  {
    id: 'eye-cross',
    description: 'Göz kesiti: kornea, mercek, retina ve ışık',
    match:
      /\b(?:goz(?!den|lem|lemevi)\w*|gorme\w*|retina\w*|kornea\w*|mercek\w*|pupil\w*|eye\w*|optic\w*)/,
  },
  { id: 'brain', description: 'Beynin kıvrımları ve beyin sapı', match: /\b(?:beyin\w*|brain\w*)/ },
  {
    id: 'neuron',
    description: 'Sinir hücresi, dendritler ve akson',
    match: /\b(?:noron\w*|sinir\w*|neuron\w*|nerve\w*|beyin\w*|brain\w*)/,
  },
  {
    id: 'heart',
    description: 'Kalp odacıkları ve ana damarlar',
    match: /\b(?:kalp\w*|yurek\w*|heart\w*)/,
  },
  {
    id: 'circulation',
    description: 'Vücutta kan dolaşımı ve damarlar',
    match:
      /\b(?:kalp\w*|kan(?:[aiu]?|in|la|lar|da|dan)?\b|damar\w*|dolasi\w*|heart\w*|blood\w*|circulat\w*)/,
  },
  {
    id: 'cell',
    description: 'Hücre zarı, çekirdek ve organeller',
    match: /\b(?:hucre\w*|cell\w*|organel\w*)/,
  },
  {
    id: 'dna',
    description: 'DNA çift sarmalı ve baz çiftleri',
    match:
      /\b(?:dna\w*|gen(?:etik\w*|om\w*|otip\w*|ler\w*|i|in|e)?\b|kromozom\w*|chromosom\w*|hucre\w*|cell\w*)/,
  },
  {
    id: 'lung',
    description: 'Akciğer, soluk borusu ve dallanan bronşlar',
    match: /\b(?:akciger\w*|solunum\w*|nefes\w*|bron\w*|lung\w*|breath\w*)/,
  },
  {
    id: 'muscle-joint',
    description: 'Kas lifleri, tendonlar, kemik ve eklem',
    match: /\b(?:kas(?!im|irga|aba|it)\w*|eklem\w*|tendon\w*|kemik\w*|muscle\w*|joint\w*)/,
  },
  {
    id: 'soil-colony',
    description: 'Karınca yuvasının toprak altındaki geniş kesiti',
    match: /\b(?:karinca\w*|ants?\b)/,
  },
  {
    id: 'ant-tunnel',
    description: 'Tünel içindeki karıncanın yakın planı',
    match: /\b(?:karinca\w*|ants?\b)/,
  },
  {
    id: 'colony-chamber',
    description: 'Yeraltı karınca odacığı ve koloni',
    match: /\b(?:karinca\w*|ants?\b)/,
  },
  {
    id: 'atmosphere',
    description: 'Dünya eğrisi ve atmosfer katmanları',
    match: /\b(?:atmosfer\w*|hava katman\w*|atmospher\w*)/,
  },
  {
    id: 'ocean-depth',
    description: 'Deniz yüzeyi, su katmanları ve derin deniz',
    match: /\b(?:okyanus\w*|deniz\w*|ocean\w*|sea\b|deep sea)/,
  },
  {
    id: 'water-cycle',
    description: 'Su döngüsü: bulut, yağmur, akış ve buharlaşma',
    match: /\b(?:su dongu\w*|yagmur\w*|buharlas\w*|bulut\w*|water cycle|rain\w*|evapora\w*)/,
  },
  {
    id: 'plant',
    description: 'Bitki, yaprak damarları ve kökler',
    match: /\b(?:bitki\w*|agac\w*|yaprak\w*|plant\w*|tree\w*|leaf\w*)/,
  },
  {
    id: 'photosynthesis',
    description: 'Yaprak kesiti ve kloroplast, fotosentez',
    match: /\b(?:fotosentez\w*|kloroplast\w*|photosynth\w*|chloroplast\w*|yaprak\w*|leaf\w*)/,
  },
  {
    id: 'refraction',
    description: 'Prizmada ışığın kırılması',
    match: /\b(?:isik\w*|optik\w*|prizma\w*|kirilm\w*|light\b|optic\w*|prism\w*|refract\w*)/,
  },
  {
    id: 'magnetism',
    description: 'Mıknatıs kutupları ve manyetik alan çizgileri',
    match: /\b(?:miknatis\w*|manyetik\w*|magnet\w*)/,
  },
  {
    id: 'electricity',
    description: 'Pil, devre, direnç ve lamba',
    match: /\b(?:elektrik\w*|devre\w*|voltaj\w*|akim\w*|electric\w*|circuit\w*|battery\w*)/,
  },
  {
    id: 'orbit',
    description: 'Güneş çevresindeki gezegen yörüngeleri',
    match: /\b(?:yorunge\w*|gezegen\w*|planet\w*|orbit\w*|gunes sistem\w*|solar system)/,
  },
  {
    id: 'gravity',
    description: 'Dünya, uydu yörüngesi ve yerçekimi',
    match: /\b(?:yercekim\w*|kutlecekim\w*|uydu\w*|gravity\w*|gravit\w*|satellite\w*)/,
  },
  {
    id: 'sound',
    description: 'Hoparlör ve ses dalgaları',
    match: /\b(?:ses(?!siz)\w*|akustik\w*|sound\w*|acoustic\w*)/,
  },
  {
    id: 'thermal',
    description: 'İletimle ısı aktarımı',
    match: /\b(?:isi\b|isilar\w*|sicaklik\w*|termal\w*|heat\w*|thermal\w*)/,
  },
  { id: 'overview', description: 'Konuya özgü nesne iddiası olmayan genel bakış' },
  { id: 'focus', description: 'Yakından bakış ve büyütme' },
  { id: 'detail', description: 'Bir ayrıntıya yakınlaştırılmış genel şema' },
  {
    id: 'comparison',
    description: 'İki durumun karşılaştırılması',
    match: /\b(?:karsilastir\w*|fark\w*|daha fazla|daha az|compare\w*|versus|difference\w*)/,
  },
  {
    id: 'cause-effect',
    description: 'Neden ve etki ilişkisi',
    match: /\b(?:neden\w*|sonuc\w*|etki\w*|sebep\w*|cause\w*|effect\w*)/,
  },
  {
    id: 'timeline',
    description: 'Süreç, zaman çizelgesi veya evrim',
    match: /\b(?:zaman\w*|evrim\w*|asama\w*|yillar\w*|surec\w*|timeline\w*|evolut\w*|stage\w*)/,
  },
  {
    id: 'microscope',
    description: 'Mikroskop ve büyütülmüş örnek',
    match: /\b(?:mikroskop\w*|mikroskob\w*|microscop\w*)/,
  },
  {
    id: 'balance',
    description: 'Denge, karşıt kuvvet veya eşik',
    match: /\b(?:denge\w*|esik\w*|balance\w*|threshold\w*)/,
  },
];
const neutral: TemplateId[] = ['overview', 'focus', 'detail'];
const genericIds = new Set<TemplateId>([
  'overview',
  'focus',
  'detail',
  'comparison',
  'cause-effect',
  'timeline',
  'microscope',
  'balance',
]);
export const palettes = ['night', 'ocean', 'forest', 'ember'] as const;
export const accents = ['cyan', 'gold', 'coral', 'lime'] as const;
const colors: Record<(typeof accents)[number], string> = {
  cyan: '#70e8eb',
  gold: '#ffe49a',
  coral: '#ffac98',
  lime: '#c7ed99',
};
const backgrounds: Record<(typeof palettes)[number], [string, string]> = {
  night: ['#172c3e', '#0d1d2f'],
  ocean: ['#17465c', '#112b3e'],
  forest: ['#233e39', '#142a31'],
  ember: ['#4a3134', '#252633'],
};
const label = z
  .string()
  .trim()
  .max(28)
  .refine((v) => !v || scienceLabel(v), 'Etiket en fazla iki kısa bilimsel sözcük olmalı.');
const value = z
  .string()
  .trim()
  .max(14)
  .refine((v) => !v || scienceValue(v), 'Sayısal değer kısa ve güvenli olmalı.');
export const templateReply = z.strictObject({
  title: motionHeading,
  template: z.enum(templateIds),
  palette: z.enum(palettes).optional(),
  accent: z.enum(accents).optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  direction: z.enum(['forward', 'reverse']).optional(),
  level: z.number().int().min(0).max(100).optional(),
  label1: label.optional(),
  label2: label.optional(),
  value: value.optional(),
});
export type TemplateReply = z.output<typeof templateReply>;
// Gemini's constrained response schema, not generated by introspecting Zod types.
export const templateResponseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    template: { type: 'string', enum: [...templateIds] },
    palette: { type: 'string', enum: [...palettes] },
    accent: { type: 'string', enum: [...accents] },
    speed: { type: 'string', enum: ['slow', 'normal', 'fast'] },
    direction: { type: 'string', enum: ['forward', 'reverse'] },
    level: { type: 'integer', minimum: 0, maximum: 100 },
    label1: { type: 'string' },
    label2: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['title', 'template'],
  additionalProperties: false,
};
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('ı', 'i');
export function matchingTemplates(narration: string, topic: string) {
  const scene = normalize(narration),
    project = normalize(topic);
  const direct = catalog.filter(
    (e) => !genericIds.has(e.id) && e.match && (e.match.test(scene) || e.match.test(project)),
  );
  const related = catalog.filter(
    (e) => genericIds.has(e.id) && e.match && (e.match.test(scene) || e.match.test(project)),
  );
  return [...direct, ...related, ...catalog.filter((e) => neutral.includes(e.id))];
}
export function selectTemplate(
  requested: TemplateId,
  options: Entry[],
  used: ReadonlySet<TemplateId>,
  neighbors: ReadonlySet<TemplateId>,
): TemplateId {
  const eligible = options.map((e) => e.id).filter((id) => !neighbors.has(id));
  if (!eligible.length) throw new Error('No safe non-adjacent template'); // 3 neutral fallbacks > 2 neighbors
  // Neutral views are a fallback: do not discard a known, unused subject view
  // simply because a weak model asked for an abstract placeholder.
  if (neutral.includes(requested)) {
    const concrete = eligible.find((id) => !genericIds.has(id) && !used.has(id));
    if (concrete) return concrete;
  }
  if (eligible.includes(requested) && !used.has(requested)) return requested;
  // Prefer an unused specific illustration, but do not invent a subject just for variety.
  const fresh = eligible.find((id) => !used.has(id));
  if (fresh) return fresh;
  return eligible.includes(requested) ? requested : eligible[0];
}
export function templateIdInStage(stage: Geometry): TemplateId | undefined {
  const main = stage.children.find((n) => n.tag === 'g' && n.attrs.id === 'layer-main');
  const marker = main?.children
    .find((n) => n.tag === 'g' && n.attrs.id?.startsWith('tpl-v174-'))
    ?.attrs.id.slice(9);
  return templateIds.find((id) => id === marker);
}
// Labels/numbers are optional; only quote a literal span of the approved scene or
// topic. This prevents an LLM from inventing measurements or inserting subtitles.
function sourcedLabel(v: string | undefined, source: string) {
  if (!v || !scienceLabel(v)) return '';
  return normalize(source).includes(normalize(v)) ? v : '';
}
export function instantiateTemplate(id: TemplateId, reply: TemplateReply, source: string): string {
  const [top, bottom] = backgrounds[reply.palette ?? 'night'];
  const c: ArtContext = {
    accent: colors[reply.accent ?? 'cyan'],
    duration: ({ slow: 4.8, normal: 3.2, fast: 2.2 } as const)[reply.speed ?? 'normal'],
    direction: reply.direction === 'reverse' ? -1 : 1,
    level: reply.level ?? 50,
  };
  const i = templateIds.indexOf(id),
    art =
      i < 10 ? anatomy(id, c) : i < 18 ? ecology(id, c) : i < 25 ? physics(id, c) : generic(id, c);
  const first = sourcedLabel(reply.label1, source),
    second = sourcedLabel(reply.label2 || reply.value, source);
  const inset = details(id, c);
  // Keep the secondary diagram at the top, clear of even a three-line caption.
  const detailPanel = inset
    ? `<g id="science-detail" transform="translate(0 -1120)"><rect x="200" y="1200" width="680" height="210" rx="24" fill="#203b48" stroke="#5e8b89" stroke-width="4"/>${inset}</g>`
    : '';
  const labels = [first, second === first ? '' : second]
    .map((v, i) => {
      if (!v) return '';
      const half = (Array.from(v).length * 28 * 0.9) / 2;
      const x = Math.max(24 + half, Math.min(1056 - half, i ? 850 : 230));
      return `<text data-keyword="true" data-label-outline="true" x="${x}" y="${i ? 1150 : 365}" font-size="28" font-weight="600" fill="#f6fff2" text-anchor="middle">${v}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 1080 1920"><defs><linearGradient id="back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><g id="layer-bg"><rect width="1080" height="1920" fill="url(#back)"/><g id="set">${art.background ?? ''}</g></g><g id="layer-main"><g id="tpl-v174-${id}">${art.main}${detailPanel}</g></g><g id="layer-fx">${art.fx}${labels}</g></svg>`;
}
