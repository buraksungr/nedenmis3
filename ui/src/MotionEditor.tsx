import { useEffect, useState } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { ObjectScene } from '../../composition/ObjectScene';
import type { ObjectFrame } from '../../shared/object-motion';
import type { Project, Scene } from '../../shared/schema';
import { api, Button } from './lib';
export function MotionPreview({ project, s, frame }: { project: string; s: Scene; frame: number }) {
  const [data, setData] = useState<ObjectFrame>(),
    [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    setError('');
    if (s.choreography)
      api<ObjectFrame>(`/projects/${project}/motion/${s.id}`, { signal: c.signal })
        .then((v) => {
          if (!c.signal.aborted) setData(v);
        })
        .catch(() => {
          if (!c.signal.aborted) setError('Çizim okunamadı; bu sahneyi yeniden üretebilirsin.');
        });
    return () => c.abort();
  }, [project, s.id, s.choreography?.digest]);
  return data && data.ref.digest === s.choreography?.digest ? (
    <ObjectScene scene={data} frame={frame} />
  ) : (
    <span className="help">{error || 'SVG yükleniyor…'}</span>
  );
}
export function MotionEditor({
  p,
  s,
  locked,
  draw,
}: {
  p: Project;
  s: Scene;
  locked: boolean;
  draw: (hint: string) => void;
}) {
  const [frame, setFrame] = useState(0),
    [playing, play] = useState(false),
    [hint, setHint] = useState('');
  const frames = Math.max(2, Math.ceil((p.assets[s.id]?.voice?.duration ?? s.seconds) * 30));
  useEffect(() => {
    if (!playing) return;
    const start = performance.now(),
      from = frame,
      id = window.setInterval(
        () => setFrame((from + Math.floor((performance.now() - start) * 0.03)) % frames),
        33,
      );
    return () => clearInterval(id);
  }, [playing, frames]);
  return (
    <div className="cinema-editor">
      <div className="cinema-monitor">
        <div className="cinema-frame">
          <MotionPreview project={p.id} s={s} frame={frame} />
        </div>
        <input
          aria-label="Nesne animasyonu karesi"
          type="range"
          min={0}
          max={frames - 1}
          value={frame}
          onChange={(e) => {
            play(false);
            setFrame(+e.target.value);
          }}
        />
      </div>
      <div className="cinema-tools">
        <small className="tiny-cap">SABİT KAMERA · SAF SVG</small>
        <h3>{s.choreography?.title}</h3>
        <p>
          {s.choreography?.objects} hareketli nesne · {s.choreography?.actors} özne örneği
        </p>
        <Button
          aria-label={playing ? 'Animasyonu duraklat' : 'Nesneleri oynat'}
          onClick={() => play(!playing)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />} Önizleme
        </Button>
        <label>
          Çizim yönlendirmesi (isteğe bağlı)
          <input
            maxLength={400}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            disabled={locked}
            placeholder="Örneğin: Tünele inen karıncaları büyüt."
          />
        </label>
        <Button disabled={locked} onClick={() => draw(hint.trim())}>
          <RefreshCw size={14} />
          Bu sahneyi yeniden üret
        </Button>
      </div>
    </div>
  );
}
