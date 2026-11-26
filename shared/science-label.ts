/** Short editorial terms only. No markup, punctuation, URLs, sentences or hidden controls.
 * The number alternative permits a small scientific measurement such as -10°C or 12%.
 * Both the planner and the SVG sanitizer use this same deliberately narrow grammar. */
const word = String.raw`\p{L}[\p{L}\p{M}\p{N}’'-]*`;
const number = String.raw`[+-]?\d{1,3}(?:[.,]\d{1,2})?(?:°[CFK]|%|mm|cm|km|m|ms|s|kHz|Hz|kg|W|J)?`;
const labelPattern = new RegExp(`^(?:${word}|${number})(?: (?:${word}|${number}))?$`, 'iu');
const valuePattern = new RegExp(`^${number}$`, 'iu');
export const scienceLabel = (s: string) => s.length <= 28 && labelPattern.test(s);
export const scienceValue = (s: string) => s.length <= 14 && valuePattern.test(s);
