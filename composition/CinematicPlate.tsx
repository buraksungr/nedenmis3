import React from 'react';
export type Shot = { index: number; title: string };
// Overscan exceeds the largest pan at both ends, including the incoming frame 0.
export function cameraPose(index: number, frame: number, frames: number) {
  const u = Math.max(0, Math.min(1, frame / Math.max(1, frames - 1))),
    t = u * u * (3 - 2 * u);
  let x = 0,
    y = 0,
    k = 1.115;
  switch (index % 4) {
    case 0:
      k = 1.025 + 0.105 * t;
      break;
    case 1:
      k = 1.15 - 0.12 * t;
      break;
    case 2:
      x = -3.5 + 7 * t;
      break;
    case 3:
      y = 2.9 - 5.8 * t;
      break;
  }
  return `translate(${x}%, ${y}%) scale(${k})`;
}
const full: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
// Exactly the same camera/grade and seeded atmosphere in the storyboard and Remotion.
// The caller supplies <Img> during export so decoding participates in Remotion's frame lock.
export function CinematicPlate({
  shot,
  frame,
  frames,
  children,
}: {
  shot: Shot;
  frame: number;
  frames: number;
  children: React.ReactNode;
}) {
  return (
    <div
      data-cinema-plate={shot.index}
      style={{ ...full, overflow: 'hidden', containerType: 'inline-size', background: '#0b1825' }}
    >
      <div data-camera="" style={{ ...full, transform: cameraPose(shot.index, frame, frames) }}>
        {children}
      </div>
      <div data-atmosphere="" style={{ ...full, pointerEvents: 'none' }}>
        {Array.from({ length: 16 }, (_, i) => {
          const phase = (i * 43 + shot.index * 23) % 101,
            t = frame / 30,
            s = 0.16 + (i % 4) * 0.055;
          return (
            <i
              key={i}
              style={{
                position: 'absolute',
                left: `${(phase * 2.3 + 5 + 1.5 * Math.sin(t * 0.3 + i)) % 100}%`,
                top: `${(120 + ((i * 19 + shot.index * 13) % 86) - ((t * (0.4 + (i % 3) * 0.15)) % 100)) % 100}%`,
                width: `${s}cqw`,
                height: `${s}cqw`,
                borderRadius: '50%',
                background: i % 3 ? '#ffdca6' : '#a8f5ec',
                opacity: 0.14 + 0.1 * Math.sin(i + t * 0.5),
                boxShadow: '0 0 .4cqw #ffe0ac55',
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          ...full,
          background:
            'linear-gradient(180deg, rgba(5,13,29,.88) 0%, rgba(5,13,29,.62) 14%, transparent 34%, transparent 59%, rgba(5,13,26,.68) 84%, rgba(4,11,22,.93) 100%), radial-gradient(ellipse at 50% 47%,transparent 45%,rgba(5,13,24,.19) 100%)',
        }}
      />
    </div>
  );
}
export function ShotTitle({ title, opacity = 1 }: { title: string; opacity?: number }) {
  return (
    <div style={{ ...full, containerType: 'inline-size', pointerEvents: 'none', opacity }}>
      <div
        data-shot-title=""
        style={{
          position: 'absolute',
          top: '8%',
          left: '7%',
          width: '86%',
          textAlign: 'center',
          color: '#fff9ee',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
          fontSize: `${Math.min(7.15, 91 / title.length)}cqw`,
          lineHeight: 1.12,
          whiteSpace: 'nowrap',
          textShadow: '0 2px 8px rgba(0,0,0,.55)',
        }}
      >
        {title}
      </div>
    </div>
  );
}
