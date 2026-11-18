import { Easing, interpolate, spring } from 'remotion';
import { motionForScene, type ShotVisual } from '../shared/shot';

const ease = {
  easing: Easing.inOut(Easing.sin),
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;
export type Pose = { x: number; y: number; scale: number; roll: number; blur: number };

// x and y are percentages of the canvas. Frame zero is independent of the shot's
// duration, so a separately rendered neighbour can dissolve into this exact pose.
export function poseAt(
  frame: number,
  fps: number,
  frames: number,
  index: number,
  shot: ShotVisual,
  intensity: number,
): Pose {
  const last = Math.max(0, frames - 1),
    f = Math.min(Math.max(0, frame), last),
    t = f / fps;
  const strength = Math.min(1.45, Math.max(0, (shot.motion ?? 1) * intensity));
  const room = Math.min(1, last / (2.5 * fps)); // Don't squeeze a long sweep into a two-frame shot.
  const progress = interpolate(f, [0, Math.max(1, last)], [0, 1], ease),
    travel = progress * room;
  const profile = motionForScene(index);
  let x = 0,
    y = 0,
    zoom = 0,
    roll = 0,
    bleed = 0.035;
  if (profile === 'pan-right' || profile === 'pan-left') {
    const enter = spring({
      frame: f,
      fps,
      durationInFrames: Math.max(1, Math.round(1.4 * fps)),
      config: { mass: 1, stiffness: 55, damping: 18, overshootClamping: true },
    });
    x = (profile === 'pan-right' ? 1 : -1) * (-3 + 1.25 * enter + 4.25 * travel);
    bleed = 0.08;
  } else if (profile === 'breathe') {
    const period = Math.max(1, Math.min(last, 5 * fps));
    zoom = interpolate(f % period, [0, period / 2, period], [0, 0.045 * room, 0], ease);
    x = 0.32 * Math.sin(t * 1.1);
  } else {
    const sign = profile === 'float-up' ? -1 : 1;
    y = sign * interpolate((t / 5.2) % 1, [0, 0.25, 0.75, 1], [0, 1.6, -1.6, 0], ease);
    x = 0.48 * Math.sin(t * 0.9);
    roll = sign * 0.18 * Math.sin(t * 1.1);
    bleed = 0.065;
  }
  // Keep the storyboard camera as a secondary framing cue, not the only animation.
  if (shot.camera === 'push') zoom += 0.035 * travel;
  if (shot.camera === 'pull') zoom += 0.035 * (1 - travel);
  if (shot.camera === 'pan') x += 0.85 * travel;
  if (shot.camera === 'tilt') y -= 1.05 * travel;
  if (shot.camera === 'track') {
    x += 0.65 * travel;
    y -= 0.4 * travel;
  }
  return {
    x: x * strength,
    y: y * strength,
    roll: roll * strength,
    // Constant overscan per profile protects the edges without an unintended pumping zoom.
    scale: 1.012 + (bleed + zoom) * strength,
    blur: shot.camera === 'focus' ? interpolate(progress, [0, 0.33], [2.4, 0], ease) : 0,
  };
}

// Image-only overlap inside the outgoing clip; no frame or narration is removed.
export function dissolveAt(frame: number, fps: number, frames: number) {
  const last = frames - 1;
  if (last < 1) return 0;
  const span = Math.max(1, Math.min(Math.round(0.65 * fps), Math.floor(last / 3)));
  return interpolate(frame, [last - span, last], [0, 1], ease);
}
