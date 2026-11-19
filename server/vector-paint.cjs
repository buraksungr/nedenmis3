// Isolated acquisition-time paint check. The worker receives only reconstructed
// XML (no original provider bytes). A faulty rasterizer cannot abort the studio.
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const { initWasm, Resvg } = require('@resvg/resvg-wasm');
(async () => {
  await initWasm(fs.readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  const buffers = workerData.map((xml) => {
    const r = new Resvg(xml, {
      fitTo: { mode: 'width', value: 108 },
      font: { loadSystemFonts: false },
    });
    const image = r.render();
    const pixels = Uint8Array.from(image.pixels);
    image.free();
    r.free();
    return pixels;
  });
  parentPort.postMessage(
    buffers,
    buffers.map((p) => p.buffer),
  );
})().catch(() => parentPort.postMessage(null));
