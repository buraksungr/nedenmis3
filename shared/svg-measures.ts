/** Read measurements from the approved narration, not from generated artwork hints.
 * Normalize spoken Turkish numbers only for unit-aware matching; articles such as
 * “bir” never become invented bar values. Display uses Turkish decimal formatting. */
import type { ratioUnits, scaleUnits } from './svg';
type RatioUnit = (typeof ratioUnits)[number];
type ScaleUnit = (typeof scaleUnits)[number];
const small: Record<string, number> = {
  sıfır: 0,
  bir: 1,
  biri: 1,
  iki: 2,
  üç: 3,
  dört: 4,
  beş: 5,
  altı: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
  yirmi: 20,
  otuz: 30,
  kırk: 40,
  elli: 50,
  altmış: 60,
  yetmiş: 70,
  seksen: 80,
  doksan: 90,
};
const term = `(?:bin|yüz|${Object.keys(small)
  .sort((a, b) => b.length - a.length)
  .join('|')})`;
function spokenNumbers(s: string) {
  return s
    .replace(
      new RegExp(`(?<![\\p{L}\\d])(?:eksi )?${term}(?: +${term})*(?![\\p{L}\\d])`, 'gu'),
      (group) => {
        let chunk = 0,
          sum = 0;
        for (const w of group.split(/ +/)) {
          if (w === 'bin') {
            sum += (chunk || 1) * 1000;
            chunk = 0;
          } else if (w === 'yüz') chunk = (chunk || 1) * 100;
          else chunk += small[w] ?? 0;
        }
        return String((sum + chunk) * (group.startsWith('eksi') ? -1 : 1));
      },
    )
    .replace(/eksi\s+(?=\d)/gu, '-')
    .replaceAll('−', '-');
}
const digit = '[-+]?\\d+(?:[.,]\\d+)?';
const value = (s: string) => Number(s.replace(',', '.'));
const bounded = (n: number) => Number.isFinite(n) && Math.abs(n) <= 1e6;
const distances: [string, ScaleUnit][] = [
  ['kilometre|km', 'km'],
  ['santimetre|cm', 'cm'],
  ['metre|m', 'm'],
  ['saniye|sn', 's'],
  ['dakika|dk', 'dk'],
  ['saat', 'sa'],
  ['gün', 'gün'],
  ['yıl|sene', 'yıl'],
];
export function measurements(text: string) {
  const source = text.toLocaleLowerCase('tr').normalize('NFC'),
    normalized = spokenNumbers(source);
  const values = Array.from(source.replaceAll('−', '-').matchAll(new RegExp(digit, 'g')), (m) =>
    value(m[0]),
  ).filter(bounded);
  function readings(u: string) {
    // A shared unit in “0 ile 10 km”/“−5 – 4 °C” qualifies the first endpoint too.
    const re = new RegExp(
      `(?<![\\d.,])(?:(${digit})\\s*(?:ile|ila|→|–|—|-|['’]?(?:dan|den|tan|ten))\\s*)?(${digit})\\s*(?:${u})`,
      'gu',
    );
    return Array.from(normalized.matchAll(re))
      .flatMap((m) => [m[1], m[2]].filter(Boolean).map(value))
      .filter(bounded);
  }
  const thermal = /°\s*c|sıcak|termometre|soğu|ısın|donma|kayna|hava.*derece/.test(source);
  const temp =
    thermal && !/fahrenheit|kelvin|°\s*f|açı/.test(source) ? readings('°\\s*c|derece') : [];
  const percentage =
    normalized.match(new RegExp(`(?:%|yüzde)\\s*(${digit})`, 'u')) ??
    normalized.match(new RegExp(`(${digit})\\s*%`, 'u'));
  const multiplier = normalized.match(
    new RegExp(`(${digit})\\s*(?:[x×](?!\\p{L})|kat(?:ı|ına|ını|ına kadar)?(?!\\p{L}))`, 'u'),
  );
  let ratio: { unit: RatioUnit; amount: number } | undefined;
  if (percentage || multiplier) {
    const n = value((percentage ?? multiplier)![1]);
    if (bounded(n) && n >= 0 && (!percentage || n <= 100))
      ratio = { unit: percentage ? '%' : '×', amount: n };
  }
  let scale: { unit: ScaleUnit; from: number; mid: number; to: number } | undefined;
  for (const [u, unit] of distances) {
    const ticks = readings(
      `(?:${u
        .split('|')
        .map((w) => (w.length <= 2 ? w + '(?!\\p{L})' : w))
        .join('|')})`,
    );
    if (unit === 'km' && /deniz seviyesi|deniz düzeyi/.test(source) && ticks[0] !== 0)
      ticks.unshift(0);
    if (ticks.length < 2) continue;
    const from = ticks[0],
      to = ticks.at(-1)!;
    if (from === to) continue;
    const mid =
      ticks.slice(1, -1).find((n) => n > Math.min(from, to) && n < Math.max(from, to)) ??
      (from + to) / 2;
    scale = { unit, from, mid, to };
    break;
  }
  return { source, values, temp, ratio, scale };
}
export type Measures = ReturnType<typeof measurements>;
