// SVG transform lists are applied in authored order, using column-vector matrices.
export type Matrix = [number, number, number, number, number, number];
export const I: Matrix = [1, 0, 0, 1, 0, 0];
export function mul([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix {
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}
export function matrix(s = '') {
  let m = I;
  for (const [, name, args] of s.matchAll(/(\w+)\(([^()]*)\)/g)) {
    const n = args
        .trim()
        .split(/[ ,\s]+/)
        .map(Number),
      [a, b = 0, c = 0] = n,
      angle = (a * Math.PI) / 180,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    let t: Matrix;
    if (name === 'matrix') t = n as Matrix;
    else if (name === 'translate') t = [1, 0, 0, 1, a, b];
    else if (name === 'scale') t = [a, 0, 0, n[1] ?? a, 0, 0];
    else if (name === 'rotate')
      t = [cos, sin, -sin, cos, b - b * cos + c * sin, c - b * sin - c * cos];
    else t = name === 'skewX' ? [1, 0, Math.tan(angle), 1, 0, 0] : [1, Math.tan(angle), 0, 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}
