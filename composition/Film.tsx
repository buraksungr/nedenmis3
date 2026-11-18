import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Img,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { groups } from '../shared/captions';
import type { Scene, Word } from '../shared/schema';
export type FilmProps = {
  image: string;
  next: string;
  scene: Scene;
  words: Word[];
  sentenceCaptions?: boolean;
  frames: number;
  intensity: string;
  subtitleSize: number;
  highlight: boolean;
};
const noise = (n: number) => {
  const a = Math.sin(n * 12.9898 + 4.233) * 43758.5453;
  return a - Math.floor(a);
};
const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
function optics(camera: Scene['camera'], p: number, k: number) {
  switch (camera) {
    case 'push':
      return `scale(${1.025 + p * 0.12 * k})`;
    case 'pull':
      return `scale(${1.03 + (1 - p) * 0.14 * k})`;
    case 'pan':
      return `scale(1.18) translateX(${(p - 0.5) * 10 * k}%)`;
    case 'tilt':
      return `scale(1.19) translateY(${(0.5 - p) * 10 * k}%)`;
    case 'track':
      return `scale(1.17) translate(${(p - 0.5) * 7 * k}%,${(0.5 - p) * 4 * k}%) rotate(${(p - 0.5) * 0.7}deg)`;
    default:
      return `scale(${1.05 + p * 0.025 * k})`;
  }
}
function Atmosphere({ scene, frame, k }: { scene: Scene; frame: number; k: number }) {
  const fx = scene.effect;
  if (fx === 'none') return null;
  const t = frame / 30;
  if (fx === 'fog' || fx === 'rays' || fx === 'water')
    return (
      <AbsoluteFill style={{ overflow: 'hidden', opacity: 0.18 * k, mixBlendMode: 'screen' }}>
        {Array.from({ length: fx === 'rays' ? 5 : 8 }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${fx === 'rays' ? -25 : noise(i) * 90}%`,
              left: `${noise(i + 8) * 105 - 15}%`,
              width: fx === 'rays' ? '9%' : '65%',
              height: fx === 'rays' ? '150%' : '16%',
              borderRadius: '50%',
              background:
                fx === 'rays'
                  ? 'linear-gradient(white,transparent)'
                  : 'radial-gradient(ellipse,#c6e9eb,transparent 70%)',
              filter: 'blur(15px)',
              transform: `translate(${Math.sin(t * 0.14 + i) * 40}px,${Math.cos(t * 0.1 + i) * 22}px) rotate(${fx === 'rays' ? 23 : -6}deg)`,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill>
      {Array.from({ length: Math.round(22 * k) }, (_, i) => {
        const n = noise(i + 1),
          sz = (fx === 'snow' ? 4 : fx === 'bubbles' ? 7 : 2) + noise(i + 2) * 7;
        const y =
          ((noise(i + 82) * 110 +
            t *
              (fx === 'snow' ? 4 : fx === 'bubbles' ? -4 : fx === 'stars' ? 0 : -0.7) *
              (n + 0.4) +
            220) %
            110) -
          5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${n * 100 + Math.sin(i + t * 0.6) * 1.4}%`,
              top: `${y}%`,
              width: sz,
              height: sz,
              borderRadius: '50%',
              background: fx === 'bubbles' ? 'transparent' : fx === 'dust' ? '#f1d6a2' : '#f0f7f6',
              border: fx === 'bubbles' ? '1.4px solid #d2f2f9' : undefined,
              opacity: (0.16 + n * 0.48) * (fx === 'stars' ? 0.65 + Math.sin(t + i) * 0.3 : 1),
              filter: i % 4 === 0 ? 'blur(2px)' : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
function Details({ s, t, p, k }: { s: Scene; t: number; p: number; k: number }) {
  if (s.object === 'none') return null;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1080 1920"
      style={{ position: 'absolute', inset: 0 }}
    >
      {s.object === 'trail' &&
        [0, 1, 2].map((v) => {
          const x = 90 + v * 123 + t * (15 + v) * k;
          return (
            <g
              key={v}
              transform={`translate(${x} ${1240 + Math.sin(x / 160) * 30}) rotate(${Math.cos(x / 160) * 10}) scale(${0.7 + v * 0.15})`}
              fill="#462c1d"
              stroke="#39251c"
              strokeWidth="2.2"
            >
              <ellipse cx="-14" cy="0" rx="11" ry="7" />
              <ellipse rx="7" ry="4" />
              <circle cx="11" cy="-1" r="5" />
              {[-1, 1].map((dir) => (
                <g key={dir}>
                  {[-1, 0, 1].map((j) => (
                    <path
                      key={j}
                      fill="none"
                      d={`M ${j * 4} 1 l ${j * 5 + Math.sin(t * 9 + j) * 4} ${dir * 7} l ${j * 5 - 2} ${dir * 4}`}
                    />
                  ))}
                </g>
              ))}
              <path d="M 14 -3 l 6 -7 6 0 M 15 0 l 7 -2 5 3" fill="none" />
            </g>
          );
        })}
      {s.object === 'orbit' && (
        <g transform="rotate(-18 540 880)" fill="none" stroke="#ffe2af">
          <ellipse cx="540" cy="880" rx="420" ry="114" opacity=".3" strokeDasharray="8 12" />
          <circle
            cx={540 + 420 * Math.cos(t * 0.27)}
            cy={880 + 114 * Math.sin(t * 0.27)}
            r="7"
            fill="#fff1cd"
          />
        </g>
      )}
      {(s.object === 'current' || s.object === 'arrow' || s.object === 'reveal') && (
        <g opacity=".68" fill="none" stroke="#dceee0" strokeWidth="3" strokeLinecap="round">
          {[0, 1, 2].slice(0, s.object === 'current' ? 3 : 1).map((i) => (
            <path
              key={i}
              d={`M 130 ${1160 + i * 52} Q 390 ${1250 + i * 52} 620 ${1020 + i * 52} T 930 ${930 + i * 52}`}
              pathLength="100"
              strokeDasharray={s.object === 'current' ? '3 8' : '100'}
              strokeDashoffset={s.object === 'current' ? -t * 9 : 100 - Math.min(1, p * 1.7) * 100}
            />
          ))}
          {s.object === 'arrow' && p > 0.6 && <path d="M 907 913 L 933 930 L 906 944" />}
        </g>
      )}
    </svg>
  );
}
export function Film({
  image,
  next,
  scene,
  words,
  intensity,
  subtitleSize,
  highlight,
  sentenceCaptions = false,
}: FilmProps) {
  const f = useCurrentFrame(),
    { durationInFrames, fps } = useVideoConfig(),
    p = f / Math.max(1, durationInFrames - 1),
    k = { Düşük: 0.58, Orta: 1, Yüksek: 1.35 }[intensity] ?? 1,
    motion = Math.min(k * scene.motion, 1.45);
  const cam = optics(scene.camera, p, motion),
    t = f / fps;
  const cap = (sentenceCaptions ? words.map((w) => [w]) : groups(words)).find(
    (g) => t >= g[0].start && t < g[g.length - 1].end + (sentenceCaptions ? 0 : 0.04),
  );
  const edge = Math.min(10, Math.floor(durationInFrames / 4)),
    fade = edge ? Math.max(0, (f - durationInFrames + edge + 1) / edge) : 0;
  return (
    <AbsoluteFill style={{ background: '#101514', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: cam,
          filter: scene.camera === 'focus' ? `blur(${(1 - Math.min(1, p * 3)) * 3}px)` : undefined,
        }}
      >
        <Img src={image} style={imgStyle} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: cam + ` translateX(${Math.sin(p * Math.PI) * 8 * motion}px)`,
          maskImage: 'linear-gradient(transparent 66%,black 100%)',
          WebkitMaskImage: 'linear-gradient(transparent 66%,black 100%)',
        }}
      >
        <Img src={image} style={imgStyle} />
      </AbsoluteFill>
      <Atmosphere scene={scene} frame={f} k={k} />
      <Details s={scene} t={t} p={p} k={k} />
      {next && fade > 0 && scene.transition !== 'cut' && (
        <AbsoluteFill
          style={{
            opacity: scene.transition === 'iris' ? 1 : fade,
            clipPath: scene.transition === 'iris' ? `circle(${fade * 120}% at 50% 44%)` : undefined,
            transform:
              scene.transition === 'drift' ? `translateX(${(1 - fade) * 6}%)` : 'scale(1.025)',
          }}
        >
          <Img src={next} style={imgStyle} />
        </AbsoluteFill>
      )}
      {cap && (
        <div
          style={{
            position: 'absolute',
            left: '9%',
            right: '9%',
            bottom: '14%',
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: subtitleSize,
            fontWeight: 650,
            lineHeight: 1.38,
            color: '#fff',
            opacity: Math.min(1, (t - cap[0].start) * 18 + 0.42),
            textShadow: '0 2px 6px #000',
          }}
        >
          <span
            style={{
              background: 'rgba(10,15,14,.82)',
              padding: '8px 15px',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
              borderRadius: 5,
            }}
          >
            {cap.map((w, i) => (
              <React.Fragment key={i}>
                {i ? ' ' : ''}
                <span
                  style={{ color: highlight && t >= w.start && t < w.end ? '#c3efa5' : 'inherit' }}
                >
                  {w.text}
                </span>
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
}
const defaults: FilmProps = {
  image: '',
  next: '',
  scene: {} as Scene,
  words: [],
  frames: 30,
  intensity: 'Orta',
  subtitleSize: 56,
  highlight: true,
};
registerRoot(() => (
  <Composition
    id="DocumentaryScene"
    component={Film}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({ durationInFrames: props.frames })}
  />
));
