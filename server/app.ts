import archiver from 'archiver';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { validWords } from '../shared/captions';
import { kinds, sceneSchema, wordSchema, type Task, type Project } from '../shared/schema';
import { speakers } from '../shared/speakers';
import { Gemini } from './gemini';
import { memoryVault, type Vault } from './vault';
import { Pollinations } from './pollinations';
import { SvgPlanner, type PlannerVaults } from './svg-planner';
import { invalidate } from './invalidate';
import { checks, setupPython, type Paths } from './media';
import { script, storyboard } from './planner';
import { Production, voiceKey } from './production';
import {
  Issue,
  Store,
  approveBoard,
  approved,
  atomic,
  changeScript,
  clearFinal,
  makeProject,
  now,
  requireThat,
  scriptSig,
} from './store';
const short = z.string().trim().min(2).max(240),
  txt = z.string().trim().max(10000),
  uuid = z.string().uuid();
const sceneList = z
  .array(sceneSchema.refine((s) => s.visualMode !== 'svg' || !!s.svgPlan, 'SVG şablonu eksik.'))
  .max(24)
  .refine(
    (a) => new Set(a.map((s) => s.id)).size === a.length,
    'Sahne kimlikleri benzersiz olmalı.',
  );
const pref = z
  .object({
    voice: z.enum(speakers),
    voiceStyle: z.string().trim().min(1).max(450),
    pace: z.enum(['Doğal', 'Yavaş', 'Hızlı']),
    subtitleSize: z.number().int().min(32).max(88),
    highlight: z.boolean(),
    musicVolume: z.number().min(0).max(0.5),
  })
  .partial();
export function createStudio(
  paths: Paths,
  options: {
    vault?: Vault;
    pollinationsVault?: Vault;
    plannerVaults?: PlannerVaults;
    seed?: boolean;
    desktopToken?: string;
    transport?: typeof fetch;
  } = {},
) {
  const store = new Store(paths.root, options.seed),
    g = new Gemini(store, options.vault ?? memoryVault(), options.transport),
    images = new Pollinations(store, options.pollinationsVault ?? memoryVault(), options.transport),
    prod = new Production(store, g, paths, images),
    planner = new SvgPlanner(
      store,
      options.plannerVaults ?? { groq: memoryVault(), openrouter: memoryVault() },
      options.transport,
    ),
    settings = () => ({
      ...g.settings(),
      pollinations: images.settings(),
      svgPlanner: planner.settings(),
    }),
    app = express();
  let busy: string | null = null,
    setup = { working: false, message: '' };
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (options.desktopToken && req.get('x-studio-session') !== options.desktopToken)
      return res.status(403).json({ error: 'Yerel oturum doğrulanamadı.' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      let originOK = !origin;
      if (origin) {
        try {
          const u = new URL(origin);
          originOK =
            u.host === req.get('host') ||
            (!options.desktopToken &&
              u.protocol === 'https:' &&
              /^\d+-[a-z0-9-]+\.e2b\.app$/.test(u.hostname) &&
              req.get('sec-fetch-site') === 'same-origin');
        } catch {
          originOK = false;
        }
      }
      if (
        req.get('sec-fetch-site') === 'cross-site' ||
        !originOK ||
        (!req.is('application/json') && !req.is('application/octet-stream'))
      )
        return res.status(403).json({ error: 'İstek kaynağı doğrulanamadı.' });
    }
    next();
  });
  app.use('/api', express.json({ limit: '512kb' }));
  const idle = () =>
    requireThat(!busy && !setup.working, 'Başka bir işlem sürüyor; tamamlanmasını bekleyin.');
  function writable(req: express.Request) {
    const p = store.get(String(req.params.id));
    requireThat(busy !== p.id, 'Proje işleniyor.');
    const rev = req.get('If-Match');
    requireThat(
      rev !== undefined && Number(rev) === p.rev,
      'Proje başka bir işlemde değişti. Yeniden açıp deneyin.',
      412,
    );
    return p;
  }
  const find = (p: Project, id: unknown) => {
    const s = p.scenes.find((s) => s.id === id);
    requireThat(s, 'Sahne bulunamadı.', 404);
    return s;
  };
  function run(p: Project, kind: string, fn: () => Promise<void | Task>) {
    idle();
    busy = p.id;
    store.checkpoint(p);
    p.job = { state: 'working', label: 'İşlem başlatıldı', kind, at: now() };
    store.save(p);
    store.log(p);
    setImmediate(async () => {
      try {
        const pending = await fn();
        if (!pending && kind === 'all') requireThat(p.final, 'Tamamlanmış bir MP4 bulunamadı.');
        p.job = pending ?? {
          state: 'done',
          kind,
          label: kind === 'all' ? 'MP4 doğrulandı' : 'İşlem tamamlandı',
          at: now(),
        };
      } catch (e) {
        p.job = {
          ...p.job,
          state: e instanceof Issue && e.code === 'config' ? 'config' : 'failed',
          label: message(e),
          at: now(),
        };
      } finally {
        store.save(p);
        store.log(p);
        busy = null;
      }
    });
    return p;
  }
  async function generateScript(p: Project, action: string, index?: number) {
    const text = await script(g, p, action, index, (label) =>
      prod.tick(p, label, p.job.kind ?? 'script'),
    );
    changeScript(p, text); // Only after a complete, validated response.
  }
  app.get('/api/projects', (_q, r) => r.json(store.list()));
  app.post('/api/projects', (q, r) => {
    const b = z
      .object({
        topic: short,
        instructions: txt.default(''),
        script: txt.default(''),
      })
      .parse(q.body);
    if (!b.script) idle();
    const p = makeProject(b.topic, b.script, b.instructions);
    store.create(p);
    if (!b.script && !busy && !setup.working) {
      run(p, 'script', () => generateScript(p, 'generate'));
    }
    r.status(201).json(p);
  });
  app.get('/api/projects/:id', (q, r) => r.json(store.get(q.params.id)));
  app.post('/api/projects/:id/script', (q, r) => {
    const p = writable(q);
    const b = z.object({ text: txt, approve: z.boolean().optional() }).parse(q.body);
    if (b.approve) requireThat(b.text.length > 5, 'Onaylamak için senaryo girin.');
    if (p.script !== b.text || b.approve) {
      store.checkpoint(p);
      changeScript(p, b.text);
      if (b.approve) {
        p.scriptApproval = scriptSig(p);
        atomic(path.join(store.dir(p.id), 'script', p.scriptApproval + '.txt'), p.script);
      }
      store.save(p);
    }
    r.json(p);
  });
  app.post('/api/projects/:id/board', (q, r) => {
    const p = writable(q);
    requireThat(p.scriptApproval === scriptSig(p), 'Önce senaryoyu onaylayın.');
    const b = z
      .object({
        scenes: sceneList,
        styleGuide: z.string().min(1).max(3000),
        approve: z.boolean().optional(),
      })
      .parse(q.body);
    const old = structuredClone(p);
    const next = { ...p, scenes: b.scenes, styleGuide: b.styleGuide };
    if (b.approve) approveBoard(next);
    const changed =
      JSON.stringify([p.scenes, p.styleGuide]) !== JSON.stringify([b.scenes, b.styleGuide]);
    if (changed || b.approve) {
      store.checkpoint(p);
      if (changed) {
        clearFinal(p);
        p.boardApproval = null;
      }
      p.scenes = b.scenes;
      p.styleGuide = b.styleGuide;
      if (changed) invalidate(p, old);
      if (b.approve) {
        p.boardApproval = next.boardApproval;
        atomic(
          path.join(store.dir(p.id), 'storyboard', p.boardApproval + '.json'),
          JSON.stringify(b, null, 2),
        );
      }
      store.save(p);
    }
    r.json(p);
  });
  app.post('/api/projects/:id/generate', (q, r) => {
    const p = writable(q);
    const b = z
      .object({
        kind: z.enum([
          'script',
          'shorten',
          'lengthen',
          'paragraph',
          'board',
          'svg-board',
          'concept',
          'all',
          'image',
          'voice',
          'align',
          'clip',
        ]),
        scene: uuid.optional(),
        paragraph: z.number().int().nonnegative().optional(),
      })
      .parse(q.body);
    const s = b.scene ? find(p, b.scene) : undefined;
    if (['board', 'svg-board', 'concept'].includes(b.kind))
      requireThat(p.scriptApproval === scriptSig(p), 'Önce senaryoyu onaylayın.');
    if (['all', 'image', 'voice', 'align', 'clip'].includes(b.kind)) approved(p);
    if (['image', 'voice', 'align', 'clip', 'concept'].includes(b.kind))
      requireThat(s, 'Bir sahne seçin.');
    if (b.kind === 'image')
      requireThat(s?.visualMode !== 'svg', 'SVG sahnesi görsel API kullanmaz.');
    requireThat(!(b.kind === 'all' && s), 'Tam üretim tüm zaman çizelgesini kullanır.', 400);
    r.status(202).json(
      run(p, b.kind, async () => {
        if (['script', 'shorten', 'lengthen', 'paragraph'].includes(b.kind)) {
          return generateScript(p, b.kind, b.paragraph);
        }
        if (b.kind === 'svg-board') {
          const result = await planner.plan(p),
            old = structuredClone(p);
          p.scenes = result.scenes;
          p.boardApproval = null;
          clearFinal(p);
          invalidate(p, old);
          if (result.warning)
            return {
              state: 'waiting',
              kind: 'svg-plan-fallback',
              label: result.warning,
              at: now(),
            };
          return;
        }
        if (b.kind === 'board' || b.kind === 'concept') {
          const result = await storyboard(g, p, s);
          const old = structuredClone(p);
          clearFinal(p);
          Object.assign(p, result);
          invalidate(p, old);
          p.boardApproval = null;
          return;
        }
        return prod.render(p, b.kind as 'all' | 'image' | 'voice' | 'align' | 'clip', s?.id);
      }),
    );
  });
  app.post('/api/projects/:id/preferences', (q, r) => {
    const p = writable(q),
      b = pref.parse(q.body);
    store.checkpoint(p);
    const old = structuredClone(p);
    if (b.voice !== undefined && b.voice !== p.voice) p.speakerPinned = true;
    Object.assign(p, b);
    invalidate(p, old);
    clearFinal(p);
    r.json(store.save(p));
  });
  app.post('/api/projects/:id/undo', (q, r) => r.json(store.undo(writable(q))));
  app.post('/api/projects/:id/title', (q, r) => {
    const p = writable(q),
      b = short.parse(q.body.title);
    store.checkpoint(p);
    p.title = b;
    r.json(store.save(p));
  });
  app.post('/api/projects/:id/subtitles', (q, r) => {
    const p = writable(q);
    approved(p);
    const s = find(p, q.body.scene),
      m = p.assets[s.id];
    const words = (
      m?.align?.method === 'estimated'
        ? z.array(wordSchema.extend({ text: z.string().trim().min(1).max(5000) })).max(5000)
        : z.array(wordSchema).max(1000)
    ).parse(q.body.words);
    requireThat(
      m?.voice && prod.usable(p, m.voice, voiceKey(p, s)) && validWords(words, m.voice.duration!),
      'Zamanlar sıralı, çakışmasız ve ses süresi içinde olmalı.',
    );
    store.checkpoint(p);
    m.edits = words;
    delete m.clip;
    clearFinal(p);
    r.json(store.save(p));
  });
  app.post(
    '/api/projects/:id/import/:kind',
    express.raw({ type: 'application/octet-stream', limit: '30mb' }),
    async (q, r) => {
      idle();
      const p = writable(q);
      approved(p);
      const kind = z.enum(['image', 'voice', 'music', 'sfx']).parse(q.params.kind);
      const s = kind === 'music' ? undefined : find(p, q.query.scene);
      requireThat(Buffer.isBuffer(q.body) && q.body.length > 0, 'Dosya boş.', 400);
      store.checkpoint(p);
      busy = p.id;
      try {
        await prod.import(p, kind, q.body, s);
        const pending =
          !images.autoFill() || p.job.kind === 'manual-images'
            ? prod.waitingForImages(p)
            : undefined;
        p.job = pending ?? {
          state: 'done',
          kind,
          label: 'Dosya doğrulandı ve içe aktarıldı',
          at: now(),
        };
        r.json(store.save(p));
      } finally {
        busy = null;
      }
    },
  );
  app.get('/api/projects/:id/media/:folder/:file', (q, r) => {
    const { id, folder, file } = q.params;
    requireThat(
      (/^(images|audio|music|renders|subtitles|scenes)$/.test(folder) ||
        (folder === 'storyboard' && file.endsWith('.jpg'))) &&
        /^[\da-f-]{36}\.(jpg|wav|mp4|json|srt)$/.test(file),
      'Varlık bulunamadı.',
      404,
    );
    const target = path.join(
      store.dir(id),
      folder === 'storyboard' ? 'media/storyboard' : folder,
      file,
    );
    requireThat(fs.existsSync(target), 'Dosya bulunamadı.', 404);
    if (q.query.download === '1') r.attachment('Nedenmis-' + file);
    r.sendFile(target);
  });
  app.get('/api/projects/:id/backup', (q, r) => {
    const p = store.get(q.params.id);
    requireThat(busy !== p.id, 'Yedekleme için işlemin bitmesini bekleyin.');
    r.attachment(`Nedenmis-${p.id.slice(0, 8)}.zip`);
    const a = archiver('zip', { zlib: { level: 1 } });
    a.on('error', () => r.destroy());
    r.on('close', () => a.abort());
    a.pipe(r);
    a.glob('**/*', { cwd: store.dir(p.id), ignore: ['cache/**', '*.tmp'] });
    void a.finalize();
  });
  app.get('/api/settings', (_q, r) => r.json(settings()));
  app.post('/api/settings/svg-planner', (q, r) => {
    idle();
    planner.configure(q.body);
    r.json(settings());
  });
  const cloudPlanner = z.enum(['groq', 'openrouter']);
  app.post('/api/settings/svg-planner/key/:provider', (q, r) => {
    idle();
    planner.key(
      cloudPlanner.parse(q.params.provider),
      z.string().trim().min(1).max(512).parse(q.body.key),
    );
    r.json(settings());
  });
  app.delete('/api/settings/svg-planner/key/:provider', (q, r) => {
    idle();
    planner.key(cloudPlanner.parse(q.params.provider));
    r.json(settings());
  });
  app.post('/api/settings/pollinations', (q, r) => {
    idle();
    images.setAutoFill(z.boolean().parse(q.body.autoFill));
    r.json(settings());
  });
  app.post('/api/settings/pollinations/key', (q, r) => {
    idle();
    images.key(z.string().trim().min(1).max(512).parse(q.body.key));
    r.json(settings());
  });
  app.delete('/api/settings/pollinations/key', (_q, r) => {
    idle();
    images.key();
    r.json(settings());
  });
  app.post('/api/settings/key', (q, r) => {
    idle();
    g.key(z.string().trim().min(1).parse(q.body.key));
    r.json(settings());
  });
  app.delete('/api/settings/key', (_q, r) => {
    idle();
    g.key();
    r.json(settings());
  });
  app.post('/api/settings/test', async (_q, r) => {
    idle();
    busy = 'settings';
    try {
      await g.test();
      r.json(settings());
    } finally {
      busy = null;
    }
  });
  app.post('/api/settings/speaker', (q, r) => {
    idle();
    store.set('tts-speaker', z.enum(speakers).parse(q.body.speaker));
    r.json(settings());
  });
  app.post('/api/settings/model', (q, r) => {
    idle();
    const b = z
      .object({
        kind: z.enum(kinds),
        model: z.string().default(''),
        consent: z.enum(['blocked', 'free', 'paid']),
      })
      .parse(q.body);
    g.configure(b.kind, b);
    r.json(settings());
  });
  app.post('/api/settings/checks', async (_q, r) => {
    idle();
    busy = 'checks';
    try {
      r.json(await checks(paths));
    } finally {
      busy = null;
    }
  });
  app.get('/api/settings/python', (_q, r) => r.json(setup));
  app.post('/api/settings/python', (_q, r) => {
    idle();
    requireThat(
      options.vault?.mode === 'encrypted',
      'Python kurulumu masaüstü uygulamasından başlatılabilir.',
      412,
    );
    setup = { working: true, message: 'Kurulum başlatıldı' };
    void setupPython(paths, (s) => (setup.message = s))
      .then(() => (setup.message = 'Kurulum doğrulandı.'))
      .catch((e) => (setup.message = message(e)))
      .finally(() => (setup.working = false));
    r.status(202).json(setup);
  });
  app.post('/api/settings/setup', (_q, r) => {
    store.set('setup-done', true);
    r.json(settings());
  });
  app.post('/api/projects/:id/revision', async (q, r) => {
    const p = writable(q);
    approved(p);
    const b = z
      .object({ text: z.string().trim().min(3).max(600), scene: uuid.optional() })
      .parse(q.body);
    const old = structuredClone(p);
    const t = b.text.toLocaleLowerCase('tr');
    const num = t.match(/(?:sahne\s*#?\s*(\d+)|(\d+)\s*[.']?\s*(?:inci\s+)?sahne)/);
    const ord = ['ilk', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', 'altıncı', 'yedinci'];
    if (num)
      requireThat(
        Number(num[1] ?? num[2]) >= 1 && Number(num[1] ?? num[2]) <= p.scenes.length,
        'Hedef sahne numarası proje dışında.',
        422,
      );
    const ix = num ? Number(num[1] ?? num[2]) - 1 : ord.findIndex((x) => t.includes(x));
    const scene = ix >= 0 ? p.scenes[ix] : b.scene ? find(p, b.scene) : undefined;
    if (/altyazı|alt yazı/.test(t) && /küçül|büyü/.test(t)) {
      store.checkpoint(p);
      p.subtitleSize = Math.max(32, Math.min(88, p.subtitleSize + (/küçül/.test(t) ? -6 : 6)));
    } else if (/müzi|müzik/.test(t) && /azalt|kıs|artır|yükselt/.test(t)) {
      store.checkpoint(p);
      p.musicVolume = Math.max(
        0,
        Math.min(0.5, p.musicVolume + (/azalt|kıs/.test(t) ? -0.04 : 0.04)),
      );
    } else if (scene && /görsel|çiz|resim/.test(t)) {
      requireThat(
        scene.visualMode !== 'svg',
        'SVG şablonunu storyboard alanlarından düzenleyin.',
        422,
      );
      store.checkpoint(p);
      scene.prompt += '\nRevizyon: ' + b.text;
      p.boardApproval = null;
    } else
      throw new Issue(
        422,
        'Hedefi belirtin: örneğin “Altyazı boyutunu küçült” veya “Müziği azalt”.',
      );
    invalidate(p, old);
    clearFinal(p);
    r.json(store.save(p));
  });
  app.use('/api', (_q, r) => r.status(404).json({ error: 'İşlem bulunamadı.' }));
  app.use((e: any, _q: express.Request, r: express.Response, _n: express.NextFunction) =>
    r.status(e instanceof z.ZodError ? 400 : e.status || 500).json({ error: message(e) }),
  );
  return { app, store, g, prod };
}
function message(e: unknown) {
  if (e instanceof z.ZodError)
    return (
      'Girdi doğrulanamadı: ' +
      e.issues
        .map((i) => i.path.join('.'))
        .slice(0, 4)
        .join(', ')
    );
  if (e instanceof Issue) return e.message.replace(/AIza[\w-]+/g, '[gizli]');
  return 'İşlem tamamlanamadı. Dosyaları ve servis yapılandırmasını kontrol edin.';
}
