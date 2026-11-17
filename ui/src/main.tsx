import '@fontsource-variable/inter/wght.css';
import '@fontsource/libre-caslon-text/400-italic.css';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Cpu,
  FilePenLine,
  Folder,
  FolderClosed,
  Grid2X2,
  HardDrive,
  House,
  Layers3,
  LayoutDashboard,
  Menu,
  PanelLeft,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen,
  SquarePlay,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { version } from '../../package.json';
import type { Settings as Config, Project, ProjectSummary } from '../../shared/schema';
import { BoardEditor, Preview, ProductionView, ScriptEditor } from './Editors';
import { Home, NewProject, Projects } from './Home';
import { api, Button, Context, Empty, Modal, names, post, workspacePages, type Page } from './lib';
import { LocalTab, SettingsPage } from './Settings';
import './studio.css';
const items: { page: Page; icon: typeof House; label: string }[] = [
  { page: 'home', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { page: 'projects', icon: FolderClosed, label: 'Projeler' },
  { page: 'new', icon: SquarePen, label: 'Yeni Video' },
  { page: 'script', icon: FilePenLine, label: 'Senaryo' },
  { page: 'board', icon: Grid2X2, label: 'Storyboard' },
  { page: 'production', icon: Layers3, label: 'Üretim Merkezi' },
  { page: 'preview', icon: SquarePlay, label: 'Video Önizleme' },
];
function route() {
  const [pg, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page: (Object.hasOwn(names, pg) ? pg : 'home') as Page, id: id || '' };
}
function App() {
  const [r, setR] = useState(route),
    [projects, setProjects] = useState<ProjectSummary[]>([]),
    [p0, setProject] = useState<Project | null>(null),
    [settings, setSettings] = useState<Config | null>(null),
    [toast, setToast] = useState<{ msg: string; bad: boolean } | null>(null),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [term, setTerm] = useState(''),
    [account, setAccount] = useState(false),
    [wizard, setWizard] = useState(0),
    [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastId = useRef(localStorage.getItem('studio-last') || '');
  const selectedId = r.id || lastId.current || projects[0]?.id;
  const activeId = useRef(selectedId);
  activeId.current = selectedId;
  const p = p0?.id === selectedId ? p0 : null;
  const notify = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), bad ? 7500 : 3400);
  }, []);
  const refresh = useCallback(async () => {
    const data = await api<ProjectSummary[]>('/projects');
    setProjects(data);
    setLoaded(true);
  }, []);
  const go = useCallback((page: Page, id?: string) => {
    if (id) {
      lastId.current = id;
      localStorage.setItem('studio-last', id);
    }
    window.location.hash =
      '/' +
      page +
      (workspacePages.includes(page) && (id || lastId.current) ? '/' + (id || lastId.current) : '');
    setMobile(false);
    setSearch(false);
    setAccount(false);
    setTerm('');
    window.scrollTo(0, 0);
  }, []);
  const setP = useCallback((x: Project) => {
    if (!activeId.current || x.id === activeId.current)
      setProject((old) => (old?.id === x.id && old.rev > x.rev ? old : x));
  }, []);
  useEffect(() => {
    const nav = () => setR(route());
    window.addEventListener('hashchange', nav);
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((x) => !x);
      }
      if (e.key === 'Escape') {
        setMobile(false);
        setAccount(false);
      }
    };
    document.addEventListener('keydown', shortcut);
    void refresh().catch((e) => notify(e.message, true));
    void api<Config>('/settings')
      .then((s) => {
        setSettings(s);
        if (s.desktop && !s.setupDone) setWizard(1);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      window.removeEventListener('hashchange', nav);
      document.removeEventListener('keydown', shortcut);
    };
  }, []);
  useEffect(() => {
    if (!selectedId || !workspacePages.includes(r.page)) return;
    let live = true;
    api<Project>('/projects/' + selectedId)
      .then((p) => {
        if (live) setP(p);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      live = false;
    };
  }, [selectedId, r.page, setP, notify]);
  useEffect(() => {
    if (r.page === 'settings')
      void api<Config>('/settings')
        .then(setSettings)
        .catch((e) => notify(e.message, true));
  }, [r.page]);
  const working = p?.job.state === 'working' || projects.some((x) => x.job.state === 'working');
  useEffect(() => {
    if (!working) return;
    let live = true;
    const t = setInterval(async () => {
      try {
        const list = await api<ProjectSummary[]>('/projects');
        if (!live) return;
        setProjects(list);
        if (selectedId) {
          const latest = await api<Project>('/projects/' + selectedId);
          if (live) setP(latest);
        }
      } catch (e) {
        if (live) notify((e as Error).message, true);
      }
    }, 1100);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [working, selectedId]);
  const mutate = async (action: string, body: unknown = {}) => {
    if (!p) throw new Error('Bir proje seçin.');
    const result = await post<Project>(`/projects/${p.id}/${action}`, body, {
      'If-Match': String(p.rev),
    });
    setP(result);
    await refresh();
    return result;
  };
  const nav = (item: (typeof items)[number]) => (
    <button
      className={'nav-item ' + (r.page === item.page ? 'active' : '')}
      key={item.page}
      onClick={() => go(item.page)}
      aria-current={r.page === item.page ? 'page' : undefined}
    >
      <item.icon size={17} strokeWidth={1.7} />
      {item.label}
      {item.page === 'new' && <Plus className="nav-plus" size={13} />}
    </button>
  );
  const finishWizard = async (toSettings: boolean) => {
    try {
      setSettings(await post<Config>('/settings/setup'));
      setWizard(0);
      if (toSettings) go('settings');
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <Context.Provider
      value={{
        page: r.page,
        go,
        p,
        setP,
        projects,
        settings,
        setSettings,
        refresh,
        notify,
        mutate,
      }}
    >
      <div className="app-shell">
        {mobile && (
          <button
            className="sidebar-scrim"
            aria-label="Gezinmeyi kapat"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={'sidebar ' + (mobile ? 'expanded' : '')}>
          <button
            className="brand"
            onClick={() => go('home')}
            aria-label="Nedenmiş Studio ana sayfa"
          >
            <img src="/favicon.svg" alt="" />
            <span>
              <strong>
                Nedenmiş<span className="brand-period">.</span>
              </strong>
              <small>STUDIO</small>
            </span>
          </button>
          <div className="sidebar-nav">
            <div className="nav-label">ÇALIŞMA ALANI</div>
            {items.slice(0, 3).map(nav)}
            <div className="nav-label second">PRODÜKSİYON</div>
            {items.slice(3).map(nav)}
          </div>
          <div className="sidebar-bottom">
            <div className="engine-mini">
              <span className="engine-icon">
                <Cpu size={17} />
              </span>
              <div>
                <strong>Yerel motor</strong>
                <small>
                  <i className={'live-dot ' + (!loaded ? 'off' : '')} />
                  {loaded ? 'Çalışıyor' : 'Bağlanıyor'}
                </small>
              </div>
              <span className="signal">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <button
              className={'nav-item settings-nav ' + (r.page === 'settings' ? 'active' : '')}
              onClick={() => go('settings')}
            >
              <Settings size={17} strokeWidth={1.7} />
              Ayarlar
            </button>
            <div className="profile-wrap">
              <button className="profile" onClick={() => setAccount(!account)}>
                <span className="avatar">NS</span>
                <span>
                  <strong>Kişisel stüdyo</strong>
                  <small>Yerel çalışma alanı</small>
                </span>
                <ChevronsUpDown size={13} />
              </button>
              {account && (
                <div className="profile-menu">
                  <span>Nedenmiş Studio · v{version}</span>
                  <button onClick={() => go('settings')}>
                    <SlidersHorizontal size={14} />
                    Stüdyo tercihleri
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="crumb">
              <button
                className="icon-btn mobile-toggle"
                aria-label="Menüyü aç"
                onClick={() => setMobile(true)}
              >
                <Menu size={19} />
              </button>
              <PanelLeft className="crumb-icon" size={16} />
              <span className="crumb-rule" />
              <span>Stüdyo</span>
              <ChevronRight size={12} />
              <b>{names[r.page]}</b>
            </div>
            <div className="bar-right">
              <button
                className="quick-search"
                onClick={() => {
                  setSearch(true);
                  setTerm('');
                }}
              >
                <Search size={14} />
                <span>Hızlı ara</span>
                <kbd>Ctrl K</kbd>
              </button>
              <span className="bar-separator" />
              <span className="local-pill">
                <i className="live-dot" />
                Yerel oturum
              </span>
            </div>
          </header>
          <main key={r.page} className="content">
            {r.page === 'home' ? (
              <Home />
            ) : r.page === 'new' ? (
              <NewProject />
            ) : r.page === 'projects' ? (
              <Projects />
            ) : r.page === 'settings' ? (
              <SettingsPage />
            ) : p ? (
              r.page === 'script' ? (
                <ScriptEditor key={p.id} p={p} />
              ) : r.page === 'board' ? (
                <BoardEditor key={p.id} p={p} />
              ) : r.page === 'production' ? (
                <ProductionView key={p.id} p={p} />
              ) : (
                <Preview key={p.id} p={p} />
              )
            ) : (
              <Empty
                icon={Folder}
                title={loaded && !projects.length ? 'Önce bir proje oluştur' : 'Proje açılıyor'}
                sub={
                  loaded && !projects.length
                    ? 'Belgeselin için bir konuyla başla.'
                    : 'Yerel dosyalar okunuyor.'
                }
              >
                {loaded && !projects.length && (
                  <Button onClick={() => go('new')}>Yeni video</Button>
                )}
              </Empty>
            )}
          </main>
          <footer className="app-footer">
            <Clapperboard size={12} />
            Nedenmiş Studio<span>YEREL PRODÜKSİYON ORTAMI</span>
          </footer>
        </div>
      </div>
      {search && (
        <Modal title="Stüdyoda ara" close={() => setSearch(false)}>
          <div className="search-field large">
            <Search size={17} />
            <input
              data-initial
              aria-label="Stüdyoda ara"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Proje veya sayfa adı…"
            />
          </div>
          <div className="search-results">
            <div className="nav-label">PROJELER</div>
            {projects
              .filter((x) =>
                (x.title + ' ' + x.topic)
                  .toLocaleLowerCase('tr')
                  .includes(term.toLocaleLowerCase('tr')),
              )
              .map((x) => (
                <button key={x.id} onClick={() => go(x.exported ? 'preview' : 'script', x.id)}>
                  <Folder size={15} />
                  {x.title}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            <div className="nav-label">SAYFALAR</div>
            {(Object.keys(names) as Page[])
              .filter((x) =>
                names[x].toLocaleLowerCase('tr').includes(term.toLocaleLowerCase('tr')),
              )
              .map((x) => (
                <button key={x} onClick={() => go(x)}>
                  <PanelLeft size={14} />
                  {names[x]}
                  <ArrowRight size={13} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {wizard > 0 && settings && (
        <Modal title="Stüdyona hoş geldin" close={() => void finishWizard(false)}>
          {wizard === 1 ? (
            <>
              <p>
                Nedenmiş Studio projelerini bu bilgisayarda tutar. Senaryo ve storyboard onayından
                sonra üretim başlar.
              </p>
              <div className="setup-path">
                <HardDrive size={15} />
                {settings.folder}
              </div>
              <div className="actions end">
                <Button onClick={() => void finishWizard(false)}>Şimdilik atla</Button>
                <Button variant="primary" onClick={() => setWizard(2)}>
                  Kuruluma başla <ArrowRight size={14} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <LocalTab s={settings} />
              <div className="actions end">
                <Button variant="primary" onClick={() => void finishWizard(true)}>
                  API ayarlarına geç <ArrowRight size={14} />
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
      {toast && (
        <div role={toast.bad ? 'alert' : 'status'} className={'toast ' + (toast.bad ? 'bad' : '')}>
          <span>{toast.bad ? <Activity size={16} /> : <Check size={16} />}</span>
          {toast.msg}
          <button aria-label="Bildirimi kapat" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
