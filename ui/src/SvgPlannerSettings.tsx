import { useState } from 'react';
import { KeyRound, Layers3, Save } from 'lucide-react';
import type { Settings } from '../../shared/schema';
import { providerNames, type PlannerConfig } from '../../shared/vector';
import { api, Badge, Button, post, useRun, useStudio } from './lib';
function KeyField({ provider, has }: { provider: 'openrouter'; has: boolean }) {
  const { setSettings, notify } = useStudio(),
    { run, busy } = useRun(),
    [value, setValue] = useState('');
  const url = '/settings/svg-planner/key/' + provider,
    name = providerNames[provider];
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
  const [provider, choose] = useState<PlannerConfig['provider']>(saved.provider);
  return (
    <section className="panel padded">
      <div className="panel-title">
        <Layers3 size={18} />
        <h2>Sahne planlayıcı</h2>
        <Badge tone="green">{providerNames[saved.provider]}</Badge>
      </div>
      <div className="form-stack spaced">
        <p>
          Metin modeli belgeselin ana öznesini, İngilizce sahne istemlerini ve kısa Türkçe
          başlıkları belirler. İllüstrasyonu Pollinations üretir. Kayıtlı sahneler çevrimdışı
          oynatılır.
        </p>
        <label>
          Planlama kaynağı
          <select value={provider} onChange={(e) => choose(e.target.value as typeof provider)}>
            {Object.entries(providerNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <p className="help">
          Otomatik seçim kayıtlı OpenRouter anahtarına öncelik verir (openrouter/free); yoksa izin
          verdiğin Gemini metin modelini kullanır. Hata olursa başka sağlayıcıya geçilmez. Geçersiz
          bir sahne yanıtı için aynı modele en fazla iki onarım isteği gider. Gemini’nin seçtiğin
          kota ve ücret izni geçerlidir.
        </p>
        {(provider === 'openrouter' || provider === 'auto') && (
          <KeyField provider="openrouter" has={saved.keys.openrouter} />
        )}
        {saved.keys.groq && (
          <Button
            onClick={() =>
              void run(async () => {
                setSettings(
                  await api<Settings>('/settings/svg-planner/key/groq', {
                    method: 'DELETE',
                    body: '{}',
                  }),
                );
              })
            }
          >
            Eski Groq anahtarını kaldır
          </Button>
        )}
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              setSettings(await post<Settings>('/settings/svg-planner', { provider }));
              notify('Sahne planlayıcı kaydedildi.');
            })
          }
        >
          <Save size={14} />
          Planlayıcıyı kaydet
        </Button>
      </div>
    </section>
  );
}
