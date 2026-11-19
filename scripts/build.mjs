import path from 'node:path';
import fs from 'node:fs';
import { build } from 'vite';
import { build as esbuild } from 'esbuild';
import { bundle } from '@remotion/bundler';
const root = process.cwd();
await build({
  root: path.join(root, 'ui'),
  build: { outDir: path.join(root, 'build/ui'), emptyOutDir: true },
});
await esbuild({
  entryPoints: ['server/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'build/server.cjs',
  packages: 'external',
});
fs.copyFileSync('server/vector-paint.cjs', 'build/vector-paint.cjs');
fs.mkdirSync('build/composition', { recursive: true });
await bundle({
  entryPoint: path.resolve('composition/Film.tsx'),
  outDir: path.resolve('build/composition'),
  publicDir: null,
  webpackOverride: (config) => ({ ...config, devtool: false }),
});
for (const f of fs.readdirSync('build/composition'))
  if (f.endsWith('.map')) fs.rmSync(path.join('build/composition', f));
console.log('Arayüz, yerel servis ve Remotion kompozisyonu hazır.');
