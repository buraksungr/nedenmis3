import { heading } from '../../shared/vector';
import { useEffect, useState } from 'react';
import { Image, RefreshCw, ScanLine } from 'lucide-react';
import { CinematicPlate, ShotTitle } from '../../composition/CinematicPlate';
import { cameraNames, illustrationPrompt } from '../../shared/cinema';
import type { Project, Scene } from '../../shared/schema';
import { Button, media } from './lib';
export function CinemaShot({
  p,
  s,
  index,
  locked,
  editTitle,
  regenerate,
  plan,
}: {
  p: Project;
  s: Scene;
  index: number;
  locked: boolean;
  editTitle: (title: string) => void;
  regenerate: (hint: string) => void;
  plan: () => void;
}) {
  const [hint, setHint] = useState(''),
    [frame, setFrame] = useState(0),
    [label, setLabel] = useState(s.cinema?.title ?? '');
  const art = p.assets[s.id]?.image,
    shot = s.cinema,
    subject = p.cinema?.subject;
  useEffect(() => {
    setFrame(0);
  }, [art?.file]);
  useEffect(() => setLabel(shot?.title ?? ''), [shot?.title]);
  if (!shot || !subject)
    return (
      <div className="scene-work">
        <span>Bu sahnenin başlığı ve İngilizce görsel istemi henüz hazır değil.</span>
        <Button disabled={locked} onClick={plan}>
          Bu sahneyi planla
        </Button>
      </div>
    );
  return (
    <div className="cinema-editor">
      <div className="cinema-monitor">
        <div className="cinema-frame">
          {art ? (
            <>
              <CinematicPlate shot={{ index, title: shot.title }} frame={frame} frames={150}>
                <img src={media(p, art.file)} alt={shot.title} />
              </CinematicPlate>
              <ShotTitle title={shot.title} />
            </>
          ) : (
            <div className="cinema-empty">
              <Image size={24} />
              <small>9:16</small>
            </div>
          )}
        </div>
        {art && (
          <input
            aria-label="Kamera önizleme karesi"
            type="range"
            min={0}
            max={149}
            value={frame}
            onChange={(e) => setFrame(+e.target.value)}
          />
        )}
      </div>
      <div className="cinema-tools">
        <small className="tiny-cap">BİLİM İLLÜSTRASYONU · 9:16</small>
        <h3>{shot.title}</h3>
        <div className="scene-format">
          <ScanLine size={14} />
          {cameraNames[index % 4]} · Yumuşak geçiş
        </div>
        <details>
          <summary>Görsel istemini göster</summary>
          <p lang="en">{illustrationPrompt(subject, art?.illustration?.brief ?? shot.brief)}</p>
        </details>
        <details>
          <summary>Başlığı düzenle</summary>
          <label className="small-label">
            Ekran başlığı
            <input
              maxLength={40}
              value={label}
              disabled={locked}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <Button
            disabled={locked || !heading.safeParse(label).success || label.trim() === shot.title}
            onClick={() => editTitle(label.trim())}
          >
            Başlığı kaydet
          </Button>
          <p className="help">
            Anlatımla örtüşen 2–3 sözcük kullan. Görsel ve ses değişmez; storyboard yeniden onay
            ister.
          </p>
        </details>
        {p.boardApproval ? (
          <>
            <label className="small-label">
              Görsel yönlendirmesi (isteğe bağlı)
              <input
                maxLength={400}
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Yeraltındaki karınca tünellerini daha yakından göster."
                disabled={locked}
              />
            </label>
            <Button disabled={locked} onClick={() => regenerate(hint.trim())}>
              <RefreshCw size={14} />
              {art ? 'Bu sahneyi yeniden üret' : 'Bu sahne için görsel üret'}
            </Button>
          </>
        ) : (
          <p className="help">
            Storyboard onayından sonra görseli üretip yalnız bu sahneyi yönlendirebilirsin.
          </p>
        )}
      </div>
    </div>
  );
}
