import {
  AudioLines,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  KeyRound,
  Layers3,
  LockKeyhole,
  Mic,
  Plug,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  kinds,
  labels,
  statusNames,
  type Check as CheckResult,
  type Kind,
  type ModelConfig,
  type Settings as SettingsType,
} from '../../shared/schema';
import { Badge, Button, Head, Modal, Notice, api, post, useRun, useStudio } from './lib';
import { SvgPlannerSettings } from './SvgPlannerSettings';
import { SpeakerSelect } from './SpeakerSelect';
const defaults: Record<string, string> = {
  blocked: 'İstekler kapalı',
  free: 'Yalnızca ücretsiz proje',
  paid: 'Ücretli kullanıma izin verildi',
};
function ModelRow({ kind, s }: { kind: Kind; s: SettingsType }) {
  const { setSettings, notify } = useStudio(),
    { busy, run } = useRun();
  const saved = s.models[kind];
  const savedModel = saved.model;
  const [model, setModel] = useState(savedModel),
    [consent, setConsent] = useState<ModelConfig['consent']>(saved.consent),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setModel(savedModel);
    setConsent(saved.consent);
  }, [savedModel, saved.consent]);
  const options = s.catalog.filter((m) => m.kind === kind),
    Icon = kind === 'text' ? FileText : AudioLines;
  const st = s.services[kind]?.status;
  async function apply() {
    setSettings(await post<SettingsType>('/settings/model', { kind, model, consent }));
    notify('Model ve kullanım izni kaydedildi.');
    setConfirm(false);
  }
  return (
    <div className="model-row">
      <div className="model-head">
        <Icon size={16} />
        <h3>{labels[kind]}</h3>
        <span className="right">
          <Badge tone={st === 'connected' ? 'green' : st === 'quota' ? 'amber' : 'gray'}>
            {st ? statusNames[st] : !s.hasKey ? 'Yapılandırılmadı' : 'Üretim test edilmedi'}
          </Badge>
        </span>
      </div>
      <div className="model-controls">
        <select
          aria-label={`${labels[kind]} modeli`}
          value={model}
          disabled={!options.length}
          onChange={(e) => {
            setModel(e.target.value);
            setConsent('blocked');
          }}
        >
          {!options.length && <option value="">Bağlantı testi gerekli</option>}
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
        <select
          aria-label={`${labels[kind]} kullanım izni`}
          value={consent}
          disabled={!model}
          onChange={(e) => setConsent(e.target.value as ModelConfig['consent'])}
        >
          {Object.entries(defaults).map(([k, v]) => (
            <option key={k} value={k} disabled={k !== 'blocked' && !model}>
              {v}
            </option>
          ))}
        </select>
        <Button
          disabled={busy || !model || (model === saved.model && consent === saved.consent)}
          onClick={() => (consent === 'blocked' ? void run(apply) : setConfirm(true))}
        >
          Uygula
        </Button>
      </div>
      <p className="help">
        {s.services[kind]?.message ||
          'Gemini için bu model ve kullanım izni geçerlidir; başka sağlayıcıya otomatik geçilmez.'}
      </p>
      {kind === 'text' && (
        <p className="help">
          Gemini metin isteğinde HTTP 429/503 olursa en fazla üç Gemini yedek modeli denenir; her
          deneme sayaca dahildir. Fiyatlandırma ve model erişimini hesabından kontrol et.
        </p>
      )}
      {kind === 'tts' && (
        <>
          <SpeakerSelect
            voice={s.defaultSpeaker}
            disabled={busy}
            onChange={(speaker) =>
              void run(async () => {
                setSettings(await post<SettingsType>('/settings/speaker', { speaker }));
                notify('Varsayılan konuşmacı kaydedildi.');
              })
            }
          />
          <p className="help">
            Henüz anlatımı veya özel ses seçimi olmayan projelere uygulanır. Mevcut anlatımı
            değiştirmek için projedeki konuşmacıyı seç.
          </p>
        </>
      )}
      {confirm && (
        <Modal
          title={consent === 'paid' ? 'Ücretli istek izni' : 'Ücretsiz proje doğrulaması'}
          close={() => setConfirm(false)}
        >
          <p>
            {consent === 'paid'
              ? `Bu anahtar ile ${model} modeline gönderilen ${labels[kind].toLocaleLowerCase('tr')} istekleri Google hesabına ücret yansıtabilir. Bu izin, iptal edene veya anahtarı değiştirene kadar geçerlidir.`
              : `Model listesi faturalandırma katmanını göstermez. ${model} için AI Studio’da ücretsiz kota olduğunu ve bu anahtarın projesinde faturalandırmanın kapalı olduğunu doğruladın mı?`}
          </p>
          {kind === 'text' && consent === 'paid' && (
            <p>HTTP 429/503 sonrası Gemini yedek model denemeleri de faturalandırılabilir.</p>
          )}
          <a
            className="text-link"
            href="https://ai.google.dev/gemini-api/docs/pricing"
            target="_blank"
            rel="noreferrer"
          >
            Google fiyatlandırmasını incele <ExternalLink size={13} />
          </a>
          <div className="actions end">
            <Button onClick={() => setConfirm(false)}>Vazgeç</Button>
            <Button variant="primary" busy={busy} onClick={() => void run(apply)}>
              {consent === 'paid'
                ? 'Ücretli isteklere izin ver'
                : 'Faturalandırma kapalı, doğruladım'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ApiTab({ s }: { s: SettingsType }) {
  const { setSettings, notify } = useStudio(),
    { busy, run } = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false),
    [entered, setEntered] = useState(false),
    [del, setDel] = useState(false),
    [err, setErr] = useState('');
  const op = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
      setSettings(await api('/settings'));
    }
  };
  return (
    <>
      <div className="panel padded">
        <div className="provider-head">
          <div className="provider-mark">
            <svg viewBox="0 0 30 30" width="27" height="27" fill="currentColor">
              <path d="M15 1c1.6 9.1 4.8 12.3 14 14-9.2 1.6-12.4 4.8-14 14C13.3 19.8 10.1 16.6 1 15 10.1 13.4 13.3 10.1 15 1Z" />
            </svg>
          </div>
          <div>
            <h2>Google Gemini</h2>
            <p>Türkçe seslendirme; Gemini seçildiğinde ayrıca senaryo ve SVG planlama.</p>
          </div>
          <span className="right">
            <Badge
              tone={
                s.status === 'connected'
                  ? 'green'
                  : ['invalid', 'quota', 'unavailable'].includes(s.status)
                    ? 'amber'
                    : 'gray'
              }
            >
              {statusNames[s.status]}
            </Badge>
          </span>
        </div>
        <div className="form-stack">
          <label htmlFor="gemini-key">Gemini API anahtarı</label>
          <div className="secret-field">
            <KeyRound size={15} />
            <input
              ref={input}
              id="gemini-key"
              type={show ? 'text' : 'password'}
              placeholder={
                s.hasKey
                  ? '••••••••••••••••  ·  Kayıtlı anahtar'
                  : 'Google AI Studio anahtarını gir'
              }
              onInput={() => setEntered(!!input.current?.value.trim())}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button
              className="icon-btn"
              aria-label={show ? 'Girilen anahtarı gizle' : 'Girilen anahtarı göster'}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="credential-note">
            <LockKeyhole size={13} />
            {s.storage === 'encrypted'
              ? 'Windows kullanıcına bağlı şifreli depolama. Kayıtlı anahtar bir daha gösterilmez.'
              : 'Tarayıcı önizlemesinde anahtar yalnızca sunucu belleğinde tutulur. Kalıcı şifreli kayıt masaüstünde kullanılabilir.'}
          </div>
          <div className="actions">
            <Button
              variant="primary"
              disabled={busy || !entered}
              onClick={() =>
                void run(() =>
                  op(async () => {
                    const key = input.current!.value.trim();
                    const data = await post<SettingsType>('/settings/key', { key });
                    input.current!.value = '';
                    setEntered(false);
                    setShow(false);
                    setSettings(data);
                    notify('Anahtar kaydedildi. Bağlantıyı test edebilirsin.');
                  }),
                )
              }
            >
              <Save size={14} />
              {s.hasKey ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
            </Button>
            <Button
              busy={busy}
              disabled={!s.hasKey}
              onClick={() =>
                void run(() =>
                  op(async () => {
                    setSettings(await post<SettingsType>('/settings/test'));
                    notify('Google model listesi doğrulandı.');
                  }),
                )
              }
            >
              <Plug size={15} />
              Bağlantıyı test et
            </Button>
            {s.hasKey && (
              <Button variant="quiet" disabled={busy} onClick={() => setDel(true)}>
                <Trash2 size={14} />
                Sil
              </Button>
            )}
          </div>
        </div>
        {(err || s.message) && (
          <div className="spaced">
            <Notice good={!err && s.status === 'connected'}>
              {err || s.message}
              {s.tested && (
                <small className="block">
                  Son test: {new Date(s.tested).toLocaleString('tr-TR')}
                </small>
              )}
            </Notice>
          </div>
        )}
        <div className="settings-external">
          <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">
            AI Studio’dan anahtar al <ExternalLink size={12} />
          </a>
        </div>
      </div>
      <div className="panel padded spaced">
        <div className="panel-title">
          <SlidersHorizontal size={17} />
          <h2>Gemini modelleri ve kullanım izinleri</h2>
        </div>
        <p className="muted">
          Yalnızca gerçek bağlantı testinde listelenen modeller seçilebilir. Üretim izni varsayılan
          olarak kapalıdır.
        </p>
        {kinds.map((k) => (
          <ModelRow key={k} s={s} kind={k} />
        ))}
        <div className="kv">
          <span>
            Bugün gönderilen Gemini istekleri <small>(UTC)</small>
          </span>
          <b>
            {Object.entries(s.requests)
              .filter(([k]) => k.startsWith(new Date().toISOString().slice(0, 10)))
              .reduce((a, [, v]) => a + v, 0)}
          </b>
        </div>
      </div>
      {del && (
        <Modal title="Gemini anahtarı silinsin mi?" close={() => setDel(false)}>
          <p>
            Model izinleri ve bağlantı durumu sıfırlanır. Projelerin ve üretilmiş dosyaların
            korunur.
          </p>
          <div className="actions end">
            <Button onClick={() => setDel(false)}>Vazgeç</Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                void run(async () => {
                  setSettings(
                    await api<SettingsType>('/settings/key', { method: 'DELETE', body: '{}' }),
                  );
                  setDel(false);
                  setErr('');
                  notify('Kayıtlı anahtar silindi.');
                })
              }
            >
              Anahtarı sil
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function LocalTab({ s }: { s: SettingsType }) {
  const { run, busy } = useRun();
  const [checks, setChecks] = useState<CheckResult[] | null>(null),
    [setup, setSetup] = useState({ working: false, message: '' }),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void api<typeof setup>('/settings/python')
      .then(setSetup)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!setup.working) return;
    const t = setInterval(
      () =>
        void api<typeof setup>('/settings/python')
          .then(setSetup)
          .catch(() => {}),
      1500,
    );
    return () => clearInterval(t);
  }, [setup.working]);
  return (
    <div className="panel padded">
      <div className="panel-title">
        <Cpu size={18} />
        <h2>Yerel servisler</h2>
      </div>
      <p className="muted">
        Bu araçlar Gemini anahtarı gerektirmez. Kontrol, programları gerçekten çalıştırır.
      </p>
      {[
        {
          id: 'ffmpeg',
          name: 'FFmpeg + FFprobe',
          sub: 'Ses miksajı, kodlama ve çıktı doğrulaması',
          icon: AudioLines,
        },
        {
          id: 'remotion',
          name: 'Remotion',
          sub: 'CPU tabanlı kompozisyon ve render tarayıcısı',
          icon: Layers3,
        },
        {
          id: 'whisper',
          name: 'Whisper + forced alignment',
          sub: 'Kesin sözcük zamanları için isteğe bağlı. Kullanılamazsa cümle zamanları tahmin edilir.',
          icon: Mic,
        },
      ].map((o) => {
        const c = checks?.find((x) => x.id === o.id);
        return (
          <div className="service-row" key={o.id}>
            <div className="metric-icon">
              <o.icon size={18} />
            </div>
            <div className="grow">
              <h3>{o.name}</h3>
              <p>{c?.detail || o.sub}</p>
            </div>
            <Badge tone={!c ? 'gray' : c.ok ? 'green' : 'amber'}>
              {!c
                ? 'Kontrol edilmedi'
                : c.ok
                  ? 'Kullanılabilir'
                  : o.id === 'whisper'
                    ? 'İsteğe bağlı'
                    : 'Kurulum gerekli'}
            </Badge>
          </div>
        );
      })}
      <div className="actions">
        <Button
          busy={busy}
          disabled={setup.working}
          onClick={() =>
            void run(async () => setChecks(await post<CheckResult[]>('/settings/checks')))
          }
        >
          <RefreshCw size={14} />
          Servisleri kontrol et
        </Button>
        {s.desktop && (
          <Button disabled={busy || setup.working} onClick={() => setConfirm(true)}>
            <Download size={14} />
            Whisper ortamını kur
          </Button>
        )}
      </div>
      {s.desktop && (
        <p className="help">
          Python 3.11 yüklü değilse{' '}
          <a
            className="inline-link"
            href="https://www.python.org/downloads/release/python-3119/"
            target="_blank"
            rel="noreferrer"
          >
            resmî Windows kurucusunu indir
          </a>
          . Kurulumda Python Launcher seçili olmalı.
        </p>
      )}
      {setup.message && <p className="help">{setup.message}</p>}
      {confirm && (
        <Modal title="Yerel Whisper kurulumu" close={() => setConfirm(false)}>
          <p>
            Python 3.11 gereklidir. Ayrı bir ortama CPU için PyTorch, Whisper ve stable-ts
            indirilir. Çok dilli base model indirilir ve sağlama toplamıyla doğrulanır. İnternet ve
            yaklaşık 2 GB boş alan gerekir.
          </p>
          <div className="actions end">
            <Button onClick={() => setConfirm(false)}>Vazgeç</Button>
            <Button
              variant="primary"
              onClick={() =>
                void run(async () => {
                  setSetup(await post('/settings/python'));
                  setConfirm(false);
                })
              }
            >
              Kurulumu başlat
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function SettingsPage() {
  const { settings: s, projects } = useStudio();
  const [tab, setTab] = useState('api');
  return (
    <>
      <Head
        over="STÜDYO TERCİHLERİ"
        title="Ayarlar"
        sub="Bağlantılarını, yerel servislerini ve çalışma alanını yönet."
      />
      <div className="tabs">
        {[
          { id: 'api', title: 'API ve modeller', I: KeyRound },
          { id: 'planner', title: 'Sahne planlayıcı', I: Layers3 },
          { id: 'local', title: 'Yerel servisler', I: Cpu },
          { id: 'workspace', title: 'Çalışma alanı', I: HardDrive },
        ].map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={tab === x.id ? 'active' : ''}>
            <x.I size={15} />
            {x.title}
          </button>
        ))}
      </div>
      {s &&
        (tab === 'api' ? (
          <ApiTab s={s} />
        ) : tab === 'planner' ? (
          <SvgPlannerSettings s={s} />
        ) : tab === 'local' ? (
          <LocalTab s={s} />
        ) : (
          <div className="panel padded">
            <div className="panel-title">
              <Database size={17} />
              <h2>Yerel proje deposu</h2>
            </div>
            <div className="kv">
              <span>Depolama</span>
              <b>SQLite + sürümlü dosyalar</b>
            </div>
            <div className="kv">
              <span>Projeler</span>
              <b>{projects.length}</b>
            </div>
            <label className="small-label">
              Proje dizini
              <input readOnly value={s.folder} />
            </label>
            <p className="help">
              Her projenin kart menüsünden ZIP yedeği indirebilirsin. API anahtarları proje
              yedeklerine dahil edilmez.
            </p>
          </div>
        ))}
    </>
  );
}
