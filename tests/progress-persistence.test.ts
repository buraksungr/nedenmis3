import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import type { Project } from '../shared/schema';
import type { Gemini } from '../server/gemini';
import type { Paths } from '../server/media';
import { Production } from '../server/production';
import { makeProject, type Store } from '../server/store';
import { app } from './http-studio';
import { completion } from './vector-test-data';

const err = (code: string) => Object.assign(new Error(`temporary ${code}`), { code });

test('progress is throttled to 350ms but scene, label, 100% and terminal changes save immediately', (t) => {
  let time = 10_000;
  t.mock.method(Date, 'now', () => time);
  const writes: Project[] = [],
    logs: Project[] = [];
  const fake = {
    save: (p: Project) => {
      writes.push(structuredClone(p));
      return p;
    },
    log: (p: Project) => {
      logs.push(structuredClone(p));
    },
  } as unknown as Store;
  const production = new Production(fake, {} as Gemini, {} as Paths),
    p = makeProject('Test');
  production.tick(p, 'Kareler', 'clip', 'first', 0);
  assert.equal(writes.length, 1);
  time += 100;
  production.tick(p, 'Kareler', 'clip', 'first', 10);
  time += 249;
  production.tick(p, 'Kareler', 'clip', 'first', 40);
  assert.equal(p.job.progress, 40);
  assert.equal(writes.length, 1);
  time++;
  production.tick(p, 'Kareler', 'clip', 'first', 50);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].job.progress, 50);
  time++;
  production.tick(p, 'Kareler', 'clip', 'second', 0);
  assert.equal(writes.length, 3, 'new scene was not saved immediately');
  time++;
  production.tick(p, 'Kareler', 'clip', 'second', 100);
  assert.equal(writes.length, 4, 'completion was not saved immediately');
  production.tick(p, 'Kareler', 'clip', 'second', 100);
  assert.equal(writes.length, 4, 'repeated 100% was not throttled');
  p.job = { state: 'failed', label: 'Hata', at: new Date().toISOString() };
  assert.equal(production.persistJob(p, true), true);
  assert.equal(writes.length, 5);
  assert.equal(writes[4].job.state, 'failed');
  assert.equal(logs.length, 1);
});

test('progress save and log failures are caught, logged and retried without callback exceptions', (t) => {
  let time = 1_000,
    saves = 0,
    logs = 0;
  const errors: string[] = [];
  t.mock.method(Date, 'now', () => time);
  t.mock.method(console, 'error', (...args: unknown[]) => {
    errors.push(args.join(' '));
  });
  const fake = {
    save: () => {
      saves++;
      throw err('EPERM');
    },
    log: () => {
      logs++;
      throw err('EBUSY');
    },
  } as unknown as Store;
  const production = new Production(fake, {} as Gemini, {} as Paths),
    p = makeProject('Test');
  assert.doesNotThrow(() => production.tick(p, 'Sahne işleniyor', 'clip'));
  assert.equal(saves, 1);
  assert.equal(logs, 1);
  assert.match(errors.join(' '), /EPERM/);
  assert.match(errors.join(' '), /EBUSY/);
  time += 100;
  production.tick(p, 'Sahne işleniyor', 'clip', undefined, 1);
  assert.equal(saves, 1, 'failure should not cause an unbounded write loop');
  time += 250;
  production.tick(p, 'Sahne işleniyor', 'clip', undefined, 2);
  assert.equal(saves, 2, 'later progress should retry the failed write');
});

test('failed terminal disk save is visible, blocks edits, and recovers the real project without crashing', async (t) => {
  const ctx = await app(
    t,
    undefined,
    async () => completion({ title: 'Güvenli Derinlikler', template: 'soil-colony' }),
    async () => {},
  );
  const warnings: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    warnings.push(args.join(' '));
  });
  assert.ok((await ctx.req('/settings/svg-planner/key/openrouter', { key: 'local-fixture' })).ok);
  assert.ok((await ctx.req('/settings/svg-planner', { provider: 'openrouter' })).ok);
  const created: Project = await (
    await ctx.req('/projects', { topic: 'Karıncalar', script: 'Karıncalar yuvada bekler.' })
  ).json();
  const route = `/projects/${created.id}`;
  assert.ok(
    (await ctx.req(`${route}/script`, { text: created.script, approve: true }, created.rev)).ok,
  );
  const current = ctx.store.get(created.id),
    original = ctx.store.save.bind(ctx.store);
  let fail = true;
  t.mock.method(ctx.store, 'save', (p: Project) => {
    if (fail && p.job.state === 'done') throw err('EPERM');
    return original(p);
  });
  const started = await ctx.req(`${route}/generate`, { kind: 'board' }, current.rev);
  assert.equal(started.status, 202);
  const visible = await ctx.settle(route);
  assert.equal(visible.job.state, 'failed');
  assert.match(visible.job.label, /diske kaydedilemedi/);
  assert.ok(visible.scenes[0].choreography, 'last completed scene must remain in memory');
  assert.equal(
    ctx.store.get(created.id).job.state,
    'working',
    'fixture must exercise the stale on-disk status',
  );
  const list = (await (await ctx.req('/projects')).json()) as {
    id: string;
    job: { state: string };
  }[];
  assert.equal(list.find((p) => p.id === created.id)?.job.state, 'failed');
  const blocked = await ctx.req(`${route}/title`, { title: 'Yeni ad' }, visible.rev);
  assert.equal(blocked.status, 503);
  assert.match(warnings.join(' '), /EPERM/);
  fail = false;
  // Reads retry at a bounded rate; after recovery the original terminal result is persisted.
  await new Promise((resolve) => setTimeout(resolve, 370));
  const restored: Project = await (await ctx.req(route)).json();
  assert.equal(restored.job.state, 'done');
  assert.ok(restored.scenes[0].choreography);
  assert.equal(ctx.store.get(created.id).job.state, 'done');
  assert.equal((await ctx.req(`${route}/title`, { title: 'Yeni ad' }, restored.rev)).status, 200);
  assert.ok(path.isAbsolute(ctx.root));
});
