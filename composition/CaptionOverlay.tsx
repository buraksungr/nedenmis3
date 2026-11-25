import React from 'react';
import type { Word } from '../shared/schema';

/** The same bounded, scene-local caption plate is used by the film and pixel controls. */
export function CaptionOverlay({
  words,
  time,
  size,
  highlight,
  estimated,
}: {
  words: Word[];
  time: number;
  size: number;
  highlight: boolean;
  estimated: boolean;
}) {
  if (!words.length) return null;
  return (
    <div
      data-caption=""
      style={{
        position: 'absolute',
        left: '9%',
        right: '9%',
        bottom: '14%',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
        fontSize: size,
        fontWeight: 650,
        lineHeight: 1.38,
        overflowWrap: 'anywhere',
        color: '#fff',
        opacity: Math.min(1, (time - words[0].start) * 18 + 0.42),
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
        {words.map((word, i) => (
          <React.Fragment key={i}>
            {i ? ' ' : ''}
            <span
              style={{
                color:
                  highlight && !estimated && time >= word.start && time < word.end
                    ? '#FACC15'
                    : 'inherit',
              }}
            >
              {word.text}
            </span>
          </React.Fragment>
        ))}
      </span>
    </div>
  );
}
