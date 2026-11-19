import { useState } from 'react';
import { KeyRound, Layers3, Save } from 'lucide-react';
import type { Settings } from '../../shared/schema';
import { plannerLabels, plannerProviders, type PlannerProvider } from '../../shared/svg';
import { api, Badge, Button, post, useRun, useStudio } from './lib';
function KeyField({
  provider,
  has,
  changed,
}: {
  provider: 'groq' | 'openrouter';
  has: boolean;
  changed: () => void;
}) {
  const { setSettings, notify } = useStudio(),
    { run, busy } = useRun(),
    [value, setValue] = useState('');
  const url = '/settings/svg-planner/key/' + provider,
    name = plannerLabels[provider];
  return (
    <div className="form-stack">
      <label>
        {name} API anahtarı
        <input
          type="password"
          autoComplete="new-password"
          value={value}
          maxLength={512}
          spellCheck={false}
          placeholder={has ? '•••••••• · Kayıtlı anahtar' : 'Gizli anahtar'}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="actions">
        <Button
          disabled={busy || !value.trim()}
          onClick={() =>
            void run(async () => {
              setSettings(await post<Settings>(url, { key: value.trim() }));
              setValue('');
              changed();
              notify(name + ' anahtarı kaydedildi.');
            })
          }
        >
          <KeyRound size={14} />
          {has ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
        </Button>
        {has && (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setSettings(await api<Settings>(url, { method: 'DELETE', body: '{}' }));
                setValue('');
                changed();
                notify(name + ' anahtarı kaldırıldı.');
              })
            }
          >
            Anahtarı kaldır
          </Button>
        )}
      </div>
    </div>
  );
}
export function SvgPlannerSettings({ s }: { s: Settings }) {
  const saved = s.svgPlanner,
    { setSettings, notify } = useStudio(),
    { busy, run } = useRun();
  const [provider, setProvider] = useState<PlannerProvider>(saved.provider),
    [model, setModel] = useState(saved.ollamaModel),
    [free, setFree] = useState(saved.groqFreeConfirmed);
  return (
    <section className="panel padded">
      <div className="panel-title">
        <Layers3 size={18} />
        <h2>SVG sahne planlayıcısı</h2>
        <Badge tone="green">{plannerLabels[saved.provider]}</Badge>
      </div>
      <p className="muted">
        Beş çizim şablonu bilgisayarında çalışır. Planlayıcı yalnızca alanları doldurur; kod
        üretemez. İnternetsiz çalışmak için yerel şablonları seç.
      </p>
      <div className="form-stack spaced">
        <label>
          Planlama kaynağı
          <select value={provider} onChange={(e) => setProvider(e.target.value as PlannerProvider)}>
            {plannerProviders.map((p) => (
              <option key={p} value={p}>
                {plannerLabels[p]}
              </option>
            ))}
          </select>
        </label>
        {provider === 'local' ? (
          <p className="help">Anahtar, model indirme veya ağ bağlantısı gerekmez.</p>
        ) : provider === 'ollama' ? (
          <>
            <label>
              Kurulu Ollama modeli
              <input
                value={model}
                maxLength={96}
                onChange={(e) => setModel(e.target.value)}
                placeholder="qwen2.5:7b"
              />
            </label>
            <p className="help">
              Stüdyonun çalıştığı bilgisayardaki 127.0.0.1:11434 kullanılır. Ollama’yı çalıştır ve
              kurulu yerel model adını gir. Uygulama model indirmez.
            </p>
          </>
        ) : (
          <>
            <KeyField
              key={provider}
              provider={provider}
              has={saved.keys[provider]}
              changed={() => {
                if (provider === 'groq') setFree(false);
              }}
            />
            <p className="help">
              Yalnız onaylı anlatımlar seçtiğin servise gönderilir. Anahtar{' '}
              {s.desktop
                ? 'masaüstünde ayrı, şifreli bir dosyada'
                : 'önizlemede yalnızca sunucu belleğinde'}{' '}
              saklanır.
            </p>
            {provider === 'openrouter' ? (
              <p className="help">
                Model: openrouter/free. Ücretli modele geçilmez. Ücretsiz kota veya model müsaitliği
                garanti değildir.
              </p>
            ) : (
              <>
                <p className="help">
                  Model: llama-3.3-70b-versatile. Groq hesap planını API isteğinden
                  doğrulayamıyoruz.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={free}
                    onChange={(e) => setFree(e.target.checked)}
                  />
                  Ücretsiz Groq hesabı kullanıyorum; ücretli faturalandırma kapalı.
                </label>
              </>
            )}
          </>
        )}
        <div>
          <Button
            variant="primary"
            disabled={
              busy || (provider === 'groq' && !free) || (provider === 'ollama' && !model.trim())
            }
            onClick={() =>
              void run(async () => {
                setSettings(
                  await post<Settings>('/settings/svg-planner', {
                    provider,
                    ollamaModel: provider === 'ollama' ? model.trim() : saved.ollamaModel,
                    groqFreeConfirmed: free,
                  }),
                );
                notify('SVG planlayıcısı kaydedildi.');
              })
            }
          >
            <Save size={14} />
            Planlayıcıyı kaydet
          </Button>
        </div>
        <p className="help">
          Bağlantı, kota veya JSON hatasında başka servise istek gönderilmez. Storyboard,
          düzenleyebileceğin yerel şablonlarla açılır.
        </p>
      </div>
    </section>
  );
}
