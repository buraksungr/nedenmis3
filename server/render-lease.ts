import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { operation, checkpoint } from './operation';
import { terminateTree } from './process-tree';
// Remotion's public cancelSignal covers rendering but not browser startup or
// every encoding substage. Supervise only children spawned *inside this render*.
// The scoped Node child_process diagnostic also sees a Chrome that never opens CDP.
type Watch = (child: ChildProcess) => void;
const spawned = new AsyncLocalStorage<Watch>();
channel('child_process').subscribe((msg) => {
  const watch = spawned.getStore();
  if (watch) watch((msg as { process: ChildProcess }).process);
});
export async function withRenderLease<T>(work: () => Promise<T>): Promise<T> {
  const signal = operation()?.signal;
  if (!signal) return work();
  checkpoint();
  const children = new Map<ChildProcess, Promise<void>>(),
    profiles = new Set<string>(),
    kills = new Map<ChildProcess, Promise<void>>();
  let forcing = false;
  const kill = (child: ChildProcess) => {
    if (!kills.has(child))
      kills.set(
        child,
        spawned.exit(() => terminateTree(child)),
      );
  };
  const watch: Watch = (child) => {
    const closed = new Promise<void>((resolve) =>
      child.once('close', () => {
        children.delete(child);
        resolve();
      }),
    );
    children.set(child, closed);
    child.once('spawn', () => {
      for (const arg of child.spawnargs) {
        if (typeof arg !== 'string' || !arg.startsWith('--user-data-dir=')) continue;
        const dir = path.resolve(arg.slice(16));
        if (
          path.dirname(dir) === path.resolve(os.tmpdir()) &&
          /^puppeteer_dev_chrome_profile-[\w-]+$/.test(path.basename(dir))
        )
          profiles.add(dir);
      }
      if (forcing) kill(child);
    });
  };
  const force = () => {
    forcing = true;
    for (const c of children.keys()) if (c.pid) kill(c);
  };
  let timer: NodeJS.Timeout | undefined;
  const abort = () => {
    timer = setTimeout(force, 800);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    return await spawned.run(watch, work);
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(timer);
    if (signal.aborted) {
      force();
      // A renderer cleanup callback may spawn another helper while an earlier
      // handle is closing. Keep draining the live set, not just its first snapshot.
      while (children.size) await Promise.all(children.values());
      await Promise.all(kills.values());
      for (const dir of profiles)
        await fs.rm(dir, { recursive: true, force: true, maxRetries: 6, retryDelay: 80 });
    }
  }
}
