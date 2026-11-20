import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createStudio } from '../server/app';
import type { PlannerWait } from '../server/planner-pacing';
import { jobActive, type Project } from '../shared/schema';
import { noNetwork } from './offline';
export async function app(
  t: TestContext,
  token?: string,
  transport: typeof fetch = noNetwork,
  plannerWait?: PlannerWait,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nedenmis-http-'));
  const ctx = createStudio(
    { root, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
    { seed: false, desktopToken: token, transport, plannerWait },
  );
  const server = ctx.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  t.after(async () => {
    await ctx.stopActive();
    await new Promise<void>((r) => server.close(() => r()));
    ctx.store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const req = (route: string, body?: unknown, rev?: number, headers?: Record<string, string>) =>
    fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(rev === undefined ? {} : { 'If-Match': String(rev) }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const settle = async (route: string, timeout = 25000): Promise<Project> => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const p: Project = await (await req(route)).json();
      if (!jobActive(p.job)) return p;
      await new Promise((r) => setTimeout(r, timeout > 60_000 ? 250 : 30));
    }
    throw new Error('Background production did not settle');
  };
  return { ...ctx, req, settle, base, root };
}
