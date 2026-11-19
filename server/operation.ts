import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { STOPPED, type OperationInfo } from '../shared/schema';

// One lease per accepted request. An old UI tab can never stop a subsequent job
// (progress revisions change often and are intentionally NOT cancellation tokens).
export class Operation {
  readonly id = randomUUID();
  private readonly controller = new AbortController();
  private release!: () => void;
  readonly drained = new Promise<void>((r) => {
    this.release = r;
  });
  finish() {
    this.release();
  }
  constructor(
    readonly owner: string,
    public label: string,
  ) {}
  get signal() {
    return this.controller.signal;
  }
  stop() {
    this.controller.abort(new Error(STOPPED));
  }
  info(): OperationInfo {
    return { id: this.id, owner: this.owner, label: this.label, stopping: this.signal.aborted };
  }
  async run<T>(fn: () => Promise<T>) {
    return context.run(this, async () => {
      checkpoint();
      const value = await fn();
      checkpoint();
      return value;
    });
  }
}
// Also covers nested HTTP transports, parallel preflight and tool invocations.
// Read-only API requests and other studio instances never inherit this lease.
const context = new AsyncLocalStorage<Operation>();
export const operation = () => context.getStore();
export const checkpoint = () => operation()?.signal.throwIfAborted();
export function requestSignal(ms: number, extra?: AbortSignal | null) {
  const signals = [AbortSignal.timeout(ms)];
  if (extra) signals.push(extra);
  const job = operation();
  if (job) signals.push(job.signal);
  return AbortSignal.any(signals);
}
