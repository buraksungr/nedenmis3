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
import { blankScene, normalize, type Project, type Scene, type Word } from '../../shared/schema';
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
import { defaultSvg, displayPlan } from '../../shared/svg-story';
import { svgPlanSchema, templates, icons, templateNames, plannerLabels } from '../../shared/svg';
import { sceneCaptions, unvoicedSvg, captionEntries } from '../../shared/captions';
import { SpeakerSelect } from './SpeakerSelect';
// Photo-only projects do not need to load the diagram renderer.
const SvgEditor = lazy(() => import('./SvgEditor').then((m) => ({ default: m.SvgEditor })));
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
  const [para, setPara] = useState(0),
    [boardType, setBoardType] = useState('photo');
  const locked = busy || p.job.state === 'working';
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
            <>
              <label className="small-label">
                Storyboard biçimi
                <select
                  value={boardType}
                  disabled={locked}
                  onChange={(e) => setBoardType(e.target.value)}
                >
                  <option value="photo">Fotoğraf · Gemini ile planla</option>
                  <option value="svg">Kod Tabanlı SVG Animasyon · anahtarsız Iconify</option>
                </select>
              </label>
              {boardType === 'svg' && (
                <p className="help">
                  Şema çizimi ayarına göre Iconify’a İngilizce kavram, özel çizim gerekirse izin
                  verdiğin metin modeline sahne anlatımı gönderilir. Çevrimdışı çizimi Ayarlar’dan
                  seçebilirsin.
                </p>
              )}
            </>
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
                        { kind: boardType === 'svg' ? 'svg-board' : 'board' },
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
            <p>Senaryo ve storyboard onaylanmadan görsel, ses veya video üretilmez.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
// Old signed plans stay unchanged on disk until the user explicitly edits/approves the board.
const editableBoard = (scenes: Scene[], topic: string) =>
  scenes.map((s) =>
    s.svgPlan ? { ...s, svgPlan: displayPlan(s.svgPlan, s.narration, topic) } : s,
  );
export function BoardEditor({ p }: { p: Project }) {
  const { go, notify, refresh, setP, settings } = useStudio();
  const autoFill = settings?.pollinations.autoFill;
  const { run, busy } = useRun();
  const d = useDraft(
    p,
    'board',
    { scenes: editableBoard(p.scenes, p.topic), styleGuide: p.styleGuide },
    (v) => v,
  );
  const invalidPlan = d.v.scenes.some(
    (s) => s.visualMode === 'svg' && (!s.svgPlan || !svgPlanSchema.safeParse(s.svgPlan).success),
  );
  const [open, setOpen] = useState<string | null>(null),
    [confirmSvg, setConfirmSvg] = useState(false);
  const locked = busy || p.job.state === 'working';
  const edit = (id: string, x: Partial<Scene>) =>
    d.edit({ ...d.v, scenes: d.v.scenes.map((s) => (s.id === id ? { ...s, ...x } : s)) });
  const move = (i: number, dir: number) => {
    const scenes = [...d.v.scenes];
    [scenes[i], scenes[i + dir]] = [scenes[i + dir], scenes[i]];
    d.edit({ ...d.v, scenes });
  };
  async function gen(kind: string, scene?: string) {
    await d.flush();
    setP(
      await post<Project>(
        `/projects/${p.id}/generate`,
        { kind, scene },
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
              Seslendirme, storyboard onayından sonra seçtiğin sesle yapılır.
              {autoFill
                ? ' Onayla ve üret, yalnız eksik fotoğrafların istemlerini Pollinations’a gönderir.'
                : ' Toplu üretim eksik fotoğrafları yüklemeni bekler.'}{' '}
              İstersen yalnızca onaylayıp tek sahne için görsel üretebilir veya dosya
              yükleyebilirsin.
            </p>
          </div>
          <div className="panel padded spaced svg-planning">
            <div className="panel-title">
              <Layers3 size={17} />
              <h2>Kod Tabanlı SVG Animasyon</h2>
            </div>
            <p>
              {templates.length} bilim şablonu ve {icons.length} ikon arasından anlatıma göre bir
              plan hazırlanır. Hibrit modda Iconify’a yalnız İngilizce arama sözcüğü gider;
              gerekirse izinli metin modeli özel çizim hazırlar. Her sahneyi ayrıca
              düzenleyebilirsin. Videoyu üretirken eksik seslendirme ve hizalama otomatik
              hazırlanır. Anahtarsız çalışmak için kendi sesini yükleyebilir veya sahnede otomatik
              sesi kapatabilirsin.
            </p>
            <div className="actions">
              <Button
                disabled={locked}
                onClick={() =>
                  d.v.scenes.length ? setConfirmSvg(true) : void run(() => gen('svg-board'))
                }
              >
                <Sparkles size={14} />
                SVG planı oluştur
              </Button>
              <small>Planlayıcı: {plannerLabels[settings?.svgPlanner.provider ?? 'local']}</small>
            </div>
          </div>
          {confirmSvg && (
            <Modal title="Sahneler SVG olarak planlansın mı?" close={() => setConfirmSvg(false)}>
              <p>
                Plan tüm sahnelere uygulanır ve yeniden onay gerekir. Anlatımlar senaryoyla
                eşleşiyorsa sahne kimlikleri ve kayıtlı medya korunur; eşleşmiyorsa senaryodan yeni
                bir sahne sırası çıkarılır.
              </p>
              <div className="actions end">
                <Button onClick={() => setConfirmSvg(false)}>Vazgeç</Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    void run(async () => {
                      setConfirmSvg(false);
                      await gen('svg-board');
                    })
                  }
                >
                  SVG planını hazırla
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
              <Button disabled={locked} onClick={() => void run(() => gen('board'))}>
                <Sparkles size={14} />
                Gemini ile planla
              </Button>
              <Button
                disabled={locked || d.v.scenes.length >= 24}
                onClick={() => {
                  const s = blankScene(crypto.randomUUID());
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
              sub="SVG şablonlarıyla başla, Gemini ile fotoğraf planı hazırla veya ilk sahneyi kendin ekle."
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
              <p className="scene-description">{s.description || 'Betimleme ekle.'}</p>
              <label className="visual-selector">
                Sahne türü
                <select
                  disabled={locked}
                  value={s.visualMode ?? 'photo'}
                  onChange={(e) => {
                    if (e.target.value === 'svg') {
                      edit(s.id, {
                        visualMode: 'svg',
                        svgPlan: s.svgPlan ?? defaultSvg(s.narration, i, p.topic),
                      });
                      setOpen(s.id);
                    } else edit(s.id, { visualMode: 'photo' });
                  }}
                >
                  <option value="photo">Fotoğraf</option>
                  <option value="svg">SVG Animasyon</option>
                </select>
              </label>
              {s.visualMode === 'svg' && s.svgPlan ? (
                <div className="manual-image-slot">
                  <SceneThumbnail p={p} s={s} />
                  <div className="grow">
                    <b>{templateNames[s.svgPlan.template]}</b>
                    <p className="help">
                      {'artwork' in s.svgPlan && s.svgPlan.artwork
                        ? `${s.svgPlan.artwork.source === 'iconify' ? 'Iconify' : 'Özel SVG'} · ${s.svgPlan.artwork.name}`
                        : 'Yerel yedek ikon'}
                    </p>
                  </div>
                  <Button onClick={() => setOpen(open === s.id ? null : s.id)}>
                    Şablon ayrıntıları
                  </Button>
                </div>
              ) : (
                <>
                  <div className="scene-format">
                    <Image size={13} /> Sabit kadraj · Yumuşak geçiş
                  </div>
                  <div className="manual-image-slot">
                    <SceneThumbnail p={p} s={s} />
                    <div className="grow">
                      <b>{p.assets[s.id]?.image ? 'Sahne görseli' : 'Görsel bekleniyor'}</b>
                      <p className="help">
                        {p.boardApproval
                          ? 'İstem boşsa sahne betimlemesi kullanılır. Yükleme: JPG, PNG veya WebP · en fazla 30 MB.'
                          : 'Onaydan sonra Pollinations ile üret veya görsel yükle.'}
                      </p>
                    </div>
                    {p.boardApproval && (
                      <div className="actions">
                        <Button
                          disabled={locked || d.status !== 'Kaydedildi'}
                          onClick={() => void run(() => gen('image', s.id))}
                        >
                          <Sparkles size={13} />
                          {p.assets[s.id]?.image ? 'Görseli yeniden üret' : 'Görsel üret'}
                        </Button>
                        <UploadFile
                          p={p}
                          scene={s.id}
                          kind="image"
                          title={p.assets[s.id]?.image ? 'Görsel değiştir' : 'Görsel yükle'}
                          disabled={locked || d.status !== 'Kaydedildi'}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
              {open === s.id && (
                <fieldset disabled={locked} className="scene-fields">
                  {s.visualMode === 'svg' && s.svgPlan && (
                    <Suspense fallback={<p>Şablon yükleniyor…</p>}>
                      <SvgEditor
                        artHref={artUrl(
                          p.id,
                          'artwork' in s.svgPlan ? s.svgPlan.artwork : undefined,
                        )}
                        lookup={(keyword, mode) =>
                          run(async () => {
                            await d.flush();
                            const r = await post<{ project: Project; message: string }>(
                              `/projects/${p.id}/scene-art`,
                              { scene: s.id, keyword, mode },
                              { 'If-Match': String(d.rev.current) },
                            );
                            setP(r.project);
                            await refresh();
                            notify(r.message);
                          })
                        }
                        narration={s.narration}
                        topic={p.topic}
                        plan={
                          'icon' in s.svgPlan
                            ? s.svgPlan
                            : displayPlan(s.svgPlan, s.narration, p.topic)
                        }
                        seconds={s.seconds}
                        onChange={(svgPlan) => edit(s.id, { svgPlan })}
                      />
                    </Suspense>
                  )}
                  {s.visualMode === 'svg' && (
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
                  {s.visualMode === 'svg' && s.svgVoiceMode === 'existing-only' && (
                    <small className="help">
                      Kayıt yoksa yalnız ekran metni ve ambiyans kullanılır; TTS istenmez.
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
                      .filter(([k]) => s.visualMode !== 'svg' || k === 'narration' || k === 'sound')
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
                    {s.visualMode !== 'svg' && (
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
                    {s.visualMode !== 'svg' && (
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
          {invalidPlan && (
            <Notice>
              Şema başlığı 2–4 sözcük olmalı; her etikete farklı, kısa bir konu adı gir.
            </Notice>
          )}
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
  if (s.visualMode === 'svg' && s.svgPlan)
    return (
      <div className="station-art svg-thumb">
        <Suspense fallback={null}>
          <AtlasPreview
            artHref={artUrl(p.id, 'artwork' in s.svgPlan ? s.svgPlan.artwork : undefined)}
            plan={displayPlan(s.svgPlan, s.narration, p.topic)}
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
  const { go, mutate, settings } = useStudio();
  const autoFill = settings?.pollinations.autoFill;
  const { run, busy } = useRun();
  const [editCaps, setEditCaps] = useState<Scene | null>(null),
    [prefs, setPrefs] = useState(false),
    [active, setActive] = useState<string | null>(null);
  const locked = busy || p.job.state === 'working';
  return (
    <>
      <Head
        over="ÜRETİM / ADIM 03"
        title="Üretim Merkezi"
        sub="Sabit fotoğrafları ve yerel SVG şablonlarını yumuşak geçişlerle videoya dönüştür."
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
              {autoFill
                ? 'Eksik fotoğraflar Pollinations ile üretilir; SVG şablonları yereldir. '
                : 'Eksik fotoğrafları yükle, ardından üretime devam et. SVG sahnelerine görsel yüklenmez. '}
              Videoyu üret: eksik anlatımı seslendirir, sesle hizalar ve MP4’e aktarır. Hazır sesler
              ve zamanlar yeniden kullanılır. Kendi görsel ve ses dosyalarını da içe aktarabilirsin.
              Müzik eklemezsen stüdyonun özgün ambiyans müziği kullanılır.
            </p>
          </div>
          <div className="section-head spaced">
            <div className="section-name">
              <h2>Sahne istasyonları</h2>
              <span className="count-tag">{p.scenes.length}</span>
            </div>
          </div>
          {p.scenes.map((s, i) => {
            const m = p.assets[s.id] ?? {},
              svg = s.visualMode === 'svg',
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
                        ...(svg
                          ? []
                          : [['image', m.image ? 'Görseli yeniden üret' : 'Görsel üret']]),
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
    offset += p.assets[s.id]?.clip?.duration ?? 0;
    return { s, at, end: offset };
  });
  const current = timeline.find((x) => time >= x.at && time < x.end);
  const words = current ? sceneCaptions(current.s, p.assets[current.s.id]) : [];
  const targetSvg = p.scenes.find((s) => s.id === scene)?.visualMode === 'svg';
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
            />
            <div className="player-meta">
              <Badge tone="green">Doğrulandı</Badge>
              {estimatedCount > 0 && (
                <Badge tone="amber">{estimatedCount} sahnede tahmini altyazı</Badge>
              )}
              <span>H.264 / AAC · 30 FPS</span>
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
              <p className="muted">
                Altyazı:{' '}
                {words
                  .filter(
                    (w) =>
                      time - (current?.at ?? 0) >= w.start && time - (current?.at ?? 0) <= w.end,
                  )
                  .map((w) => w.text)
                  .join(' ') || '—'}
              </p>
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
                disabled={busy || !revision.trim() || p.job.state === 'working'}
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
                disabled={busy || p.job.state === 'working' || !scene}
                onClick={() =>
                  void run(async () => {
                    if (targetSvg) {
                      go('board', p.id);
                      return;
                    }
                    await mutate('generate', { kind: 'image', scene });
                    go('production', p.id);
                  })
                }
              >
                <RefreshCw size={14} />
                {targetSvg ? 'SVG şablonunu düzenle' : 'Sahne görselini yenile'}
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
          disabled={busy || !p.history || p.job.state === 'working'}
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
