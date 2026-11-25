/** Map a fixed output-pixel safety rectangle into a slice-fitted SVG viewBox.
 * Applying it outside each transformed foreground group also constrains animation. */
export function fittedSafeRect(viewBox: string, bottom: number) {
  const [x, y, width, height] = viewBox.split(/[\s,]+/).map(Number),
    scale = Math.max(1080 / width, 1920 / height),
    visibleWidth = 1080 / scale,
    visibleHeight = 1920 / scale;
  return {
    x: x + (width - visibleWidth) / 2,
    y: y + (height - visibleHeight) / 2,
    width: visibleWidth,
    height: bottom / scale,
  };
}
