/** Pixel-level control of the shipped DocumentaryScene; no AI, network or image libraries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderStill } from '@remotion/renderer';
import type { FilmProps } from '../composition/Film';
import { ff } from '../server/media';
import { withDocumentaryScene } from '../server/render-browser';

export async function staticFadeControl(root: string, join: number) {
  const dir = fs.mkdtempSync(path.join(root, 'still-'));
  const png = (n: string) =>
    'data:image/png;base64,' + fs.readFileSync(`tests/fixtures/still-${n}.png`).toString('base64');
  const props: FilmProps = {
    image: png('a'),
    next: png('b'),
    words: [],
    frames: 91,
    subtitleSize: 56,
    highlight: false,
  };
  const width = 90,
    height = 160;
  const stills = (shot: FilmProps, frames: number[]) =>
    withDocumentaryScene(
      { composition: path.resolve('build/composition') },
      shot,
      async (options) => {
        const samples: Buffer[] = [];
        for (const frame of frames) {
          const output = path.join(dir, 'frame.png'),
            raw = path.join(dir, 'frame.rgb');
          await renderStill({ ...options, frame, scale: 1 / 12, imageFormat: 'png', output });
          await ff(['-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw]);
          const buf = fs.readFileSync(raw);
          assert.equal(buf.length, width * height * 3);
          samples.push(buf);
        }
        return samples;
      },
    );
  try {
    const [start, hold, before, mid, end] = await stills(props, [0, 35, 70, 80, 90]);
    const [landing, last] = await stills({ ...props, image: props.next!, next: null }, [0, 90]);
    assert.ok(
      start.equals(hold) && hold.equals(before),
      'The outgoing photo moved before the fade',
    );
    assert.ok(
      !start.equals(landing) && end.equals(landing) && landing.equals(last),
      'The incoming photo must land exactly and remain static',
    );
    // At native fixture resolution compare the photos themselves, not just two equally blurred frames.
    for (const [name, frame] of [
      ['a', start],
      ['b', landing],
    ] as const) {
      const rgb = path.join(dir, name + '.rgb');
      await ff([
        '-i',
        `tests/fixtures/still-${name}.png`,
        '-frames:v',
        '1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        rgb,
      ]);
      assert.ok(
        frame.equals(fs.readFileSync(rgb)),
        `Still ${name} was cropped, scaled or filtered`,
      );
    }
    let maxMidpointError = 0;
    for (let i = 0; i < mid.length; i++)
      maxMidpointError = Math.max(maxMidpointError, Math.abs(mid[i] - (start[i] + landing[i]) / 2));
    assert.ok(maxMidpointError <= 2, 'Every pixel should participate in the same opacity dissolve');
    // Also check the production path: the smoke board requests a legacy cut. The
    // encoded MP4 must still land on the next photo; compare above the caption band.
    const pair = path.join(dir, 'join.rgb'),
      stride = 90 * 80 * 3;
    await ff([
      '-i',
      path.join(root, 'local-render-control.mp4'),
      '-vf',
      `select=eq(n\\,0)+eq(n\\,${join - 1})+eq(n\\,${join}),scale=90:160,crop=90:80:0:0`,
      '-vsync',
      '0',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      pair,
    ]);
    const rgb = fs.readFileSync(pair);
    assert.equal(rgb.length, 3 * stride);
    const distance = (a: number, b: number) => {
      let sum = 0;
      for (let i = 0; i < stride; i++) sum += Math.abs(rgb[a * stride + i] - rgb[b * stride + i]);
      return sum / stride;
    };
    const joinError = distance(1, 2);
    assert.ok(
      distance(0, 2) > 15 && joinError < 3,
      'Production clip did not dissolve across the legacy cut',
    );
    const report = {
      nativeStillMatches: true,
      unchangedFrames: [0, 35, 70],
      maxMidpointError,
      handoffMatches: true,
      encodedJoinMeanError: joinError,
      finalStillMatches: true,
    };
    fs.writeFileSync(path.join(root, 'static-fade-report.json'), JSON.stringify(report, null, 2));
    console.log('Validated static pictures and opacity-only handoff:', report);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
