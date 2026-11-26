import React, { useId } from 'react';
import { useCurrentFrame } from 'remotion';
import { layers, type Geometry, type VectorFrame } from '../shared/vector';
const attrs: Record<string, string> = {
  'fill-rule': 'fillRule',
  'paint-order': 'paintOrder',
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
export function svgAttrs(n: Geometry, scope: string) {
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.attrs))
    a[attrs[k] ?? k] =
      k === 'id' ? scope + v : v.startsWith('url(#') ? `url(#${scope}${v.slice(5)}` : v;
  return a;
}
function shape(n: Geometry, scope: string, key: number): React.ReactElement {
  // Older signed text had no bounded size or position. Keep the archive readable
  // without allowing an old title/label to cover the new caption area.
  if (n.tag === 'text') return <g key={key} />;
  const a = svgAttrs(n, scope);
  return React.createElement(
    n.tag,
    { ...a, key },
    n.text ?? n.children.map((c, i) => shape(c, scope, i)),
  );
}
// Signed archive drawing: no synthetic whole-layer pan, zoom, or drift.
export function VectorScene({ scene }: { scene: VectorFrame; frame: number }) {
  const scope = 'v' + useId().replace(/[^\w-]/g, '') + '-',
    { ref, drawing } = scene;
  return (
    <svg
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{ display: 'block', background: '#18231f', fontFamily: 'Arial, sans-serif' }}
      role="img"
      aria-label={ref.title}
      data-vector-scene={ref.digest}
    >
      <defs>
        {drawing.defs.map((n, i) => shape(n, scope, i))}
        <clipPath id={scope + 'safe-frame'}>
          <rect x="0" y="0" width="1080" height="1460" />
        </clipPath>
      </defs>
      {layers.map((l, i) => (
        <g
          key={l}
          data-vector-layer={l}
          clipPath={l === 'layer-bg' ? undefined : `url(#${scope}safe-frame)`}
        >
          <svg
            width="1080"
            height="1920"
            viewBox={drawing.viewBox ?? '0 0 1080 1350'}
            preserveAspectRatio="xMidYMid slice"
          >
            {shape(drawing.layers[l], scope, i)}
          </svg>
        </g>
      ))}
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
