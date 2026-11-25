import { Easing, interpolate } from 'remotion';

// Image-only overlap inside the outgoing clip; no frame or narration is removed.
export function dissolveAt(frame: number, fps: number, frames: number, notBefore = 0) {
  const last = frames - 1;
  if (last < 1) return 0;
  const span = Math.max(1, Math.min(Math.round(0.65 * fps), Math.floor(last / 3)));
  // Motion scenes may only reveal the incoming art after the outgoing caption
  // has ended. If no frames remain, cut at the scene boundary instead.
  const start = Math.max(last - span, Math.ceil(notBefore * fps));
  if (start >= last) return 0;
  return interpolate(frame, [start, last], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
