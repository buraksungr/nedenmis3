import { ObjectScene } from './ObjectScene';
import type { ObjectFrame } from '../shared/object-motion';
import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Img,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { captionGroupAt } from '../shared/captions';
import type { Word } from '../shared/schema';
import { dissolveAt } from './fade';
import type { SvgPlan } from '../shared/svg';
import { AnimatedPlate } from './ScientificPlate';
import { CaptionOverlay } from './CaptionOverlay';
import { AnimatedVector } from './VectorScene';
import type { VectorFrame } from '../shared/vector';
export type FilmProps = {
  objects?: ObjectFrame;
  nextObjects?: ObjectFrame;
  title?: string;
  nextTitle?: string;
  vector?: VectorFrame;
  nextVector?: VectorFrame;
  svg?: SvgPlan;
  nextSvg?: SvgPlan;
  artHref?: string;
  nextArtHref?: string;
  image: string;
  next: string | null;
  words: Word[];
  sentenceCaptions?: boolean;
  frames: number;
  subtitleSize: number;
  highlight: boolean;
};
// Old raster assets can still be read locally, always at identity.
const still: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};
export function Film({
  objects,
  nextObjects,
  svg,
  nextSvg,
  vector,
  nextVector,
  artHref,
  nextArtHref,
  image,
  next,
  words,
  subtitleSize,
  highlight,
  sentenceCaptions = false,
}: FilmProps) {
  const f = useCurrentFrame(),
    { durationInFrames, fps } = useVideoConfig(),
    t = f / fps;
  const cap = captionGroupAt(words, t, sentenceCaptions);
  // Do not show the next motion scene under the outgoing scene's subtitles.
  // Preserve the normal crossfade for legacy photo/atlas sequences.
  const motionTransition = !!(objects || nextObjects),
    afterCaption = words.length
      ? Math.max(...words.map((w) => w.end)) + (sentenceCaptions ? 0 : 0.04)
      : Infinity;
  const alpha =
    next || nextSvg || nextVector || nextObjects
      ? dissolveAt(f, fps, durationInFrames, motionTransition ? afterCaption : 0)
      : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#101514' }}>
      {objects ? (
        <ObjectScene scene={objects} frame={f} fps={fps} />
      ) : vector ? (
        <AnimatedVector scene={vector} />
      ) : svg ? (
        <AnimatedPlate plan={svg} artHref={artHref} />
      ) : (
        image && <Img src={image} style={still} />
      )}
      {/* Source-over on the opaque first photo gives (1-alpha)*old + alpha*new. */}
      {alpha > 0 &&
        (nextObjects ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <ObjectScene scene={nextObjects} frame={0} fps={fps} />
          </AbsoluteFill>
        ) : nextVector ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <AnimatedVector scene={nextVector} opening />
          </AbsoluteFill>
        ) : nextSvg ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <AnimatedPlate plan={nextSvg} artHref={nextArtHref} opening />
          </AbsoluteFill>
        ) : (
          next && <Img src={next} style={{ ...still, opacity: alpha }} />
        ))}
      {cap && (
        <CaptionOverlay
          words={cap}
          time={t}
          size={subtitleSize}
          highlight={highlight}
          estimated={sentenceCaptions}
        />
      )}
    </AbsoluteFill>
  );
}
const defaults: FilmProps = {
  image: '',
  next: null,
  words: [],
  frames: 30,
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
