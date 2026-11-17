import path from 'node:path';
import { createServer } from 'vite';
import { createStudio } from './app';
(async () => {
  const root = process.cwd();
  const { app } = createStudio({
    root: path.resolve(process.env.STUDIO_HOME || '.studio'),
    pythonDir: path.join(root, 'python'),
    composition: path.join(root, 'build/composition'),
  });
  const port = Number(process.env.PORT || 5173);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Nedenmiş Studio · port ${port}`));
  const vite = await createServer({
    root: path.join(root, 'ui'),
    server: {
      middlewareMode: true,
      fs: {
        deny: [
          '**/.studio/**',
          '**/.git/**',
          '**/.env*',
          '**/*.credential',
          '**/*.sqlite*',
          '**/server/**',
          '**/desktop/**',
          '**/out/**',
        ],
      },
      allowedHosts: true,
      hmr: { server },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
