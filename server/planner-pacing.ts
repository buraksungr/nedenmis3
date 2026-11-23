import { setTimeout as sleep } from 'node:timers/promises';
import { checkpoint, operation } from './operation';
import { Issue, ProviderHttpIssue } from './store';

export const svgOutputTokens = 8192;
export const sceneGapMs = 5_000;
const backoffs = [10_000, 20_000, 35_000] as const;
export type PlannerWait = (ms: number, signal?: AbortSignal) => Promise<void>;
export async function plannerDelay(
  ms: number,
  wait: PlannerWait = (ms, signal) => sleep(ms, undefined, { signal }),
) {
  checkpoint();
  try {
    await wait(ms, operation()?.signal);
  } finally {
    checkpoint(); // Surface Durdur, not an AbortError classified as a provider/scene failure.
  }
}

/** One HTTP retry budget per drawing (rig or scene), independent of its two content repairs.
 * The transport closure always resends the same payload, with no fallback to a different API. */
export function svgSender(wait: PlannerWait | undefined, progress: (message: string) => void) {
  let retries = 0;
  return async <T>(post: () => Promise<T>, action: string): Promise<T> => {
    for (;;) {
      checkpoint();
      progress(action);
      checkpoint();
      try {
        return await post();
      } catch (e) {
        checkpoint();
        if (!(e instanceof ProviderHttpIssue)) throw e;
        if (e.status !== 429) {
          // 503 (hizmet dışı) zaten text() içindeki model fallback zinciriyle ele alınıyor;
          // buraya tekrar gitmeye gerek yok. Diğer hatalar doğrudan iletilir.
          throw e;
        }
        const reason = `HTTP ${e.status} - Kota/Hız Sınırı`;
        if (retries === backoffs.length) {
          throw new Issue(
            e.status,
            `${reason}. 3 otomatik yeniden deneme hakkı kullanıldı.`,
            'quota',
          );
        }
        const ms = backoffs[retries++];
        progress(`${action} · ${reason}. ${ms / 1000} sn sonra yeniden denenecek (${retries}/3).`);
        await plannerDelay(ms, wait);
      }
    }
  };
}
