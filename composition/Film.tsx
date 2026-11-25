import { ShotTitle } from './ShotTitle';
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
  title,
  nextTitle,
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
  // Do not show the next motion scene or its title under the outgoing scene's
  // subtitles. Preserve the normal crossfade for legacy photo/atlas sequences.
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
      {/* One still, safe-area heading. Fade through zero rather than stacking two titles. */}
      {alpha < 0.5 && title ? (
        <ShotTitle title={title} opacity={1 - 2 * alpha} />
      ) : alpha >= 0.5 && nextTitle ? (
        <ShotTitle title={nextTitle} opacity={2 * alpha - 1} />
      ) : null}
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
                  style={{
                    color:
                      highlight && !sentenceCaptions && t >= w.start && t < w.end
                        ? '#FACC15'
                        : 'inherit',
                  }}
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
