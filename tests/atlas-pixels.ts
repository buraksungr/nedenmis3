/** Compare the decoded film (not storyboard metadata) with the same Remotion shot
 * rendered twice, with the recovered Iconify bytes and with only its local fallback. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderStill } from '@remotion/renderer';
import type { FilmProps } from '../composition/Film';
import type { SvgPlan } from '../shared/svg';
import { withDocumentaryScene } from '../server/render-browser';
import { ff } from '../server/media';
export async function hookPixels(
  out: string,
  final: string,
  svg: SvgPlan,
  bytes: string,
  frames: number,
) {
  assert.equal(svg.template, 'TitleHookScene');
  const frame = 18,
    crop = 'crop=176:176:548:918',
    tmp = fs.mkdtempSync(path.join(out, 'proof-'));
  const rgb = async (file: string, name: string, seek: boolean) => {
    const dst = path.join(tmp, name + '.rgb');
    await ff([
      '-i',
      file,
      '-an',
      '-vf',
      (seek ? `select=eq(n\\,${frame}),` : '') + crop,
      '-frames:v',
      '1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      dst,
    ]);
    const b = fs.readFileSync(dst);
    assert.equal(b.length, 176 * 176 * 3);
    return b;
  };
  const expected = async (withArt: boolean) => {
    const name = withArt ? 'art' : 'local',
      image = path.join(tmp, name + '.png');
    const props: FilmProps = {
      image: '',
      next: null,
      words: [],
      frames,
      subtitleSize: 56,
      highlight: true,
      svg,
      ...(withArt
        ? { artHref: 'data:image/svg+xml;base64,' + Buffer.from(bytes).toString('base64') }
        : {}),
    };
    await withDocumentaryScene({ composition: path.resolve('build/composition') }, props, (opts) =>
      renderStill({ ...opts, frame, imageFormat: 'png', output: image }),
    );
    return rgb(image, name, false);
  };
  const mean = (a: Buffer, b: Buffer) =>
    a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length;
  try {
    const actual = await rgb(final, 'film', true),
      withArt = await expected(true),
      noArt = await expected(false),
      referenceSeparation = mean(withArt, noArt),
      toIconify = mean(actual, withArt),
      toLocal = mean(actual, noArt);
    assert.ok(
      referenceSeparation > 7 && toIconify < 6 && toIconify * 3 < toLocal,
      JSON.stringify({ referenceSeparation, toIconify, toLocal }),
    );
    await ff([
      '-i',
      final,
      '-an',
      '-vf',
      `select=eq(n\\,${frame}),scale=540:960`,
      '-frames:v',
      '1',
      path.join(out, 'balina-kare.png'),
    ]);
    return { frame, crop, referenceSeparation, toIconify, toLocal };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
