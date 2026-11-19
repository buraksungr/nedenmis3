// Two Unicode CLDR annotations files, not runtime network dependencies. Only translate
// concrete names (tts), not associative tags: e.g. “ocean” must not become a whale.
// Source revision and licence are recorded in resources/CLDR-LICENSE.txt and docs/ATLAS.md.
import fs from 'node:fs';
const [trFile, enFile] = process.argv.slice(2),
  read = (p) => JSON.parse(fs.readFileSync(p, 'utf8')).annotations.annotations;
const tr = read(trFile),
  en = read(enFile),
  out = {};
for (const [symbol, n] of Object.entries(tr)) {
  const a = n.tts?.[0]?.toLocaleLowerCase('tr'),
    b = en[symbol]?.tts?.[0]?.toLowerCase();
  if (
    !a ||
    !b ||
    !/^\p{L}{2,20}(?: \p{L}{2,20}){0,2}$/u.test(a) ||
    !/^([a-z]{2,20})(?: [a-z]{2,20}){0,2}$/.test(b) ||
    b.length > 40
  )
    continue;
  if (
    !/\p{Extended_Pictographic}/u.test(symbol) ||
    symbol.includes('\u200d') ||
    /face|button|finger|symbol|sign|flag|person|woman|man |skin tone|clockwise/.test(b)
  )
    continue;
  out[a] = b;
}
fs.writeFileSync(
  'shared/data/visual-nouns.json',
  JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 2) + '\n',
);
