import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { ScientificPlate } from '../../composition/ScientificPlate';
import { templates, templateNames, type SvgPlan } from '../../shared/svg';
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
  onChange,
}: {
  plan: SvgPlan;
  seconds: number;
  onChange: (v: SvgPlan) => void;
}) {
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
  const edit = (patch: Partial<SvgPlan>) => onChange({ ...plan, ...patch });
  const labels =
    plan.template === 'ProcessFlowScene'
      ? 'Üç adım adı gir; aralarına | koy.'
      : plan.template === 'ComparisonScene' || plan.template === 'FocusCalloutScene'
        ? 'İki kısa etiket gir; aralarına | koy.'
        : 'Şemanın altında görünen kısa açıklama.';
  return (
    <div className="svg-editor">
      <div className="svg-monitor">
        <div className="svg-paper">
          <ScientificPlate plan={plan} frames={frames} frame={Math.min(frame, frames - 1)} />
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
            onChange={(e) => edit({ template: e.target.value as SvgPlan['template'] })}
          >
            {templates.map((t) => (
              <option key={t} value={t}>
                {templateNames[t]}
              </option>
            ))}
          </select>
        </label>
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
            maxLength={72}
            onChange={(e) => edit({ title: e.target.value })}
            required
          />
        </label>
        <label>
          Alt başlık / etiketler
          <input
            value={plan.subtitle}
            maxLength={160}
            onChange={(e) => edit({ subtitle: e.target.value })}
          />
          <small className="help">{labels}</small>
        </label>
        <Numeric
          label="Başlangıç değeri"
          value={plan.fromValue}
          change={(fromValue) => edit({ fromValue })}
        />
        <Numeric
          label="Bitiş değeri"
          value={plan.toValue}
          change={(toValue) => edit({ toValue })}
        />
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
        <p className="help">
          Sayılar termometre ve karşılaştırmada, hava durumu kesitte kullanılır. Onaydan önce
          bilimsel değerleri kontrol et.
        </p>
      </div>
    </div>
  );
}
