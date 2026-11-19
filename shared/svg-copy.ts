/** Extractive editing: every content word is traced to this shot, never to the topic,
 * a previous shot, or a bank of finished titles. Prefer whole Turkish noun groups. */
import { catalogue, labelSchema, titleSchema, type Template } from './svg';
import { concepts, lower, root, words } from './visual-concepts';
export { lower } from './visual-concepts';
const cap = (s: string) => s.slice(0, 1).toLocaleUpperCase('tr') + s.slice(1);
const stop =
  /^(?:ve|veya|ya|da|de|ile|için|ise|bir|bu|şu|o|gibi|çünkü|böylece|neden|nasıl|önce|sonra|ardından|kadar|daha|çok|bile|ancak|fakat|ama|bazen|yaklaşık|her|hem|en|diye|iken|ise|olarak|onun|yüzden|üstelik|kısmı|biri)$/u;
const adjective =
  /^(?:devasa|büyük|küçük|hızlı|yavaş|sıcak|soğuk|yüksek|alçak|yeni|uzun|kısa|yoğun|seyrek|alt|üst|iç|dış|aynı|kendi|güçlü|önemli|zor|derin)$/u;
const gen = (w: string) => /(?:nın|nin|nun|nün|[ıiuü]n)$/u.test(w);
const participle = (w: string) =>
  /(?:binen|vuran|kalan|olan|gelen|geçen|inen|artan|azalan|taşıyan|bulunan|oluşan|yayan|çözünen|çözünmüş|atan)$/u.test(
    w,
  );
const closed = (w: string) =>
  /(?:iyor|ıyor|uyor|üyor|ebilir|abilir|leşir|laşır|leşti|laştı|lanır|lenir|dır|dir|dur|dür|tır|tir|tur|tür|arlar|erler|alır|verir|çıkar|eder|olur|artar|azalır|destekler|zorlaştırır|biner|çeker|düşer|iner|korur|kaybeder|kurur|taşır|sağlar|oluşur|dönüşür|uçar|ölür|düşünün|görürüz|isteriz)$/u.test(
    w,
  );
const plain = (w: string) => (w === 'dna' ? 'DNA' : w);
const titleCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (w === 've' ? w : cap(plain(w))))
    .join(' ');
const nominal = (w: string) =>
  w.includes("'")
    ? w.split("'")[0]
    : w.replace(/(?:dir|dır|dur|dür)$/u, '').replace(/(ma|me)y[ıi]$/u, '$1');
function groundedWord(w: string, ws: string[]) {
  const r = root(w);
  return ws.some(
    (s) =>
      s === w || root(s) === r || nominal(s) === w || s.replace(/([ıiuü])n[ıiuüae]$/u, '$1') === w,
  );
}
export function grounded(value: string, text: string) {
  const src = words(lower(text)),
    tokens = words(lower(value));
  return tokens.length > 0 && tokens.every((w) => groundedWord(w, src));
}
// Decode list grammar, not a table of canonical science labels. Spatial clauses
// ordered bottom → top are reversed for a plate drawn from the top down.
export function namedSequence(text: string, kind: 'cycle' | 'layers') {
  const src = lower(text);
  if (kind === 'layers') {
    const spatial = src.match(
      /(\p{L}+) (üstünde|altında) (\p{L}+)[,;] (?:onun )?\2 (?:de |da )?(\p{L}+)/u,
    );
    if (spatial) {
      const rows = [root(spatial[1]), spatial[3], spatial[4]];
      return (spatial[2] === 'üstünde' ? rows.reverse() : rows).map(cap);
    }
  }
  const parts = src.split(/\s*[,;]\s*|\s+(?:ve|sonra|ardından)\s+/u);
  if (parts.length < 3 || parts.length > 4) return;
  // A list of subjects, not a list of arbitrary clauses. The predicate follows the last item.
  if (!parts.slice(0, -1).every((p) => words(p).length >= 1 && words(p).length <= 2)) return;
  if (kind === 'cycle' && !/döngü|çevrim|yinelen|tekrar|evre|aşama/u.test(src)) return;
  if (kind === 'layers' && !/katman|tabaka|üst|alt|kabuk|kabuğ|çekirdek/u.test(src)) return;
  const last = words(parts.at(-1)!)
    .slice(0, /^(?:iç|dış|alt|üst|ana|yer) /u.test(parts.at(-1)!) ? 2 : 1)
    .join(' ');
  const out = [...parts.slice(0, -1), last].map(cap);
  return out.every((l) => labelSchema.safeParse(l).success) ? out : undefined;
}
type Span = { s: string; start: number; end: number; score: number };
function extract(text: string) {
  const tokens = Array.from(lower(text).matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu));
  const spans: Span[] = [],
    key = concepts(text)[0],
    literal = lower(text);
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i][0];
    if (stop.test(a)) continue;
    for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
      const w = tokens[j][0];
      if (
        (stop.test(w) && !(w === 've' && j === i + 1)) ||
        (j > i &&
          (tokens[j].index! > tokens[j - 1].index! + tokens[j - 1][0].length + 1 ||
            !/^\s+$/u.test(
              literal.slice(tokens[j - 1].index! + tokens[j - 1][0].length, tokens[j].index),
            )))
      )
        break;
      const t = tokens.slice(i, j + 1).map((x) => x[0]),
        len = t.length,
        prev = t.at(-2) ?? '';
      // Nominal predicates (oksijendir → oksijen) are not additional vocabulary.
      let phrase = t.map((x, k) => plain(k === len - 1 ? nominal(x) : x)).join(' ');
      if (!phrase || -1 !== t.slice(0, -1).findIndex(closed)) break;
      let score = (len === 1 ? 1 : len === 2 ? 7 : len === 3 ? 5 : 2) - i * 0.012;
      if (adjective.test(a) && len > 1) score += 4;
      if (gen(a) && len > 1 && /[ıiuü]$/u.test(w)) score += 7;
      if (participle(prev)) score += 6;
      if (/(?:s[ıiuü]|[ğçc][ıiuü])$/u.test(w) && len >= 2) score += 4;
      if (t.some((v, k) => k > 0 && participle(v) && k < len - 1)) score += 6;
      if (
        adjective.test(w) ||
        participle(w) ||
        gen(w) ||
        /^(?:karada|karaya|denizde|burada|üzerinde|üzerine|altında|halinde|arasında|birçok)$/u.test(
          w,
        )
      )
        score -= 11;
      if (len > 1 && /^(?:karada|denizde|burada|yükseklerde|alçakta)$/u.test(a)) score -= 5;
      if (len > 1 && t.slice(1, -1).some((v) => gen(v))) score -= 5;
      if ((/[dt][ae]$|[dt][ae]n$/u.test(w) || w === 'biri') && len > 1) score -= 4;
      if (len > 1 && /(?:dığında|diğinde|duğunda|düğünde|ınca|ince|unca|ünce)$/u.test(a))
        score -= 6;
      if (closed(w)) score -= nominal(w) !== w ? 1 : 7;
      if (j === tokens.length - 1 && len > 1 && !participle(prev) && !gen(a) && !adjective.test(a))
        score -= 2;
      if (len > 1 && /\d/u.test(phrase)) score -= 3;
      if (t.includes('ve'))
        score += len === 3 && prev === 've' && !closed(w) && !adjective.test(w) ? 4 : -15;
      if (
        w === 've' ||
        /^(?:altında|üstünde|halinde|zamanında|süre|yukarıda|eksi|artı|yirmi|kısmı)$/u.test(w)
      )
        score -= 6;
      if (/^(?:altında|üstünde|halinde|yukarıda|zamanında|kısmı)$/u.test(a)) score -= 6;
      const pos = /(?:[ıiuü]n[ıiuü]|[ıiuü]n[ae]|s[ıiuü]n[dt][ae](?:n)?)$/u.test(w);
      if (key?.mention && phrase.includes(key.mention)) score += key.score * 0.48;
      if (
        len >= 2 &&
        t.some(
          (v, k) => k > 0 && /(?:[ıiuü]ğı|[ıiuü]ği|[ae]ti|[dt][ıiuü]|m[ıiuü]|s[ıiuü])$/u.test(v),
        )
      )
        score += 1.2;
      // Reject partial numeric and genitive groups when a stronger right-hand head follows.
      const next = tokens[j + 1]?.[0];
      if (
        next &&
        j + 1 < tokens.length &&
        /^\s+$/u.test(literal.slice(tokens[j].index! + w.length, tokens[j + 1].index))
      ) {
        if (
          (gen(a) || adjective.test(a)) &&
          /[ıiuü](?:n[aeıiuü])?$/u.test(next) &&
          !closed(next) &&
          !gen(next) &&
          !stop.test(next)
        )
          score -= 5;
        if (/^(?:on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz)$/u.test(w)) score -= 6;
      }
      if (pos && len >= 2 && gen(a)) score -= 2;
      // Remove only case after an explicit possessive ending, never guess a new noun.
      if (len >= 2) phrase = phrase.replace(/([ıiuü])n[ıiuüae]$/u, '$1');
      spans.push({ s: phrase, start: i, end: j, score });
    }
  }
  // The shortest utterances can be used intact; never fill the deficit with unrelated words.
  const all = words(lower(text));
  if (all.length >= 2 && all.length <= 4)
    spans.push({ s: all.join(' '), start: 0, end: all.length - 1, score: 0 });
  return spans.sort((a, b) => b.score - a.score);
}
export function copyFor(template: Template, text: string, count?: number) {
  const [min, max] = catalogue[template].slots,
    spans = extract(text);
  const top = spans.find((p) => titleSchema.safeParse(titleCase(p.s)).success);
  let title = top ? titleCase(top.s) : '';
  const named =
    template === 'LayerStackScene'
      ? namedSequence(text, 'layers')
      : template === 'CycleLoopScene'
        ? namedSequence(text, 'cycle')
        : undefined;
  const slots = Math.max(min, Math.min(max, count ?? named?.length ?? min));
  const taken: Span[] = [];
  for (const p of spans) {
    if (
      !labelSchema.safeParse(p.s).success ||
      (!p.s.includes(' ') && (adjective.test(p.s) || participle(p.s)))
    )
      continue;
    if (!taken.some((other) => p.start <= other.end && p.end >= other.start)) taken.push(p);
    if (taken.length >= slots) break;
  }
  taken.sort((a, b) => a.start - b.start);
  const keyword = concepts(text)[0];
  const ratioSubject =
    template === 'RatioGaugeScene' && keyword
      ? words(lower(text)).find((w) => concepts(nominal(w))[0]?.keyword === keyword.keyword)
      : undefined;
  // Anchor axes, endpoints and steps to the clauses that actually describe them.
  const ordered: string[] = [];
  if (template === 'RatioGaugeScene') {
    const subject = text.split(/yaklaşık|yüzde|%|[0-9]/iu)[0],
      group = words(lower(subject)).filter((w) => !stop.test(w));
    if (group.length >= 2) {
      const head = group.slice(-2);
      if (gen(head[1])) head[1] = root(head[1]);
      const h = titleCase(head.join(' '));
      if (titleSchema.safeParse(h).success && grounded(h, text)) title = h;
    }
  }
  const split =
    template === 'TimelineScaleScene'
      ? /\bönce\b|önce |sonra |ardından /u
      : template === 'ThermometerGaugeScene'
        ? / iken |,| ancak | oysa /u
        : template === 'SplitCauseEffectScene'
          ? / bu yüzden | böylece | sonucunda | bu nedenle /u
          : template === 'ProcessFlowScene'
            ? / önce |, sonra | sonra | ve /u
            : undefined;
  if (split) {
    const parts = lower(text)
      .split(split)
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === slots)
      for (const v of parts) {
        const p = extract(v).find((p) => labelSchema.safeParse(p.s).success);
        if (p) ordered.push(p.s);
      }
  }
  const candidates = [
    ...(named ?? []),
    ...(ratioSubject ? [nominal(ratioSubject)] : []),
    ...ordered,
    ...taken.map((p) => p.s),
    ...spans.map((p) => p.s),
  ];
  const seen = new Set<string>();
  const pool = candidates
    .map((s) => cap(s))
    .filter((s) => {
      if (seen.has(lower(s)) || !labelSchema.safeParse(s).success) return false;
      seen.add(lower(s));
      return true;
    });
  if (template === 'TitleHookScene') {
    const member = spans.find(
      (p) =>
        !p.s.includes(' ') &&
        top?.s.split(' ').includes(p.s) &&
        keyword &&
        p.s.includes(keyword.mention) &&
        labelSchema.safeParse(p.s).success,
    );
    if (member) {
      const l = cap(member.s);
      pool.splice(0, pool.length, l, ...pool.filter((v) => v !== l));
    }
  }
  const labels = pool.slice(0, slots);
  while (labels.length < slots) labels.push(''); // invalid editor draft, never approved or exported
  return { title, labels, pool };
}
