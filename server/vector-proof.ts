import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { layers, type Drawing, type Layer } from '../shared/vector';
import { serialize, InvalidDrawing } from './layered-svg';
const paint = (documents: string[]) =>
  new Promise<Uint8Array[]>((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'vector-paint.cjs'), {
      workerData: documents,
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 48 },
    });
    const fail = () =>
      reject(
        new InvalidDrawing(
          'Katmanlar güvenli boyutlarda çizilemedi. Daha basit ve kadraj içinde geometri kullan.',
        ),
      );
    const deadline = setTimeout(() => {
      fail();
      void worker.terminate();
    }, 5000);
    worker.once('message', (data) =>
      Array.isArray(data) &&
      data.length === documents.length &&
      data.every((b) => b instanceof Uint8Array && b.length === 108 * 135 * 4)
        ? resolve(data)
        : fail(),
    );
    worker.once('error', fail);
    worker.once('exit', () => {
      clearTimeout(deadline);
      fail();
    });
  });
// Native install smoke: run the packaged WASM/worker without any user model or asset.
export async function verifyPaintRuntime() {
  const [pixels] = await paint([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#1a2b3c"/></svg>',
  ]);
  return pixels[0] === 26 && pixels[1] === 43 && pixels[2] === 60 && pixels[3] === 255;
}
/** Cheap, bounded paint test during acquisition only. Counting XML tags does not
 * catch an empty/off-canvas layer, invisible arrows, or a tiny corner icon. */
export async function checkPaint(d: Drawing) {
  const w = 108,
    h = 135,
    n = w * h;
  const xml = (include: readonly Layer[]) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><defs>${d.defs.map(serialize).join('')}</defs>${include.map((l) => serialize(d.layers[l])).join('')}</svg>`;
  const [bg, main, full] = await paint([[layers[0]], layers.slice(0, 2), layers].map(xml));
  let opaque = 0,
    subject = 0,
    fx = 0,
    left = w,
    right = 0,
    top = h,
    bottom = 0;
  const palette = new Set<number>(),
    chroma = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const j = i * 4,
      x = i % w,
      y = Math.floor(i / w);
    if (bg[j + 3] > 210) opaque++;
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(bg[j + c] - main[j + c]))) > 12) {
      subject++;
      left = Math.min(x, left);
      right = Math.max(x, right);
      top = Math.min(y, top);
      bottom = Math.max(y, bottom);
    }
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(main[j + c] - full[j + c]))) > 12) fx++;
    const bin = (full[j] >> 5) * 64 + (full[j + 1] >> 5) * 8 + (full[j + 2] >> 5);
    palette.add(bin);
    const channels = [full[j], full[j + 1], full[j + 2]];
    if (Math.max(...channels) - Math.min(...channels) > 25)
      chroma.set(bin, (chroma.get(bin) ?? 0) + 1);
  }
  if (opaque / n < 0.94) throw new InvalidDrawing('Arka plan tüm kadrajı kaplamalı.');
  if (subject / n < 0.045 || Math.max((right - left) / w, (bottom - top) / h) < 0.48)
    throw new InvalidDrawing('Ana özneyi belirgin biçimde büyüt; küçük bir köşe ikonu çizme.');
  if (fx / n < 0.0009 || fx / n > 0.65)
    throw new InvalidDrawing('Efekt katmanı görünür ama özneyi örtmeyecek büyüklükte olmalı.');
  if (palette.size < 5 || [...chroma.values()].filter((v) => v / n > 0.002).length < 3)
    throw new InvalidDrawing('Zengin, kontrastlı bir renk paleti kullan.');
  return { background: opaque / n, subject: subject / n, effects: fx / n, colors: palette.size };
}
