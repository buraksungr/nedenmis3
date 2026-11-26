import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { FilmFrame, type FilmProps } from '../composition/Film';
import { parseStage } from '../server/motion-svg';
import type { MotionRef, ObjectFrame } from '../shared/object-motion';
import { svgPlanSchema } from '../shared/svg';
import legacyFlight from './fixtures/legacy-flight.json';

const scene = (label: string, bg: string): ObjectFrame => ({
  ref: { title: 'Bilimsel Sahne', digest: label } as MotionRef,
  stage: parseStage(
    `<svg viewBox="0 0 1080 1920"><g id="layer-bg"><rect width="1080" height="1920" fill="${bg}"/></g><g id="layer-main"><path d="M200 300Q300 200 400 300Z" fill="#fff"/></g><g id="layer-fx"><circle cx="100" cy="300" r="10" data-anim="fall"/><circle cx="200" cy="300" r="10" data-anim="fall"/><circle cx="300" cy="300" r="10" data-anim="fall"/><text data-keyword="true" x="120" y="600" font-size="40" fill="#fff">${label}</text></g></svg>`,
  ).root,
});
const old = scene('Eski', '#210f20'),
  next = scene('Yeni', '#1b2940');
const oldPlan = svgPlanSchema.parse({
    ...legacyFlight[0],
    title: 'İlk Görünüm',
    labels: ['Eski', ''],
  }),
  nextPlan = svgPlanSchema.parse({
    ...legacyFlight[0],
    title: 'Yeni Görünüm',
    labels: ['Yeni', ''],
  });
const base: FilmProps = {
  image: '',
  next: null,
  words: [{ text: 'Bitti.', start: 0, end: 0.5 }],
  frames: 90,
  subtitleSize: 56,
  highlight: true,
};
const markup = (props: Partial<FilmProps>, frame: number) =>
  renderToStaticMarkup(
    createElement(FilmFrame, { ...base, ...props, frame, fps: 30, durationInFrames: 90 }),
  );
const keywords = (html: string) =>
  [...html.matchAll(/<text\b[^>]*data-science-keyword=""[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, ''),
  );

test('motion keywords disappear before the art overlaps; incoming labels start only on their own clip', () => {
  const props = { objects: old, nextObjects: next };
  assert.deepEqual(keywords(markup(props, 10)), ['Eski']);
  for (const f of [72, 80, 88, 89]) {
    const html = markup(props, f);
    assert.match(html, /data-motion-stage="Yeni"/);
    assert.deepEqual(keywords(html), [], `ghosting at frame ${f}`);
  }
  assert.deepEqual(keywords(markup({ objects: next }, 0)), ['Yeni']);
});

test('legacy atlas and mixed transitions suppress both keyword layers without changing geometry', () => {
  for (const props of [
    { svg: oldPlan, nextSvg: nextPlan },
    { objects: old, nextSvg: nextPlan },
    { svg: oldPlan, nextObjects: next },
  ]) {
    assert.deepEqual(keywords(markup(props, 10)), ['Eski']);
    for (const frame of [75, 82, 89]) assert.deepEqual(keywords(markup(props, frame)), []);
  }
  assert.deepEqual(keywords(markup({ svg: nextPlan }, 0)), ['Yeni']);
});

test('without a dissolve, current keywords stay visible through the cut and never reveal the next label early', () => {
  const html = markup({ objects: old, nextObjects: next, words: [] }, 89);
  assert.deepEqual(keywords(html), ['Eski']);
  assert.doesNotMatch(html, /data-motion-stage="Yeni"/);
  assert.deepEqual(keywords(markup({ objects: next }, 0)), ['Yeni']);
});
