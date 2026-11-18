import { Easing, interpolate } from 'remotion';

// Image-only overlap inside the outgoing clip; no frame or narration is removed.
export function dissolveAt(frame: number, fps: number, frames: number) {
  const last = frames - 1;
  if (last < 1) return 0;
  const span = Math.max(1, Math.min(Math.round(0.65 * fps), Math.floor(last / 3)));
  return interpolate(frame, [last - span, last], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
