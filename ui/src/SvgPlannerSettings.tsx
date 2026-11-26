import { useState } from 'react';
import { KeyRound, Layers3, Save } from 'lucide-react';
import type { Settings } from '../../shared/schema';
import { providerNames, type PlannerConfig } from '../../shared/vector';
import { api, Badge, Button, post, useRun, useStudio } from './lib';
function KeyField({ provider, has }: { provider: 'openrouter' | 'anthropic'; has: boolean }) {
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
  const [provider, choose] = useState<PlannerConfig['provider']>(saved.provider),
    [openrouterModel, setRouterModel] = useState(saved.openrouterModel),
    [anthropicModel, setAnthropicModel] = useState(saved.anthropicModel);
  return (
    <section className="panel padded">
      <div className="panel-title">
        <Layers3 size={18} />
        <h2>Sahne planlayıcı</h2>
        <Badge tone="green">{providerNames[saved.provider]}</Badge>
      </div>
      <div className="form-stack spaced">
        <p>
          Seçilen model senaryoyu yazar; sahneler için yerel bilimsel şablon ve sınırlı renk/hareket
          seçenekleri belirler. SVG geometrisi uygulamada hazırlanır, modelden çizim istenmez.
          Seslendirme ayrı Gemini ayarını kullanır.
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
          Otomatik seçim, kayıtlı OpenRouter anahtarı varsa aşağıdaki OpenRouter modelini, yoksa
          izin verdiğin Gemini metin modelini kullanır. Doğrudan Anthropic yalnız açıkça seçilirse
          kullanılır. Hata veya kota dolması başka bir sağlayıcıya geçirmez; Gemini’nin kendi yedek
          model zinciri için de hesap fiyatlandırmanı kontrol et. Yeni çizim kapalı seçeneği eski
          projelerdeki gibi senaryo için Gemini’yi kullanır.
        </p>
        {(provider === 'openrouter' || provider === 'auto') && (
          <>
            <label>
              OpenRouter model kimliği
              <input
                value={openrouterModel}
                onChange={(e) => setRouterModel(e.target.value)}
                maxLength={120}
                spellCheck={false}
                list="openrouter-models"
              />
              <datalist id="openrouter-models">
                <option value="openrouter/free" />
                <option value="meta-llama/llama-3.3-8b-instruct:free" />
                <option value="anthropic/claude-sonnet-4" />
              </datalist>
            </label>
            <p className="help">
              Bir model kimliği seçebilir veya yazabilirsin; varsayılan openrouter/free’dir. :free
              modellerin erişimini ve kotasını OpenRouter’da kontrol et. Diğer modeller ücretli
              olabilir; seçtiğin model hesabını faturalandırabilir.
            </p>
            <KeyField key="openrouter" provider="openrouter" has={saved.keys.openrouter} />
          </>
        )}
        {provider === 'anthropic' && (
          <>
            <label>
              Anthropic Claude model kimliği
              <input
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                maxLength={120}
                spellCheck={false}
                list="anthropic-models"
              />
              <datalist id="anthropic-models">
                <option value="claude-sonnet-4-20250514" />
                <option value="claude-3-5-haiku-latest" />
              </datalist>
            </label>
            <p className="help">
              Doğrudan Anthropic API ayrı bir anahtar ve erişilebilir Claude model kimliği ister;
              kullanım ücretli olabilir. Model erişimini ve güncel fiyatları Anthropic hesabında
              kontrol et.
            </p>
            <KeyField key="anthropic" provider="anthropic" has={saved.keys.anthropic} />
          </>
        )}
        <p className="help">
          Sahneler arasında 5 sn beklenir ve geçersiz seçim için en fazla iki içerik onarımı
          yapılır. OpenRouter veya Anthropic HTTP 429 yanıtında aynı çizim isteği 10, 20 ve 35 sn
          sonra yeniden denenebilir; HTTP 503 doğrudan bildirilir. Gemini 429/503 için kendi sabit
          model yedeklerini hemen dener; çizim zincirinin son yanıtı 429 ise aynı beklemelerle
          yeniden denenebilir. Model erişimi ve fiyatı sağlayıcı hesabına bağlıdır. Senaryoda bu
          çizim beklemeleri kullanılmaz. Durdur beklemeyi de keser.
        </p>
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
          disabled={
            busy ||
            ((provider === 'openrouter' || provider === 'auto') && !openrouterModel.trim()) ||
            (provider === 'anthropic' && !anthropicModel.trim())
          }
          onClick={() =>
            void run(async () => {
              setSettings(
                await post<Settings>('/settings/svg-planner', {
                  provider,
                  ...(openrouterModel.trim() ? { openrouterModel: openrouterModel.trim() } : {}),
                  ...(anthropicModel.trim() ? { anthropicModel: anthropicModel.trim() } : {}),
                }),
              );
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
