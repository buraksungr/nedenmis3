import { operation, checkpoint } from './operation';
import { withRenderLease } from './render-lease';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { ChromeMode, HeadlessBrowser } from '@remotion/renderer';
import type { VideoConfig } from 'remotion';
import { Issue } from './store';

export type ScenePaths = { composition: string; defaultBrowser?: string };
type Candidate = { browserExecutable: string; chromeMode: ChromeMode };
const unquote = (s?: string) => s?.trim().replace(/^"(.*)"$/, '$1');

// The desktop host supplies the OS association, not a command to execute. Never launch
// an arbitrary HTTPS handler (or Electron itself) as Chrome. No PATH/cwd/cache lookups.
export function browserCandidates({
  defaultBrowser,
  env = process.env,
  platform = process.platform,
}: {
  defaultBrowser?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
} = {}): Candidate[] {
  const win = platform === 'win32',
    paths = win ? path.win32 : path.posix,
    files = [unquote(env.STUDIO_BROWSER)];
  if (win) {
    const handler = unquote(defaultBrowser);
    if (handler && /^(?:msedge|chrome|chromium)\.exe$/i.test(paths.basename(handler)))
      files.push(handler);
    for (const root of [
      env.ProgramW6432,
      env.ProgramFiles,
      env['ProgramFiles(x86)'],
      env.LOCALAPPDATA,
    ]) {
      if (!root) continue;
      files.push(
        paths.join(root, 'Microsoft/Edge/Application/msedge.exe'),
        paths.join(root, 'Google/Chrome/Application/chrome.exe'),
      );
    }
  } else if (platform === 'linux') {
    files.push('/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser');
  }
  const pathKey = (file: string) => (win ? file.toLowerCase() : file);
  const candidates: Candidate[] = [],
    seen = new Set([pathKey(paths.normalize(process.execPath))]);
  for (const file of files) {
    if (
      !file ||
      !paths.isAbsolute(file) ||
      (win && (!/^[a-z]:[\\/]/i.test(file) || !/\.exe$/i.test(file)))
    )
      continue;
    const browserExecutable = paths.normalize(file),
      key = pathKey(browserExecutable);
    if (seen.has(key)) continue;
    seen.add(key);
    // Remotion 4 defaults to --headless=old. Full Chrome/Edge need --headless=new;
    // only a standalone Headless Shell should use Remotion's shell mode.
    const shell = /^(?:chrome-headless-shell|headless_shell)(?:\.exe)?$/i.test(
      paths.basename(browserExecutable),
    );
    candidates.push({
      browserExecutable,
      chromeMode: shell ? 'headless-shell' : 'chrome-for-testing',
    });
  }
  return candidates;
}

export async function openFirstBrowser<T>(
  candidates: Candidate[],
  launch: (options: Candidate) => Promise<T>,
) {
  const failures: string[] = [];
  for (const options of candidates) {
    checkpoint();
    if (!(await stat(options.browserExecutable).catch(() => undefined))?.isFile()) continue;
    try {
      return { ...options, puppeteerInstance: await launch(options) };
    } catch (e) {
      checkpoint();
      // A browser may exist but exit before the DevTools connection is ready.
      const detail =
        e instanceof Error
          ? e.message.trim().split(/\r?\n/).filter(Boolean).slice(0, 2).join(' ').slice(0, 180)
          : 'Bağlantı kurulamadı';
      failures.push(`${options.browserExecutable} (${detail})`);
    }
  }
  const problem = failures.length
    ? `Render tarayıcısı başlatılamadı. Denenen: ${failures.join('; ')}.`
    : 'Remotion için kurulu bir Edge veya Chrome bulunamadı.';
  throw new Issue(
    412,
    `${problem} Edge/Chrome’u kurun veya güncelleyin. Özel konum için STUDIO_BROWSER değişkenine tarayıcının tam dosya yolunu yazıp stüdyoyu yeniden açın.`,
    'config',
  );
}

type SceneOptions = Candidate & {
  puppeteerInstance: HeadlessBrowser;
  serveUrl: string;
  inputProps: Record<string, unknown>;
  logLevel: 'error';
  cancelSignal?: ReturnType<typeof import('@remotion/renderer').makeCancelSignal>['cancelSignal'];
  composition: VideoConfig;
};

// Settings and production both load the real composition with the browser that actually
// connected. Never pass an undefined executable (which would trigger a runtime download).
export async function withDocumentaryScene<T>(
  paths: ScenePaths,
  inputProps: Record<string, unknown>,
  use: (options: SceneOptions) => T | Promise<T>,
): Promise<T> {
  if (!(await stat(path.join(paths.composition, 'index.html')).catch(() => undefined))?.isFile()) {
    throw new Issue(
      412,
      'Remotion kompozisyonu eksik. Uygulamayı yeniden kurun; geliştirme ortamında npm run build çalıştırın.',
      'config',
    );
  }
  return withRenderLease(async () => {
    const { openBrowser, selectComposition, makeCancelSignal } = await import('@remotion/renderer');
    const session = await openFirstBrowser(
      browserCandidates({ defaultBrowser: paths.defaultBrowser }),
      (options) => openBrowser('chrome', { ...options, logLevel: 'error' }),
    );
    const signal = operation()?.signal,
      { cancelSignal, cancel } = makeCancelSignal();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      checkpoint();
      const options = {
        ...session,
        serveUrl: paths.composition,
        inputProps,
        logLevel: 'error' as const,
      };
      const composition = await selectComposition({ ...options, id: 'DocumentaryScene' });
      checkpoint();
      return await use({ ...options, composition, cancelSignal });
    } finally {
      signal?.removeEventListener('abort', cancel);
      await session.puppeteerInstance.close({ silent: true });
    }
  });
}
