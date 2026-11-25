import React, { useId } from 'react';
import { spring } from 'remotion';
import type { ObjectFrame, AnimKind } from '../shared/object-motion';
import type { Geometry } from '../shared/vector';
import { svgAttrs } from './VectorScene';
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Object-local timeline. All times in seconds; all distances and pivots in this node's SVG units.
 * Nothing depends on wall time, DOM measurement, the browser animation clock or a random seed. */
export function objectPose(n: Geometry, frame: number, fps: number) {
  const a = n.attrs,
    kind = a['data-anim'] as AnimKind,
    value = (k: string, d: number) => Number(a['data-' + k] ?? d),
    delay = value('delay', 0),
    duration = value(
      'duration',
      kind === 'wiggle' ? 0.64 : kind === 'swing' ? 2.2 : kind === 'pop' ? 0.65 : 2.8,
    ),
    elapsed = Math.max(0, frame / fps - delay),
    progress = clamp(elapsed / duration),
    phase = value('phase', 0),
    cycle = (elapsed / duration + phase) % 1,
    wave = Math.sin(cycle * Math.PI * 2),
    cx = value('pivot-x', Number(a.cx ?? a.x ?? 0) + (a.width ? Number(a.width) / 2 : 0)),
    cy = value('pivot-y', Number(a.cy ?? a.y ?? 0) + (a.height ? Number(a.height) / 2 : 0)),
    around = (s: number) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`,
    dx = value('dx', 0),
    dy = value('dy', 0);
  switch (kind) {
    case 'move':
      return { transform: `translate(${dx * progress} ${dy * progress})` };
    case 'fall':
    case 'rise': {
      const y = (kind === 'rise' ? -1 : 1) * Math.abs(dy || 180);
      return {
        transform: `translate(${cycle * dx} ${cycle * y})`,
        opacity: frame / fps < delay ? 0 : Math.min(1, cycle * 12, (1 - cycle) * 12),
      };
    }
    case 'pulse':
      return { transform: around(0.7 + 0.7 * cycle), opacity: Math.max(0.05, 1 - cycle) };
    case 'wiggle':
    case 'swing':
      return {
        transform: `rotate(${wave * value('angle', kind === 'wiggle' ? 13 : 21)} ${cx} ${cy})`,
      };
    case 'draw':
      return { reveal: progress };
    case 'pop': {
      const k =
        elapsed === 0
          ? 0
          : spring({
              frame: elapsed * fps,
              fps,
              durationInFrames: Math.max(1, Math.round(duration * fps)),
              config: { damping: 10, stiffness: 155, mass: 1 },
            });
      return { transform: around(k), opacity: clamp(k * 3) };
    }
    default:
      return {};
  }
}
function object(
  n: Geometry,
  scope: string,
  rigScope: string,
  key: number,
  frame: number,
  fps: number,
  reveal?: number,
): React.ReactElement {
  const a = svgAttrs(n, scope);
  for (const k of Object.keys(a)) if (k.startsWith('data-')) delete a[k];
  if (n.tag === 'use') a.href = '#' + rigScope + 'subject-main';
  const animated = !!n.attrs['data-anim'],
    pose = animated ? objectPose(n, frame, fps) : {},
    trace = pose.reveal ?? reveal,
    staticTransform = a.transform;
  if (animated) delete a.transform;
  if (trace !== undefined && n.tag !== 'g' && n.tag !== 'use') {
    a.pathLength = '1';
    a.strokeDasharray = '1 1';
    a.strokeDashoffset = String(1 - trace);
  }
  const el = React.createElement(
    n.tag,
    { ...a, key },
    n.children.length
      ? n.children.map((c, i) => object(c, scope, rigScope, i, frame, fps, trace))
      : undefined,
  );
  if (!animated) return el;
  return (
    <g
      key={key}
      transform={staticTransform}
      data-object={n.attrs.id ?? ''}
      data-anim={n.attrs['data-anim']}
    >
      <g transform={pose.transform} opacity={pose.opacity}>
        {el}
      </g>
    </g>
  );
}
export function ObjectScene({
  scene,
  frame,
  fps = 30,
}: {
  scene: ObjectFrame;
  frame: number;
  fps?: number;
}) {
  const scope = 'm' + useId().replace(/[^\w-]/g, '') + '-',
    r = scope + 'rig-',
    { stage } = scene;
  return (
    <svg
      data-motion-stage={scene.ref.digest}
      role="img"
      aria-label={scene.ref.title}
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{ display: 'block', background: '#112334' }}
    >
      <defs>
        {stage.children.flatMap((n) => n.children).map((n, i) => object(n, r, r, i, frame, fps))}
        <linearGradient id={scope + 'scrim'} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#081528" stopOpacity=".82" />
          <stop offset=".2" stopColor="#081528" stopOpacity="0" />
          <stop offset=".68" stopColor="#081528" stopOpacity="0" />
          <stop offset="1" stopColor="#081528" stopOpacity=".87" />
        </linearGradient>
      </defs>
      <defs>
        <clipPath id={scope + 'safe-frame'}>
          <rect x="0" y="220" width="1080" height="1240" />
        </clipPath>
      </defs>
      {/* Clip in output coordinates, outside the fitted SVG. This also constrains
          paths, transforms and every animated frame, even with an alternate viewBox. */}
      <g clipPath={`url(#${scope}safe-frame)`}>
        <svg
          data-fixed-camera=""
          width="1080"
          height="1920"
          viewBox={stage.attrs.viewBox}
          preserveAspectRatio="xMidYMid slice"
        >
          {stage.children.map((n, i) => object(n, scope + 'set-', r, i, frame, fps))}
        </svg>
      </g>
      <rect width="1080" height="1920" fill={`url(#${scope}scrim)`} />
    </svg>
  );
}
