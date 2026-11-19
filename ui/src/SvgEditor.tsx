import { keywordSchema } from '../../shared/artwork';
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { ScientificPlate } from '../../composition/ScientificPlate';
import { defaultSvg, diagramLabels } from '../../shared/svg-story';
import {
  catalogue,
  ratioUnits,
  scaleUnits,
  icons,
  iconNames,
  titleSchema,
  labelSchema,
  svgPlanSchema,
  templates,
  templateNames,
  type SvgPlan,
} from '../../shared/svg';
import { Button } from './lib';
function Numeric({
  label,
  value,
  change,
}: {
  label: string;
  value: number;
  change: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        step="any"
        min={-1000000}
        max={1000000}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          const n = Number(raw);
          if (raw.trim() && Number.isFinite(n) && Math.abs(n) <= 1000000) {
            change(n);
            setRaw(String(n));
          } else setRaw(String(value));
        }}
      />
    </label>
  );
}
export function SvgEditor({
  plan,
  seconds,
  narration,
  topic,
  onChange,
  artHref,
  lookup,
}: {
  artHref?: string;
  lookup: (keyword: string, mode: 'auto' | 'custom') => Promise<unknown>;
  plan: SvgPlan;
  seconds: number;
  narration: string;
  topic: string;
  onChange: (v: SvgPlan) => void;
}) {
  const [keyword, setKeyword] = useState(plan.iconKeyword ?? '');
  useEffect(() => setKeyword(plan.iconKeyword ?? ''), [plan.iconKeyword, narration]);
  const [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(false),
    frames = Math.max(2, Math.round(seconds * 30));
  useEffect(() => {
    if (!playing) return;
    let id: number;
    const start = performance.now(),
      initial = frame;
    const tick = (t: number) => {
      const next = initial + Math.floor((t - start) * 0.03);
      if (next >= frames - 1) {
        setFrame(frames - 1);
        setPlaying(false);
      } else {
        setFrame(next);
        id = requestAnimationFrame(tick);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, frames]);
  const checked = svgPlanSchema.safeParse(plan);
  const edit = (patch: Partial<SvgPlan>) => onChange({ ...plan, ...patch });
  return (
    <div className="svg-editor">
      <div className="svg-monitor">
        <div className="svg-paper">
          <ScientificPlate
            plan={plan}
            artHref={artHref}
            frames={frames}
            frame={Math.min(frame, frames - 1)}
          />
        </div>
        <div className="actions">
          <Button
            aria-label={playing ? 'Şemayı duraklat' : 'Şemayı oynat'}
            onClick={() => {
              if (!playing && frame >= frames - 1) setFrame(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          <input
            type="range"
            min={0}
            max={frames - 1}
            value={Math.min(frame, frames - 1)}
            aria-label="Şema önizleme karesi"
            onChange={(e) => {
              setPlaying(false);
              setFrame(Number(e.target.value));
            }}
          />
        </div>
      </div>
      <div className="form-grid">
        <label>
          SVG şablonu
          <select
            value={plan.template}
            onChange={(e) => {
              const template = e.target.value as SvgPlan['template'];
              const seed = defaultSvg(narration, 0, topic, template);
              onChange({
                ...seed,
                iconKeyword: plan.iconKeyword,
                artMode: plan.artMode,
                artwork: plan.artwork,
                title: plan.title,
                icon: plan.icon,
                weather: plan.weather,
                accentColor: plan.accentColor,
              });
            }}
          >
            {templates.map((t) => (
              <option key={t} value={t}>
                {templateNames[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bilim ikonu
          <select
            value={plan.icon}
            onChange={(e) =>
              edit({
                icon: e.target.value as SvgPlan['icon'],
                artMode: 'local',
                artwork: undefined,
              })
            }
          >
            {icons.map((i) => (
              <option key={i} value={i}>
                {iconNames[i]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Iconify anahtar kelimesi
          <input
            value={keyword}
            maxLength={48}
            placeholder="Örn. whale, lungs"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        <div>
          <p className="help">
            {plan.artwork
              ? `${plan.artwork.source === 'iconify' ? 'Iconify' : 'Özel çizim'} · ${plan.artwork.name}`
              : '20 yerel ikondan yedek çizim'}
          </p>
          <div className="actions">
            <Button
              disabled={!keywordSchema.safeParse(keyword).success}
              onClick={() => void lookup(keyword, 'auto')}
            >
              İkon ara
            </Button>
            <Button
              disabled={!keywordSchema.safeParse(keyword).success}
              onClick={() => void lookup(keyword, 'custom')}
            >
              Özel çizim iste
            </Button>
          </div>
        </div>
        <label>
          Vurgu rengi
          <input
            type="color"
            value={plan.accentColor}
            onChange={(e) => edit({ accentColor: e.target.value })}
          />
        </label>
        <label>
          Şema başlığı
          <input
            value={plan.title}
            maxLength={60}
            aria-invalid={!titleSchema.safeParse(plan.title).success}
            onChange={(e) => edit({ title: e.target.value })}
            required
          />
          <small className="help">Anlatım cümlesi yerine 2–4 sözcük kullan.</small>
        </label>
        {catalogue[plan.template].slots[0] < catalogue[plan.template].slots[1] && (
          <label>
            Aşama sayısı
            <select
              value={plan.labels.length}
              onChange={(e) => {
                const n = Number(e.target.value),
                  labels = plan.labels.slice(0, n);
                const suggestions = diagramLabels(plan.template, narration, topic, n);
                for (const l of suggestions)
                  if (
                    labels.length < n &&
                    !labels.some((v) => v.toLocaleLowerCase('tr') === l.toLocaleLowerCase('tr'))
                  )
                    labels.push(l);
                edit({ labels });
              }}
            >
              <option value={3}>3 aşama</option>
              <option value={4}>4 aşama</option>
            </select>
          </label>
        )}
        {plan.labels.map((label, i) => (
          <label key={i}>
            {plan.template === 'ProcessFlowScene' || plan.template === 'CycleLoopScene'
              ? 'Adım'
              : plan.template === 'LayerStackScene'
                ? 'Katman'
                : 'Şema etiketi'}{' '}
            {i + 1}
            <input
              value={label}
              maxLength={36}
              required
              aria-invalid={!labelSchema.safeParse(label).success}
              onChange={(e) =>
                edit({ labels: plan.labels.map((v, j) => (i === j ? e.target.value : v)) })
              }
            />
          </label>
        ))}
        {plan.template === 'ComparisonScene' && (
          <label>
            Karşılaştırma türü
            <select
              value={plan.fromValue === null ? 'qualitative' : 'measured'}
              onChange={(e) =>
                edit(
                  e.target.value === 'measured'
                    ? { fromValue: 0, toValue: 0 }
                    : { fromValue: null, toValue: null },
                )
              }
            >
              <option value="qualitative">Nitel · ölçüm yok</option>
              <option value="measured">Sayısal · ölçülen değerler</option>
            </select>
          </label>
        )}
        {(plan.template === 'RatioGaugeScene' || plan.template === 'TimelineScaleScene') && (
          <label>
            Gösterge birimi
            <select
              value={plan.unit}
              onChange={(e) => edit({ unit: e.target.value as SvgPlan['unit'] })}
            >
              {(plan.template === 'RatioGaugeScene' ? ratioUnits : scaleUnits).map((u) => (
                <option key={u} value={u}>
                  {u === 'sıra' ? 'Evre sırası (ölçüm yok)' : u}
                </option>
              ))}
            </select>
          </label>
        )}
        {plan.template === 'RatioGaugeScene' && (
          <Numeric
            label={plan.unit === '%' ? 'Yüzde' : 'Kat sayısı'}
            value={plan.toValue ?? 0}
            change={(toValue) => edit({ toValue })}
          />
        )}
        {(plan.template === 'ComparisonScene' ||
          plan.template === 'ThermometerGaugeScene' ||
          (plan.template === 'TimelineScaleScene' && plan.unit !== 'sıra')) &&
          plan.fromValue !== null &&
          plan.toValue !== null && (
            <>
              <Numeric
                label="Başlangıç değeri"
                value={plan.fromValue}
                change={(fromValue) => edit({ fromValue })}
              />
              {plan.template === 'TimelineScaleScene' && (
                <Numeric
                  label="Orta değer"
                  value={plan.midValue ?? 0}
                  change={(midValue) => edit({ midValue })}
                />
              )}
              <Numeric
                label="Bitiş değeri"
                value={plan.toValue}
                change={(toValue) => edit({ toValue })}
              />
            </>
          )}
        {plan.template === 'CrossSectionScene' && (
          <label>
            Hava durumu
            <select
              value={plan.weather}
              onChange={(e) => edit({ weather: e.target.value as SvgPlan['weather'] })}
            >
              <option value="none">Yok</option>
              <option value="snow">Kar</option>
              <option value="rain">Yağmur</option>
            </select>
          </label>
        )}
        {!checked.success && (
          <p role="status" className="help">
            Onay için başlık, birbirinden farklı etiketler ve gösterge aralığı geçerli olmalı.
          </p>
        )}
        <p className="help">
          {catalogue[plan.template].use}. Onaydan önce etiketleri ve varsa ölçülerin birimlerini
          kontrol et.
        </p>
      </div>
    </div>
  );
}
