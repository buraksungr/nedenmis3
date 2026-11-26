import { motionFrame } from './motion-files';
import { isSvgScene } from '../shared/schema';
import { STYLE_LOCK, NEGATIVE_LOCK } from '../shared/cinema';
import { checkpoint, operation } from './operation';
import { readArtwork } from './atlas-art';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FilmProps } from '../composition/Film';
import {
  sceneSeconds,
  sceneCaptions,
  unvoicedSvg,
  useExistingVoiceOnly,
  captionEntries,
  cue,
  groups,
  srtFromCues,
  validWords,
} from '../shared/captions';
import {
  mediaUrl,
  type Asset,
  type Project,
  type Scene,
  type Task,
  type TimedText,
  type Word,
} from '../shared/schema';
import { readWhisper, sentenceEstimates, verifiedAlignment } from './alignment';
import { inputFormat } from './import-formats';
import { Gemini } from './gemini';
import {
  audioDuration,
  checks,
  errorDetail,
  ffmpeg,
  ffprobe,
  ff,
  probe,
  python,
  soundBed,
  verifyVideo,
  type Paths,
} from './media';
import { legacyPlate } from '../shared/legacy-atlas';
import { verifiedFrame } from './vector-files';
import { withDocumentaryScene } from './render-browser';
import { Issue, Store, approved, atomic, hash, now, requireThat, scriptSig } from './store';
export type Step = 'all' | 'voice' | 'align' | 'clip';
export const imageKey = (p: Project, s: Scene) =>
  s.visualMode === 'illustration'
    ? hash('science-image-v1', p.cinema?.subject, s.cinema?.brief, STYLE_LOCK, NEGATIVE_LOCK)
    : hash('image-v1', p.styleGuide, s.description, s.prompt, s.angle, s.environment);
export const voiceKey = (p: Project, s: Scene) =>
  hash('voice-v1', s.narration, p.voice, p.voiceStyle, p.pace);
export const framesForVoice = (seconds: number) => Math.max(1, Math.ceil(seconds * 30 - 1e-7));
/** Inputs of the separate, deliberately silent draft. Audio and alignment never affect it. */
export const draftInputs = (p: Project) =>
  hash(
    'silent-draft-inputs-v1',
    p.styleGuide,
    p.subtitleSize,
    p.scenes.map((s) => [
      s.id,
      s.visualMode,
      s.narration,
      s.seconds,
      s.choreography,
      s.vector,
      s.svgPlan,
      p.assets[s.id]?.image,
    ]),
  );
export class Production {
  // Per in-memory project: a render may report hundreds of frames per second.
  // Remember attempts, not only successes, so a locked disk is not hammered.
  private readonly progressWrites = new WeakMap<Project, number>();
  constructor(
    private store: Store,
    private g: Gemini,
    private paths: Paths,
    private readonly runWhisper = readWhisper,
  ) {}
  /** Progress/status writes must never escape a Remotion callback or async job finalizer. */
  persistJob(p: Project, log = false): boolean {
    let saved = false;
    try {
      this.store.save(p);
      saved = true;
    } catch (e) {
      console.error(`[Üretim] Proje durumu kaydedilemedi (${p.id}): ${errorDetail(e)}`);
    }
    if (log) {
      try {
        this.store.log(p);
      } catch (e) {
        console.error(`[Üretim] İlerleme günlüğü yazılamadı (${p.id}): ${errorDetail(e)}`);
      }
    }
    return saved;
  }
  file(p: Project, rel: string) {
    const base = this.store.dir(p.id),
      file = path.resolve(base, rel);
    requireThat(file.startsWith(base + path.sep), 'Proje dışındaki dosyaya erişilemez.', 400);
    return file;
  }
  usable(p: Project, a: Asset | undefined, key: string) {
    return (
      !!a &&
      a.key === key &&
      fs.existsSync(this.file(p, a.file)) &&
      fs.statSync(this.file(p, a.file)).size > 0
    );
  }
  tick(p: Project, label: string, kind: string, scene?: string, progress?: number) {
    const op = operation();
    if (op?.signal.aborted) return;
    if (op) op.label = label;
    const previous = p.job,
      changed =
        previous.state !== 'working' ||
        previous.label !== label ||
        previous.kind !== kind ||
        previous.scene !== scene,
      finished = progress !== undefined && progress >= 100 && (previous.progress ?? -1) < 100,
      time = Date.now(),
      last = this.progressWrites.get(p);
    p.job = { runId: previous.runId, state: 'working', label, kind, scene, progress, at: now() };
    if (!changed && !finished && last !== undefined && time >= last && time - last < 350) return;
    this.progressWrites.set(p, time);
    this.persistJob(p, progress === undefined);
  }
  private temp(p: Project, ext: string) {
    return this.file(p, `cache/${randomUUID()}.${ext}`);
  }
  private publish(
    p: Project,
    src: string,
    folder: string,
    ext: string,
    key: string,
    duration?: number,
  ): Asset {
    checkpoint();
    const dest = `${folder}/${randomUUID()}.${ext}`;
    const file = this.file(p, dest);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.renameSync(src, file);
    return { file: dest, key, duration, source: 'local', created: now() };
  }
  async import(
    p: Project,
    kind: 'image' | 'voice' | 'music' | 'sfx',
    data: Buffer,
    s?: Scene,
    origin: { source: 'import' } | { source: 'gemini'; model: string } = {
      source: 'import',
    },
  ) {
    checkpoint();
    approved(p);
    if (kind === 'image') requireThat(s && !isSvgScene(s), 'SVG sahnesi fotoğraf kabul etmez.');
    const tmp = this.temp(p, 'input'),
      out = this.temp(p, kind === 'image' ? 'jpg' : 'wav');
    const format = inputFormat(data, kind === 'image');
    const input = ['-protocol_whitelist', 'file,pipe', '-f', format, '-i', tmp];
    atomic(tmp, data);
    try {
      if (kind === 'image') {
        const dimensions = (await probe(tmp)).streams[0];
        requireThat(
          dimensions?.width > 0 &&
            dimensions?.height > 0 &&
            dimensions.width * dimensions.height <= 40000000,
          'Görsel boyutu okunamadı veya 40 megapiksel sınırını aşıyor.',
          422,
        );
        const science = s!.visualMode === 'illustration';
        if (science) {
          requireThat(
            dimensions.width >= 180 && dimensions.height >= 180,
            'İllüstrasyon yanıtı çok küçük.',
            422,
          );
        }
        await ff([
          ...input,
          '-frames:v',
          '1',
          '-vf',
          science
            ? "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)',scale=1080:1920,setsar=1"
            : "scale='min(1920,iw)':-2",
          '-q:v',
          '2',
          out,
        ]);
        const v = (await probe(out)).streams[0];
        requireThat(
          v.width >= 180 && v.height >= 180,
          'Görsel en az 180 × 180 piksel olmalı.',
          422,
        );
        const m = (p.assets[s!.id] ??= {});
        delete p.draft;
        m.image = {
          ...this.publish(p, out, 'images', 'jpg', imageKey(p, s!)),
          ...origin,
        };
        const prev = p.scenes[p.scenes.findIndex((x) => x.id === s!.id) - 1];
        if (prev && p.assets[prev.id]) delete p.assets[prev.id].clip;
        delete m.clip;
        if (s!.id === p.scenes[0]?.id) p.cover = mediaUrl(p, m.image.file);
      } else {
        await audioDuration(tmp);
        await ff([
          ...input,
          '-vn',
          '-t',
          '180',
          '-ac',
          '1',
          '-ar',
          '48000',
          '-c:a',
          'pcm_s16le',
          out,
        ]);
        const d = await audioDuration(out);
        const a = this.publish(
          p,
          out,
          kind === 'music' ? 'music' : 'audio',
          'wav',
          kind === 'voice' ? voiceKey(p, s!) : hash(data),
          d,
        );
        Object.assign(a, origin);
        if (kind === 'music') p.music = a;
        else {
          const m = (p.assets[s!.id] ??= {});
          if (kind === 'sfx') m.sfx = a;
          else {
            p.speakerPinned = true; // Keep a consistent narrator when resuming later.
            m.voice = a;
            delete m.align;
            delete m.edits;
            delete m.words;
            delete m.clip;
            delete m.recognized;
          }
        }
      }
      delete p.final;
      delete p.subtitleFiles;
      this.store.save(p);
    } finally {
      fs.rmSync(tmp, { force: true });
      fs.rmSync(out, { force: true });
    }
  }
  private async measureVoice(p: Project, a: Asset) {
    try {
      return await audioDuration(this.file(p, a.file));
    } catch (e) {
      throw new Issue(
        422,
        `Ses dosyası okunamadı (${a.file}, FFprobe: ${ffprobe}): ${errorDetail(e)}`,
      );
    }
  }
  private async verifyCached(p: Project, asset: Asset, kind: 'image' | 'voice') {
    if (kind === 'voice') {
      asset.duration = await this.measureVoice(p, asset);
      return;
    }
    requireThat(
      (await probe(this.file(p, asset.file))).streams[0]?.width > 0,
      `Görsel okunamadı: ${asset.file}`,
      422,
    );
  }
  async voice(p: Project, s: Scene, force: boolean) {
    checkpoint();
    approved(p);
    const m = (p.assets[s.id] ??= {});
    if (!force && this.usable(p, m.voice, voiceKey(p, s)))
      return this.verifyCached(p, m.voice!, 'voice');
    this.tick(p, 'Türkçe seslendirme üretiliyor', 'voice', s.id);
    const data = await this.g.voice(s.narration, p.voice, `${p.voiceStyle} Tempo: ${p.pace}.`);
    await this.import(p, 'voice', data, s, {
      source: 'gemini',
      model: this.g.raw().models.tts.model,
    });
  }
  private alignmentKey(voice: Asset, s: Scene, estimated: boolean) {
    return estimated
      ? hash('estimated-sentences-v1', voice.file, voice.duration, s.narration)
      : hash('base-stable-ts-1', voice.file, s.narration);
  }
  private cachedAlignment(p: Project, s: Scene) {
    const m = p.assets[s.id];
    return (
      !!m?.voice &&
      this.usable(p, m.voice, voiceKey(p, s)) &&
      this.usable(p, m.align, this.alignmentKey(m.voice, s, m.align?.method === 'estimated')) &&
      validWords(captionEntries(m), m.voice.duration!)
    );
  }
  async align(p: Project, s: Scene, force = false, whisperUnavailable?: string) {
    checkpoint();
    approved(p);
    const m = p.assets[s.id],
      voice = m?.voice;
    requireThat(voice && voice.key === voiceKey(p, s), 'Önce güncel seslendirmeyi üretin.');
    if (!force && this.cachedAlignment(p, s)) return;
    // The fallback is for alignment only: an unreadable recording has no usable clock or soundtrack.
    const audio = this.file(p, voice.file);
    const duration = await this.measureVoice(p, voice);
    voice.duration = duration;
    this.tick(p, 'Altyazı zamanlaması hazırlanıyor', 'align', s.id);
    const txt = this.temp(p, 'txt'),
      out = this.temp(p, 'json');
    try {
      if (!whisperUnavailable) atomic(txt, s.narration);
      let result:
        | ReturnType<typeof verifiedAlignment>
        | { method: 'estimated'; reason: string; sentences: TimedText[] };
      try {
        if (whisperUnavailable) throw new Error(`Whisper ön kontrolü: ${whisperUnavailable}`);
        result = verifiedAlignment(await this.runWhisper(this.paths, audio, txt, out), duration);
      } catch (e) {
        checkpoint();
        const reason = errorDetail(e),
          retain = this.cachedAlignment(p, s);
        const label = `${retain ? 'Kayıtlı altyazı korundu' : 'Tahmini cümle altyazısı kullanılıyor'}: ${reason}`;
        const event = {
          state: 'working',
          level: 'warning',
          kind: retain ? 'align-retained' : 'align-fallback',
          at: now(),
          scene: s.id,
          sceneNumber: p.scenes.findIndex((x) => x.id === s.id) + 1,
          label,
          audio: voice.file,
          duration,
          python: python(this.paths),
          ffmpeg,
          ffprobe,
        } as const;
        this.store.log(p, event);
        console.warn(
          `[Hizalama] ${p.id} / Sahne ${event.sceneNumber} (${s.id}): ${label} | ses=${voice.file} (${duration} sn), Python=${event.python}, FFmpeg=${ffmpeg}, FFprobe=${ffprobe}`,
        );
        // A failed explicit retry must not discard a previously good track or manual edits.
        if (retain) return;
        result = {
          method: 'estimated',
          reason,
          sentences: sentenceEstimates(s.narration, duration),
        };
      }
      // Disk/publication failures are real failures, not a reason to fabricate another output.
      checkpoint();
      fs.writeFileSync(out, JSON.stringify({ ...result, duration }));
      const a = this.publish(
        p,
        out,
        'subtitles',
        'json',
        this.alignmentKey(voice, s, result.method === 'estimated'),
      );
      if (result.method === 'estimated') {
        m.align = { ...a, ...result };
        delete m.words;
        delete m.recognized;
      } else {
        m.align = { ...a, method: 'whisper' };
        m.words = result.words;
        m.recognized = result.recognized;
      }
      delete m.edits;
      delete m.clip;
      delete p.final;
      delete p.subtitleFiles;
      this.store.save(p);
    } finally {
      fs.rmSync(txt, { force: true });
      fs.rmSync(out, { force: true });
    }
  }
  async clip(p: Project, s: Scene, next: Scene | undefined, frames: number, force = false) {
    await this.makeClip(p, s, next, frames, { force });
  }
  private async makeClip(
    p: Project,
    s: Scene,
    next: Scene | undefined,
    frames: number,
    options: { force?: boolean; draftOutput?: string },
  ) {
    checkpoint();
    const draft = options.draftOutput !== undefined;
    if (!draft) approved(p);
    // A draft must not create or overwrite normal production assets.
    const m = p.assets[s.id] ?? (draft ? {} : (p.assets[s.id] = {})),
      silent = draft || unvoicedSvg(s, m);
    const diagram = (scene?: Scene) => {
      if (scene?.visualMode !== 'svg' || scene.vector) return undefined;
      requireThat(scene.svgPlan, 'SVG şablonu eksik.');
      return legacyPlate(scene.svgPlan);
    };
    const vectorFor = (v?: Scene) =>
      v?.visualMode === 'svg' && v.vector
        ? verifiedFrame(this.store.dir(p.id), v.vector, v.narration)
        : undefined;
    const readMotion = (v?: Scene) =>
      v?.visualMode === 'motion-svg'
        ? motionFrame(this.store.dir(p.id), v.choreography, v.narration)
        : undefined;
    const objects = readMotion(s),
      nextObjects = readMotion(next);
    const vector = vectorFor(s),
      nextVector = vectorFor(next);
    const svg = diagram(s),
      nextSvg = diagram(next);
    requireThat(
      (objects || vector || svg || this.usable(p, m.image, imageKey(p, s))) &&
        (silent || this.usable(p, m.voice, voiceKey(p, s))),
      'Güncel sahne görseli ve seslendirme gerekiyor.',
    );
    if (!silent && !validWords(captionEntries(m), m.voice!.duration!)) {
      await this.align(p, s);
      frames = framesForVoice(m.voice!.duration!);
    }
    const words = draft
        ? s.narration.trim()
          ? sentenceEstimates(s.narration, frames / 30)
          : []
        : sceneCaptions(s, m),
      sentenceCaptions = silent || m.align?.method === 'estimated';
    // Incoming diagrams always start at frame zero. Separate the diagram and active-word revisions from the static photo and timing inputs.
    const adjacent =
      next && !nextSvg && !nextVector && !nextObjects ? p.assets[next.id]?.image : undefined;
    const data = (plan: typeof svg) => {
      const art = plan?.artwork && readArtwork(this.store.dir(p.id), plan.artwork.digest);
      return art ? 'data:image/svg+xml;base64,' + Buffer.from(art).toString('base64') : undefined;
    };
    const artHref = data(svg),
      nextArtHref = data(nextSvg);
    const title =
        objects?.ref.title ?? (s.visualMode === 'illustration' ? s.cinema?.title : undefined),
      nextTitle =
        nextObjects?.ref.title ??
        (next?.visualMode === 'illustration' ? next.cinema?.title : undefined);
    const key = hash(
      'film-7-clean-keyword-transitions',
      ...(objects || nextObjects ? ['object-safe-frame-and-caption-sync-v2'] : []),
      ...(title || nextTitle ? ['fixed-object-stage-v1', title, nextTitle] : []),
      objects
        ? objects.ref
        : vector
          ? ['vector-fixed-archive-v2', vector.ref]
          : svg
            ? ['atlas-svg-v3', svg, ...(svg.artwork ? [!!artHref] : [])]
            : m.image!.file,
      words,
      frames,
      nextObjects
        ? nextObjects.ref
        : nextVector
          ? ['vector-fixed-archive-v2', nextVector.ref]
          : nextSvg
            ? ['atlas-svg-v3', nextSvg, ...(nextSvg.artwork ? [!!nextArtHref] : [])]
            : adjacent?.file,
      p.subtitleSize,
      p.highlight,
      ...(sentenceCaptions ? ['sentence-cues-v1'] : p.highlight ? ['active-word-amber-v1'] : []),
    );
    if (!draft && !options.force && this.usable(p, m.clip, key)) {
      await verifyVideo(this.file(p, m.clip!.file), frames, false);
      return;
    }
    this.tick(
      p,
      draft ? 'Sessiz taslak: sahne kareleri işleniyor' : 'Sahne kareleri işleniyor',
      draft ? 'draft' : 'clip',
      s.id,
      0,
    );
    const url = (a: Asset) =>
      'data:image/jpeg;base64,' + fs.readFileSync(this.file(p, a.file)).toString('base64');
    const props: FilmProps = {
      title,
      nextTitle,
      objects,
      nextObjects,
      ...(vector ? { vector } : {}),
      ...(nextVector ? { nextVector } : {}),
      ...(svg ? { svg, artHref } : {}),
      ...(nextSvg ? { nextSvg, nextArtHref } : {}),
      image: objects || vector || svg ? '' : url(m.image!),
      next: adjacent ? url(adjacent) : null,
      words,
      frames,
      subtitleSize: p.subtitleSize,
      highlight: p.highlight && !sentenceCaptions,
      sentenceCaptions,
    };
    const output = options.draftOutput ?? this.temp(p, 'mp4');
    const lease = operation();
    let renderOpen = true;
    const { renderMedia } = await import('@remotion/renderer');
    try {
      await withDocumentaryScene(this.paths, props, (options) =>
        renderMedia({
          ...options,
          codec: 'h264',
          muted: true,
          concurrency: 1,
          crf: 19,
          x264Preset: 'veryfast',
          outputLocation: output,
          onProgress: ({ progress }) => {
            if (renderOpen && !lease?.signal.aborted)
              this.tick(
                p,
                draft ? 'Sessiz taslak: sahne kareleri işleniyor' : 'Sahne kareleri işleniyor',
                draft ? 'draft' : 'clip',
                s.id,
                Math.round(progress * 100),
              );
          },
        }),
      );
      await verifyVideo(output, frames, false);
      if (!draft) {
        m.clip = this.publish(p, output, 'scenes', 'mp4', key, frames / 30);
        this.store.save(p);
      }
    } finally {
      renderOpen = false;
      if (!draft) fs.rmSync(output, { force: true, maxRetries: 5, retryDelay: 80 });
    }
  }
  /** Revalidate the actual signed drawings; a missing/stale file is not a ready scene. */
  draftReadyScenes(p: Project): Scene[] {
    return p.scenes.filter((s) => {
      try {
        if (s.visualMode === 'motion-svg') {
          motionFrame(this.store.dir(p.id), s.choreography, s.narration);
          return true;
        }
        if (s.visualMode === 'svg') {
          if (s.vector) verifiedFrame(this.store.dir(p.id), s.vector, s.narration);
          else if (s.svgPlan) legacyPlate(s.svgPlan);
          else return false;
          return true;
        }
        return this.usable(p, p.assets[s.id]?.image, imageKey(p, s));
      } catch {
        return false;
      }
    });
  }
  /** Render only ready shots, with estimated scene time and NO audio track or cloud calls.
   * The temporary clips, published draft and cache key are isolated from approved production. */
  async exportDraft(p: Project): Promise<Task> {
    checkpoint();
    requireThat(p.scriptApproval === scriptSig(p), 'Önce güncel senaryoyu onaylayın.');
    const ready = this.draftReadyScenes(p);
    requireThat(ready.length, 'Sessiz taslak için en az bir sahne çizimi gerekli.');
    const scenes = ready.map((s) => ({
        id: s.id,
        frames: framesForVoice(
          Number.isFinite(s.seconds) && s.seconds > 0 ? Math.min(120, s.seconds) : 5,
        ),
      })),
      frames = scenes.reduce((sum, s) => sum + s.frames, 0),
      key = hash('silent-draft-render-v2-clean-keywords', draftInputs(p), scenes),
      label = `${ready.length}/${p.scenes.length} hazır sahne • Sessiz taslak`;
    if (this.usable(p, p.draft?.asset, key) && p.draft?.total === p.scenes.length) {
      await verifyVideo(this.file(p, p.draft.asset.file), frames, false);
      return { state: 'done', kind: 'draft', label, at: now() };
    }
    this.tick(p, `${label} · Yerel araçlar doğrulanıyor`, 'draft');
    const report = await checks(this.paths, { whisper: false, render: true }),
      missing = report.filter((x) => !x.ok);
    if (missing.length)
      throw new Issue(
        412,
        'Sessiz taslak için yerel servisleri yapılandırın: ' +
          missing.map((x) => `${x.name}: ${x.detail}`).join('; ') +
          '. TTS veya Whisper kullanılmadı.',
        'config',
      );
    const working = fs.mkdtempSync(path.join(this.store.dir(p.id), 'cache', 'draft-')),
      work = (name: string) => path.join(working, name);
    try {
      const list: string[] = [];
      for (const [i, s] of ready.entries()) {
        checkpoint();
        const name = `clip-${i}.mp4`;
        await this.makeClip(p, s, ready[i + 1], scenes[i].frames, { draftOutput: work(name) });
        list.push(`file '${name}'`);
      }
      atomic(work('video.txt'), list.join('\n'));
      this.tick(p, `${label} · MP4 doğrulanıyor`, 'draft');
      const out = work('draft.mp4');
      await ff(
        [
          '-f',
          'concat',
          '-safe',
          '1',
          '-i',
          'video.txt',
          '-map',
          '0:v:0',
          '-an',
          '-c:v',
          'copy',
          '-movflags',
          '+faststart',
          out,
        ],
        900000,
        working,
      );
      await verifyVideo(out, frames, false);
      await ff(['-i', out, '-f', 'null', '-'], 600000);
      checkpoint();
      const asset = {
        ...this.publish(p, out, 'renders', 'mp4', key, frames / 30),
        hasAudio: false,
      };
      p.draft = { asset, scenes, total: p.scenes.length };
      this.store.save(p);
      return { state: 'done', kind: 'draft', label, at: now() };
    } finally {
      fs.rmSync(working, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
    }
  }
  // A placeholder is a UI state, never an image asset or a renderable frame.
  waitingForImages(p: Project): Task | undefined {
    const count = p.scenes.filter(
      (s) => !isSvgScene(s) && !this.usable(p, p.assets[s.id]?.image, imageKey(p, s)),
    ).length;
    if (count)
      return {
        state: 'waiting',
        kind: 'manual-images',
        label: `${count} sahne için görsel bekleniyor. Görselleri yükleyip üretime devam edin.`,
        at: now(),
      };
  }
  private async batchVoice(p: Project, s: Scene) {
    if (!useExistingVoiceOnly(s)) return this.voice(p, s, false);
    // Explicit offline opt-out. Never replace a lost recording with a paid request in this mode.
    const voice = p.assets[s.id]?.voice;
    if (voice) {
      requireThat(this.usable(p, voice, voiceKey(p, s)), 'Kayıtlı anlatımı yeniden yükleyin.');
      await this.verifyCached(p, voice, 'voice');
    }
  }
  async render(p: Project, kind: Step, target?: string) {
    checkpoint();
    approved(p);
    const scenes = target ? p.scenes.filter((s) => s.id === target) : p.scenes;
    requireThat(scenes.length, 'Sahne bulunamadı.');
    const waiting = kind === 'all' ? this.waitingForImages(p) : undefined;
    let whisperUnavailable: string | undefined;
    if (kind === 'all') {
      // Preflight only the services needed for this phase. Awaiting manual images
      // requires narration, not image credentials, a renderer or a Whisper model.
      // Verify saved display lists before spending a voice request on a board with missing art.
      for (const s of scenes)
        if (s.visualMode === 'motion-svg')
          motionFrame(this.store.dir(p.id), s.choreography, s.narration);
      let needWhisper = false;
      for (const s of scenes) {
        const m = p.assets[s.id];
        if (!useExistingVoiceOnly(s) && !this.usable(p, m?.voice, voiceKey(p, s)))
          this.g.allowed('tts');
        if (!waiting && !unvoicedSvg(s, m) && !this.cachedAlignment(p, s)) needWhisper = true;
      }
      this.tick(p, 'Yerel üretim araçları doğrulanıyor', 'preflight');
      const report = await checks(this.paths, {
        whisper: !waiting && needWhisper,
        render: !waiting,
      });
      whisperUnavailable = report.find((x) => x.id === 'whisper' && !x.ok)?.detail;
      const missing = report.filter((x) => !x.ok && x.id !== 'whisper');
      if (missing.length)
        throw new Issue(
          412,
          'Önce yerel servisleri yapılandırın: ' +
            missing.map((x) => `${x.name}: ${x.detail}`).join('; ') +
            '. Bulut isteği yapılmadı.',
          'config',
        );
    }
    if (waiting) {
      for (const scene of scenes) await this.batchVoice(p, scene);
      delete p.final;
      delete p.subtitleFiles;
      return { ...waiting, at: now() };
    }
    for (const s of scenes) {
      if (kind === 'all' && !isSvgScene(s))
        await this.verifyCached(p, p.assets[s.id].image!, 'image');
      if (kind === 'all') await this.batchVoice(p, s);
      if (kind === 'voice') await this.voice(p, s, true);
      if ((kind === 'all' && !unvoicedSvg(s, p.assets[s.id])) || kind === 'align')
        await this.align(p, s, kind === 'align', whisperUnavailable);
    }
    if (kind === 'all' || kind === 'clip') {
      // Pad to a frame boundary: never trim narration or timing to fit an estimate.
      for (const [i, s] of p.scenes.entries()) {
        if (scenes.includes(s)) {
          const frames = framesForVoice(sceneSeconds(s, p.assets[s.id]));
          await this.clip(p, s, p.scenes[i + 1], frames, kind === 'clip');
        }
      }
      if (kind === 'all') await this.finish(p);
    }
  }
  async finish(p: Project) {
    checkpoint();
    approved(p);
    // If no narration or user-supplied audio exists, do not manufacture a music or
    // Foley bed. A completely unvoiced project is an actually silent MP4.
    const silentMix =
      !p.music && p.scenes.every((s) => unvoicedSvg(s, p.assets[s.id]) && !p.assets[s.id]?.sfx);
    const mixKey = hash(
      'mix-v4-silent-if-no-audio',
      silentMix,
      p.scenes.map((s) => [
        p.assets[s.id].clip?.file,
        p.assets[s.id].voice?.file,
        p.assets[s.id].sfx?.file,
        s.sound,
        s.effect,
        s.object,
      ]),
      p.music?.file,
      p.musicVolume,
    );
    if (
      this.usable(p, p.final, mixKey) &&
      p.subtitleFiles &&
      Object.values(p.subtitleFiles).every((f) => fs.existsSync(this.file(p, f)))
    ) {
      await verifyVideo(
        this.file(p, p.final!.file),
        p.scenes.reduce((n, s) => n + framesForVoice(sceneSeconds(s, p.assets[s.id])), 0),
        !silentMix,
      );
      return;
    }
    this.tick(p, silentMix ? 'Sessiz MP4 doğrulaması' : 'Ses miksajı ve MP4 doğrulaması', 'export');
    const dir = this.store.dir(p.id),
      working = fs.mkdtempSync(path.join(dir, 'cache', 'mix-'));
    const work = (n: string) => path.join(working, n);
    let frames = 0;
    const all: Word[] = [],
      display: TimedText[] = [],
      sentences: (TimedText & { scene: string; estimated: boolean })[] = [];
    try {
      const list: string[] = [];
      const alist: string[] = [];
      for (const [i, s] of p.scenes.entries()) {
        const m = p.assets[s.id],
          duration = m.clip!.duration!;
        const offset = frames / 30,
          scripted = unvoicedSvg(s, m),
          estimated = scripted || m.align?.method === 'estimated';
        const entries = sceneCaptions(s, m).map((w) => ({
          text: w.text,
          start: offset + w.start,
          end: offset + Math.min(w.end, duration),
        }));
        // Never combine captions across a cut or export estimated sentences as measured words.
        if (!estimated) all.push(...entries);
        display.push(...(estimated ? entries : groups(entries).map(cue)));
        sentences.push(
          ...(estimated ? entries : groups(entries, Infinity).map(cue)).map((c) => ({
            ...c,
            scene: s.id,
            estimated,
            ...(scripted ? { timing: 'scene-duration' } : {}),
          })),
        );
        frames += Math.round(duration * 30);
        // Older Windows FFmpeg builds do not resolve drive-qualified concat manifests
        // consistently. Stage local basenames and start the child inside the manifest directory.
        const clipName = `clip-${i}.mp4`,
          original = this.file(p, m.clip!.file);
        try {
          fs.linkSync(original, work(clipName));
        } catch {
          await fs.promises.copyFile(original, work(clipName));
        }
        list.push(`file '${clipName}'`);
        if (!silentMix) {
          const foley = work(`bed-${i}.wav`);
          atomic(foley, await soundBed(duration, s));
          const aout = work(`mix-${i}.wav`);
          const inputs = [
            ...(scripted
              ? ['-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=48000:cl=mono']
              : ['-i', this.file(p, m.voice!.file)]),
            '-i',
            foley,
            ...(m.sfx ? ['-i', this.file(p, m.sfx.file)] : []),
          ];
          await ff([
            ...inputs,
            '-filter_complex',
            `[0:a]aresample=48000,apad,atrim=duration=${duration}[v];[1:a]volume=0.32[b];${m.sfx ? '[2:a]volume=0.2[fx];' : ''}[v][b]${m.sfx ? '[fx]' : ''}amix=inputs=${m.sfx ? 3 : 2}:duration=first:dropout_transition=0,volume=${m.sfx ? 3 : 2}[m]`,
            '-map',
            '[m]',
            '-ar',
            '48000',
            '-ac',
            '1',
            '-c:a',
            'pcm_s16le',
            aout,
          ]);
          alist.push(`file 'mix-${i}.wav'`);
        }
      }
      atomic(work('video.txt'), list.join('\n'));
      const duration = frames / 30,
        out = work('documentary.mp4');
      if (silentMix) {
        await ff(
          [
            '-f',
            'concat',
            '-safe',
            '1',
            '-i',
            'video.txt',
            '-map',
            '0:v:0',
            '-an',
            '-c:v',
            'copy',
            '-movflags',
            '+faststart',
            out,
          ],
          900000,
          working,
        );
      } else {
        atomic(work('audio.txt'), alist.join('\n'));
        const music = p.music ? this.file(p, p.music.file) : work('score.wav');
        if (!p.music) atomic(music, await soundBed(duration));
        await ff(
          [
            '-f',
            'concat',
            '-safe',
            '1',
            '-i',
            'video.txt',
            '-f',
            'concat',
            '-safe',
            '1',
            '-i',
            'audio.txt',
            '-stream_loop',
            '-1',
            '-i',
            music,
            '-filter_complex',
            `[1:a]aformat=sample_fmts=dbl:sample_rates=48000:channel_layouts=stereo,asplit=2[voice][copy];[copy]aformat=sample_fmts=dbl:sample_rates=48000:channel_layouts=stereo[det];[2:a]aformat=sample_fmts=dbl:sample_rates=48000:channel_layouts=stereo,atrim=duration=${duration},volume=${p.musicVolume},afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, duration - 0.75)}:d=0.75,aformat=sample_fmts=dbl:sample_rates=48000:channel_layouts=stereo[bed];[bed][det]sidechaincompress=threshold=0.025:ratio=6:attack=20:release=300,aformat=sample_fmts=dbl:sample_rates=48000:channel_layouts=stereo[duck];[voice][duck]amix=inputs=2:duration=first:dropout_transition=0,volume=2,loudnorm=I=-16:TP=-1.5:LRA=9[a]`,
            '-map',
            '0:v:0',
            '-map',
            '[a]',
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-b:a',
            '160k',
            '-ar',
            '48000',
            '-ac',
            '2',
            '-t',
            String(duration),
            '-movflags',
            '+faststart',
            out,
          ],
          900000,
          working,
        );
      }
      await verifyVideo(out, frames, !silentMix);
      checkpoint();
      const id = randomUUID(),
        json = `subtitles/${id}.json`,
        sub = `subtitles/${id}.srt`;
      atomic(
        this.file(p, json),
        JSON.stringify(
          {
            language: 'tr',
            duration,
            words: all,
            sentences,
          },
          null,
          2,
        ),
      );
      atomic(this.file(p, sub), srtFromCues(display));
      p.final = {
        ...this.publish(p, out, 'renders', 'mp4', mixKey, duration),
        hasAudio: !silentMix,
      };
      p.subtitleFiles = { json, srt: sub };
      this.store.save(p);
    } finally {
      fs.rmSync(working, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
    }
  }
}
