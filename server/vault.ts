export interface Vault {
  mode: 'session' | 'encrypted';
  has(): boolean;
  get(): string | undefined;
  set(v: string): void;
  clear(): void;
}
export function memoryVault(): Vault {
  let secret: string | undefined;
  return {
    mode: 'session',
    has: () => !!secret,
    get: () => secret,
    set: (v) => {
      secret = v;
    },
    clear: () => {
      secret = undefined;
    },
  };
}
