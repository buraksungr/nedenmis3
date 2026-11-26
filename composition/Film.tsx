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
import { ScientificPlate } from './ScientificPlate';
import { CaptionOverlay } from './CaptionOverlay';
import { VectorScene } from './VectorScene';
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
// Pure frame component also lets browser and encoded-film tests inspect the exact
// transition without mocking Remotion's timeline hooks.
export function FilmFrame({
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
  frame: f,
  fps,
  durationInFrames,
}: FilmProps & { frame: number; fps: number; durationInFrames: number }) {
  const t = f / fps;
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
        <ObjectScene scene={objects} frame={f} fps={fps} showKeywords={alpha === 0} />
      ) : vector ? (
        <VectorScene scene={vector} frame={f} />
      ) : svg ? (
        <ScientificPlate
          plan={svg}
          artHref={artHref}
          frame={f}
          frames={durationInFrames}
          showKeywords={alpha === 0}
        />
      ) : (
        image && <Img src={image} style={still} />
      )}
      {/* Artwork alone dissolves. Neither outgoing nor incoming keywords are
          composited during the overlap, so an old label cannot ghost through
          the new scene. The new label appears on its own clip's first frame. */}
      {alpha > 0 &&
        (nextObjects ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <ObjectScene scene={nextObjects} frame={0} fps={fps} showKeywords={false} />
          </AbsoluteFill>
        ) : nextVector ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <VectorScene scene={nextVector} frame={0} />
          </AbsoluteFill>
        ) : nextSvg ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <ScientificPlate
              plan={nextSvg}
              artHref={nextArtHref}
              frame={0}
              frames={durationInFrames}
              showKeywords={false}
            />
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
export function Film(props: FilmProps) {
  const frame = useCurrentFrame(),
    { fps, durationInFrames } = useVideoConfig();
  return <FilmFrame {...props} frame={frame} fps={fps} durationInFrames={durationInFrames} />;
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
