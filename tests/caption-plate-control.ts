/** Sample the packaged composition as pixels. A single timed caption band, not merely two non-overlapping texts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderStill } from '@remotion/renderer';
import type { FilmProps } from '../composition/Film';
import { sample } from './vector-test-data';
import { parseIllustration } from '../server/layered-svg';
import { vectorSchema } from '../shared/vector';
import { ff } from '../server/media';
import { withDocumentaryScene } from '../server/render-browser';
export async function captionPlateControl(out: string) {
  const tmp = fs.mkdtempSync(path.join(out, 'caption-')),
    width = 270,
    height = 480;
  const art = sample(2),
    { drawing } = parseIllustration(art.svg);
  const props: FilmProps = {
    vector: {
      ref: vectorSchema.parse({
        kind: 'layered-v1',
        title: art.title,
        fx: art.fx,
        provider: 'openrouter',
        model: 'qa-illustrator-replay',
        digest: 'f'.repeat(64),
        narrationHash: 'b'.repeat(64),
      }),
      drawing,
    },
    image: '',
    next: null,
    words: [
      { text: 'Tatlı', start: 0.1, end: 0.8 },
      { text: 'yedikten', start: 0.8, end: 1.6 },
    ],
    frames: 60,
    highlight: true,
    subtitleSize: 64,
  };
  const frames = async (p: FilmProps, samples: number[]) =>
    withDocumentaryScene({ composition: path.resolve('build/composition') }, p, async (opts) => {
      const result: Buffer[] = [];
      for (const frame of samples) {
        const png = path.join(tmp, 'frame.png'),
          rgb = path.join(tmp, 'frame.rgb');
        await renderStill({ ...opts, frame, scale: 0.25, imageFormat: 'png', output: png });
        await ff(['-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', rgb]);
        const raw = fs.readFileSync(rgb);
        assert.equal(raw.length, width * height * 3);
        result.push(raw);
      }
      return result;
    });
  function band(raw: Buffer) {
    const background = raw.subarray((width * 350 + 2) * 3, (width * 350 + 2) * 3 + 3);
    let marks = 0,
      yellow = 0,
      xSum = 0,
      white = 0;
    for (let y = 350; y < 475; y++)
      for (let x = 0; x < width; x++) {
        const i = (width * y + x) * 3,
          r = raw[i],
          g = raw[i + 1],
          b = raw[i + 2];
        if (r !== background[0] || g !== background[1] || b !== background[2]) marks++;
        if (r >= 234 && g >= 177 && g <= 219 && b <= 49) {
          yellow++;
          xSum += x;
        }
        if (r >= 244 && g >= 244 && b >= 244) white++;
      }
    return { marks, yellow, white, center: xSum / (yellow || 1) };
  }
  try {
    const [quiet, left, right] = (await frames(props, [0, 12, 34])).map(band);
    const [off] = (await frames({ ...props, highlight: false }, [12])).map(band);
    assert.equal(
      quiet.marks,
      0,
      'Legacy subtitle or footer still occupies the caption area before speech',
    );
    assert.ok(left.yellow > 15 && right.yellow > 15 && left.white > 15 && right.white > 15);
    assert.ok(
      right.center > left.center + 12,
      'Amber should move from the first to the second word',
    );
    assert.equal(off.yellow, 0);
    assert.ok(off.white > 30);
    const report = {
      emptyBeforeFirstWord: true,
      activeColour: '#FACC15',
      left,
      right,
      highlightDisabled: off,
    };
    fs.writeFileSync(path.join(out, 'caption-plate-report.json'), JSON.stringify(report, null, 2));
    console.log('Verified empty lower plate and timed amber-to-white word handoff.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
