import { spawn } from 'node:child_process';
import path from 'node:path';
function binary(pkg: string, fallback: string): string {
  try {
    return require(pkg).path;
  } catch {
    return fallback;
  }
}

import type { Check, Scene } from '../shared/schema';
import { wav } from './gemini';
import { withDocumentaryScene, type ScenePaths } from './render-browser';
import { Issue, requireThat } from './store';
export const ffmpeg = process.env.STUDIO_FFMPEG || binary('@ffmpeg-installer/ffmpeg', 'ffmpeg'),
  ffprobe = process.env.STUDIO_FFPROBE || binary('@ffprobe-installer/ffprobe', 'ffprobe');
export type Paths = ScenePaths & { root: string; pythonDir: string };
// Local diagnostics only: never echo command arguments, environment or unbounded tool output.
export function errorDetail(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/AIza[\w-]+/g, '[gizli]')
    .replace(/(Bearer\s+|[?&]key=)[^\s&]+/gi, '$1[gizli]')
    .replace(/[\x00-\x1f]+/g, ' ')
    .trim()
    .slice(0, 1800);
}
export function exec(
  bin: string,
  args: string[],
  ms = 180000,
  onLine?: (line: string) => void,
  cwd?: string,
) {
  return new Promise<string>((resolve, reject) => {
    let stdout = '',
      stderr = '';
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        PATH: path.dirname(ffmpeg) + path.delimiter + process.env.PATH,
        PYTHONUTF8: '1',
        OMP_NUM_THREADS: '2',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, ms);
    child.stdout.on('data', (b) => {
      stdout = (stdout + b).slice(-524288);
      onLine?.(String(b).trim().slice(-180));
    });
    child.stderr.on('data', (b) => {
      stderr = (stderr + b).slice(-2048);
    });
    child.once('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Issue(412, `${bin}: başlatılamadı (${e.code ?? e.name}).`, 'config'));
    });
    child.once('close', (c, signal) => {
      clearTimeout(timer);
      if (c === 0) resolve(stdout);
      else
        reject(
          new Issue(
            422,
            `${path.basename(bin)}: ${timedOut ? `${ms / 1000} sn süre sınırı aşıldı` : `çıkış=${c ?? 'yok'}${signal ? `, sinyal=${signal}` : ''}`}; ${errorDetail(stderr.trim().slice(-1200)) || 'stderr boş.'}`,
          ),
        );
    });
  });
}
export const ff = (args: string[], ms?: number, cwd?: string) =>
  exec(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-xerror', '-nostdin', '-y', '-threads', '2', ...args],
    ms,
    undefined,
    cwd,
  );
export async function probe(file: string) {
  return JSON.parse(
    await exec(
      ffprobe,
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        file,
      ],
      20000,
    ),
  );
}
export async function audioDuration(file: string) {
  const p = await probe(file);
  const d = Number(p.format.duration);
  requireThat(
    p.streams.some((s: any) => s.codec_type === 'audio') && d > 0.05 && d <= 180,
    'Ses boş, bozuk veya üç dakikadan uzun.',
    422,
  );
  return d;
}
export async function verifyVideo(file: string, frames: number, audio: boolean) {
  const p = await probe(file),
    v = p.streams.find((s: any) => s.codec_type === 'video');
  requireThat(
    v?.codec_name === 'h264' &&
      v.width === 1080 &&
      v.height === 1920 &&
      v.r_frame_rate === '30/1' &&
      Math.abs(Number(v.nb_frames) - frames) < 1,
    'Video boyutu, kare sayısı veya kodlaması doğrulanamadı.',
    422,
  );
  if (audio) {
    const a = p.streams.find((s: any) => s.codec_type === 'audio');
    requireThat(
      a?.codec_name === 'aac' && Math.abs(Number(a.duration) - frames / 30) < 0.11,
      'AAC kanalı veya ses-görüntü eşleşmesi doğrulanamadı.',
      422,
    );
    await ff(['-i', file, '-f', 'null', '-'], 600000);
  }
  return Number(v.duration);
}
export const python = (p: Paths) =>
  process.env.STUDIO_PYTHON ||
  path.join(p.root, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export async function checks(p: Paths, { whisper = true, render = true } = {}): Promise<Check[]> {
  const check = async (id: string, name: string, fn: () => Promise<string>): Promise<Check> => {
    try {
      return { id, name, ok: true, detail: await fn() };
    } catch (e) {
      return { id, name, ok: false, detail: e instanceof Error ? e.message : 'Kullanılamıyor' };
    }
  };
  return Promise.all([
    check('ffmpeg', 'FFmpeg + FFprobe', async () => {
      const txt = await exec(ffmpeg, ['-version']);
      await exec(ffprobe, ['-version']);
      return txt.split('\n')[0].split('Copyright')[0].trim();
    }),
    ...(whisper
      ? [
          check('whisper', 'Whisper + hizalama', () =>
            exec(
              python(p),
              [
                path.join(p.pythonDir, 'align.py'),
                '--check',
                '--models',
                path.join(p.root, 'models'),
              ],
              60000,
            ),
          ),
        ]
      : []),
    ...(render
      ? [
          check('remotion', 'Remotion', () =>
            withDocumentaryScene(
              p,
              {},
              ({ browserExecutable }) =>
                `Kompozisyon açıldı. Render tarayıcısı: ${browserExecutable}`,
            ),
          ),
        ]
      : []),
  ]);
}
export async function setupPython(p: Paths, stage: (s: string) => void) {
  const dir = path.join(p.root, 'venv');
  stage('Python ortamı oluşturuluyor');
  await exec(process.platform === 'win32' ? 'py' : 'python3', [
    ...(process.platform === 'win32' ? ['-3.11'] : []),
    '-m',
    'venv',
    dir,
  ]);
  stage('CPU için PyTorch kuruluyor');
  await exec(
    python(p),
    [
      '-m',
      'pip',
      'install',
      '--index-url',
      'https://download.pytorch.org/whl/cpu',
      'torch==2.6.0',
      'torchaudio==2.6.0',
    ],
    1200000,
  );
  stage('Whisper ve hizalama paketleri kuruluyor');
  await exec(
    python(p),
    ['-m', 'pip', 'install', '-r', path.join(p.pythonDir, 'requirements.txt')],
    1200000,
  );
  stage('Çok dilli Whisper base modeli indiriliyor ve doğrulanıyor');
  await exec(
    python(p),
    [
      path.join(p.pythonDir, 'align.py'),
      '--install-model',
      '--models',
      path.join(p.root, 'models'),
    ],
    1200000,
  );
  await exec(
    python(p),
    [path.join(p.pythonDir, 'align.py'), '--check', '--models', path.join(p.root, 'models')],
    60000,
  );
}
// Original deterministic underscore + scene-specific Foley. No sampled or downloaded music.
export function soundBed(duration: number, scene?: Scene) {
  const hz = 16000,
    len = Math.ceil(duration * hz),
    data = Buffer.alloc(len * 2);
  let seed = 419,
    n = 0,
    lp = 0;
  const env = scene?.effect;
  for (let i = 0; i < len; i++) {
    const t = i / hz;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    n = seed / 2147483648 - 1;
    lp = lp * 0.97 + n * 0.03;
    const chord = [146.83, 130.81, 110, 123.47][Math.floor(t / 4) % 4];
    let s: number;
    if (!scene) {
      s =
        (Math.sin(t * chord * 2 * Math.PI) +
          0.55 * Math.sin(t * chord * 3 * Math.PI) +
          0.22 * Math.sin(t * chord * 4 * Math.PI)) *
        0.22 *
        (0.65 + 0.35 * Math.sin((Math.PI * t) / 4) ** 2);
    } else if (env === 'bubbles' || env === 'water') {
      s =
        lp * 0.43 + Math.sin(t * (150 + (t % 1.7) * 30) * 6.283) * 0.025 * Math.exp(-(t % 1.7) * 9);
    } else if (env === 'snow' || env === 'fog' || env === 'rays') {
      s = lp * 0.75 * (0.65 + 0.35 * Math.sin(t * 1.7));
    } else if (scene.object === 'trail') {
      s = n * 0.11 * Math.exp(-(t % 0.28) * 100);
    } else {
      s = env === 'stars' ? 0 : lp * 0.15;
    }
    if (scene) {
      const cue = scene.sound.toLocaleLowerCase('tr');
      if (scene.object === 'trail' || /adım|ayak|hışırtı/.test(cue))
        s += n * 0.085 * Math.exp(-(t % 0.39) * 95);
      else if (env === 'bubbles' || /kabarcık/.test(cue))
        s += Math.sin(t * (390 + (t % 1.91) * 55) * 6.283) * 0.03 * Math.exp(-(t % 1.91) * 22);
      else if (/rüzgâr|rüzgar|kış/.test(cue)) s += lp * 0.28 * (0.5 + 0.5 * Math.sin(t * 0.67));
    }
    const fade = Math.min(1, t / 0.3, Math.max(0, duration - t) / 0.34);
    data.writeInt16LE(Math.round(s * fade * 32760), i * 2);
  }
  return wav(data, hz);
}
