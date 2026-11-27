import type { TemplateId } from './science-templates';

/** Local usage contracts, also supplied to the planner. Keywords are descriptive;
 * matching additionally applies inflection/ambiguity guards in science-templates. */
export type ScienceCategory =
  | 'anatomy'
  | 'biology'
  | 'ecology'
  | 'earth'
  | 'space'
  | 'physics'
  | 'diagram';
export type TemplateMeta = {
  category: ScienceCategory;
  keywords: { tr: readonly string[]; en: readonly string[] };
  scope: string;
};
const entry = (
  category: ScienceCategory,
  tr: string[],
  en: string[],
  scope: string,
): TemplateMeta => ({ category, keywords: { tr, en }, scope });

/** Exactly one explicit category, bilingual keyword list and usage scope per stable ID. */
export const templateMetadata: Record<TemplateId, TemplateMeta> = {
  'eye-front': entry(
    'anatomy',
    ['göz', 'iris', 'göz bebeği', 'görme'],
    ['eye', 'iris', 'pupil', 'vision'],
    'Yalnız gerçek göz ve görme anlatımı; gözlem veya gözden kaybolma değil.',
  ),
  'eye-cross': entry(
    'anatomy',
    ['göz', 'retina', 'kornea', 'göz merceği'],
    ['eye', 'retina', 'cornea', 'eye lens'],
    'Göz anatomisi ve gözde ışığın izlediği yol.',
  ),
  brain: entry(
    'anatomy',
    ['beyin', 'beyin sapı'],
    ['brain', 'brainstem'],
    'Beynin yapısı; genel sinir iletimi için nöron da uygundur.',
  ),
  neuron: entry(
    'biology',
    ['nöron', 'sinir', 'beyin', 'akson'],
    ['neuron', 'nerve', 'brain', 'axon'],
    'Sinir hücresi ve sinyal iletimi.',
  ),
  heart: entry(
    'anatomy',
    ['kalp', 'yürek', 'kalp atışı'],
    ['heart', 'heartbeat', 'cardiac'],
    'Kalp anatomisi ve nabız; damarlar kalple birlikte hareket eder.',
  ),
  circulation: entry(
    'anatomy',
    ['kan', 'damar', 'dolaşım', 'kalp'],
    ['blood', 'vessel', 'circulation', 'heart'],
    'Kan ve vücut dolaşımı; karasal veya okyanus akıntısı değil.',
  ),
  cell: entry(
    'biology',
    ['hücre', 'organel', 'hücre zarı'],
    ['cell', 'organelle', 'cell membrane'],
    'Hücre yapısı ve organeller.',
  ),
  dna: entry(
    'biology',
    ['DNA', 'gen', 'genetik', 'kromozom'],
    ['DNA', 'gene', 'genetics', 'chromosome'],
    'DNA ve kalıtım; genişlemek sözcüğü gen değildir.',
  ),
  lung: entry(
    'anatomy',
    ['akciğer', 'nefes', 'solunum', 'bronş'],
    ['lung', 'breath', 'respiration', 'bronchus'],
    'Akciğer ve solunum anatomisi.',
  ),
  'muscle-joint': entry(
    'anatomy',
    ['kas', 'eklem', 'tendon', 'kemik'],
    ['muscle', 'joint', 'tendon', 'bone'],
    'Kas, kemik ve eklem yapısı.',
  ),
  'soil-colony': entry(
    'ecology',
    ['karınca', 'koloni', 'yuva', 'toprak altı'],
    ['ant', 'colony', 'nest', 'underground'],
    'Karınca yuvası ve yeraltı kolonisi geniş görünümü.',
  ),
  'ant-tunnel': entry(
    'ecology',
    ['karınca', 'tünel', 'yuva'],
    ['ant', 'tunnel', 'nest'],
    'Karınca ve yuva tünelinin yakın görünümü.',
  ),
  'colony-chamber': entry(
    'ecology',
    ['karınca', 'koloni', 'odacık', 'kraliçe'],
    ['ant', 'colony', 'chamber', 'queen'],
    'Karınca kolonisinin odacığı ve bireyleri.',
  ),
  atmosphere: entry(
    'earth',
    ['atmosfer', 'hava katmanı'],
    ['atmosphere', 'air layer'],
    'Dünya atmosferinin katmanları.',
  ),
  'ocean-depth': entry(
    'earth',
    ['okyanus', 'deniz', 'derinlik'],
    ['ocean', 'sea', 'deep sea'],
    'Deniz yüzeyi ve okyanus derinliği.',
  ),
  'water-cycle': entry(
    'earth',
    ['su döngüsü', 'yağmur', 'buharlaşma', 'bulut'],
    ['water cycle', 'rain', 'evaporation', 'cloud'],
    'Su döngüsü, yağış, akış ve buharlaşma.',
  ),
  plant: entry(
    'biology',
    ['bitki', 'ağaç', 'yaprak', 'kök'],
    ['plant', 'tree', 'leaf', 'root'],
    'Bitki ve yaprak/kök yapısı.',
  ),
  photosynthesis: entry(
    'biology',
    ['fotosentez', 'kloroplast', 'yaprak'],
    ['photosynthesis', 'chloroplast', 'leaf'],
    'Fotosentez ve yapraktaki kloroplast.',
  ),
  refraction: entry(
    'physics',
    ['kırılma', 'prizma', 'optik', 'ışık'],
    ['refraction', 'prism', 'optics', 'light'],
    'Prizmada optik kırılma; uzaydaki ışık bükülmesini prizmayla göstermez.',
  ),
  magnetism: entry(
    'physics',
    ['mıknatıs', 'manyetik alan'],
    ['magnet', 'magnetic field'],
    'Mıknatıs ve manyetik alan.',
  ),
  electricity: entry(
    'physics',
    ['elektrik', 'devre', 'akım', 'pil'],
    ['electricity', 'circuit', 'current', 'battery'],
    'Elektrik devresi ve akım.',
  ),
  orbit: entry(
    'space',
    ['yörünge', 'gezegen', 'güneş sistemi', 'kara delik'],
    ['orbit', 'planet', 'solar system', 'black hole'],
    'Uzay ve yörünge; kara delikte yerel yığılma diski görünümü.',
  ),
  gravity: entry(
    'space',
    ['yerçekimi', 'kütleçekim', 'uydu', 'kara delik'],
    ['gravity', 'gravitation', 'satellite', 'black hole'],
    'Kütleçekim ve uzay; kara delikte olay ufku ve ışık bükülmesi.',
  ),
  sound: entry(
    'physics',
    ['ses', 'akustik', 'ses dalgası'],
    ['sound', 'acoustics', 'sound wave'],
    'Ses kaynağı ve dalga yayılması.',
  ),
  thermal: entry(
    'physics',
    ['ısı', 'sıcaklık', 'termal', 'iletim'],
    ['heat', 'temperature', 'thermal', 'conduction'],
    'Isı iletimi ve sıcaklık farkı.',
  ),
  overview: entry(
    'diagram',
    ['genel bakış', 'bütün'],
    ['overview', 'whole'],
    'Konuya uyarlanan genel görünüm; bilinmeyen konuda nötr şema.',
  ),
  focus: entry(
    'diagram',
    ['odak', 'yakın plan'],
    ['focus', 'close-up'],
    'Konuya uyarlanan yakın görünüm; göz veya optik iddiası değildir.',
  ),
  detail: entry(
    'diagram',
    ['ayrıntı', 'kesit'],
    ['detail', 'cross section'],
    'Konuya uyarlanan ayrıntı; bilinmeyen konuda nötr yapı.',
  ),
  comparison: entry(
    'diagram',
    ['karşılaştırma', 'fark'],
    ['comparison', 'difference'],
    'İki durumun karşılaştırılması veya konuya uyarlanmış görünüm.',
  ),
  'cause-effect': entry(
    'diagram',
    ['neden', 'sonuç', 'etki'],
    ['cause', 'effect'],
    'Neden/etki ilişkisi veya konuya uyarlanmış görünüm.',
  ),
  timeline: entry(
    'diagram',
    ['zaman', 'aşama', 'süreç', 'evrim'],
    ['timeline', 'stage', 'process', 'evolution'],
    'Süreç veya konuya uyarlanmış sıralı görünüm.',
  ),
  microscope: entry(
    'diagram',
    ['mikroskop', 'büyütme'],
    ['microscope', 'magnification'],
    'Mikroskop yalnız gerçekten anılıyorsa; aksi durumda konu ayrıntısı.',
  ),
  balance: entry(
    'diagram',
    ['denge', 'eşik'],
    ['balance', 'threshold'],
    'Denge veya konuya uyarlanmış bilimsel görünüm.',
  ),
};
