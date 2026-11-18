import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FilmProps } from '../composition/Film';
import { captionEntries, cue, groups, srtFromCues, validWords } from '../shared/captions';
import type { Asset, Project, Scene, Task, TimedText, Word } from '../shared/schema';
import { visualOf } from '../shared/shot';
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
import { withDocumentaryScene } from './render-browser';
import { Issue, Store, approved, atomic, hash, now, requireThat } from './store';
export type Step = 'all' | 'image' | 'voice' | 'align' | 'clip';
export const imageKey = (p: Project, s: Scene) =>
  hash('image-v1', p.styleGuide, s.description, s.prompt, s.angle, s.environment);
export const voiceKey = (p: Project, s: Scene) =>
  hash('voice-v1', s.narration, p.voice, p.voiceStyle, p.pace);
export const framesForVoice = (seconds: number) => Math.max(1, Math.ceil(seconds * 30 - 1e-7));
export class Production {
  constructor(
    private store: Store,
    private g: Gemini,
    private paths: Paths,
    private readonly runWhisper = readWhisper,
  ) {}
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
    p.job = { state: 'working', label, kind, scene, progress, at: now() };
    this.store.save(p);
    if (progress === undefined) this.store.log(p);
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
    const dest = `${folder}/${randomUUID()}.${ext}`;
    fs.renameSync(src, this.file(p, dest));
    return { file: dest, key, duration, source: 'local', created: now() };
  }
  async import(
    p: Project,
    kind: 'image' | 'voice' | 'music' | 'sfx',
    data: Buffer,
    s?: Scene,
    model?: string,
  ) {
    approved(p);
    const tmp = this.temp(p, 'input'),
      out = this.temp(p, kind === 'image' ? 'jpg' : 'wav');
    const format = inputFormat(data, kind === 'image');
    const input = ['-protocol_whitelist', 'file,pipe', '-f', format, '-i', tmp];
    atomic(tmp, data);
    try {
      if (kind === 'image') {
        const dimensions = (await probe(tmp)).streams[0];
        requireThat(
          dimensions?.width * dimensions?.height <= 40000000,
          'Görsel 40 megapikselden büyük.',
          422,
        );
        await ff([...input, '-frames:v', '1', '-vf', "scale='min(1920,iw)':-2", '-q:v', '2', out]);
        const v = (await probe(out)).streams[0];
        requireThat(
          v.width >= 180 && v.height >= 180,
          'Görsel en az 180 × 180 piksel olmalı.',
          422,
        );
        const m = (p.assets[s!.id] ??= {});
        m.image = {
          ...this.publish(p, out, 'images', 'jpg', imageKey(p, s!)),
          source: model ? 'gemini' : 'import',
          model,
        };
        const prev = p.scenes[p.scenes.findIndex((x) => x.id === s!.id) - 1];
        if (prev && prev.transition !== 'cut' && p.assets[prev.id]) delete p.assets[prev.id].clip;
        delete m.clip;
        if (s!.id === p.scenes[0]?.id) p.cover = `/api/projects/${p.id}/media/${m.image.file}`;
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
        a.source = model ? 'gemini' : 'import';
        a.model = model;
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
  async asset(p: Project, s: Scene, kind: 'image' | 'voice', force: boolean) {
    approved(p);
    const m = (p.assets[s.id] ??= {}),
      k = kind === 'image' ? imageKey(p, s) : voiceKey(p, s);
    if (!force && this.usable(p, m[kind], k)) return this.verifyCached(p, m[kind]!, kind);
    if (kind === 'image') this.g.requireAutomaticImages();
    this.tick(
      p,
      kind === 'image' ? 'Sinematik görsel üretiliyor' : 'Türkçe seslendirme üretiliyor',
      kind,
      s.id,
    );
    let data: Buffer;
    if (kind === 'image') {
      const first = p.assets[p.scenes[0].id]?.image;
      const ref =
        first && fs.existsSync(this.file(p, first.file))
          ? fs.readFileSync(this.file(p, first.file))
          : undefined;
      data = await this.g.image(
        `Cinematic 2D documentary, vertical 9:16. Full bleed. No lettering, subtitles or logos. Use the reference for identity, palette and technique, not composition. Layered foreground, midground and background, restrained color, atmospheric lighting. ${JSON.stringify({ bible: p.styleGuide, scene: s.description, prompt: s.prompt, angle: s.angle, environment: s.environment, narration: s.narration })}`,
        ref,
      );
    } else data = await this.g.voice(s.narration, p.voice, `${p.voiceStyle} Tempo: ${p.pace}.`);
    await this.import(
      p,
      kind,
      data,
      s,
      this.g.raw().models[kind === 'voice' ? 'tts' : 'image'].model,
    );
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
    approved(p);
    const m = p.assets[s.id];
    requireThat(
      this.usable(p, m?.image, imageKey(p, s)) && this.usable(p, m?.voice, voiceKey(p, s)),
      'Güncel görsel ve seslendirme gerekiyor.',
    );
    if (!validWords(captionEntries(m), m.voice!.duration!)) {
      await this.align(p, s);
      frames = framesForVoice(m.voice!.duration!);
    }
    const words = captionEntries(m),
      sentenceCaptions = m.align?.method === 'estimated';
    const adjacent = s.transition !== 'cut' && next ? p.assets[next.id]?.image : undefined;
    const sceneIndex = p.scenes.findIndex((x) => x.id === s.id);
    requireThat(sceneIndex >= 0, 'Sahne onaylı zaman çizelgesinde bulunamadı.');
    const nextShot = adjacent && next ? visualOf(next) : undefined;
    const key = hash(
      'film-4-motion-dissolve',
      sceneIndex,
      m.image!.file,
      visualOf(s),
      s.transition,
      s.animation,
      p.intensity,
      words,
      frames,
      adjacent?.file,
      nextShot,
      p.subtitleSize,
      p.highlight,
      ...(sentenceCaptions ? ['sentence-cues-v1'] : []),
    );
    if (!force && this.usable(p, m.clip, key)) {
      await verifyVideo(this.file(p, m.clip!.file), frames, false);
      return;
    }
    this.tick(p, 'Sahne kareleri işleniyor', 'clip', s.id, 0);
    const url = (a: Asset) =>
      'data:image/jpeg;base64,' + fs.readFileSync(this.file(p, a.file)).toString('base64');
    const props: FilmProps = {
      image: url(m.image!),
      next: adjacent && nextShot ? { image: url(adjacent), shot: nextShot } : null,
      sceneIndex,
      scene: s,
      words,
      frames,
      intensity: p.intensity,
      subtitleSize: p.subtitleSize,
      highlight: p.highlight && !sentenceCaptions,
      sentenceCaptions,
    };
    const output = this.temp(p, 'mp4');
    let last = 0;
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
            if (Date.now() - last > 1000) {
              last = Date.now();
              this.tick(p, 'Sahne kareleri işleniyor', 'clip', s.id, Math.round(progress * 100));
            }
          },
        }),
      );
      await verifyVideo(output, frames, false);
      m.clip = this.publish(p, output, 'scenes', 'mp4', key, frames / 30);
      this.store.save(p);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }
  // A placeholder is a UI state, never an image asset or a renderable frame.
  waitingForImages(p: Project): Task | undefined {
    const count = p.scenes.filter(
      (s) => !this.usable(p, p.assets[s.id]?.image, imageKey(p, s)),
    ).length;
    if (count)
      return {
        state: 'waiting',
        kind: 'manual-images',
        label: `${count} sahne için görsel bekleniyor. Görselleri yükleyip üretime devam edin.`,
        at: now(),
      };
  }
  async render(p: Project, kind: Step, target?: string) {
    approved(p);
    const scenes = target ? p.scenes.filter((s) => s.id === target) : p.scenes;
    requireThat(scenes.length, 'Sahne bulunamadı.');
    const manual = this.g.usesManualImages();
    const waiting = kind === 'all' && manual ? this.waitingForImages(p) : undefined;
    let whisperUnavailable: string | undefined;
    if (kind === 'all') {
      // Preflight only the services needed for this phase. Awaiting manual images
      // requires narration, not image credentials, a renderer or a Whisper model.
      let needWhisper = false;
      for (const s of scenes) {
        const m = p.assets[s.id];
        if (!manual && !this.usable(p, m?.image, imageKey(p, s))) this.g.allowed('image');
        if (!this.usable(p, m?.voice, voiceKey(p, s))) this.g.allowed('tts');
        if (!waiting && !this.cachedAlignment(p, s)) needWhisper = true;
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
      for (const scene of scenes) await this.asset(p, scene, 'voice', false);
      delete p.final;
      delete p.subtitleFiles;
      return { ...waiting, at: now() };
    }
    for (const s of scenes) {
      if (kind === 'all' && manual) await this.verifyCached(p, p.assets[s.id].image!, 'image');
      else if (kind === 'all' || kind === 'image')
        await this.asset(p, s, 'image', kind === 'image');
      if (kind === 'all' || kind === 'voice') await this.asset(p, s, 'voice', kind === 'voice');
      if (kind === 'all' || kind === 'align')
        await this.align(p, s, kind === 'align', whisperUnavailable);
    }
    if (kind === 'all' || kind === 'clip') {
      // Pad to a frame boundary: never trim narration or timing to fit an estimate.
      for (const [i, s] of p.scenes.entries()) {
        if (scenes.includes(s)) {
          const frames = framesForVoice(p.assets[s.id]?.voice?.duration ?? 0);
          await this.clip(p, s, p.scenes[i + 1], frames, kind === 'clip');
        }
      }
      if (kind === 'all') await this.finish(p);
    }
  }
  async finish(p: Project) {
    approved(p);
    const mixKey = hash(
      'mix-v3',
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
        p.scenes.reduce((n, s) => n + framesForVoice(p.assets[s.id].voice!.duration!), 0),
        true,
      );
      return;
    }
    this.tick(p, 'Ses miksajı ve MP4 doğrulaması', 'export');
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
          estimated = m.align?.method === 'estimated';
        const entries = captionEntries(m).map((w) => ({
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
        const foley = work(`bed-${i}.wav`);
        atomic(foley, soundBed(duration, s));
        const aout = work(`mix-${i}.wav`);
        const inputs = [
          '-i',
          this.file(p, m.voice!.file),
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
      atomic(work('video.txt'), list.join('\n'));
      atomic(work('audio.txt'), alist.join('\n'));
      const duration = frames / 30;
      const music = p.music ? this.file(p, p.music.file) : work('score.wav');
      if (!p.music) atomic(music, soundBed(duration));
      const out = work('documentary.mp4');
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
      await verifyVideo(out, frames, true);
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
      p.final = this.publish(p, out, 'renders', 'mp4', mixKey, duration);
      p.subtitleFiles = { json, srt: sub };
      this.store.save(p);
    } finally {
      fs.rmSync(working, { recursive: true, force: true });
    }
  }
}
