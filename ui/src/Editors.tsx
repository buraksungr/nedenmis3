import { MotionEditor, MotionPreview } from './MotionEditor';
import { isSvgScene } from '../../shared/schema';
import { artUrl } from '../../shared/artwork';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  FilePenLine,
  Film,
  Grid2X2,
  History,
  Image,
  Layers3,
  LockKeyhole,
  Mic,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  jobActive,
  blankScene,
  normalize,
  type Project,
  type Scene,
  type Word,
} from '../../shared/schema';
import {
  Badge,
  Button,
  Empty,
  Head,
  JobNote,
  Modal,
  Notice,
  WorkspaceBar,
  api,
  fmt,
  media,
  post,
  useRun,
  useStudio,
} from './lib';
import { legacyPlate } from '../../shared/legacy-atlas';
import { providerNames } from '../../shared/vector';

import { captionGroupAt, sceneCaptions, unvoicedSvg, captionEntries } from '../../shared/captions';
import { SpeakerSelect } from './SpeakerSelect';
// Photo-only projects do not need to load the diagram renderer.
const VectorEditor = lazy(() =>
  import('./VectorEditor').then((m) => ({ default: m.VectorEditor })),
);
const VectorPreview = lazy(() =>
  import('./VectorEditor').then((m) => ({ default: m.VectorPreview })),
);
const AtlasPreview = lazy(() =>
  import('../../composition/ScientificPlate').then((m) => ({ default: m.ScientificPlate })),
);
// Persist unsent text immediately; serialize database writes and use optimistic revisions.
function useDraft<T>(project: Project, route: string, initial: T, toBody: (v: T) => object) {
  const { setP, refresh, notify } = useStudio();
  const storageKey = 'draft:' + project.id + ':' + route;
  const [v, setV] = useState<T>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return d && d.rev === project.rev ? d.value : initial;
    } catch {
      return initial;
    }
  });
  const value = useRef(v),
    dirty = useRef(JSON.stringify(v) !== JSON.stringify(initial)),
    rev = useRef(project.rev),
    chain = useRef<Promise<unknown>>(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true);
  const [status, setStatus] = useState('Kaydedildi');
  const cb = useRef({ setP, refresh, notify, toBody });
  cb.current = { setP, refresh, notify, toBody };
  const flush = useCallback(
    async (extra?: object): Promise<Project | undefined> => {
      if (timer.current) clearTimeout(timer.current);
      const op = chain.current
        .catch(() => {})
        .then(async () => {
          if (!dirty.current && !extra) return;
          const v = value.current;
          const result = await post<Project>(
            `/projects/${project.id}/${route}`,
            { ...cb.current.toBody(v), ...extra },
            { 'If-Match': String(rev.current) },
          );
          rev.current = result.rev;
          if (v === value.current) {
            dirty.current = false;
            localStorage.removeItem(storageKey);
            if (alive.current) setStatus('Kaydedildi');
          }
          cb.current.setP(result);
          await cb.current.refresh();
          return result;
        });
      chain.current = op;
      return op;
    },
    [project.id, route, storageKey],
  );
  function edit(x: T) {
    value.current = x;
    setV(x);
    dirty.current = true;
    setStatus('Kaydediliyor…');
    localStorage.setItem(storageKey, JSON.stringify({ rev: rev.current, value: x }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        void flush().catch((e) => {
          setStatus('Kaydedilemedi');
          cb.current.notify(e.message, true);
        }),
      850,
    );
  }
  useEffect(() => {
    if (!dirty.current) {
      value.current = initial;
      setV(initial);
      rev.current = project.rev;
    }
  }, [project.rev]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void flush().catch(() => {});
    };
  }, [flush]);
  return { v, edit, flush, status, rev };
}
function EditorMeta() {
  return (
    <div className="meta-strip">
      <span>
        <Clock3 size={14} />
        30 sn hedef
      </span>
      <span>
        <Film size={14} />
        1080 × 1920
      </span>
      <span>
        <Mic size={14} />
        Türkçe anlatım
      </span>
    </div>
  );
}
export function ScriptEditor({ p }: { p: Project }) {
  const { go, refresh, setP, notify } = useStudio();
  const { run, busy } = useRun();
  const draft = useDraft(p, 'script', p.script, (text) => ({ text }));
  const [para, setPara] = useState(0);
  const locked = busy || jobActive(p.job);
  async function generate(kind: string) {
    await draft.flush();
    const result = await post<Project>(
      `/projects/${p.id}/generate`,
      { kind, paragraph: para },
      { 'If-Match': String(draft.rev.current) },
    );
    setP(result);
    await refresh();
  }
  return (
    <>
      <Head
        over="ÜRETİM / ADIM 01"
        title="Senaryo"
        sub="Belgeselin anlatımını düzenle ve sahne planlamasına geç."
      />
      <WorkspaceBar />
      <JobNote />
      <div className="editor-layout">
        <section className="panel padded">
          <div className="panel-title">
            <FilePenLine size={18} />
            <h2>Anlatım metni</h2>
            <span className="right">
              <Badge tone={p.scriptApproval ? 'green' : 'amber'}>
                {p.scriptApproval ? 'Onaylandı' : 'Taslak'}
              </Badge>
            </span>
          </div>
          <h3 className="editor-topic">{p.topic}</h3>
          <EditorMeta />
          <textarea
            className="script-editor"
            aria-label="Senaryo metni"
            rows={12}
            value={draft.v}
            disabled={locked}
            onChange={(e) => draft.edit(e.target.value)}
            maxLength={10000}
            placeholder="Anlatım metnini yaz ya da Gemini ile senaryo oluştur…"
          />
          <div className="editor-foot">
            <span>{draft.v.trim().split(/\s+/).filter(Boolean).length} kelime</span>
            <span>
              <CheckCheck size={13} />
              {draft.status}
            </span>
          </div>
          {!p.scenes.length && (
            <div className="note-panel">
              <strong>Sabit kamera · Hareketli SVG</strong>
              <p>
                Senaryoyu onayladığında seçtiğin metin modeli her sahneyi ayrı çizer ve nesneleri
                hareketlendirir. Sahne başlıkları yalnız proje bilgisidir; videoya yazılmaz.
                Fotoğraf servisi kullanılmaz.
              </p>
            </div>
          )}
          <div className="actions between">
            <Button
              disabled={locked || !draft.v.trim()}
              onClick={() =>
                void run(async () => {
                  await draft.flush({});
                  notify('Senaryo kaydedildi.');
                })
              }
            >
              <Save size={14} />
              Kaydet
            </Button>
            <Button
              variant="primary"
              disabled={locked || draft.v.trim().length < 6}
              onClick={() =>
                void run(async () => {
                  const saved = await draft.flush({ approve: true });
                  go('board', p.id);
                  notify('Senaryo onaylandı.');
                  if (saved && !saved.scenes.length) {
                    setP(
                      await post<Project>(
                        `/projects/${p.id}/generate`,
                        {
                          kind: 'board',
                        },
                        { 'If-Match': String(saved.rev) },
                      ),
                    );
                    await refresh();
                  }
                })
              }
            >
              <Check size={15} />
              Onayla ve devam et <ArrowRight size={14} />
            </Button>
          </div>
        </section>
        <aside className="form-stack">
          <div className="panel padded">
            <div className="panel-title">
              <Sparkles size={17} />
              <h2>Senaryo araçları</h2>
            </div>
            <p className="muted">Gemini ile metnin ritmini ve uzunluğunu düzenle.</p>
            {[
              ['script', 'Senaryoyu oluştur / yenile', RefreshCw],
              ['shorten', 'Metni kısalt', Scissors],
              ['lengthen', 'Metni genişlet', Plus],
            ].map(([k, title, I]) => {
              const Icon = I as typeof Plus;
              return (
                <button
                  key={k as string}
                  className="tool-row"
                  disabled={locked || (k !== 'script' && !draft.v)}
                  onClick={() => void run(() => generate(k as string))}
                >
                  <Icon size={15} />
                  {title as string}
                  <ArrowRight size={13} />
                </button>
              );
            })}
            <label className="small-label">
              Paragraf seç
              <select value={para} onChange={(e) => setPara(+e.target.value)}>
                {draft.v.split(/\n\s*\n/).map((s, i) => (
                  <option value={i} key={i}>
                    {i + 1}. {s.slice(0, 34)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={locked || !draft.v}
              onClick={() => void run(() => generate('paragraph'))}
            >
              Paragrafı yeniden yaz
            </Button>
          </div>
          <div className="note-panel">
            <ShieldCheck size={18} />
            <h3>Onay senin elinde</h3>
            <p>
              Normal üretim storyboard onayı ister; hazır çizimler ayrıca sessiz taslak olarak dışa
              aktarılabilir.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function DraftExportPanel({
  p,
  locked,
  start,
}: {
  p: Project;
  locked: boolean;
  start: () => void;
}) {
  const [status, setStatus] = useState<{ ready: number; total: number }>();
  useEffect(() => {
    let live = true;
    if (!jobActive(p.job))
      void api<{ ready: number; total: number }>(`/projects/${p.id}/draft-status`)
        .then((value) => {
          if (live) setStatus(value);
        })
        .catch(() => {
          if (live) setStatus(undefined);
        });
    return () => {
      live = false;
    };
  }, [p.id, p.rev, p.job.state]);
  return (
    <section className="panel padded spaced draft-export" aria-label="Sessiz taslak">
      <div className="panel-title">
        <Film size={17} />
        <h2>Sessiz taslak</h2>
        <Badge tone="purple">
          {status ? `${status.ready}/${status.total}` : `—/${p.scenes.length}`} hazır sahne • Sessiz
          taslak
        </Badge>
      </div>
      <p className="help">
        Storyboard onayı beklemeden yalnız hazır çizimler sırayla işlenir; eksik veya doğrulanamayan
        sahneler atlanır. Süreler sahne ayarlarından tahmin edilir. TTS, Whisper, kayıtlı ses, müzik
        ve efekt kullanılmaz; MP4 ses kanalı içermez. Normal üretim ve kayıtları değişmez.
      </p>
      <div className="actions">
        <Button variant="primary" disabled={locked || !status?.ready} onClick={start}>
          <Film size={15} /> Sessiz taslağı oluştur
        </Button>
        {p.draft && (
          <a className="btn secondary" href={media(p, p.draft.asset.file) + '?download=1'} download>
            <Download size={15} /> Sessiz taslağı indir
          </a>
        )}
      </div>
      {p.draft && (
        <div className="draft-result">
          <video controls playsInline preload="metadata" src={media(p, p.draft.asset.file)} />
          <p>
            {p.draft.scenes.length}/{p.draft.total} hazır sahne • Sessiz taslak · H.264 ·{' '}
            {fmt(p.draft.asset.duration ?? 0)}
          </p>
        </div>
      )}
    </section>
  );
}
// Old signed plans stay unchanged on disk until the user explicitly edits/approves the board.
export function BoardEditor({ p }: { p: Project }) {
  const { go, notify, refresh, setP, settings } = useStudio();
  const { run, busy } = useRun();
  const d = useDraft(p, 'board', { scenes: p.scenes, styleGuide: p.styleGuide }, (v) => v);
  const invalidPlan = d.v.scenes.some(
    (s) =>
      (s.visualMode === 'motion-svg' && !s.choreography) ||
      (s.visualMode === 'svg' && !s.svgPlan && !s.vector) ||
      (s.visualMode === 'illustration' && (!s.cinema || p.cinema?.scriptHash !== p.scriptApproval)),
  );
  const [open, setOpen] = useState<string | null>(null),
    [confirmMotion, setConfirmMotion] = useState(false);
  const locked = busy || jobActive(p.job);
  const edit = (id: string, x: Partial<Scene>) =>
    d.edit({ ...d.v, scenes: d.v.scenes.map((s) => (s.id === id ? { ...s, ...x } : s)) });
  const pending = Object.keys(p.motionWork ?? {}).length;
  const move = (i: number, dir: number) => {
    const scenes = [...d.v.scenes];
    [scenes[i], scenes[i + dir]] = [scenes[i + dir], scenes[i]];
    d.edit({ ...d.v, scenes });
  };
  async function gen(kind: string, scene?: string, instruction?: string) {
    await d.flush();
    setP(
      await post<Project>(
        `/projects/${p.id}/generate`,
        { kind, scene, instruction },
        { 'If-Match': String(d.rev.current) },
      ),
    );
    await refresh();
  }
  return (
    <>
      <Head
        over="ÜRETİM / ADIM 02"
        title="Storyboard"
        sub="Her sahnenin kadrajını ve anlatımını planla."
      />
      <WorkspaceBar />
      <JobNote />
      {!p.scriptApproval ? (
        <Empty
          icon={LockKeyhole}
          title="Önce senaryoyu onayla"
          sub="Sahne planı, onayladığın anlatım üzerinden hazırlanır."
        >
          <Button variant="primary" onClick={() => go('script', p.id)}>
            Senaryoya git <ArrowRight size={15} />
          </Button>
        </Empty>
      ) : (
        <>
          <div className="panel padded">
            <div className="panel-title">
              <Layers3 size={17} />
              <h2>Görsel kimlik</h2>
              <Badge tone={p.boardApproval ? 'green' : 'purple'}>
                {p.boardApproval ? 'Onaylandı' : 'Planlama'}
              </Badge>
            </div>
            <textarea
              aria-label="Ortak görsel kimlik"
              rows={2}
              disabled={locked}
              value={d.v.styleGuide}
              onChange={(e) => d.edit({ ...d.v, styleGuide: e.target.value })}
            />
          </div>
          <div className="panel padded spaced">
            <SpeakerSelect
              voice={p.voice}
              disabled={locked}
              onChange={(voice) =>
                void run(async () => {
                  await d.flush();
                  const next = await post<Project>(
                    `/projects/${p.id}/preferences`,
                    { voice },
                    { 'If-Match': String(d.rev.current) },
                  );
                  setP(next);
                  await refresh();
                  notify('Bu projenin konuşmacısı kaydedildi.');
                })
              }
            />
            <p className="help">
              Seslendirme, storyboard onayından sonra seçtiğin sesle yapılır. Kayıtlı sesler ve
              sözcük zamanları korunur.
            </p>
          </div>
          <div className="panel padded spaced cinema-planning">
            <div className="panel-title">
              <Layers3 size={17} />
              <h2>Nesne animasyonu</h2>
              <Badge tone="purple">9:16 · SVG</Badge>
            </div>
            <p>
              Kamera sabit kalır. Aynı öznenin kopyaları, parçacıklar ve çizgiler kendi zamanlarında
              hareket eder.
            </p>
            {p.subjectRig && (
              <p className="subject-lock">
                <LockKeyhole size={14} /> Ortak özne <strong>{p.subjectRig.subject}</strong>
                {pending > 0 && ` · ${p.scenes.length - pending}/${p.scenes.length} sahne hazır`}
              </p>
            )}
            <div className="actions">
              <Button
                variant="primary"
                disabled={locked}
                onClick={() =>
                  d.v.scenes.some((s) => s.visualMode !== 'motion-svg' && !p.motionWork?.[s.id])
                    ? setConfirmMotion(true)
                    : void run(() => gen('board'))
                }
              >
                <Sparkles size={14} />
                {p.subjectRig ? 'Eksik sahneleri tamamla' : 'Hareketli sahneleri planla'}
              </Button>
            </div>
            <small className="help">
              Planlayıcı: {providerNames[settings?.svgPlanner.provider ?? 'auto']} · Çizimler proje
              klasörüne kaydedilir.
            </small>
          </div>
          <DraftExportPanel
            p={p}
            locked={locked || d.status !== 'Kaydedildi'}
            start={() => void run(() => gen('draft'))}
          />
          {confirmMotion && (
            <Modal
              title="Sahneler hareketli SVG’ye dönüştürülsün mü?"
              close={() => setConfirmMotion(false)}
            >
              <p>
                Bu projedeki klasik fotoğraf veya SVG sahneleri yeni bir görsel plan alır. Ses ve
                sözcük zamanları anlatım değişmedikçe korunur. Her sahnenin çizimi ayrı kaydedilir.
              </p>
              <div className="actions end">
                <Button onClick={() => setConfirmMotion(false)}>Vazgeç</Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    void run(async () => {
                      setConfirmMotion(false);
                      await gen('board');
                    })
                  }
                >
                  Hareketli SVG’ye dönüştür
                </Button>
              </div>
            </Modal>
          )}
          <div className="section-head spaced">
            <div className="section-name">
              <h2>Sahne planı</h2>
              <span className="count-tag">{d.v.scenes.length}</span>
            </div>
            <div className="actions">
              <Button
                disabled={locked || d.v.scenes.length >= 24}
                onClick={() => {
                  const s: Scene = {
                    ...blankScene(crypto.randomUUID()),
                    visualMode: 'motion-svg',
                  };
                  d.edit({ ...d.v, scenes: [...d.v.scenes, s] });
                  setOpen(s.id);
                }}
              >
                <Plus size={14} />
                Sahne ekle
              </Button>
            </div>
          </div>
          {d.v.scenes.length === 0 && (
            <Empty
              icon={Grid2X2}
              title="Henüz sahne yok"
              sub="Hareketli sahneleri planla veya ilk sahneni ekle."
            />
          )}
          {d.v.scenes.map((s, i) => (
            <div key={s.id} className="panel scene-card">
              <div className="scene-heading">
                <span className="scene-no">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <small>SAHNE {String(i + 1).padStart(2, '0')}</small>
                  <h3>{s.narration || 'Yeni sahne'}</h3>
                </div>
                <span className="duration">{s.seconds} sn</span>
                <button
                  className="icon-btn"
                  aria-label="Sahne ayrıntılarını aç/kapat"
                  onClick={() => setOpen(open === s.id ? null : s.id)}
                >
                  {open === s.id ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>
              </div>
              {p.motionWork?.[s.id] && (
                <div className="scene-work">
                  <span>
                    {p.job.scene === s.id && jobActive(p.job)
                      ? p.job.label
                      : p.motionWork[s.id].detail || 'Çizim bekliyor'}
                  </span>
                  <Button
                    disabled={locked}
                    onClick={() => void run(() => gen('retry-vector', s.id))}
                  >
                    <RefreshCw size={14} />
                    {p.motionWork[s.id].detail ? 'Tekrar dene' : 'Bu sahneyi tamamla'}
                  </Button>
                </div>
              )}
              {s.visualMode === 'motion-svg' && s.choreography ? (
                <MotionEditor
                  p={p}
                  s={s}
                  locked={locked || d.status !== 'Kaydedildi'}
                  draw={(hint) => void run(() => gen('redraw-vector', s.id, hint))}
                />
              ) : (
                <div className="manual-image-slot">
                  <SceneThumbnail p={p} s={s} />
                  <div className="grow">
                    <b>
                      {s.vector?.title ?? s.svgPlan?.title ?? s.cinema?.title ?? 'Sahne çizimi'}
                    </b>
                    <p className="help">
                      {s.visualMode === 'motion-svg'
                        ? 'Henüz çizilmedi.'
                        : 'Arşiv sahnesi · Yerel dosyalar korunur.'}
                    </p>
                  </div>
                  {!p.motionWork?.[s.id] && (
                    <Button
                      disabled={locked || !s.narration}
                      onClick={() => void run(() => gen('redraw-vector', s.id))}
                    >
                      Hareketli SVG çiz
                    </Button>
                  )}
                  {!isSvgScene(s) && p.boardApproval && (
                    <UploadFile
                      p={p}
                      scene={s.id}
                      kind="image"
                      title="Görsel yükle"
                      disabled={locked}
                    />
                  )}
                </div>
              )}
              {open === s.id && (
                <fieldset disabled={locked} className="scene-fields">
                  {s.visualMode === 'svg' && (
                    <Suspense fallback={<p>Çizim yükleniyor…</p>}>
                      <VectorEditor
                        project={p.id}
                        art={s.vector}
                        locked={locked}
                        redraw={(hint) => void run(() => gen('redraw-vector', s.id, hint))}
                      />
                    </Suspense>
                  )}
                  {isSvgScene(s) && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={s.svgVoiceMode !== 'existing-only'}
                        onChange={(e) =>
                          edit(s.id, { svgVoiceMode: e.target.checked ? 'auto' : 'existing-only' })
                        }
                      />
                      Eksik anlatımı otomatik seslendir
                    </label>
                  )}
                  {isSvgScene(s) && s.svgVoiceMode === 'existing-only' && (
                    <small className="help">
                      Kayıt yoksa sahne süresi ve ekran metni kullanılır; TTS istenmez. Hiç ses,
                      müzik veya efekt yoksa MP4 sessizdir.
                    </small>
                  )}
                  <div className="form-grid">
                    {(
                      [
                        ['narration', 'Anlatım'],
                        ['description', 'Görsel betimleme'],
                        ['prompt', 'Görsel istemi (isteğe bağlı)'],
                        ['environment', 'Çevre ayrıntıları'],
                        ['sound', 'Ses tasarımı'],
                      ] as const
                    )
                      .filter(
                        ([k]) =>
                          (!isSvgScene(s) && s.visualMode !== 'illustration') ||
                          k === 'narration' ||
                          k === 'sound',
                      )
                      .map(([k, l]) => (
                        <label key={k}>
                          {l}
                          <textarea
                            rows={2}
                            value={s[k]}
                            onChange={(e) => edit(s.id, { [k]: e.target.value })}
                          />
                        </label>
                      ))}
                    {s.visualMode !== 'svg' && s.visualMode !== 'illustration' && (
                      <label>
                        Kamera açısı
                        <input
                          value={s.angle}
                          onChange={(e) => edit(s.id, { angle: e.target.value })}
                        />
                      </label>
                    )}
                    <label>
                      Tahmini süre (sn)
                      <input
                        type="number"
                        min="0.2"
                        max="120"
                        step="0.1"
                        value={s.seconds}
                        onChange={(e) => edit(s.id, { seconds: Math.max(0.2, +e.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="actions">
                    {s.visualMode !== 'svg' && s.visualMode !== 'illustration' && (
                      <Button onClick={() => void run(() => gen('concept', s.id))}>
                        <Sparkles size={13} />
                        Konsepti yenile
                      </Button>
                    )}
                    <button
                      className="icon-btn"
                      aria-label="Sahneyi yukarı taşı"
                      disabled={!i}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Sahneyi aşağı taşı"
                      disabled={i === d.v.scenes.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-btn danger-text"
                      aria-label="Sahneyi kaldır"
                      onClick={() =>
                        d.edit({ ...d.v, scenes: d.v.scenes.filter((x) => x.id !== s.id) })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </fieldset>
              )}
            </div>
          ))}
          {d.v.scenes.length > 0 &&
            normalize(d.v.scenes.map((s) => s.narration).join(' ')) !== normalize(p.script) && (
              <Notice>
                Sahne sırası veya anlatımı senaryodan farklı.{' '}
                <button
                  className="inline-link"
                  disabled={locked}
                  onClick={() =>
                    void run(async () => {
                      await d.flush();
                      setP(
                        await post<Project>(
                          `/projects/${p.id}/script`,
                          { text: d.v.scenes.map((s) => s.narration).join('\n\n') },
                          { 'If-Match': String(d.rev.current) },
                        ),
                      );
                      go('script', p.id);
                    })
                  }
                >
                  Sahne metnini senaryoya aktar ve yeniden onayla.
                </button>
              </Notice>
            )}
          {invalidPlan && <Notice>Onaylamadan önce her sahnenin görsel planını tamamla.</Notice>}
          <div className="approval-footer">
            <span>
              <CheckCheck size={14} />
              {d.status}
            </span>
            <Button
              disabled={
                locked ||
                invalidPlan ||
                !d.v.scenes.length ||
                (!!p.boardApproval && d.status === 'Kaydedildi')
              }
              onClick={() =>
                void run(async () => {
                  await d.flush({ approve: true });
                  notify('Storyboard onaylandı. Görsel üretimi başlatılmadı.');
                })
              }
            >
              Yalnızca onayla
            </Button>
            <Button
              variant="primary"
              disabled={locked || invalidPlan || !d.v.scenes.length}
              onClick={() =>
                void run(async () => {
                  const saved = await d.flush({ approve: true });
                  go('production', p.id);
                  if (saved) {
                    setP(
                      await post<Project>(
                        `/projects/${p.id}/generate`,
                        { kind: 'all' },
                        { 'If-Match': String(saved.rev) },
                      ),
                    );
                    await refresh();
                  }
                  notify('Storyboard onaylandı. Üretim başlatıldı.');
                })
              }
            >
              <ShieldCheck size={16} />
              Onayla ve üret <ArrowRight size={14} />
            </Button>
          </div>
        </>
      )}
    </>
  );
}
function SceneThumbnail({ p, s }: { p: Project; s: Scene }) {
  if (s.visualMode === 'motion-svg' && s.choreography)
    return (
      <div className="station-art svg-thumb" style={{ position: 'relative' }}>
        <MotionPreview project={p.id} s={s} frame={20} />
      </div>
    );
  if (s.visualMode === 'svg' && s.vector)
    return (
      <div className="station-art svg-thumb">
        <Suspense fallback={null}>
          <VectorPreview project={p.id} art={s.vector} frame={20} />
        </Suspense>
      </div>
    );
  if (s.visualMode === 'svg' && s.svgPlan)
    return (
      <div className="station-art svg-thumb">
        <Suspense fallback={null}>
          <AtlasPreview
            artHref={artUrl(p.id, 'artwork' in s.svgPlan ? s.svgPlan.artwork : undefined)}
            plan={legacyPlate(s.svgPlan)}
            frame={20}
            frames={60}
          />
        </Suspense>
      </div>
    );
  const image = p.assets[s.id]?.image;
  return image ? (
    <img className="station-art" src={media(p, image.file)} alt={s.description} />
  ) : (
    <span className="station-placeholder" role="img" aria-label="Boş görsel alanı">
      <Image size={22} />
    </span>
  );
}
function UploadFile({
  p,
  scene,
  kind,
  title,
  disabled = false,
}: {
  p: Project;
  scene?: string;
  kind: string;
  title: string;
  disabled?: boolean;
}) {
  const { setP, refresh, notify } = useStudio();
  const { busy, run } = useRun();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        accept={kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/*'}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f)
            void run(async () => {
              if (f.size > 30 * 1024 * 1024) throw new Error('En fazla 30 MB yükleyebilirsin.');
              const v = await api<Project>(
                `/projects/${p.id}/import/${kind}` + (scene ? '?scene=' + scene : ''),
                {
                  method: 'POST',
                  body: f,
                  headers: {
                    'If-Match': String(p.rev),
                    'Content-Type': 'application/octet-stream',
                  },
                },
              );
              setP(v);
              await refresh();
              notify('Dosya doğrulandı ve içe aktarıldı.');
            });
        }}
      />
      <Button busy={busy} disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload size={13} />
        {title}
      </Button>
    </>
  );
}
function Captions({ p, s, close }: { p: Project; s: Scene; close: () => void }) {
  const { mutate, notify } = useStudio();
  const { run, busy } = useRun();
  const m = p.assets[s.id];
  const estimated = m.align?.method === 'estimated',
    unit = estimated ? 'Cümle' : 'Sözcük';
  const [words, setWords] = useState<Word[]>(captionEntries(m).map((w) => ({ ...w })));
  const edit = (i: number, v: Partial<Word>) =>
    setWords(words.map((w, j) => (i === j ? { ...w, ...v } : w)));
  return (
    <Modal title="Altyazı zamanlaması" close={close} wide>
      <p className="muted">
        Gerçek ses süresi: {m.voice?.duration?.toFixed(2)} sn.{' '}
        {estimated ? 'Tahmini cümle zamanları' : 'Sözcük zamanları'} sahne başlangıcına göredir.
      </p>
      <audio controls src={media(p, m.voice!.file)} />
      {m.recognized && <p className="muted">Whisper: {m.recognized}</p>}
      <div className="word-cols">
        <b>{unit}</b>
        <b>Başlangıç (sn)</b>
        <b>Bitiş (sn)</b>
      </div>
      {words.map((w, i) => (
        <div className="word-cols" key={i}>
          <input
            aria-label={`${i + 1}. ${unit.toLocaleLowerCase('tr')}`}
            value={w.text}
            onChange={(e) => edit(i, { text: e.target.value })}
          />
          {(['start', 'end'] as const).map((k) => (
            <input
              aria-label={`${i + 1}. ${k}`}
              key={k}
              type="number"
              step=".01"
              min="0"
              value={w[k]}
              onChange={(e) => edit(i, { [k]: +e.target.value })}
            />
          ))}
        </div>
      ))}
      <div className="actions end">
        <Button
          busy={busy}
          variant="primary"
          onClick={() =>
            void run(async () => {
              await mutate('subtitles', { scene: s.id, words });
              notify('Altyazı zamanları kaydedildi.');
              close();
            })
          }
        >
          <Save size={15} />
          Kaydet
        </Button>
      </div>
    </Modal>
  );
}
export function ProductionView({ p }: { p: Project }) {
  const { go, mutate } = useStudio();
  const { run, busy } = useRun();
  const [editCaps, setEditCaps] = useState<Scene | null>(null),
    [prefs, setPrefs] = useState(false),
    [active, setActive] = useState<string | null>(null);
  const locked = busy || jobActive(p.job);
  return (
    <>
      <Head
        over="ÜRETİM / ADIM 03"
        title="Üretim Merkezi"
        sub="Sabit fotoğrafları ve vektör sahnelerini yumuşak geçişlerle videoya dönüştür."
      />
      <WorkspaceBar />
      <JobNote />
      {!p.boardApproval ? (
        <Empty
          icon={LockKeyhole}
          title="Storyboard onayı bekleniyor"
          sub="Pahalı işlemler başlamadan önce senaryonu ve sahne planını incele."
        >
          <Button variant="primary" onClick={() => go(p.scriptApproval ? 'board' : 'script', p.id)}>
            Onay adımına git <ArrowRight size={15} />
          </Button>
        </Empty>
      ) : (
        <>
          <div className="panel padded">
            <div className="panel-title">
              <ClapperIcon />
              <h2>{p.title}</h2>
              <span className="right">
                <Badge tone="green">Onaylı plan</Badge>
              </span>
            </div>
            <EditorMeta />
            <div className="actions">
              <Button
                variant="primary"
                disabled={locked}
                onClick={() => void run(() => mutate('generate', { kind: 'all' }))}
              >
                <Film size={15} />
                Videoyu üret
              </Button>
              <Button disabled={locked} onClick={() => setPrefs(true)}>
                <SlidersHorizontal size={14} />
                Prodüksiyon ayarları
              </Button>
              <UploadFile
                p={p}
                kind="music"
                title={p.music ? 'Müziği değiştir' : 'Müzik içe aktar'}
                disabled={locked}
              />
              {p.final && (
                <Button onClick={() => go('preview', p.id)}>
                  Videoyu izle <ArrowRight size={14} />
                </Button>
              )}
            </div>
            <p className="help">
              Kareler kaydedilmiş SVG nesnelerinden çizilir; görsel servisi gerekmez. Videoyu üret:
              eksik anlatımı seslendirir, sesle hizalar ve MP4’e aktarır. Hazır sesler ve zamanlar
              yeniden kullanılır. Kendi görsel ve ses dosyalarını da içe aktarabilirsin. Sesli
              üretimde müzik eklemezsen stüdyonun özgün ambiyansı kullanılır; hiç ses yoksa MP4
              sessizdir.
            </p>
          </div>
          <DraftExportPanel
            p={p}
            locked={locked}
            start={() => void run(() => mutate('generate', { kind: 'draft' }))}
          />
          <div className="section-head spaced">
            <div className="section-name">
              <h2>Sahne istasyonları</h2>
              <span className="count-tag">{p.scenes.length}</span>
            </div>
          </div>
          {p.scenes.map((s, i) => {
            const m = p.assets[s.id] ?? {},
              svg = isSvgScene(s),
              silent = unvoicedSvg(s, m);
            return (
              <div className="panel station" key={s.id}>
                <div className="station-top">
                  <SceneThumbnail p={p} s={s} />
                  <div className="grow">
                    <small className="tiny-cap">SAHNE {String(i + 1).padStart(2, '0')}</small>
                    <h3>{s.narration}</h3>
                    <div className="asset-states">
                      {[
                        [
                          svg || m.image,
                          svg ? 'Yerel SVG' : !m.image ? 'Görsel bekleniyor' : 'Görsel',
                        ],
                        [silent || m.voice, silent ? `Anlatımsız · ${s.seconds} sn` : 'Ses'],
                        [
                          silent || captionEntries(m).length,
                          silent
                            ? 'Sahne metni'
                            : m.align?.method === 'estimated'
                              ? 'Tahmini altyazı'
                              : 'Altyazı',
                        ],
                        [m.clip, 'Sahne klibi'],
                      ].map(([a, n]) => (
                        <span key={String(n)} className={a ? 'ready' : ''}>
                          {a ? <Check size={11} /> : <Clock3 size={10} />} {String(n)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {!svg && (
                    <UploadFile
                      p={p}
                      kind="image"
                      scene={s.id}
                      title={m.image ? 'Görsel değiştir' : 'Görsel yükle'}
                      disabled={locked}
                    />
                  )}
                  <button
                    className="icon-btn"
                    aria-label="Sahne üretim araçları"
                    onClick={() => setActive(active === s.id ? null : s.id)}
                  >
                    {active === s.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
                {active === s.id && (
                  <div className="station-tools">
                    <p>{s.description}</p>
                    {m.align?.method === 'estimated' && (
                      <details className="alignment-detail">
                        <summary>Hizalama günlüğü · tahmini cümle zamanları</summary>
                        <p>{m.align.reason}</p>
                        <p>
                          Ses: {m.voice?.file} · {m.voice?.duration?.toFixed(3)} sn. Üretim bu sesin
                          ölçülen süresiyle devam etti. Kesin zamanları yeniden denemek için “Sesi
                          hizala”yı seç.
                        </p>
                      </details>
                    )}
                    <div className="actions">
                      {[
                        ['voice', 'Ses üret'],
                        ['align', 'Sesi hizala'],
                        ['clip', 'Sahneyi işle'],
                      ].map(([k, n]) => (
                        <Button
                          key={k}
                          disabled={
                            locked ||
                            (k === 'align' && !m.voice) ||
                            (k === 'clip' && ((!svg && !m.image) || (!silent && !m.voice)))
                          }
                          onClick={() =>
                            void run(() => mutate('generate', { kind: k, scene: s.id }))
                          }
                        >
                          <RefreshCw size={12} />
                          {n}
                        </Button>
                      ))}
                    </div>
                    <div className="actions">
                      <UploadFile
                        p={p}
                        kind="voice"
                        scene={s.id}
                        title="Anlatım yükle"
                        disabled={locked}
                      />
                      <UploadFile
                        p={p}
                        kind="sfx"
                        scene={s.id}
                        title="Efekt yükle"
                        disabled={locked}
                      />
                      {captionEntries(m).length > 0 && (
                        <Button disabled={locked} onClick={() => setEditCaps(s)}>
                          Altyazıyı düzenle
                        </Button>
                      )}
                    </div>
                    {m.voice && <audio controls src={media(p, m.voice.file)} />}
                  </div>
                )}
              </div>
            );
          })}
          {prefs && <Preferences p={p} close={() => setPrefs(false)} />}
          {editCaps && <Captions p={p} s={editCaps} close={() => setEditCaps(null)} />}
        </>
      )}
    </>
  );
}
function ClapperIcon() {
  return <Film size={18} />;
}
function Preferences({ p, close }: { p: Project; close: () => void }) {
  const { mutate, notify } = useStudio();
  const { busy, run } = useRun();
  const [v, set] = useState({
    voice: p.voice,
    voiceStyle: p.voiceStyle,
    pace: p.pace,
    subtitleSize: p.subtitleSize,
    highlight: p.highlight,
    musicVolume: p.musicVolume,
  });
  return (
    <Modal title="Prodüksiyon ayarları" close={close}>
      <div className="form-stack">
        <SpeakerSelect voice={v.voice} onChange={(voice) => set({ ...v, voice })} disabled={busy} />
        <label>
          Anlatım temposu
          <select value={v.pace} onChange={(e) => set({ ...v, pace: e.target.value })}>
            {['Doğal', 'Yavaş', 'Hızlı'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Seslendirme yönergesi
          <textarea
            value={v.voiceStyle}
            onChange={(e) => set({ ...v, voiceStyle: e.target.value })}
          />
        </label>
        <label>
          Altyazı boyutu · {v.subtitleSize} px
          <input
            type="range"
            min="32"
            max="88"
            value={v.subtitleSize}
            onChange={(e) => set({ ...v, subtitleSize: +e.target.value })}
          />
        </label>
        <label>
          Müzik seviyesi · %{Math.round(v.musicVolume * 100)}
          <input
            type="range"
            min="0"
            max="0.5"
            step=".01"
            value={v.musicVolume}
            onChange={(e) => set({ ...v, musicVolume: +e.target.value })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={v.highlight}
            onChange={(e) => set({ ...v, highlight: e.target.checked })}
          />
          Etkin sözcüğü vurgula
        </label>
        <Button
          variant="primary"
          busy={busy}
          onClick={() =>
            void run(async () => {
              await mutate('preferences', v);
              notify('Ayarlar kaydedildi. Değişen sahneler sonraki üretimde işlenecek.');
              close();
            })
          }
        >
          <Save size={14} />
          Kaydet
        </Button>
      </div>
    </Modal>
  );
}
export function Preview({ p }: { p: Project }) {
  const { go, mutate, notify } = useStudio();
  const { busy, run } = useRun();
  const vid = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0),
    [revision, setRevision] = useState(''),
    [scene, setScene] = useState(p.scenes[0]?.id ?? '');
  let offset = 0;
  const timeline = p.scenes.map((s) => {
    const at = offset;
    // Export concatenates whole 30 fps clips and computes each offset in frames.
    offset += Math.round((p.assets[s.id]?.clip?.duration ?? 0) * 30) / 30;
    return { s, at, end: offset };
  });
  const current = timeline.find((x) => time >= x.at && time < x.end);
  const mediaForCurrent = current && p.assets[current.s.id];
  const words = current ? sceneCaptions(current.s, mediaForCurrent) : [];
  const caption = current
    ? captionGroupAt(
        words,
        time - current.at,
        unvoicedSvg(current.s, mediaForCurrent) || mediaForCurrent?.align?.method === 'estimated',
      )
    : undefined;

  const estimatedCount = p.scenes.filter(
    (s) => p.assets[s.id]?.align?.method === 'estimated',
  ).length;
  return (
    <>
      <Head
        over="ÜRETİM / ADIM 04"
        title="Video önizleme"
        sub="Son kurguyu izle, sahneleri incele ve doğrulanmış videoyu dışa aktar."
      />
      <WorkspaceBar />
      <JobNote />
      {!p.final ? (
        <Empty
          icon={Film}
          title="Önizleme henüz hazır değil"
          sub="Oynatıcı yalnızca ses ve görüntü doğrulamasından geçen MP4 dosyasını gösterir."
        >
          <Button variant="primary" onClick={() => go('production', p.id)}>
            Üretim merkezini aç <ArrowRight size={14} />
          </Button>
        </Empty>
      ) : (
        <div className="preview-layout">
          <div className="panel player-panel">
            <video
              ref={vid}
              controls
              playsInline
              src={media(p, p.final.file)}
              onTimeUpdate={() => setTime(vid.current?.currentTime ?? 0)}
              onSeeking={() => setTime(vid.current?.currentTime ?? 0)}
              onSeeked={() => setTime(vid.current?.currentTime ?? 0)}
            />
            <div className="player-meta">
              <Badge tone="green">Doğrulandı</Badge>
              {estimatedCount > 0 && (
                <Badge tone="amber">{estimatedCount} sahnede tahmini altyazı</Badge>
              )}
              <span>{p.final.hasAudio === false ? 'H.264 · Sessiz' : 'H.264 / AAC'} · 30 FPS</span>
            </div>
          </div>
          <div className="form-stack">
            <div className="panel padded">
              <div className="panel-title">
                <Film size={17} />
                <h2>Sahne zaman çizelgesi</h2>
              </div>
              {timeline.map(({ s, at, end }, i) => (
                <button
                  key={s.id}
                  className={'timeline-row ' + (current?.s.id === s.id ? 'current' : '')}
                  onClick={() => {
                    if (vid.current) {
                      vid.current.currentTime = at;
                      setTime(at);
                      setScene(s.id);
                    }
                  }}
                >
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  <span>{s.narration}</span>
                  <small>
                    {fmt(at)}–{fmt(end)}
                  </small>
                </button>
              ))}
              <p className="muted">Altyazı: {caption?.map((w) => w.text).join(' ') || '—'}</p>
              <div className="actions">
                <a className="btn primary" href={media(p, p.final.file) + '?download=1'} download>
                  <Download size={15} />
                  MP4 dışa aktar
                </a>
                {p.subtitleFiles &&
                  (['srt', 'json'] as const).map((k) => (
                    <a
                      key={k}
                      className="btn secondary"
                      href={media(p, p.subtitleFiles![k]) + '?download=1'}
                      download
                    >
                      {k.toUpperCase()}
                    </a>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {p.boardApproval && (
        <div className="panel padded spaced">
          <div className="panel-title">
            <WandSparkles size={18} />
            <h2>Revizyon asistanı</h2>
          </div>
          <div className="form-stack">
            <label>
              Hedef sahne
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                {p.scenes.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.narration}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              aria-label="Revizyon isteği"
              placeholder="Örn. Altyazı boyutunu küçült veya müziği azalt."
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              rows={2}
            />
            <div className="actions">
              <Button
                disabled={busy || !revision.trim() || jobActive(p.job)}
                onClick={() =>
                  void run(async () => {
                    const v = await mutate('revision', { text: revision, scene });
                    setRevision('');
                    go(v.boardApproval ? 'production' : 'board', p.id);
                    notify('Revizyon kaydedildi. Sağlam varlıklar korunuyor.');
                  })
                }
              >
                <Check size={14} />
                Revizyonu uygula
              </Button>
              <Button
                disabled={busy || jobActive(p.job) || !scene}
                onClick={() =>
                  void run(async () => {
                    go('board', p.id);
                  })
                }
              >
                <RefreshCw size={14} />
                Sahneyi düzenle
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="actions end spaced">
        <a className="btn secondary" href={`/api/projects/${p.id}/backup`} download>
          <Download size={14} />
          Proje yedeği
        </a>
        <Button
          disabled={busy || !p.history || jobActive(p.job)}
          onClick={() =>
            void run(async () => {
              await mutate('undo');
              notify('Önceki proje sürümü geri yüklendi.');
            })
          }
        >
          <History size={14} />
          Geri al
        </Button>
      </div>
    </>
  );
}
