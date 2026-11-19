import { catalogue, legacySvgPlanSchema, type StoredSvgPlan, type SvgPlan } from './svg';
/** Project a previously authored plate without writing to a signed board or generating
 * copy. A missing legacy label remains absent; new artwork never calls this path. */
export function legacyPlate(stored: StoredSvgPlan): SvgPlan {
  if ('icon' in stored) {
    const missing = Math.max(0, catalogue[stored.template].slots[0] - stored.labels.length);
    return missing
      ? { ...stored, labels: [...stored.labels, ...Array<string>(missing).fill('')] }
      : stored;
  }
  const old = legacySvgPlanSchema.parse(stored),
    n = catalogue[old.template].slots[0],
    parts = old.subtitle.split('|').map((s) => s.trim());
  return {
    template: old.template,
    title: old.title,
    labels: parts.length === n ? parts : Array<string>(n).fill(''),
    icon: 'globe',
    accentColor: old.accentColor,
    weather: old.weather,
    fromValue: old.fromValue,
    toValue: old.toValue,
  };
}
