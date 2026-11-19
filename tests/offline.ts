import { Pollinations } from '../server/pollinations';
import type { Store } from '../server/store';
import { memoryVault } from '../server/vault';

export const noNetwork: typeof fetch = async () => {
  throw new Error('Network disabled in QA');
};
export const testImages = (store: Store, transport = noNetwork) =>
  new Pollinations(store, memoryVault(), transport);
