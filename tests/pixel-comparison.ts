import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
export function reduced(png: Buffer) {
  const { data, width, height } = PNG.sync.read(png);
  assert.equal(width, 1080);
  assert.ok(height >= 1350);
  const rgb = Buffer.alloc(540 * 675 * 3);
  for (let y = 0; y < 675; y++)
    for (let x = 0; x < 540; x++) {
      const a = (y * 2 * 1080 + x * 2) * 4,
        b = (y * 540 + x) * 3;
      for (let c = 0; c < 3; c++)
        rgb[b + c] = (data[a + c] + data[a + 4 + c] + data[a + 4320 + c] + data[a + 4324 + c]) / 4;
    }
  return rgb;
}
export function evidence(
  film: Buffer,
  reference: Buffer,
  alternative: Buffer,
  description: string,
) {
  let n = 0,
    expected = 0,
    other = 0;
  for (let j = 0; j < film.length; j += 3) {
    let separation = 0;
    for (let c = 0; c < 3; c++) separation += Math.abs(reference[j + c] - alternative[j + c]);
    if (separation < 60) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      expected += Math.abs(film[j + c] - reference[j + c]);
      other += Math.abs(film[j + c] - alternative[j + c]);
    }
  }
  const result = {
    changedPixels: n,
    toReference: expected / (n * 3),
    toAlternative: other / (n * 3),
  };
  assert.ok(
    n >= 30 && result.toReference < result.toAlternative * 0.6,
    description + ': ' + JSON.stringify(result),
  );
  return result;
}
