import React, { useId } from 'react';
import { spring } from 'remotion';
import type { ObjectFrame, AnimKind } from '../shared/object-motion';
import type { Geometry } from '../shared/vector';
import { I, MAX_MOVE_PIXELS, matrix, mul, type Matrix } from '../shared/svg-transform';
import { svgAttrs } from './VectorScene';
import { fittedSafeRect } from './frame';
const clamp = (v: number) => Math.min(1, Math.max(0, v));
type Pose = {
  transform?: string;
  opacity?: number;
  reveal?: number;
  flow?: number;
  scale?: number;
};
/** Object-local timeline. All times in seconds; all distances and pivots in this node's SVG units.
 * Nothing depends on wall time, DOM measurement, the browser animation clock or a random seed. */
export function objectPose(
  n: Geometry,
  frame: number,
  fps: number,
  moveFactor = 1,
  legacy = false,
): Pose {
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
      return {
        transform: `translate(${dx * moveFactor * progress} ${dy * moveFactor * progress})`,
      };
    case 'fall':
    case 'rise': {
      const y = (kind === 'rise' ? -1 : 1) * Math.abs(dy || 180);
      return {
        transform: `translate(${cycle * dx} ${cycle * y})`,
        opacity: frame / fps < delay ? 0 : Math.min(1, cycle * 12, (1 - cycle) * 12),
      };
    }
    case 'pulse':
      // Existing objects-v1 archives were signed with a growing, fading ring.
      // Keep its exact frame-by-frame behavior rather than reinterpreting it.
      if (legacy)
        return { transform: around(0.7 + 0.7 * cycle), opacity: Math.max(0.05, 1 - cycle) };
    // fall through: new pulse and dilate share centered, continuously visible scaling.
    case 'dilate':
      // The renderer applies this to a fill-box-centered wrapper. A path or group
      // has no reliable cx/cy, so guessing its pivot from attributes causes drift.
      return { scale: 1 + value('amplitude', kind === 'dilate' ? 0.22 : 0.12) * wave };
    case 'flow':
      return { flow: cycle };
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
type StrokeEffect = { kind: 'draw' | 'flow'; value: number };
type MotionContext = { transform: Matrix; distance: number; fit: number; legacy: boolean };
function object(
  n: Geometry,
  scope: string,
  rigScope: string,
  key: number,
  frame: number,
  fps: number,
  context: MotionContext,
  inheritedEffect?: StrokeEffect,
): React.ReactElement {
  const a = svgAttrs(n, scope);
  for (const k of Object.keys(a)) if (k.startsWith('data-')) delete a[k];
  if (n.tag === 'text' && n.attrs['data-keyword'] === 'true') a['data-science-keyword'] = '';
  if (n.tag === 'use') a.href = '#' + rigScope + 'subject-main';
  const animated = !!n.attrs['data-anim'],
    local = mul(context.transform, matrix(n.attrs.transform)),
    dx = Number(n.attrs['data-dx'] ?? 0),
    dy = Number(n.attrs['data-dy'] ?? 0),
    requested =
      n.attrs['data-anim'] === 'move'
        ? Math.hypot(local[0] * dx + local[2] * dy, local[1] * dx + local[3] * dy) * context.fit
        : 0,
    distance = Number.isFinite(requested) ? requested : Infinity,
    remaining = Math.max(0, MAX_MOVE_PIXELS - context.distance),
    // v2 reserves the ancestors' full displacement, so nested moves cannot add
    // up to more than 240 output pixels after authored scale and rotation. v1
    // deliberately retains its signed, unbounded movement for archive playback.
    factor = context.legacy
      ? 1
      : distance === Infinity
        ? 0
        : distance
          ? Math.min(1, remaining / distance)
          : 1,
    pose: Pose = animated ? objectPose(n, frame, fps, factor, context.legacy) : {},
    effect: StrokeEffect | undefined =
      pose.reveal !== undefined
        ? { kind: 'draw', value: pose.reveal }
        : pose.flow !== undefined
          ? { kind: 'flow', value: pose.flow }
          : inheritedEffect,
    staticTransform = a.transform,
    childTransform =
      pose.scale !== undefined
        ? mul(local, [pose.scale, 0, 0, pose.scale, 0, 0])
        : pose.transform
          ? mul(local, matrix(pose.transform))
          : local,
    childContext = {
      transform: childTransform,
      distance: context.distance + (distance === Infinity ? remaining : distance * factor),
      fit: context.fit,
      legacy: context.legacy,
    };
  if (animated) delete a.transform;
  if (
    effect &&
    (context.legacy && effect.kind === 'draw'
      ? n.tag !== 'g' && n.tag !== 'use'
      : ['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse'].includes(n.tag))
  ) {
    a.pathLength = '1';
    a.strokeDasharray = effect.kind === 'draw' ? '1 1' : '0.22 0.12';
    a.strokeDashoffset = String(effect.kind === 'draw' ? 1 - effect.value : -0.34 * effect.value);
  }
  const el = React.createElement(
    n.tag,
    { ...a, key },
    n.text ??
      (n.children.length
        ? n.children.map((c, i) => object(c, scope, rigScope, i, frame, fps, childContext, effect))
        : undefined),
  );
  if (!animated) return el;
  return (
    <g
      key={key}
      transform={staticTransform}
      data-object={n.attrs.id ?? ''}
      data-anim={n.attrs['data-anim']}
    >
      <g
        transform={pose.transform}
        opacity={pose.opacity}
        style={
          pose.scale === undefined
            ? undefined
            : {
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transform: `scale(${pose.scale})`,
              }
        }
      >
        {el}
      </g>
    </g>
  );
}
type Piece = { node: Geometry; zone: 'full' | 'foreground' | 'keyword' };
// Archived scenes can put <defs> inside a group. Bind their subject references
// without cloning unrelated artwork into <defs> or changing its paint order.
function definitions(n: Geometry): Geometry[] {
  return n.tag === 'defs' ? n.children : n.children.flatMap(definitions);
}
/** Preserve the authored paint order, but let an old nested #set span the whole
 * frame. Wrapper attributes are retained when a group needs to be partitioned. */
function pieces(n: Geometry, box: number[], rootChild = false): Piece[] {
  const a = n.attrs;
  if (
    n.tag === 'defs' ||
    ['layer-bg', 'set', 'background'].includes(a.id) ||
    (rootChild &&
      n.tag === 'rect' &&
      (a.width === '100%' || parseFloat(a.width ?? '0') >= box[2]) &&
      (a.height === '100%' || parseFloat(a.height ?? '0') >= box[3]))
  )
    return [{ node: n, zone: 'full' }];
  if (n.tag === 'text') return [{ node: n, zone: 'keyword' }];
  const children = n.children.flatMap((child) => pieces(child, box));
  if (!children.some((child) => child.zone !== 'foreground'))
    return [{ node: n, zone: 'foreground' }];
  return children.map((piece, i) => {
    const attrs = { ...a };
    // A split ancestor is reconstructed around each run. Do not duplicate its DOM id.
    if (i) delete attrs.id;
    return { ...piece, node: { ...n, attrs, children: [piece.node] } };
  });
}
export function ObjectScene({
  scene,
  frame,
  fps = 30,
  showKeywords = true,
}: {
  scene: ObjectFrame;
  frame: number;
  fps?: number;
  showKeywords?: boolean;
}) {
  const scope = 'm' + useId().replace(/[^\w-]/g, '') + '-',
    r = scope + 'rig-',
    { stage } = scene,
    viewBox = stage.attrs.viewBox,
    box = viewBox.split(' ').map(Number),
    initial: MotionContext = {
      transform: I,
      distance: 0,
      fit: Math.max(1080 / box[2], 1920 / box[3]),
      legacy: scene.ref.kind !== 'objects-v2',
    },
    foreground = fittedSafeRect(viewBox, 1460),
    keyword = fittedSafeRect(viewBox, 1220),
    ordered = stage.children
      .flatMap((n) => pieces(n, box, true))
      .filter((piece) => showKeywords || piece.zone !== 'keyword');
  return (
    <svg
      data-motion-stage={scene.ref.digest}
      role="img"
      aria-label={scene.ref.title}
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{ display: 'block', background: '#18231f' }}
    >
      <defs>
        {stage.children.flatMap(definitions).map((n, i) => object(n, r, r, i, frame, fps, initial))}
      </defs>
      {/* Backgrounds and legacy sets remain full bleed. Clips are mapped from output
          pixels into the fitted viewBox, outside all subject/keyword transforms. */}
      <svg
        data-fixed-camera=""
        width="1080"
        height="1920"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <clipPath id={scope + 'safe-frame'} clipPathUnits="userSpaceOnUse">
            <rect {...foreground} />
          </clipPath>
          <clipPath id={scope + 'keyword-frame'} clipPathUnits="userSpaceOnUse">
            <rect {...keyword} />
          </clipPath>
        </defs>
        {ordered.map(({ node, zone }, i) => {
          const art = object(node, scope + 'set-', r, i, frame, fps, initial);
          return zone === 'full' ? (
            art
          ) : (
            <g
              key={i}
              clipPath={`url(#${scope}${zone === 'keyword' ? 'keyword-frame' : 'safe-frame'})`}
            >
              {art}
            </g>
          );
        })}
      </svg>
    </svg>
  );
}
