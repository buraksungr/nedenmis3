import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { browserCandidates, openFirstBrowser } from '../server/render-browser';
import { Issue } from '../server/store';

test('Windows: prefer override, then supported default, then machine and per-user installs', () => {
  const system = 'D:\\Program Files',
    x86 = 'D:\\Program Files (x86)',
    user = 'E:\\Kullanıcılar\\Işık\\AppData\\Local',
    override = 'F:\\Taşınabilir Tarayıcı\\chrome.exe',
    handler = 'G:\\Özel Konum\\msedge.exe';
  const env = {
    STUDIO_BROWSER: `"${override}"`,
    ProgramW6432: system,
    ProgramFiles: system.toLowerCase(),
    'ProgramFiles(x86)': x86,
    LOCALAPPDATA: user,
  };
  const candidates = browserCandidates({ platform: 'win32', env, defaultBrowser: handler });
  assert.deepEqual(
    candidates.map((c) => c.browserExecutable),
    [
      override,
      handler,
      ...[system, x86, user].flatMap((root) => [
        path.win32.join(root, 'Microsoft/Edge/Application/msedge.exe'),
        path.win32.join(root, 'Google/Chrome/Application/chrome.exe'),
      ]),
    ],
  );
  assert.ok(candidates.every((c) => c.chromeMode === 'chrome-for-testing'));
});

test('Only launch local absolute executables; never use arbitrary URL handlers or old headless mode for full Chrome', () => {
  for (const invalid of [
    '..\\chrome.exe',
    '\\chrome.exe',
    'D:chrome.exe',
    'D:\\browser.lnk',
    '\\\\share\\chrome.exe',
  ]) {
    assert.deepEqual(
      browserCandidates({
        platform: 'win32',
        env: { STUDIO_BROWSER: invalid },
        defaultBrowser: 'D:\\Apps\\firefox.exe',
      }),
      [],
    );
  }
  assert.ok(
    !browserCandidates({ env: { STUDIO_BROWSER: process.execPath } }).some(
      (c) => c.browserExecutable === process.execPath,
    ),
  );
  const shell = 'D:\\QA\\chrome-headless-shell.exe';
  assert.deepEqual(browserCandidates({ platform: 'win32', env: { STUDIO_BROWSER: shell } }), [
    { browserExecutable: shell, chromeMode: 'headless-shell' },
  ]);
  const linux = browserCandidates({
    platform: 'linux',
    env: { STUDIO_BROWSER: '/opt/studio-chrome' },
  });
  assert.equal(linux[0].browserExecutable, '/opt/studio-chrome');
  assert.ok(linux.some((c) => c.browserExecutable === '/usr/bin/chromium'));
});

test('An existing browser that exits early cannot mask a working one; missing or unusable browsers require configuration', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio tarayıcı-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const [missing, folder, earlyExit, good] = [
    path.join(dir, 'missing.exe'),
    dir,
    path.join(dir, 'msedge.exe'),
    path.join(dir, 'chrome.exe'),
  ].map((browserExecutable) => ({ browserExecutable, chromeMode: 'chrome-for-testing' as const }));
  await Promise.all([
    writeFile(earlyExit.browserExecutable, ''),
    writeFile(good.browserExecutable, ''),
  ]);
  const attempted: string[] = [],
    instance = Symbol('connected browser');
  const launch = async ({ browserExecutable }: { browserExecutable: string }) => {
    attempted.push(browserExecutable);
    if (browserExecutable !== good.browserExecutable)
      throw new Error('Failed to launch the browser process!\nError: Closed with 0 signal: null');
    return instance;
  };
  assert.deepEqual(await openFirstBrowser([missing, folder, earlyExit, good], launch), {
    ...good,
    puppeteerInstance: instance,
  });
  assert.deepEqual(attempted, [earlyExit.browserExecutable, good.browserExecutable]);
  await assert.rejects(
    openFirstBrowser([earlyExit], launch),
    (e: unknown) =>
      e instanceof Issue &&
      e.code === 'config' &&
      e.message.includes(earlyExit.browserExecutable) &&
      e.message.includes('Closed with 0'),
  );
  await assert.rejects(
    openFirstBrowser([missing, folder], launch),
    (e: unknown) =>
      e instanceof Issue &&
      e.code === 'config' &&
      e.message.includes('bulunamadı') &&
      e.message.includes('STUDIO_BROWSER'),
  );
});
