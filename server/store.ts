import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultSpeaker, type Speaker } from '../shared/speakers';
import { legacySvgPlanSchema, svgPlanSchema } from '../shared/svg';
import { vectorSchema } from '../shared/vector';
import {
  STOPPED,
  jobActive,
  blankScene,
  normalize,
  stageOf,
  type Project,
  type ProjectSummary,
  type ProviderSettings,
  type Scene,
  type Task,
} from '../shared/schema';
export const hash = (...v: unknown[]) =>
  createHash('sha256')
    .update(v.length === 1 && Buffer.isBuffer(v[0]) ? v[0] : JSON.stringify(v))
    .digest('hex');
export const now = () => new Date().toISOString();
export class Issue extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'failed',
  ) {
    super(message);
  }
}
export function requireThat(v: unknown, msg: string, status = 409): asserts v {
  if (!v) throw new Issue(status, msg);
}
export function atomic(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export const scriptSig = (p: Project) => hash(normalize(p.script));
export const boardSig = (p: Project) => hash(scriptSig(p), p.scenes, p.styleGuide);
export function approved(p: Project) {
  requireThat(p.scriptApproval === scriptSig(p), 'Önce güncel senaryoyu onaylayın.');
  requireThat(
    p.boardApproval === boardSig(p),
    'Görsel, ses ve render için storyboard onayı gerekiyor.',
  );
}
export function approveBoard(p: Project) {
  requireThat(p.scriptApproval === scriptSig(p), 'Senaryo onayı gerekiyor.');
  requireThat(
    p.scenes.length > 0 &&
      p.scenes.every(
        (s) =>
          s.narration &&
          (s.visualMode === 'svg'
            ? s.vector
              ? !s.svgPlan &&
                vectorSchema.safeParse(s.vector).success &&
                s.vector.narrationHash === hash(normalize(s.narration))
              : svgPlanSchema.safeParse(s.svgPlan).success ||
                legacySvgPlanSchema.safeParse(s.svgPlan).success
            : s.description),
      ),
    'Her sahnede anlatım ve geçerli bir SVG planı veya fotoğraf betimlemesi gerekiyor.',
  );
  requireThat(
    new Set(p.scenes.map((s) => s.id)).size === p.scenes.length,
    'Sahne kimlikleri benzersiz olmalı.',
  );
  requireThat(
    normalize(p.scenes.map((s) => s.narration).join(' ')) === normalize(p.script),
    'Sahne anlatımları onaylı senaryoyu aynı sırayla, eksiksiz içermeli.',
  );
  p.boardApproval = boardSig(p);
}
export function changeScript(p: Project, text: string) {
  if (normalize(text) !== normalize(p.script)) {
    delete p.vectorWork;
    p.scriptApproval = null;
    p.boardApproval = null;
    clearFinal(p);
  }
  p.script = text;
}
export function clearFinal(p: Project) {
  delete p.final;
  delete p.subtitleFiles;
  p.job = { state: 'waiting', label: 'Değişiklikler kaydedildi', at: now() };
}
export function makeProject(topic: string, script = '', instructions = ''): Project {
  const time = now();
  return {
    version: 1,
    id: randomUUID(),
    rev: 0,
    title: topic,
    topic,
    instructions,
    category: 'BELGESEL',
    cover: '',
    example: false,
    created: time,
    updated: time,
    script,
    scriptApproval: null,
    boardApproval: null,
    scenes: [],
    styleGuide:
      'Nostaljik 2D piksel sanatıyla ayrıntılı doğa belgeseli. Doğal tonlar, yönlü ışık, güçlü ön ve arka plan ayrımı. Aynı özneyi, renk paletini ve çizim tekniğini koru.',
    voice: defaultSpeaker,
    voiceStyle: 'Sakin, merak uyandıran, doğal bir Türkçe belgesel anlatımı.',
    pace: 'Doğal',
    subtitleSize: 56,
    highlight: true,
    musicVolume: 0.12,
    assets: {},
    job: { state: 'waiting', label: 'Onay bekleniyor', at: time },
    history: 0,
  };
}
export function summary(p: Project): ProjectSummary {
  return {
    id: p.id,
    title: p.title,
    topic: p.topic,
    updated: p.updated,
    category: p.category,
    cover: p.cover,
    example: p.example,
    job: p.job,
    stage: stageOf(p),
    scenes: p.scenes.length,
    duration: p.final?.duration ?? 30,
    exported: !!p.final,
  };
}
export const folders = [
  'script',
  'storyboard',
  'scenes',
  'images',
  'audio',
  'subtitles',
  'music',
  'renders',
  'cache',
  'versions',
];
export class Store {
  db: DatabaseSync;
  projects: string;
  constructor(
    public root: string,
    seed = true,
  ) {
    fs.mkdirSync(root, { recursive: true });
    this.projects = path.join(root, 'Projects');
    fs.mkdirSync(this.projects, { recursive: true });
    this.db = new DatabaseSync(path.join(root, 'studio.sqlite'));
    this.db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, summary TEXT); CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT);',
    );
    // Drop the 1.0.6 Gemini image model, not the user's text/TTS choices, historical
    // request counts, or already generated project media.
    const prior = this.setting<ProviderSettings | null>('gemini', null);
    if (prior?.models && Object.hasOwn(prior.models, 'image')) {
      this.set('gemini', {
        ...prior,
        models: { text: prior.models.text, tts: prior.models.tts },
        services: Object.fromEntries(
          Object.entries(prior.services ?? {}).filter(([k]) => k !== 'image'),
        ),
        catalog: (prior.catalog ?? []).filter((m) => m.kind === 'text' || m.kind === 'tts'),
      });
    }
    this.db.exec('DELETE FROM projects');
    for (const ent of fs.readdirSync(this.projects, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      try {
        const p = this.get(ent.name);
        if (p.final && !fs.existsSync(path.join(this.dir(p.id), p.final.file))) {
          delete p.final;
          delete p.subtitleFiles;
          p.job = {
            state: 'failed',
            label: 'MP4 dosyası bulunamadı. Önbellekten yeniden üretin.',
            at: now(),
          };
          this.save(p);
        } else if (jobActive(p.job)) {
          p.job = {
            ...p.job,
            state: p.job.state === 'stopping' ? 'cancelled' : 'failed',
            runId: undefined,
            label:
              p.job.state === 'stopping'
                ? STOPPED
                : 'Üretim kesildi. Kaydedilmiş varlıklarla devam edebilirsiniz.',
            at: now(),
          };
          this.save(p);
        } else this.index(p);
      } catch {
        this.db.prepare('DELETE FROM projects WHERE id=?').run(ent.name);
      }
    }
    if (seed && !this.setting('starter-installed', false)) {
      this.seed();
      this.set('starter-installed', true);
    }
  }
  set(key: string, value: unknown) {
    this.db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(key, JSON.stringify(value));
  }
  setting<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT v FROM settings WHERE k=?').get(key);
    return row ? JSON.parse(String(row.v)) : fallback;
  }
  dir(id: string) {
    requireThat(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id), 'Proje bulunamadı.', 404);
    return path.join(this.projects, id);
  }
  defaultSpeaker(): Speaker {
    return this.setting<Speaker>('tts-speaker', defaultSpeaker);
  }
  private resolveSpeaker(p: Project) {
    // Pre-1.0.2 projects had a concrete voice but no pin. Preserve existing audio and
    // non-default selections; untouched drafts (including the starter board) inherit.
    p.speakerPinned ??= p.voice !== defaultSpeaker || Object.values(p.assets).some((m) => m.voice);
    if (!p.speakerPinned) p.voice = this.defaultSpeaker();
    return p;
  }
  get(id: string): Project {
    const file = path.join(this.dir(id), 'project.json');
    requireThat(fs.existsSync(file), 'Proje bulunamadı.', 404);
    return this.resolveSpeaker(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  index(p: Project) {
    this.db
      .prepare('INSERT OR REPLACE INTO projects VALUES(?,?)')
      .run(p.id, JSON.stringify(summary(p)));
  }
  list(): ProjectSummary[] {
    return this.db
      .prepare('SELECT summary FROM projects')
      .all()
      .map((r) => JSON.parse(String(r.summary)))
      .sort((a, b) => b.updated.localeCompare(a.updated));
  }
  save(p: Project) {
    p.rev++;
    p.updated = now();
    atomic(path.join(this.dir(p.id), 'project.json'), JSON.stringify(p, null, 2));
    this.index(p);
    return p;
  }
  create(p: Project) {
    for (const f of folders) fs.mkdirSync(path.join(this.dir(p.id), f), { recursive: true });
    return this.save(this.resolveSpeaker(p));
  }
  checkpoint(p: Project) {
    const counter = 'history:' + p.id;
    const next = Math.max(p.history, this.setting(counter, 0)) + 1;
    atomic(path.join(this.dir(p.id), 'versions', `${next}.json`), JSON.stringify(p));
    this.set(counter, next);
    p.history = next;
  }
  undo(p: Project) {
    requireThat(p.history > 0, 'Önceki sürüm yok.');
    const old: Project = JSON.parse(
      fs.readFileSync(path.join(this.dir(p.id), 'versions', `${p.history}.json`), 'utf8'),
    );
    old.rev = p.rev;
    old.job = { state: 'waiting', label: 'Önceki sürüm geri yüklendi', at: now() };
    return this.save(old);
  }
  log(p: Project, event: Task = p.job) {
    fs.appendFileSync(path.join(this.dir(p.id), 'production.ndjson'), JSON.stringify(event) + '\n');
  }
  seed() {
    const sat = makeProject('Satürn’ün halkaları nasıl oluştu?');
    Object.assign(sat, {
      title: 'Satürn’ün halkaları',
      category: 'UZAY',
      cover: '/art/saturn.jpg',
      example: true,
    });
    this.create(sat);
    const sea = makeProject(
      'Balinalar okyanusta nasıl haberleşir?',
      'Okyanusun mavi karanlığında bir balina, gözünün göremediği kadar uzaktaki bir başka balinaya nasıl ulaşır? Su, sesi havadan daha hızlı iletir. Bazı büyük balinaların çıkardığı alçak frekanslı sesler çok uzaklara yayılabilir. Kambur balinaların şarkılarıysa tekrar eden bölümlerden oluşur. Böylece denizin yüzeyinden bakınca sessiz sandığımız bu dünya, suyun altında seslerle dolu bir yaşam alanına dönüşür.',
    );
    Object.assign(sea, {
      title: 'Okyanusun sessiz devleri',
      category: 'OKYANUS',
      cover: '/art/ocean.jpg',
      example: true,
    });
    this.create(sea);
    const lines = [
      'Karıncalar kışın neden ortadan kaybolur?',
      'Yaz boyunca toprağın üzerinde gördüğümüz bu küçük canlılar, soğuk günlerde aslında çok yakınımızdadır.',
      'Ilıman bölgelerde birçok karınca türü, sıcaklık düştükçe yuvasının daha korunaklı bölümlerine çekilir.',
      'Toprak, yüzeydeki ani sıcaklık değişimlerini bir battaniye gibi yavaşlatır.',
      'Soğukta karıncaların metabolizması yavaşlar; daha az hareket eder, daha az enerji harcarlar.',
      'İlkbaharda toprak yeniden ısındığında, yuvanın girişinde beliren ilk işçiler bize koloninin kışı yer altında geçirdiğini gösterir.',
    ];
    const ant = makeProject('Karıncalar kışın neden ortadan kaybolur?', lines.join('\n\n'));
    Object.assign(ant, {
      title: 'Karıncaların kış sırrı',
      category: 'DOĞA',
      cover: '/art/ants.jpg',
      example: true,
    });
    const details = [
      'Boş bir orman patikası ve ilk kar taneleri.',
      'Yazın yosun üzerinde ilerleyen koyu kızıl işçi karınca.',
      'Kesitte görünen köklerin altındaki korunaklı koloni.',
      'Toprak katmanlarında soğuk mavi yüzeyden sıcak kahverengi derinliğe geçiş.',
      'Bir odacıkta birbirine yakın, neredeyse hareketsiz işçi karıncalar.',
      'Güneşle ısınmış yuva girişinden çıkan ilk işçi.',
    ];
    ant.scenes = lines.map(
      (n, i): Scene => ({
        ...blankScene(randomUUID()),
        narration: n,
        description: details[i],
        prompt: details[i] + ' Dikey kadraj, sinematik doğa çizimi, metinsiz.',
        sound: i === 0 ? 'Hafif kış rüzgarı' : 'Sakin orman ortamı',
        environment: details[i],
      }),
    );
    this.create(ant);
  }
}
