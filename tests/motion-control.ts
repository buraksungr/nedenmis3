/** Pixel-level control of the shipped DocumentaryScene; no AI, network or image libraries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderStill } from '@remotion/renderer';
import type { FilmProps } from '../composition/Film';
import { ff } from '../server/media';
import { withDocumentaryScene } from '../server/render-browser';
import { blankScene } from '../shared/schema';

export async function motionControl(root: string) {
  const dir = fs.mkdtempSync(path.join(root, 'motion-'));
  const png = (n: string) =>
    'data:image/png;base64,' + fs.readFileSync(`tests/fixtures/motion-${n}.png`).toString('base64');
  const plates = { background: png('background'), foreground: png('foreground') };
  const arrival = {
    image: png('arrival'),
    shot: { camera: 'pull', motion: 1, effect: 'none', object: 'orbit' },
  } as const;
  const props: FilmProps = {
    image: plates,
    next: arrival,
    sceneIndex: 0,
    scene: { ...blankScene('current'), effect: 'none' },
    words: [],
    frames: 91,
    intensity: 'Orta',
    subtitleSize: 56,
    highlight: false,
  };
  const width = 270,
    height = 480;
  const stills = (shot: FilmProps, frames: number[]) =>
    withDocumentaryScene(
      { composition: path.resolve('build/composition') },
      shot,
      async (options) => {
        const samples: Buffer[] = [];
        for (const frame of frames) {
          const output = path.join(dir, 'frame.png'),
            raw = path.join(dir, 'frame.rgb');
          await renderStill({ ...options, frame, scale: 0.25, imageFormat: 'png', output });
          await ff(['-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw]);
          const buf = fs.readFileSync(raw);
          assert.equal(buf.length, width * height * 3);
          samples.push(buf);
        }
        return samples;
      },
    );
  function marker(buf: Buffer, foreground = false) {
    let sumX = 0,
      sumY = 0,
      count = 0;
    for (let i = 0; i < buf.length; i += 3) {
      const r = buf[i],
        g = buf[i + 1],
        b = buf[i + 2];
      if (foreground ? r > 220 && g > 145 && b < 20 : r < 20 && g > 220 && b > 220) {
        sumX += (i / 3) % width;
        sumY += Math.floor(i / 3 / width);
        count++;
      }
    }
    assert.ok(count > 100, 'Missing registration marker');
    return { x: sumX / count, y: sumY / count, area: count };
  }
  try {
    const [start, moved, mid, end] = await stills(props, [0, 60, 80, 90]);
    const [landing] = await stills(
      {
        ...props,
        sceneIndex: 1,
        image: arrival.image,
        next: null,
        scene: { ...props.scene, ...arrival.shot },
      },
      [0],
    );
    const backgroundDx = marker(moved).x - marker(start).x,
      foregroundDx = marker(moved, true).x - marker(start, true).x;
    assert.ok(foregroundDx > 8 && backgroundDx > 2);
    assert.ok(
      Math.abs(backgroundDx / foregroundDx - 0.4) < 0.1,
      'Background must pan more slowly than the foreground',
    );
    // Top-left is solid artwork: at the midpoint each source must contribute exactly half, not fade to black.
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(mid[c] - (start[c] + landing[c]) / 2) <= 2);
    assert.ok(
      !start.equals(landing) && end.equals(landing),
      'Transition must land on the real incoming first picture',
    );
    // Single manual image: actually grow and recede; float up then down. The cut
    // control keeps its outgoing marker through the final frame, despite a neighbour.
    const single = { ...props, image: plates.background };
    const areas = (await stills({ ...single, sceneIndex: 1, next: null }, [0, 45, 90])).map(
      (buf) => marker(buf).area,
    );
    assert.ok(
      areas[1] > Math.max(areas[0], areas[2]) * 1.04,
      'Breathing did not expand then contract',
    );
    const heights = (
      await stills(
        { ...single, sceneIndex: 2, frames: 151, scene: { ...single.scene, transition: 'cut' } },
        [0, 39, 117, 150],
      )
    ).map((buf) => marker(buf).y);
    assert.ok(
      heights[0] - heights[1] > 5 && heights[2] - heights[1] > 10,
      'Vertical float was not visible',
    );
    const report = {
      frames: props.frames,
      backgroundDx,
      foregroundDx,
      breathingMarkerAreas: areas,
      floatMarkerY: heights,
      midpointRGB: [...mid.subarray(0, 3)],
      handoffMatches: true,
    };
    fs.writeFileSync(path.join(root, 'motion-report.json'), JSON.stringify(report, null, 2));
    console.log('Validated PNG parallax, crossfade midpoint and scene boundary:', report);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
