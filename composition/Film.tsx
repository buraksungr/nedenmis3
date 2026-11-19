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
import type { Word } from '../shared/schema';
import { dissolveAt } from './fade';
import type { SvgPlan } from '../shared/svg';
import { AnimatedPlate } from './ScientificPlate';

export type FilmProps = {
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
// Both plates have exactly the same fixed bounds. No overscan, filters or camera pose.
const still: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};
export function Film({
  svg,
  nextSvg,
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
  const cap = (sentenceCaptions ? words.map((w) => [w]) : groups(words)).find(
    (g) => t >= g[0].start && t < g[g.length - 1].end + (sentenceCaptions ? 0 : 0.04),
  );
  const alpha = next || nextSvg ? dissolveAt(f, fps, durationInFrames) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#101514' }}>
      {svg ? (
        <AnimatedPlate plan={svg} artHref={artHref} />
      ) : (
        image && <Img src={image} style={still} />
      )}
      {/* Source-over on the opaque first photo gives (1-alpha)*old + alpha*new. */}
      {alpha > 0 &&
        (nextSvg ? (
          <AbsoluteFill style={{ opacity: alpha }}>
            <AnimatedPlate plan={nextSvg} artHref={nextArtHref} opening />
          </AbsoluteFill>
        ) : (
          next && <Img src={next} style={{ ...still, opacity: alpha }} />
        ))}
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
