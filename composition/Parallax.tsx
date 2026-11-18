import type { CSSProperties } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { Pose } from './motion';

// A single production JPEG today, or two registered plates on the same canvas.
// foreground is a transparent PNG; no segmentation or synthetic second copy.
export type Artwork = string | { background: string; foreground?: string };
const plate: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transformOrigin: 'center',
};
export function Parallax({ source, pose }: { source: Artwork; pose: Pose }) {
  const background = typeof source === 'string' ? source : source.background;
  const foreground = typeof source === 'string' ? undefined : source.foreground;
  const style = (depth: number): CSSProperties => ({
    ...plate,
    transform: `translate(${pose.x * depth}%, ${pose.y * depth}%) rotate(${pose.roll}deg) scale(${pose.scale})`,
    filter: pose.blur > 0 ? `blur(${pose.blur}px)` : undefined,
  });
  return (
    <AbsoluteFill>
      {background && <Img src={background} style={style(foreground ? 0.4 : 1)} />}
      {foreground && <Img src={foreground} style={style(1)} />}
    </AbsoluteFill>
  );
}
