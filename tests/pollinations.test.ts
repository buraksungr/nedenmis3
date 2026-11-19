import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Pollinations, ImageUnavailable } from '../server/pollinations';
import { Store, makeProject } from '../server/store';
import { randomUUID } from 'node:crypto';
import { blankScene } from '../shared/schema';
import { memoryVault } from '../server/vault';
import { testImages } from './offline';

function temp(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pollinations-'));
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return store;
}

test('HTTP errors, redirect, invalid bodies, a stream over the limit, and a lost connection each stop after one image GET', async (t) => {
  const store = temp(t),
    key = 'sk_offline-secret-test';
  let response: () => Response,
    cancelled = false;
  const requests: { host: string; init?: RequestInit }[] = [];
  const chunk = new Uint8Array(1024 * 1024);
  const images = testImages(store, async (url, init) => {
    requests.push({ host: new URL(String(url)).host, init });
    return response();
  });
  images.key(key);
  for (response of [
    () => new Response(key, { status: 302, headers: { location: 'https://example.invalid/' } }),
    ...[401, 402, 403, 429, 503].map((status) => () => new Response(key, { status })),
    () => new Response(`<html>${key}</html>`, { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    () => new Response(null),
    () => new Response(new Uint8Array(0), { headers: { 'Content-Type': 'image/jpeg' } }),
    () => new Response('Not a PNG', { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(chunk, { headers: { 'Content-Length': String(31 * 1024 * 1024) } }),
    () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
    () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.error(new Error(key));
          },
        }),
      ),
    () => {
      throw new DOMException(key, 'TimeoutError');
    },
  ]) {
    const prior = requests.length;
    await assert.rejects(
      images.image('Onaylı sahne'),
      (err: unknown) => err instanceof ImageUnavailable && !err.message.includes(key),
    );
    assert.equal(requests.length, prior + 1);
    const { host, init } = requests[prior];
    assert.equal(host, 'gen.pollinations.ai');
    assert.equal(init?.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.equal(cancelled, true);
});

test('an unreadable saved credential never silently selects the legacy host', async (t) => {
  let calls = 0;
  const vault = {
    ...memoryVault(),
    has: () => true,
    get: (): string => {
      throw new Error('private vault detail');
    },
  };
  const images = new Pollinations(temp(t), vault, async () => {
    calls++;
    return new Response();
  });
  assert.equal(images.settings().hasKey, true);
  await assert.rejects(images.image('Kış'), /Kayıtlı anahtar çözülemedi/);
  assert.equal(calls, 0);
});

test('1.0.6 upgrade removes only Gemini image settings; prior media, text/TTS selections and counters survive', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-image-upgrade-'));
  const old = new Store(root, false);
  const text = { model: 'text-id', consent: 'free' },
    tts = { model: 'tts-id', consent: 'paid' };
  const requests = { '2026-11-16:image': 2, '2026-11-16:tts': 3 };
  old.set('gemini', {
    models: { text, tts, image: { model: 'old-image', consent: 'paid' } },
    catalog: ['text', 'image', 'tts'].map((kind) => ({ id: kind + '-id', kind, name: kind })),
    services: { tts: { status: 'connected' }, image: { status: 'connected' } },
    requests,
    status: 'connected',
    message: '',
    tested: null,
  });
  const p = makeProject('Eski resim', 'Kuşlar gölde dinlenir.');
  const scene = {
    ...blankScene(randomUUID()),
    description: p.script,
    narration: p.script,
    prompt: p.script,
  };
  p.scenes = [scene];
  const rel = 'images/' + randomUUID() + '.jpg';
  p.assets[scene.id] = { image: { file: rel, key: 'old', source: 'gemini' } };
  old.create(p);
  fs.copyFileSync('ui/public/art/ants.jpg', path.join(old.dir(p.id), rel));
  old.db.close();
  const store = new Store(root, false);
  t.after(() => {
    store.db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.deepEqual(store.get(p.id).assets, p.assets);
  assert.ok(fs.existsSync(path.join(store.dir(p.id), rel)));
  const saved = store.setting<any>('gemini', null);
  assert.deepEqual(saved.models, { text, tts });
  assert.deepEqual(
    saved.catalog.map((m: any) => m.kind),
    ['text', 'tts'],
  );
  assert.deepEqual(saved.services, { tts: { status: 'connected' } });
  assert.deepEqual(saved.requests, requests);
  assert.deepEqual(testImages(store).settings(), {
    hasKey: false,
    autoFill: true,
    storage: 'session',
  });
});
