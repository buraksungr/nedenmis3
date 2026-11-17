import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  FilePenLine,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  Frame,
  Grid2X2,
  Layers3,
  List,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { Project, ProjectSummary } from '../../shared/schema';
import {
  Badge,
  Button,
  Empty,
  Head,
  Modal,
  api,
  colors,
  fmt,
  post,
  useRun,
  useStudio,
  type Page,
} from './lib';
function openAt(p: ProjectSummary): Page {
  return p.exported
    ? 'preview'
    : p.stage === 'Üretime hazır' || p.stage === 'İşleniyor'
      ? 'production'
      : p.stage === 'Storyboard'
        ? 'board'
        : 'script';
}
export function ProjectCard({ item: p }: { item: ProjectSummary }) {
  const { go, refresh, notify } = useStudio();
  const [menu, setMenu] = useState(false),
    [edit, setEdit] = useState(false),
    [title, setTitle] = useState(p.title);
  const { run, busy } = useRun();
  return (
    <article className="project-card">
      <button
        className="card-open"
        onClick={() => go(openAt(p), p.id)}
        aria-label={`${p.title} projesini aç`}
      >
        <div className={'project-art ' + (!p.cover ? 'no-art' : '')}>
          {p.cover ? <img src={p.cover} alt="" /> : <Clapperboard size={42} strokeWidth={1} />}
          <span className="art-shade" />
          <span className="art-category">{p.category}</span>
          <span className="timecode">
            <Clock3 size={11} />
            {fmt(p.duration)}
          </span>
        </div>
        <div className="project-info">
          <div className="card-status">
            <Badge tone={colors(p.stage)}>{p.stage}</Badge>
          </div>
          <h3>{p.title}</h3>
          <div className="card-meta">
            <span>
              <Frame size={12} />
              9:16
            </span>
            <b />
            Sinematik 2D
            {p.example && (
              <>
                <b />
                Örnek
              </>
            )}
          </div>
        </div>
      </button>
      <button
        className={'card-more ' + (menu ? 'selected' : '')}
        aria-label={`${p.title} proje seçenekleri`}
        onClick={() => setMenu(!menu)}
      >
        <MoreHorizontal size={17} />
      </button>
      {menu && (
        <>
          <button
            className="dismiss-menu"
            aria-label="Menüyü kapat"
            onClick={() => setMenu(false)}
          />
          <div className="pop-menu">
            <button
              onClick={() => {
                setMenu(false);
                go(openAt(p), p.id);
              }}
            >
              <FolderOpen />
              Projeyi aç
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setEdit(true);
              }}
            >
              <Pencil />
              Adını değiştir
            </button>
            <a href={`/api/projects/${p.id}/backup`} download onClick={() => setMenu(false)}>
              <Download />
              Yedek indir
            </a>
          </div>
        </>
      )}
      {edit && (
        <Modal title="Proje adını düzenle" close={() => setEdit(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const latest = await api<Project>('/projects/' + p.id);
                await post(
                  `/projects/${p.id}/title`,
                  { title },
                  { 'If-Match': String(latest.rev) },
                );
                await refresh();
                setEdit(false);
                notify('Proje adı kaydedildi.');
              });
            }}
          >
            <label>
              Proje adı
              <input
                data-initial
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={2}
                maxLength={240}
              />
            </label>
            <div className="actions end">
              <Button busy={busy} variant="primary">
                Değişiklikleri kaydet
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </article>
  );
}
export function Home() {
  const { projects, go } = useStudio();
  const running = projects.filter((x) => x.job.state === 'working'),
    exports = projects.filter((x) => x.exported);
  const metrics = [
    { label: 'Toplam proje', val: projects.length, icon: Folder, tone: 'sage', page: 'projects' },
    {
      label: 'Aktif üretim',
      val: running.length,
      icon: Layers3,
      tone: 'lilac',
      page: 'production',
    },
    { label: 'Tamamlanan video', val: exports.length, icon: Film, tone: 'sand', page: 'preview' },
  ] as const;
  return (
    <>
      <Head
        title="Stüdyo paneli"
        sub="Projelerine, üretim akışına ve son çıktılarına genel bir bakış."
      >
        <div className="date-tag">
          <CalendarDays size={14} />
          {new Date().toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </Head>
      <section className="hero">
        <div className="hero-image" />
        <div className="hero-scrim" />
        <div className="hero-content">
          <span className="hero-kicker">
            <span className="live-dot" /> BELGESEL ATÖLYESİ
          </span>
          <h2>
            Bir fikirden, <em>bir belgesele.</em>
          </h2>
          <p>Konunu seç, hikâyeni sinematik bir belgesele dönüştür.</p>
          <Button variant="primary" onClick={() => go('new')}>
            <Plus size={17} />
            Yeni video oluştur
          </Button>
        </div>
        <div className="hero-index">
          <i />
          FİG. 01 <span>/</span> KIZIL TİLKİ
        </div>
        <span className="frame-corner tl" />
        <span className="frame-corner tr" />
        <span className="frame-corner br" />
        <span className="frame-corner bl" />
      </section>
      <div className="metrics">
        {metrics.map((m) => (
          <button
            key={m.page}
            className="metric"
            onClick={() =>
              go(
                m.page,
                m.page === 'production'
                  ? running[0]?.id
                  : m.page === 'preview'
                    ? exports[0]?.id
                    : undefined,
              )
            }
          >
            <div className={'metric-icon ' + m.tone}>
              <m.icon size={20} strokeWidth={1.6} />
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{String(m.val).padStart(2, '0')}</strong>
            </div>
            <ArrowUpRight size={14} className="metric-arrow" />
          </button>
        ))}
      </div>
      <section className="home-section">
        <div className="section-head">
          <div className="section-name">
            <i />
            <h2>Son projeler</h2>
            <span className="count-tag">{projects.length}</span>
          </div>
          <button className="text-link" onClick={() => go('projects')}>
            Tüm projeler <ArrowRight size={14} />
          </button>
        </div>
        <div className="projects-grid">
          {projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} item={p} />
          ))}
        </div>
      </section>
      <section className="home-section">
        <div className="section-head">
          <div className="section-name">
            <i />
            <h2>Üretim akışı</h2>
          </div>
          <span className="tiny-cap">
            <span className="live-dot" />
            ONAY TABANLI
          </span>
        </div>
        <div className="flow">
          {[
            { name: 'Senaryo', icon: FilePenLine, to: 'script', sub: 'Hikâyeni şekillendir' },
            { name: 'Storyboard', icon: Grid2X2, to: 'board', sub: 'Sahnelerini planla' },
            { name: 'Üretim', icon: AudioLines, to: 'production', sub: 'Görsel ve ses üret' },
            { name: 'Önizleme', icon: Play, to: 'preview', sub: 'İzle ve dışa aktar' },
          ].map((x, i) => (
            <button key={x.to} onClick={() => go(x.to as Page)}>
              <div className="flow-icon">
                <x.icon size={17} strokeWidth={1.6} />
              </div>
              <div>
                <small>ADIM 0{i + 1}</small>
                <strong>{x.name}</strong>
                <span>{x.sub}</span>
              </div>
              {i < 3 && <ChevronRight size={15} className="flow-divider" />}
            </button>
          ))}
        </div>
      </section>
      <section className="home-section">
        <div className="section-head">
          <div className="section-name">
            <i />
            <h2>Son çıktılar</h2>
          </div>
        </div>
        {exports.length ? (
          exports.slice(0, 4).map((p) => (
            <button key={p.id} className="export-row" onClick={() => go('preview', p.id)}>
              <Film size={17} />
              <strong>{p.title}</strong>
              <span>MP4 · {fmt(p.duration)}</span>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <div className="compact-empty">
            <ArrowDownToLine size={17} />
            <span>Doğrulanmış MP4 çıktıları burada görünecek.</span>
          </div>
        )}
      </section>
    </>
  );
}
export function Projects() {
  const { projects, go } = useStudio();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('Tümü'),
    [list, setList] = useState(false);
  const filtered = projects.filter(
    (p) =>
      p.title.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')) &&
      (filter === 'Tümü' || p.stage === filter),
  );
  return (
    <>
      <Head
        over="PROJE KÜTÜPHANESİ"
        title="Projeler"
        sub="Yerel projelerini aç, düzenle veya yedekle."
      >
        <Button variant="primary" onClick={() => go('new')}>
          <Plus size={16} />
          Yeni video
        </Button>
      </Head>
      <div className="library-tools">
        <div className="search-field">
          <Search size={15} />
          <input
            placeholder="Projelerde ara…"
            aria-label="Proje ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Aşamaya göre filtrele"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            'Tümü',
            'Taslak',
            'Senaryo',
            'Storyboard',
            'Üretime hazır',
            'İşleniyor',
            'Tamamlandı',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <div className="view-switch">
          <button
            aria-label="Kart görünümü"
            className={!list ? 'active' : ''}
            onClick={() => setList(false)}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            aria-label="Liste görünümü"
            className={list ? 'active' : ''}
            onClick={() => setList(true)}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {!filtered.length ? (
        <Empty icon={Search} title="Proje bulunamadı" sub="Aramanı veya aşama filtreni değiştir." />
      ) : list ? (
        <div className="panel">
          {filtered.map((p) => (
            <button className="project-row" key={p.id} onClick={() => go(openAt(p), p.id)}>
              {p.cover ? <img src={p.cover} alt="" /> : <Film />}
              <div>
                <strong>{p.title}</strong>
                <small>{p.example ? 'Örnek çalışma' : 'Yerel proje'} · 9:16</small>
              </div>
              <Badge tone={colors(p.stage)}>{p.stage}</Badge>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map((p) => (
            <ProjectCard key={p.id} item={p} />
          ))}
        </div>
      )}
    </>
  );
}
export function NewProject() {
  const { go, refresh, setP, notify } = useStudio();
  const { run, busy } = useRun();
  const [topic, setTopic] = useState(''),
    [instructions, setInstructions] = useState(''),
    [script, setScript] = useState(''),
    [intensity, setIntensity] = useState('Orta'),
    [existing, setExisting] = useState(false);
  return (
    <>
      <Head
        over="YENİ PRODÜKSİYON"
        title="Yeni video"
        sub="Bir konuyla başla. Senaryoyu ve storyboard’u onayladıktan sonra üretime geç."
      />
      <div className="editor-layout">
        <form
          className="panel padded form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const p = await post<Project>('/projects', {
                topic,
                instructions,
                script: existing ? script : '',
                intensity,
              });
              setP(p);
              await refresh();
              go('script', p.id);
              notify('Proje yerel çalışma alanına kaydedildi.');
            });
          }}
        >
          <div className="panel-title">
            <FolderPlus size={18} />
            <h2>Proje bilgileri</h2>
          </div>
          <label>
            Belgesel konusu <b className="required">*</b>
            <input
              data-initial
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Hangi hikâyeyi anlatmak istiyorsun?"
              minLength={2}
              maxLength={240}
              required
            />
          </label>
          <div className="example-hint">
            <Sparkles size={13} />
            <button
              type="button"
              onClick={() => setTopic('Karıncalar kışın neden ortadan kaybolur?')}
            >
              Örnek: Karıncalar kışın neden ortadan kaybolur?
            </button>
          </div>
          <label>
            Yönetmen notları <small>İsteğe bağlı</small>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={10000}
              placeholder="Vurgulanacak ayrıntılar, anlatım tonu veya görsel tercihler…"
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={existing}
              onChange={(e) => setExisting(e.target.checked)}
            />{' '}
            Kendi senaryomu kullanacağım
          </label>
          {existing && (
            <label>
              Mevcut senaryo
              <textarea
                rows={6}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                required
                maxLength={10000}
                placeholder="Türkçe anlatım metnini buraya yapıştır…"
              />
            </label>
          )}
          <label>
            Animasyon yoğunluğu
            <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
              {['Düşük', 'Orta', 'Yüksek'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <div className="actions end">
            <Button type="button" onClick={() => go('home')}>
              Vazgeç
            </Button>
            <Button busy={busy} variant="primary">
              <Plus size={16} />
              Proje oluştur
            </Button>
          </div>
        </form>
        <aside>
          <div className="panel spec-panel">
            <img src="/art/forest-studio.jpg" alt="Ormanda kızıl tilki, sinematik 2D çizim" />
            <div className="padded">
              <div className="eyebrow">PRODÜKSİYON PROFİLİ</div>
              <h2>Sinematik belgesel</h2>
              {[
                ['Hedef süre', '30 saniye'],
                ['Format', '1080 × 1920 · 9:16'],
                ['Kare hızı', '30 FPS'],
                ['Anlatım', 'Türkçe · Erkek'],
                ['Görsel stil', 'Sinematik 2D'],
                ['Üretim', 'İki aşamalı onay'],
              ].map(([k, v]) => (
                <div className="kv" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
