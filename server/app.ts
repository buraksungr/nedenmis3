import type { PlannerWait } from './planner-pacing';
import { ObjectPlanner } from './object-planner';
import { motionFrame } from './motion-files';
export { parseSubjectRig, parseStage } from './motion-svg';
import { isDeepStrictEqual } from 'node:util';
export { parseIllustration } from './layered-svg';
import { Operation, checkpoint } from './operation';
import { readArtwork } from './atlas-art';
import { readIllustration, verifiedFrame } from './vector-files';
import archiver from 'archiver';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { validWords } from '../shared/captions';
import { randomTopic } from '../shared/topics';
import {
  STOPPED,
  STOPPING,
  kinds,
  sceneSchema,
  wordSchema,
  type Task,
  type Project,
} from '../shared/schema';
import { speakers } from '../shared/speakers';
import { Gemini } from './gemini';
import { memoryVault, type Vault } from './vault';
import { SceneModels, type PlannerVaults } from './scene-models';
import { invalidate } from './invalidate';
import { checks, setupPython, type Paths } from './media';
import { script } from './planner';
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
  summary,
} from './store';
const short = z.string().trim().min(2).max(240),
  txt = z.string().trim().max(10000),
  uuid = z.string().uuid();
const sceneList = z
  .array(
    sceneSchema.refine(
      (s) => [s.svgPlan, s.vector, s.choreography, s.cinema].filter(Boolean).length <= 1,
      'Bir sahnede yalnız bir çizim kullanılabilir.',
    ),
  )
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
    plannerVaults?: PlannerVaults;
    seed?: boolean;
    desktopToken?: string;
    transport?: typeof fetch;
    plannerWait?: PlannerWait;
  } = {},
) {
  const store = new Store(paths.root, options.seed),
    g = new Gemini(store, options.vault ?? memoryVault(), options.transport),
    prod = new Production(store, g, paths),
    planner = new SceneModels(
      store,
      options.plannerVaults ?? {
        groq: memoryVault(),
        openrouter: memoryVault(),
        anthropic: memoryVault(),
      },
      options.transport,
      g,
    ),
    objects = new ObjectPlanner(store, planner, options.plannerWait),
    settings = () => ({
      ...g.settings(),
      svgPlanner: planner.settings(),
    }),
    app = express();
  let busy: Operation | null = null,
    activeProject: Project | null = null,
    setup = { working: false, message: '' };
  // If even the final status cannot be written, retain the live project in memory,
  // report the disk problem instead of a stale "working" state, and retry on reads.
  // Editing is blocked until that exact in-memory revision has been saved.
  const pendingSaves = new Map<string, { project: Project; attemptedAt: number }>();
  const diskProblem =
    'Projenin son durumu diske kaydedilemedi. Disk erişimini kontrol edin; uygulamayı kapatmadan yeniden deneyin.';
  function readProject(id: string, force = false): Project {
    const pending = pendingSaves.get(id);
    if (!pending) return store.get(id);
    if (force || Date.now() - pending.attemptedAt >= 350) {
      pending.attemptedAt = Date.now();
      if (prod.persistJob(pending.project)) {
        pendingSaves.delete(id);
        return pending.project;
      }
    }
    return {
      ...pending.project,
      job: { ...pending.project.job, state: 'failed', runId: undefined, label: diskProblem },
    };
  }
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
    const p = readProject(String(req.params.id), true);
    requireThat(!pendingSaves.has(p.id), diskProblem, 503);
    requireThat(busy?.owner !== p.id, 'Proje işleniyor.');
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
  function stopActive() {
    const op = busy;
    if (!op) return;
    if (!op.signal.aborted) {
      try {
        if (activeProject) {
          activeProject.job = {
            ...activeProject.job,
            state: 'stopping',
            label: STOPPING,
            at: now(),
          };
          prod.persistJob(activeProject, true);
        }
        if (setup.working) setup.message = STOPPING;
      } finally {
        op.stop();
      }
    }
    return op.drained;
  }
  app.get('/api/operation', (_q, r) =>
    r.json(busy ? { ...busy.info(), projectJob: !!activeProject } : null),
  );
  app.post('/api/operations/:runId/stop', (q, r) => {
    requireThat(busy && busy.id === q.params.runId, 'Bu işlem artık çalışmıyor.');
    void stopActive();
    r.status(202).json(busy.info());
  });
  // Synchronous HTTP jobs (imports and tools) use the same cancellable lease, but
  // retain their existing response contracts. Only the owner releases it, in finally.
  async function managed<T>(owner: string, label: string, fn: () => Promise<T>) {
    idle();
    const op = (busy = new Operation(owner, label));
    try {
      return await op.run(fn);
    } catch (e) {
      if (op.signal.aborted) throw new Issue(409, STOPPED);
      throw e;
    } finally {
      busy = null;
      op.finish();
    }
  }
  function run(p: Project, kind: string, fn: () => Promise<void | Task>) {
    idle();
    const op = new Operation(p.id, 'İşlem başlatıldı');
    store.checkpoint(p);
    p.job = { state: 'working', runId: op.id, label: op.label, kind, at: now() };
    if (!prod.persistJob(p, true)) {
      // save() may have replaced project.json but failed to update the index. Do
      // not leave a fictitious running job on disk when no operation was started.
      p.job = { state: 'failed', kind, label: diskProblem, at: now() };
      pendingSaves.set(p.id, { project: p, attemptedAt: Date.now() });
      throw new Issue(503, diskProblem);
    }
    busy = op;
    activeProject = p;
    setImmediate(async () => {
      try {
        const pending = await op.run(fn);
        if (!pending && kind === 'all') requireThat(p.final, 'Tamamlanmış bir MP4 bulunamadı.');
        p.job = pending ?? {
          state: 'done',
          kind,
          label: kind === 'all' ? 'MP4 doğrulandı' : 'İşlem tamamlandı',
          at: now(),
        };
      } catch (e) {
        p.job = op.signal.aborted
          ? { state: 'cancelled', label: STOPPED, kind, at: now() }
          : {
              ...p.job,
              state: e instanceof Issue && e.code === 'config' ? 'config' : 'failed',
              label: message(e),
              at: now(),
            };
      } finally {
        try {
          if (!prod.persistJob(p, true))
            pendingSaves.set(p.id, { project: p, attemptedAt: Date.now() });
        } finally {
          activeProject = null;
          busy = null;
          op.finish();
        }
      }
    });
    return p;
  }
  async function generateScript(p: Project, action: string, index?: number) {
    const text = await script(planner, p, action, index, (label) =>
      prod.tick(p, label, p.job.kind ?? 'script'),
    );
    checkpoint();
    changeScript(p, text); // Only after a complete, validated response.
  }
  app.get('/api/topics/suggest', async (_q, r) => {
    let suggestion: string;
    try {
      const ai = await planner.text(
        'Rastgele bir Türkçe belgesel konusu öner. Sadece bir soru cümlesi yaz, açıklama ekleme. 6-12 kelime, doğa/bilim/uzay/tarih temalı.',
      );
      suggestion = ai.trim().replace(/^[\"']|[\"']$/g, '');
      if (!suggestion || suggestion.length < 5) throw new Error('Geçersiz AI yanıtı');
    } catch {
      suggestion = randomTopic();
    }
    r.json({ suggestion });
  });

  app.get('/api/projects', (_q, r) => {
    const items = store.list();
    for (const id of pendingSaves.keys()) {
      const item = summary(readProject(id));
      const index = items.findIndex((x) => x.id === id);
      if (index < 0) items.push(item);
      else items[index] = item;
    }
    r.json(items.sort((a, b) => b.updated.localeCompare(a.updated)));
  });
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
  app.get('/api/projects/:id', (q, r) => r.json(readProject(q.params.id)));
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
  app.get('/api/projects/:id/atlas/:digest.svg', (q, r) => {
    const svg = readArtwork(store.dir(q.params.id), q.params.digest);
    requireThat(svg, 'Çizim bulunamadı.', 404);
    r.set('Content-Security-Policy', "default-src 'none'; sandbox").type('image/svg+xml').send(svg);
  });
  app.get('/api/projects/:id/illustrations/:digest', (q, r) => {
    const { ref, drawing } = readIllustration(store.dir(q.params.id), q.params.digest);
    r.json({ ref, drawing });
  });
  app.get('/api/projects/:id/motion/:scene', (q, r) => {
    const p = readProject(q.params.id),
      s = find(p, q.params.scene);
    requireThat(s.visualMode === 'motion-svg', 'Bu sahnede hareket planı yok.', 404);
    r.json(motionFrame(store.dir(p.id), s.choreography, s.narration));
  });
  app.get('/api/projects/:id/draft-status', (q, r) => {
    const p = readProject(q.params.id);
    r.json({ ready: prod.draftReadyScenes(p).length, total: p.scenes.length });
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
    for (const s of b.scenes) {
      const saved = p.scenes.find((v) => v.id === s.id);
      requireThat(
        s.visualMode === 'motion-svg' || (saved && saved.visualMode === s.visualMode),
        'Yeni sahneler hareketli SVG olarak planlanır.',
        422,
      );
      if (s.visualMode === 'motion-svg' && b.approve)
        requireThat(s.choreography, 'Önce bu sahnenin SVG çizimini tamamlayın.', 422);
      if (s.choreography) {
        requireThat(
          isDeepStrictEqual(saved?.choreography, s.choreography),
          'Sahne koreografisi planlayıcıya bağlıdır.',
          422,
        );
        if (b.approve && s.visualMode === 'motion-svg')
          motionFrame(store.dir(p.id), s.choreography, s.narration);
      }
      if (s.cinema) {
        const stored = p.scenes.find((v) => v.id === s.id)?.cinema;
        requireThat(
          stored?.context === s.cinema.context && stored.brief === s.cinema.brief,
          'İllüstrasyon istemi ve öznesi planlayıcıya bağlıdır.',
          422,
        );
      }
      if (s.visualMode === 'svg' && !s.vector && !s.svgPlan)
        requireThat(!b.approve && p.vectorWork?.[s.id], 'Geçerli bir sahne çizimi gerekli.', 422);
      if (s.svgPlan) {
        requireThat(
          isDeepStrictEqual(p.scenes.find((v) => v.id === s.id)?.svgPlan, s.svgPlan),
          'Eski atlas yalnız kayıtlı sahnede okunabilir. Yeni sahne için vektör çizimi oluşturun.',
          422,
        );
      } else if (s.vector) {
        requireThat(
          isDeepStrictEqual(p.scenes.find((v) => v.id === s.id)?.vector, s.vector),
          'Çizim ve başlığı yalnız sahne modeli üretebilir.',
          422,
        );
        if (b.approve && s.visualMode === 'svg')
          verifiedFrame(store.dir(p.id), s.vector, s.narration);
      }
    }
    if (b.approve) approveBoard(next);
    const changed =
      JSON.stringify([p.scenes, p.styleGuide]) !== JSON.stringify([b.scenes, b.styleGuide]);
    if (changed || b.approve) {
      store.checkpoint(p);
      if (changed) {
        clearFinal(p);
        p.boardApproval = null;
      }
      if (p.motionWork)
        for (const id of Object.keys(p.motionWork))
          if (!b.scenes.some((s) => s.id === id)) delete p.motionWork[id];
      if (p.vectorWork)
        for (const id of Object.keys(p.vectorWork)) {
          const v = b.scenes.find((s) => s.id === id);
          if (
            !v ||
            (v.visualMode === 'photo' && p.scenes.find((s) => s.id === id)?.visualMode === 'svg')
          )
            delete p.vectorWork[id];
        }
      p.scenes = b.scenes;
      p.styleGuide = b.styleGuide;
      if (changed) invalidate(p, old);
      if (b.approve) {
        p.boardApproval = next.boardApproval;
        atomic(
          path.join(store.dir(p.id), 'storyboard', p.boardApproval + '.json'),
          JSON.stringify(
            {
              ...b,
              ...(p.scenes.some((s) => s.visualMode === 'illustration')
                ? { cinema: p.cinema }
                : {}),
            },
            null,
            2,
          ),
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
          'redraw-vector',
          'retry-vector',
          'all',
          'draft',
          'image',
          'voice',
          'align',
          'clip',
        ]),
        scene: uuid.optional(),
        instruction: z.string().trim().max(400).optional(),
        paragraph: z.number().int().nonnegative().optional(),
      })
      .parse(q.body);
    const s = b.scene ? find(p, b.scene) : undefined;
    if (['board', 'svg-board', 'redraw-vector', 'retry-vector'].includes(b.kind))
      requireThat(p.scriptApproval === scriptSig(p), 'Önce senaryoyu onaylayın.');
    if (['voice', 'align', 'clip', 'all', 'image'].includes(b.kind)) approved(p);
    if (b.kind === 'draft') {
      requireThat(p.scriptApproval === scriptSig(p), 'Önce güncel senaryoyu onaylayın.');
      requireThat(!s, 'Sessiz taslak tüm hazır sahnelerden oluşur.', 400);
      requireThat(
        prod.draftReadyScenes(p).length,
        'Sessiz taslak için en az bir sahne çizimi gerekli.',
      );
    }
    requireThat(
      b.kind !== 'image',
      'Fotoğraf üretimi kaldırıldı. Storyboard üzerinden hareketli SVG oluşturun.',
    );
    if (['voice', 'align', 'clip', 'redraw-vector', 'retry-vector'].includes(b.kind))
      requireThat(s, 'Bir sahne seçin.');
    requireThat(!(b.kind === 'all' && s), 'Toplu işlem için tek sahne seçilmez.', 400);
    r.status(202).json(
      run(p, b.kind, async () => {
        if (['script', 'shorten', 'lengthen', 'paragraph'].includes(b.kind)) {
          return generateScript(p, b.kind, b.paragraph);
        }
        if (['board', 'svg-board', 'redraw-vector', 'retry-vector'].includes(b.kind)) {
          if (b.kind === 'retry-vector')
            requireThat(s && p.motionWork?.[s.id], 'Bu sahne zaten hazır.');
          return objects.plan(
            p,
            (label, scene) => prod.tick(p, label, b.kind, scene?.id),
            s,
            b.kind === 'redraw-vector' ? (b.instruction ?? '') : undefined,
          );
        }
        if (b.kind === 'draft') return prod.exportDraft(p);
        return prod.render(p, b.kind as 'all' | 'voice' | 'align' | 'clip', s?.id);
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
      await managed(p.id, 'Dosya doğrulanıyor', async () => {
        await prod.import(p, kind, q.body, s);
        const pending = prod.waitingForImages(p);
        p.job = pending ?? {
          state: 'done',
          kind,
          label: 'Dosya doğrulandı ve içe aktarıldı',
          at: now(),
        };
        r.json(store.save(p));
      });
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
    const p = readProject(q.params.id, true);
    requireThat(!pendingSaves.has(p.id), diskProblem, 503);
    requireThat(busy?.owner !== p.id, 'Yedekleme için işlemin bitmesini bekleyin.');
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
  const cloudPlanner = z.enum(['groq', 'openrouter', 'anthropic']);
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
    await managed('settings', 'Gemini bağlantısı sınanıyor', () => g.test());
    r.json(settings());
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
    r.json(await managed('checks', 'Yerel servisler denetleniyor', () => checks(paths)));
  });
  app.get('/api/settings/python', (_q, r) => r.json(setup));
  app.post('/api/settings/python', (_q, r) => {
    idle();
    requireThat(
      options.vault?.mode === 'encrypted',
      'Python kurulumu masaüstü uygulamasından başlatılabilir.',
      412,
    );
    void managed('python', 'Whisper kurulumu', async () => {
      setup = { working: true, message: 'Kurulum başlatıldı' };
      await setupPython(paths, (s) => {
        checkpoint();
        setup.message = s;
        if (busy) busy.label = s;
      });
    })
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
        scene.visualMode !== 'motion-svg' &&
          scene.visualMode !== 'svg' &&
          scene.visualMode !== 'illustration',
        'Storyboard üzerinden bu sahneyi yönlendirme ile yeniden üretin.',
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
  return { app, store, g, prod, stopActive };
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
