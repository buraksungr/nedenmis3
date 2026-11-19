/** Translation only. These entries never supply titles, labels or replacement narration. */
import nouns from './data/visual-nouns.json';
import { stemmer } from '@orama/stemmers/turkish';
import type { ScienceIcon } from './svg';
export const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('tr');
export const words = (s: string) => s.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? [];
const form = (w: string) => lower(w).replace(/[’'].*$/u, '');
export const root = (w: string) => stemmer(form(w)).replace(/(?:suy|suyun)$/u, 'su');
// Anatomical structures and physical mechanisms outrank incidental context (water, land).
const cues: [RegExp, string, ScienceIcon, number][] = [
  [/akciğer|solunum/, 'lungs', 'cell', 12],
  [/iskelet/, 'skeleton', 'cell', 11],
  [/kemik/, 'bone', 'cell', 9],
  [/yer\s?çekim|kütle\s?çekim/, 'gravity', 'earth', 14],
  [/kaldırma kuvvet/, 'buoyancy', 'water', 13],
  [/vücut ağırlı|vücut ağırlığ|ağırlı|ağırlığ|kütlesi/, 'weight', 'earth', 12],
  [/basın[çc]/, 'pressure', 'cell', 10],
  [/balina|kaşalot/, 'whale', 'water', 9],
  [/volkan|yanardağ|lavlar/, 'volcano', 'flame', 12],
  [/\bdna\b|genetik|kromozom/, 'dna', 'molecule', 13],
  [/oksijen/, 'oxygen', 'molecule', 10],
  [/kanad|kanat|uçak|uçağ|uçuş|pilot|jet motor|kalkış/, 'airplane', 'airplane', 7],
  [/radyo|ses dalga|titreşim|frekans|yankı|işitme/, 'sound wave', 'soundwave', 10],
  [/ışık hızı|foton/, 'light', 'sun', 9],
  [/troposfer|stratosfer|mezosfer|atmosfer/, 'atmosphere', 'globe', 8],
  [/kabin/, 'airplane', 'shield', 7],
  [/hava direnci|havanın yoğunlu|havanın yoğunluğ|rüzg[aâ]r/, 'wind', 'airplane', 10],
  [/yağmur/, 'rain', 'water', 7],
  [/yakıt/, 'fuel', 'airplane', 8],
  [/karınca/, 'ant', 'ant', 10],
  [/retina|göz(?!lem)|merce[kğ]/, 'eye', 'eye', 9],
  [/kalp|kalb|nabız/, 'heart', 'heart', 9],
  [/atom|elektron|nötron|proton/, 'atom', 'atom', 10],
  [/şimşek|yıldırım/, 'lightning', 'lightning', 9],
  [/koruyucu|kalkan|bağışıklık/, 'shield', 'shield', 8],
  [/kar kristal|kar tanesi|donma|kar yağ/, 'snowflake', 'snowflake', 8],
  [/güneş/, 'sun', 'sun', 8],
  [/zaman|saat|saniye|dakika/, 'clock', 'clock', 6],
  [/yerküre|enlem|boylam/, 'globe', 'globe', 8],
  [/hücre|ozmoz|osmoz/, 'cell', 'cell', 9],
  [/beyin|beyn|nöron|sinir/, 'brain', 'brain', 9],
  [/(?<!\p{L})kan(?:da|dan|a|ı)?(?!\p{L})|damar|alyuvar/u, 'blood', 'blood', 8],
  [/molekül|gl[iu]koz|şeker/, 'molecule', 'molecule', 7],
  [/yapra[kğ]|bitki|fotosentez|kök/, 'leaf', 'leaf', 8],
  [/alev|sıcaklık|ısın|termometre/, 'thermometer', 'flame', 7],
  [/dünya|topra[kğ]|manto|gezegen/, 'earth', 'earth', 5],
  [/suyun|buharlaş|susama|damla|(?:^|\s)su(?:\s|$|yu|da)|deniz|okyanus/, 'water', 'water', 2],
  [/teleskop/, 'telescope', 'eye', 10],
  [/galaksi|samanyolu/, 'galaxy', 'globe', 10],
  [/fosil/, 'fossil', 'earth', 10],
  [/bakteri/, 'bacteria', 'cell', 10],
  [/mıknatıs|manyetik/, 'magnet', 'lightning', 9],
  [/depre[mğ]|sismik/, 'earthquake', 'earth', 10],
  [/deri|cilt/, 'skin', 'cell', 7],
];
const lex = new Map<string, string>(Object.entries(nouns)),
  byStem = new Map<string, string>();
for (const [tr, en] of lex) if (!tr.includes(' ') && tr.length >= 3) byStem.set(root(tr), en);
export function concepts(text: string) {
  const s = lower(text),
    tokens = words(s),
    candidates: { keyword: string; icon: ScienceIcon; score: number; mention: string }[] = [];
  for (const [r, keyword, icon, score] of cues) {
    const m = s.match(r);
    if (m) candidates.push({ keyword, icon, score, mention: m[0].trim() });
  }
  for (let i = 0; i < tokens.length; i++)
    for (let len = 1; len <= 3 && i + len <= tokens.length; len++) {
      const t = tokens.slice(i, i + len).join(' '),
        keyword =
          lex.get(t) ??
          (len === 1
            ? (lex.get(root(t)) ??
              lex.get(t.replace(/(?:n[ıiuü]n|[ıiuü]n|lar|ler)$/u, '')) ??
              byStem.get(root(t)))
            : undefined);
      if (keyword) candidates.push({ keyword, icon: 'globe', score: 4 + len, mention: t });
    }
  return candidates.sort((a, b) => b.score - a.score);
}
// Single-object lookups cannot express a directed physical relationship or a
// requested cutaway. The fallback model can draw those relationships when allowed.
export function needsCustom(text: string) {
  const s = lower(text);
  return (
    /diyagram|şematik|iç yapısının kesit|kuvvet vektör/u.test(s) ||
    (/yer\s?çekim|kütle\s?çekim|manyetik alan|kuvvet|elektrik alan/u.test(s) &&
      /bastır|çeker|iter|baskı|aşağı|yukarı|döndür|yönünü/u.test(s))
  );
}
