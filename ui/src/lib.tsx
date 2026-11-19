import {
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  FolderOpen,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-react';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Project, ProjectSummary, Settings } from '../../shared/schema';
export type Page =
  | 'home'
  | 'new'
  | 'projects'
  | 'script'
  | 'board'
  | 'production'
  | 'preview'
  | 'settings';
export const names: Record<Page, string> = {
  home: 'Ana Sayfa',
  new: 'Yeni Video',
  projects: 'Projeler',
  script: 'Senaryo',
  board: 'Storyboard',
  production: 'Üretim Merkezi',
  preview: 'Video Önizleme',
  settings: 'Ayarlar',
};
export const fmt = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
export async function api<T>(url: string, opt?: RequestInit): Promise<T> {
  const res = await fetch('/api' + url, {
    ...opt,
    headers: {
      ...(opt?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
      ...opt?.headers,
    },
  });
  const v = await res.json().catch(() => ({ error: 'Yerel servis yanıt vermiyor.' }));
  if (!res.ok) throw new Error(v.error || 'İşlem tamamlanamadı.');
  return v;
}
export const post = <T,>(url: string, body: unknown = {}, headers?: HeadersInit) =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body), headers });
export { mediaUrl as media } from '../../shared/schema';
export const colors = (stage: string) =>
  stage === 'Tamamlandı'
    ? 'green'
    : stage === 'Storyboard'
      ? 'purple'
      : stage === 'Senaryo'
        ? 'amber'
        : stage === 'İşleniyor'
          ? 'blue'
          : stage === 'Üretime hazır'
            ? 'green'
            : 'gray';
export const workspacePages: Page[] = ['script', 'board', 'production', 'preview'];
export type StudioState = {
  page: Page;
  go: (page: Page, id?: string) => void;
  projects: ProjectSummary[];
  p: Project | null;
  setP: (p: Project) => void;
  settings: Settings | null;
  setSettings: (s: Settings) => void;
  refresh: () => Promise<void>;
  notify: (msg: string, bad?: boolean) => void;
  mutate: (action: string, body?: unknown) => Promise<Project>;
};
export const Context = createContext<StudioState>(null!);
export const useStudio = () => useContext(Context);
export function useRun() {
  const { notify } = useStudio();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'İşlem başarısız.', true);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
export function Button({
  children,
  variant = 'secondary',
  busy = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  busy?: boolean;
}) {
  return (
    <button {...props} disabled={props.disabled || busy} className={`btn ${variant} ${className}`}>
      {busy && <LoaderCircle size={15} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = 'gray',
  dot = true,
}: {
  children: React.ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={'badge ' + tone}>
      {dot && <i />}
      {children}
    </span>
  );
}
export function Head({
  over,
  title,
  sub,
  children,
}: {
  over?: string;
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {over && (
          <div className="eyebrow">
            <span className="shortline" />
            {over}
          </div>
        )}
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {children}
    </header>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callback = useRef(close);
  callback.current = close;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const controls = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea,select,a[href],[tabindex="0"]',
        ),
      );
    (el.querySelector<HTMLElement>('[data-initial]') || controls()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        callback.current();
      }
      if (e.key === 'Tab') {
        const a = controls(),
          first = a[0],
          last = a.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        className={'modal ' + (wide ? 'wide' : '')}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Kapat" onClick={close}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon: Icon = Clapperboard,
  title,
  sub,
  children,
}: {
  icon?: React.ElementType;
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{sub}</p>
      {children}
    </div>
  );
}
export function Notice({ children, good = false }: { children: React.ReactNode; good?: boolean }) {
  return (
    <div className={'notice ' + (good ? 'good' : '')}>
      {good ? <Check size={17} /> : <TriangleAlert size={17} />}
      <div>{children}</div>
    </div>
  );
}
export function WorkspaceBar() {
  const { p, projects, go, page } = useStudio();
  return p ? (
    <div className="workspace-bar">
      <div className="project-select">
        <FolderOpen size={16} />
        <select
          aria-label="Çalışılacak proje"
          value={p.id}
          onChange={(e) => go(page, e.target.value)}
        >
          {projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
      <div className="step-links">
        {workspacePages.map((x, i) => (
          <React.Fragment key={x}>
            {i > 0 && <span>›</span>}
            <button onClick={() => go(x, p.id)} className={page === x ? 'current' : ''}>
              {['Senaryo', 'Storyboard', 'Üretim', 'Önizleme'][i]}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  ) : null;
}
export function JobNote() {
  const { p, go } = useStudio();
  if (!p || (p.job.state === 'waiting' && p.job.kind !== 'manual-images') || p.job.state === 'done')
    return null;
  return (
    <div className={'job-note ' + p.job.state}>
      {p.job.state === 'working' ? (
        <LoaderCircle className="spin" size={16} />
      ) : p.job.state === 'waiting' ? (
        <Clock3 size={16} />
      ) : (
        <TriangleAlert size={16} />
      )}
      <span>
        {p.job.label}
        {p.job.progress !== undefined && p.job.state === 'working' ? ` · %${p.job.progress}` : ''}
      </span>
      {p.job.state === 'config' && (
        <button onClick={() => go('settings')}>
          Ayarları aç <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
