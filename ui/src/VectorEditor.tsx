import { useEffect, useState } from 'react';
import { Paintbrush } from 'lucide-react';
import { VectorScene } from '../../composition/VectorScene';
import type { VectorFrame, VectorRef } from '../../shared/vector';
import { api, Button } from './lib';
export function VectorPreview({
  project,
  art,
  frame,
}: {
  project: string;
  art: VectorRef;
  frame: number;
}) {
  const [v, setV] = useState<VectorFrame>(),
    [err, setErr] = useState('');
  useEffect(() => {
    const c = new AbortController();
    setV(undefined);
    setErr('');
    api<VectorFrame>(`/projects/${project}/illustrations/${art.digest}`, { signal: c.signal })
      .then((x) => {
        if (!c.signal.aborted) setV(x);
      })
      .catch(() => {
        if (!c.signal.aborted) setErr('Çizim okunamadı; yeniden çizebilirsin.');
      });
    return () => c.abort();
  }, [project, art.digest]);
  return v?.ref.digest === art.digest ? (
    <VectorScene scene={v} frame={frame} />
  ) : (
    <span className="help">{err || 'Çizim yükleniyor…'}</span>
  );
}
export function VectorEditor({
  project,
  art,
  redraw,
  locked,
}: {
  project: string;
  art?: VectorRef;
  redraw: (hint: string) => void;
  locked: boolean;
}) {
  const [hint, setHint] = useState('');
  return (
    <div className="vector-editor">
      {art && (
        <div className="vector-monitor">
          <div className="svg-paper">
            <VectorPreview project={project} art={art} frame={0} />
          </div>
        </div>
      )}
      <div className="form-stack">
        <strong>{art?.title ?? 'Özel vektör çizimi'}</strong>
        <p className="help">
          {art
            ? `${art.provider === 'gemini' ? 'Gemini' : 'OpenRouter'} · ${art.model} · arşiv çizimi · sabit kadraj`
            : 'Yeni çizim doğrulanana kadar varsa önceki görüntü korunur.'}
        </p>
        <label>
          Çizim yönlendirmesi (isteğe bağlı)
          <textarea
            maxLength={400}
            rows={2}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Balinayı yandan çiz, kırmızı kuvvet oklarını büyüt."
          />
        </label>
        <Button disabled={locked} onClick={() => redraw(hint)}>
          <Paintbrush size={15} />
          Bu sahneyi yeniden çiz
        </Button>
        <small>
          Yalnız bu sahne için modele yeni istek gönderilir. Kayıtlı ses ve zamanlar değişmez.
        </small>
      </div>
    </div>
  );
}
