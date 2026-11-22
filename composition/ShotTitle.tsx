import React from 'react';
const full: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
export function ShotTitle({ title, opacity = 1 }: { title: string; opacity?: number }) {
  return (
    <div style={{ ...full, containerType: 'inline-size', pointerEvents: 'none', opacity }}>
      <div
        data-shot-title=""
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '80%',
          textAlign: 'center',
          color: '#fff9ee',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
          fontSize: '5.2cqw',
          lineHeight: 1.25,
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          textShadow: '0 2px 8px rgba(0,0,0,.55)',
        }}
      >
        {title}
      </div>
    </div>
  );
}
