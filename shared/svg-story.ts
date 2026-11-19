import {
  catalogue,
  icons,
  labelSchema,
  legacySvgPlanSchema,
  svgPlanSchema,
  templates,
  titleSchema,
  type PlannerDraft,
  type StoredSvgPlan,
  type SvgPlan,
  type Template,
} from './svg';
import { copyFor, grounded, lower, namedSequence } from './svg-copy';
import { concepts, needsCustom } from './visual-concepts';
import { keywordSchema } from './artwork';
import { measurements, type Measures } from './svg-measures';

// The four qualitative views always have grounded, non-numeric copy available. A
// variation requirement must never turn an altitude, angle or percentage into °C.
function suitability(
  m: Measures,
  index: number,
  subjectIcon: SvgPlan['icon'],
  hint?: PlannerDraft,
) {
  const { source: s, scale, temp, ratio, values } = m;
  const cycle = namedSequence(s, 'cycle'),
    layers = namedSequence(s, 'layers');
  const scores: Record<Template, number> = {
    TitleHookScene: index === 0 ? (/\?|neden|nasıl/.test(s) ? 24 : 8) : -Infinity,
    ThermometerGaugeScene: temp.length >= 2 ? 22 : -Infinity,
    RatioGaugeScene: ratio ? 23 : -Infinity,
    TimelineScaleScene: scale
      ? 22
      : /zaman çiz|kronoloj|yıllar içinde|dönüm noktası/.test(s)
        ? 16
        : -Infinity,
    LayerStackScene: layers ? 22 : /katman|tabaka/.test(s) ? 13 : -Infinity,
    CycleLoopScene: cycle || /döngü|çevrim|tekrar baş|yinelen/.test(s) ? 21 : -Infinity,
    WavePulseScene: /dalga|frekans|titreşim|radyo|ışık.*yayıl|ısı.*yayıl|sinyal.*ulaş/.test(s)
      ? 20
      : -Infinity,
    CrossSectionScene: /kesit/.test(s)
      ? 21
      : /topra[kğ]|yeralt|kök|yuva|zar[ıd]|hücre/.test(s) &&
          ['leaf', 'earth', 'ant', 'cell', 'blood'].includes(subjectIcon)
        ? 13
        : -Infinity,
    SplitCauseEffectScene:
      /neden olur|yol aç|sonucunda|bu yüzden|bunun için|sayesinde|seyrelince|artarsa|azalırsa|bu nedenle|böylece|öncesi.*sonrası/.test(
        s,
      )
        ? 18
        : 2,
    ComparisonScene:
      /karşılaştır|kıyas|oysa|daha |arasında|göre|seyrek.*yoğun|yoğun.*seyrek|fark/.test(s) ||
      values.length >= 2
        ? 15
        : 3,
    ProcessFlowScene:
      /süreç|önce|sonra|ardından|adım|geçiş|karış|dönüş|ilet|emil|sindirim|motor|yolculu/.test(s)
        ? 15
        : 4,
    FocusCalloutScene: 9,
  };
  // The model can recognize qualitative relations outside the offline vocabulary.
  // Numeric diagrams *always* need independent evidence in the approved text.
  if (hint?.template && templates.includes(hint.template as Template)) {
    const t = hint.template as Template;
    if (!['TitleHookScene', 'ThermometerGaugeScene', 'RatioGaugeScene'].includes(t))
      scores[t] = Math.max(scores[t], 6);
    scores[t] += 5;
  }
  return scores;
}
const palette = ['#9ADBC1', '#F1BB79', '#8FCDE5', '#C5B8EB', '#D1D986'];
export function diagramLabels(template: Template, text: string, _topic = '', count?: number) {
  return copyFor(template, text, count).labels;
}
export function defaultSvg(
  text: string,
  index = 0,
  _topic = '',
  preferred?: Template,
  count?: number,
): SvgPlan {
  const m = measurements(text),
    concept = concepts(text)[0],
    icon = concept?.icon ?? 'globe',
    scores = suitability(m, index, icon);
  const template = preferred ?? [...templates].sort((a, b) => scores[b] - scores[a])[0];
  const { title, labels } = copyFor(template, text, count);
  const p: SvgPlan = {
    title,
    labels,
    icon,
    ...(concept ? { iconKeyword: concept.keyword } : {}),
    artMode: needsCustom(text) ? 'custom' : 'auto',
    template,
    weather: /kar yağ|karlı|karla/.test(m.source)
      ? 'snow'
      : /yağmur/.test(m.source)
        ? 'rain'
        : 'none',
    accentColor: palette[index % palette.length],
    fromValue: 0,
    toValue: 0,
  };
  if (template === 'RatioGaugeScene') {
    p.unit = m.ratio?.unit ?? '%';
    p.toValue = m.ratio?.amount ?? 0;
  }
  if (template === 'TimelineScaleScene') {
    const scale = m.scale ?? ({ unit: 'sıra', from: 0, mid: 1, to: 2 } as const);
    p.unit = scale.unit;
    p.fromValue = scale.from;
    p.midValue = scale.mid;
    p.toValue = scale.to;
  }
  if (template === 'ThermometerGaugeScene') {
    p.fromValue = m.temp[0] ?? 0;
    p.toValue = m.temp.at(-1) ?? 0;
  }
  if (template === 'ComparisonScene') {
    // Bare comparable numbers only. Do not put °C and km, or percent and mass, on one axis.
    const numeric =
      m.values.length === 2 &&
      !m.ratio &&
      !m.temp.length &&
      !m.scale &&
      !/derece|metre|saniye|dakika|saat|\bkm\b|\bkg\b|yüzde/.test(m.source);
    p.fromValue = numeric ? m.values[0] : null;
    p.toValue = numeric ? m.values[1] : null;
  }
  return p;
}
function repairCopy(seed: SvgPlan, draft: PlannerDraft, text: string, checkGrounding = true) {
  const [min, max] = catalogue[seed.template].slots,
    raw = draft.labels ?? [],
    count = Math.max(min, Math.min(max, raw.length >= min ? raw.length : seed.labels.length));
  const used = new Set<string>(),
    ok = (v: string) => !checkGrounding || grounded(v, text);
  const slots = Array.from({ length: count }, (_, i) => {
    const v = labelSchema.safeParse(raw[i]).data;
    if (!v || !ok(v) || used.has(lower(v))) return;
    used.add(lower(v));
    return v;
  });
  const { pool, labels: defaults } = copyFor(seed.template, text, count);
  const labels = slots.map((s, i) => {
    if (s) return s;
    const v = [defaults[i], ...pool].find((l) => l && !used.has(lower(l))) ?? '';
    used.add(lower(v));
    return v;
  });
  const heading = titleSchema.safeParse(draft.title).data;
  return { title: heading && ok(heading) ? heading : seed.title, labels };
}
// A read projection only; the original JSON is what signs a board and its history.
export function displayPlan(stored: StoredSvgPlan, text: string, topic = ''): SvgPlan {
  if ('icon' in stored) {
    if (svgPlanSchema.safeParse(stored).success) return stored;
    // 1.1.1 thermometers had zero labels; older heading rules allowed incomplete copy.
    const seed = defaultSvg(text, 0, topic, stored.template);
    return { ...stored, ...repairCopy(seed, stored, text, false) };
  }
  const old = legacySvgPlanSchema.parse(stored),
    seed = defaultSvg(text, 0, topic, old.template);
  const parts = old.subtitle.split('|').map((s) => s.trim()),
    labels = parts.length === catalogue[old.template].slots[0] ? parts : undefined;
  return {
    ...seed,
    fromValue: old.fromValue,
    toValue: old.toValue,
    weather: old.weather,
    accentColor: old.accentColor,
    ...repairCopy(seed, { title: old.title, labels }, text, false),
  };
}
function allocate(scores: Record<Template, number>[]): Template[] {
  const candidates = scores.map((row) => templates.filter((t) => Number.isFinite(row[t])));
  const goal = Math.min(5, scores.length),
    bit = (t: Template) => 1 << templates.indexOf(t);
  const memo = new Map<number, boolean>();
  // Look ahead before committing a shot. This avoids exhausting the only opening or
  // the only evidence-backed measurement slot on boards with repetitive LLM suggestions.
  function feasible(i: number, previous: Template, mask: number, unique: number): boolean {
    if (unique >= goal) return true;
    if (unique + scores.length - i < goal) return false;
    const key = (i * templates.length + templates.indexOf(previous)) * 2 ** templates.length + mask;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const ok = candidates[i].some(
      (t) => t !== previous && feasible(i + 1, t, mask | bit(t), unique + Number(!(mask & bit(t)))),
    );
    memo.set(key, ok);
    return ok;
  }
  const counts = new Map<Template, number>();
  let mask = 0,
    previous: Template | undefined;
  return scores.map((row, i) => {
    const score = (t: Template) => row[t] - Math.min(10, (counts.get(t) ?? 0) * 2.8);
    const ranked = candidates[i].filter((t) => t !== previous).sort((a, b) => score(b) - score(a));
    const t =
      ranked.find((t) => feasible(i + 1, t, mask | bit(t), counts.size + Number(!counts.has(t)))) ??
      ranked[0];
    counts.set(t, (counts.get(t) ?? 0) + 1);
    mask |= bit(t);
    previous = t;
    return t;
  });
}
export function storyboardPlans(
  rows: string[],
  topic: string,
  preferences: (PlannerDraft | undefined)[] = [],
  retainSaved = false,
): SvgPlan[] {
  const scores = rows.map((text, i) => {
    const p = preferences[i],
      r = suitability(measurements(text), i, concepts(text)[0]?.icon ?? 'globe', p);
    if (retainSaved && p && svgPlanSchema.safeParse(p).success) r[p.template as Template] = 90; // Previously reviewed by the user.
    return r;
  });
  return allocate(scores).map((t, i) => {
    const p = preferences[i],
      text = rows[i],
      seed = defaultSvg(text, i, topic, t);
    const finish = (v: SvgPlan) => {
      const out = svgPlanSchema.safeParse(v);
      if (!out.success)
        throw Error(
          `${i + 1}. sahnede başlık ve etiketler için yeterli anlatım yok. Cümleyi genişletin veya komşu sahneyle birleştirin.`,
        );
      return out.data;
    };
    if (!p) return finish(seed);
    const saved = retainSaved && p.template === t ? svgPlanSchema.safeParse(p).data : undefined;
    if (saved) return saved; // User-authored, not fresh model output. Never rewrite it after a provider error.
    const evidence = concepts(text),
      icon = icons.find((k) => k === p.icon);
    const remote = keywordSchema.safeParse(p.iconKeyword).data;
    const attested =
      remote &&
      ((p.keywordEvidence?.trim() && lower(text).includes(lower(p.keywordEvidence.trim()))) ||
        evidence.some((c) => c.keyword === remote));
    const keyword =
      attested &&
      (!evidence[0] ||
        evidence[0].score < 9 ||
        evidence.some((c) => c.keyword === remote && c.score >= evidence[0].score))
        ? remote
        : seed.iconKeyword;
    const copy = repairCopy(
      seed,
      { title: p.title, labels: !p.template || p.template === t ? p.labels : undefined },
      text,
    );
    return finish({
      ...seed,
      ...copy,
      icon: icon && (!evidence.length || evidence.some((c) => c.icon === icon)) ? icon : seed.icon,
      iconKeyword: keyword,
      artMode: p.artMode ?? seed.artMode,
      accentColor: p.accentColor?.trim() || seed.accentColor,
      weather: (p.weather?.trim() || seed.weather) as SvgPlan['weather'],
    });
  });
}
