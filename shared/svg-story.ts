// Local editorial vocabulary for the offline planner. These are diagram nouns and labels,
// never replacement narration. Unknown subjects use the author's own keywords.
import {
  labelCount,
  labelSchema,
  legacySvgPlanSchema,
  templates,
  titleSchema,
  type ScienceIcon,
  type StoredSvgPlan,
  type SvgPlan,
  type Template,
} from './svg';

type Subject = {
  icon: ScienceIcon;
  title: string;
  pair: [string, string];
  flow: [string, string, string];
};
const subjects: [RegExp, Subject][] = [
  [
    /hücre|ozmo[sz]|osmo[sz]|zarından/,
    {
      icon: 'cell',
      title: 'Hücrede Su Dengesi',
      pair: ['Hücre içi sıvı', 'Hücre dışı sıvı'],
      flow: ['Yoğunluk farkı', 'Zardan su geçişi', 'Sıvı dengesi'],
    },
  ],
  [
    /beyin|beyn|hipotalamus|sinir|nöron/,
    {
      icon: 'brain',
      title: 'Beynin Sinyalleri',
      pair: ['Duyu sinyali', 'Beynin yanıtı'],
      flow: ['Uyarının algılanması', 'Sinir iletimi', 'Beynin yanıtı'],
    },
  ],
  [
    /ağız|ağz|damak|tükürük/,
    {
      icon: 'water',
      title: 'Ağızda Kalan Tat',
      pair: ['Tatlı lokma', 'Bir yudum su'],
      flow: ['Tatlı lokma', 'Damakta kalan tat', 'Su içme isteği'],
    },
  ],
  [
    /(?:^| )kan(?:da|a|ın|ı| dolaş| şeker)|damar|alyuvar|plazma/,
    {
      icon: 'blood',
      title: 'Kan Dolaşımı',
      pair: ['Kan plazması', 'Damar duvarı'],
      flow: ['Bağırsakta emilim', 'Kana geçiş', 'Damarlarla taşınma'],
    },
  ],
  [
    /şeker|glikoz|glukoz|sindirim|molekül|kimya|atom/,
    {
      icon: 'molecule',
      title: 'Moleküllerin Yapısı',
      pair: ['Molekül', 'Atomlar'],
      flow: ['Atomlar', 'Kimyasal bağlar', 'Molekül'],
    },
  ],
  [
    /buharlaş|yoğuş|su döngü/,
    {
      icon: 'water',
      title: 'Suyun Yolculuğu',
      pair: ['Su buharı', 'Su damlası'],
      flow: ['Buharlaşma', 'Yoğuşma', 'Yağış'],
    },
  ],
  [
    /susama|susa[dr]|susuz|sıvı|su iç|içtiğimiz su|yağmur|damla|deniz|okyanus|(?:^| )su(?: |yu|ya|da|yun)/,
    {
      icon: 'water',
      title: 'Suyun Hareketi',
      pair: ['Su damlası', 'Su yüzeyi'],
      flow: ['Su damlası', 'Yüzeyde akış', 'Su birikimi'],
    },
  ],
  [
    /yapra[kğ]|bitki|kök|fotosentez|orman/,
    {
      icon: 'leaf',
      title: 'Bitkinin Yapısı',
      pair: ['Yaprak ayası', 'Ana damar'],
      flow: ['Kökten emilim', 'Gövdede taşınma', 'Yaprağa ulaşım'],
    },
  ],
  [
    /sıcak|termometre|derece|°c|enerji|ateş|alev|ısın|ısı /,
    {
      icon: 'flame',
      title: 'Isı Değişimi',
      pair: ['Isı kaynağı', 'Isınan ortam'],
      flow: ['Isı kaynağı', 'Isı aktarımı', 'Sıcaklık değişimi'],
    },
  ],
  [
    /topra[kğ]|katman|yeralt|yüzey|yuva|dünya|gezegen|kaya|karlı|kar yağ/,
    {
      icon: 'earth',
      title: 'Yüzeyin Altında',
      pair: ['Yeryüzü', 'Toprak katmanı'],
      flow: ['Yüzey', 'Üst katman', 'Derin katman'],
    },
  ],
];
const lower = (s: string) => s.toLocaleLowerCase('tr').normalize('NFC');
const upperFirst = (s: string) => s.slice(0, 1).toLocaleUpperCase('tr') + s.slice(1);
const stop =
  /^(?:ve|ile|için|neden|nasıl|gibi|daha|fakat|önce|sonra|çünkü|bir|bu|olan|olarak|hemen|bile|çok|ise|kadar)$/u;
function keywords(text: string) {
  return [
    ...new Set(
      (lower(text).match(/[\p{L}][\p{L}\p{M}’'-]*/gu) ?? []).filter(
        (w) => w.length > 2 && w.length <= 22 && !stop.test(w),
      ),
    ),
  ];
}
function subjectFor(text: string, topic: string): Subject {
  const source = lower(text),
    match = (s: string) => subjects.find(([r]) => r.test(s))?.[1];
  const base = match(source) ?? match(lower(topic));
  if (base) {
    if (base.icon === 'blood' && /şeker|gl[iu]koz|yoğun|çözünmüş/.test(source))
      return {
        ...base,
        title: /yoğun|çözünmüş/.test(source) ? 'Kandaki Yoğunluk Artışı' : 'Glikozun Kana Geçişi',
        pair: ['Kan plazması', 'Çözünmüş glikoz'],
        flow: ['Sindirim', 'Glikoz emilimi', 'Kana geçiş'],
      };
    if (base.icon === 'brain' && /sus|sıvı|su iç/.test(source + ' ' + lower(topic)))
      return {
        ...base,
        title: 'Beynin Susama Sinyali',
        pair: ['Sıvı dengesi', 'Susama merkezi'],
        flow: ['Yoğunluk değişimi', 'Beyinde algılama', 'Susama hissi'],
      };
    if (base.icon === 'molecule' && /şeker|gl[iu]koz|tatlı/.test(source))
      return {
        ...base,
        title: 'Şekerin Yolculuğu',
        pair: ['Şeker molekülü', 'Çözünmüş şeker'],
        flow: ['Şekerin sindirimi', 'Bağırsakta emilim', 'Kana geçiş'],
      };
    if (base.icon === 'water' && /susuz|susama|su iç|sıvı denge|içtiğimiz su/.test(source))
      return {
        ...base,
        title: /tatlı|şeker/.test(source) ? 'Tatlı ve Susama' : 'Vücudun Su Dengesi',
        pair: ['Susama hissi', 'Bir yudum su'],
        flow: ['Susama sinyali', 'Su içme', 'Sıvı dengesi'],
      };
    return base;
  }
  const [a, b, c] = keywords(text + ' ' + topic),
    key = upperFirst(a ?? 'Bilim'),
    second = b ? upperFirst(b) : key + ' incelemesi';
  return {
    icon: 'earth',
    title: b ? `${key} ve ${upperFirst(b)}` : `${key} Üzerine`,
    pair: [key, second],
    flow: [key, second, c ? upperFirst(c) : `${key} etkisi`],
  };
}
function evidence(text: string) {
  const source = lower(text),
    values = (source.match(/[-−+]?\d+(?:[.,]\d+)?/gu) ?? [])
      .map((s) => Number(s.replace('−', '-').replace(',', '.')))
      .filter((n) => Number.isFinite(n) && Math.abs(n) <= 1e6);
  return {
    source,
    values,
    thermal:
      values.length >= 2 &&
      /sıcaklık|derece|°\s*c|termometre/.test(source) &&
      !/fahrenheit|°\s*f|kelvin/.test(source),
  };
}
export function diagramLabels(template: Template, text: string, topic = ''): string[] {
  const { icon, pair, flow } = subjectFor(text, topic);
  if (template === 'ThermometerGaugeScene') return [];
  if (template === 'ProcessFlowScene') return [...flow];
  if (template === 'CrossSectionScene') {
    if (icon === 'cell') return ['Hücre dışı sıvı', 'Hücre içi sıvı'];
    if (icon === 'blood') return ['Kan plazması', 'Damar duvarı'];
    if (icon === 'leaf') return ['Toprak yüzeyi', 'Kök bölgesi'];
  }
  return [...pair];
}
// Rank only scientifically plausible options. A variety bonus must never introduce a
// temperature measurement or fictitious bar values to break a run of identical shots.
function rank(
  text: string,
  topic: string,
  previous: Template | undefined,
  counts: Partial<Record<Template, number>>,
  prefer?: Template,
) {
  const { source, values, thermal } = evidence(text),
    icon = subjectFor(text, topic).icon;
  const scores: Record<Template, number> = {
    ThermometerGaugeScene: thermal ? 12 : -Infinity,
    CrossSectionScene:
      /topra[kğ]|katman|yeralt|kök|yuva|damar|zar[ıd]|hücre/.test(source) &&
      ['cell', 'blood', 'leaf', 'earth', 'water'].includes(icon)
        ? 9
        : -Infinity,
    ComparisonScene:
      values.length >= 2
        ? 8
        : /karşılaştır|daha |fark|yoğunlu|kıyas|arasında|oysa|göre|tatlı.*su |şeker.*su /.test(
              source,
            )
          ? 6
          : -Infinity,
    ProcessFlowScene:
      /süreç|önce|sonra|ardından|adım|geçiş|karış|dönüş|ilet|emil|sindirim|hareket|yolculu/.test(
        source,
      )
        ? 8
        : 3,
    FocusCalloutScene: 5,
  };
  const score = (t: Template) =>
    scores[t] + (t === prefer ? 12 : 0) - Math.min(6, (counts[t] ?? 0) * 1.75);
  return templates.filter((t) => t !== previous).sort((a, b) => score(b) - score(a))[0];
}
export function defaultSvg(
  text: string,
  index = 0,
  topic = '',
  template = rank(text, topic, undefined, {}),
): SvgPlan {
  const { source, values } = evidence(text),
    subject = subjectFor(text, topic),
    qualitative = template === 'ComparisonScene' && values.length < 2;
  return {
    template,
    title: subject.title,
    icon: subject.icon,
    labels: diagramLabels(template, text, topic),
    fromValue: qualitative ? null : (values[0] ?? 0),
    toValue: qualitative ? null : (values[1] ?? values[0] ?? 0),
    weather: /kar yağ|karlı|karla/.test(source) ? 'snow' : /yağmur/.test(source) ? 'rain' : 'none',
    accentColor: ['#9ADBC1', '#F1BB79', '#8FCDE5', '#C5B8EB', '#D1D986'][index % 5],
  };
}
// Resolve legacy data for display/explicit editing, without modifying the signed stored board.
export function displayPlan(stored: StoredSvgPlan, text: string, topic = ''): SvgPlan {
  if ('icon' in stored) return stored;
  const old = legacySvgPlanSchema.parse(stored),
    seed = defaultSvg(text, 0, topic, old.template),
    parts = old.subtitle.split('|').map((t) => t.trim());
  return {
    ...seed,
    fromValue: old.fromValue,
    toValue: old.toValue,
    weather: old.weather,
    accentColor: old.accentColor,
    title: titleSchema.safeParse(old.title).data ?? seed.title,
    labels:
      parts.length === labelCount[old.template] &&
      new Set(parts.map(lower)).size === parts.length &&
      parts.every((l) => labelSchema.safeParse(l).success)
        ? parts
        : seed.labels,
  };
}
export function storyboardPlans(
  rows: string[],
  topic: string,
  preferences: (SvgPlan | undefined)[] = [],
  retainSaved = false,
): SvgPlan[] {
  const counts: Partial<Record<Template, number>> = {};
  let previous: Template | undefined;
  return rows.map((text, index) => {
    const p = preferences[index];
    if (retainSaved && p && p.template !== previous) {
      previous = p.template;
      counts[previous] = (counts[previous] ?? 0) + 1;
      return p;
    }
    const template = rank(text, topic, previous, counts, p?.template),
      seed = defaultSvg(text, index, topic, template);
    counts[template] = (counts[template] ?? 0) + 1;
    previous = template;
    if (
      !p ||
      (p.icon === 'leaf' &&
        seed.icon !== 'leaf' &&
        /hücre|beyin|susama|su iç|şeker|glikoz|damar|kan(?:da|a)|ağız/.test(lower(text)))
    )
      return seed;
    const plan = {
      ...seed,
      title: p.title,
      accentColor: p.accentColor,
      weather: p.weather,
      icon: p.icon,
    };
    if (template === p.template) {
      plan.labels = p.labels; // Measurements must come from the narration; qualitative comparisons have no scale.
      if (template === 'ComparisonScene' || template === 'ThermometerGaugeScene') {
        const { values } = evidence(text);
        if (
          p.fromValue !== null &&
          p.toValue !== null &&
          values.includes(p.fromValue) &&
          values.includes(p.toValue)
        ) {
          plan.fromValue = p.fromValue;
          plan.toValue = p.toValue;
        }
      } else {
        plan.fromValue = p.fromValue;
        plan.toValue = p.toValue;
      }
    }
    return plan;
  });
}
