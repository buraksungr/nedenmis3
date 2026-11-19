import React, { useId } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  layers,
  type Geometry,
  type Layer,
  type VectorFrame,
  type VectorRef,
} from '../shared/vector';
const attrs: Record<string, string> = {
  'fill-rule': 'fillRule',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'font-size': 'fontSize',
  'font-family': 'fontFamily',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
};
// Only the server's parsed display list reaches here. No innerHTML, external href or CSS clock.
function shape(n: Geometry, scope: string, key: number): React.ReactElement {
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.attrs))
    a[attrs[k] ?? k] =
      k === 'id' ? scope + v : v.startsWith('url(#') ? `url(#${scope}${v.slice(5)}` : v;
  return React.createElement(
    n.tag,
    { ...a, key },
    n.text ?? n.children.map((c, i) => shape(c, scope, i)),
  );
}
export function pose(l: Layer, frame: number, fx: VectorRef['fx']) {
  const t = frame / 30,
    at = (x: number, y: number, k: number) =>
      `translate(${540 + x} ${675 + y}) scale(${k}) translate(-540 -675)`;
  if (l === 'layer-bg')
    return {
      transform: at(
        9 * Math.sin(t * 0.37),
        7 * Math.sin(t * 0.44),
        1.055 + 0.012 * Math.sin(t * 0.32),
      ),
      opacity: 1,
    };
  if (l === 'layer-main')
    return {
      transform: at(4 * Math.sin(t * 0.72), 8 * Math.sin(t * 0.91), 1 + 0.009 * Math.sin(t * 1.1)),
      opacity: 1,
    };
  const wave = Math.sin(t * 1.85);
  return {
    transform: at(
      fx === 'drift' ? 28 * wave : 0,
      fx === 'rise' ? -26 * wave : fx === 'fall' ? 26 * wave : fx === 'drift' ? 5 * wave : 0,
      fx === 'pulse' ? 1 + 0.033 * wave : 1 + 0.008 * wave,
    ),
    opacity: 0.84 + 0.16 * Math.sin(t * 2.3 + 0.6),
  };
}
export function VectorScene({ scene, frame }: { scene: VectorFrame; frame: number }) {
  const scope = 'v' + useId().replace(/[^\w-]/g, '') + '-',
    { ref, drawing } = scene;
  return (
    <svg
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{ display: 'block', background: '#101827', fontFamily: 'Arial, sans-serif' }}
      role="img"
      aria-label={ref.title}
      data-vector-scene={ref.digest}
    >
      <rect width="1080" height="1920" fill="#101827" />
      <svg x="0" y="0" width="1080" height="1350" viewBox="0 0 1080 1350" overflow="hidden">
        <defs>
          {drawing.defs.map((n, i) => shape(n, scope, i))}
          <linearGradient id={scope + '-scrim'} x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop stopColor="#101827" stopOpacity=".76" />
            <stop offset="1" stopColor="#101827" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={scope + '-edge'} x2="0" y2="1">
            <stop stopColor="#101827" stopOpacity="0" />
            <stop offset="1" stopColor="#101827" />
          </linearGradient>
        </defs>
        {layers.map((l, i) => (
          <g key={l} data-vector-layer={l} {...pose(l, frame, ref.fx)}>
            {shape(drawing.layers[l], scope, i)}
          </g>
        ))}
        <rect width="1080" height="225" fill={`url(#${scope}-scrim)`} />
        <rect y="1250" width="1080" height="101" fill={`url(#${scope}-edge)`} />
      </svg>
      <text
        x="540"
        y="131"
        fill="#fff7e8"
        textAnchor="middle"
        fontSize={Math.min(80, Math.floor(1760 / ref.title.length))}
        fontWeight="700"
        letterSpacing="-.9"
      >
        {ref.title}
      </text>
    </svg>
  );
}
export function AnimatedVector({
  scene,
  opening = false,
}: {
  scene: VectorFrame;
  opening?: boolean;
}) {
  const frame = useCurrentFrame();
  return <VectorScene scene={scene} frame={opening ? 0 : frame} />;
}
