import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeSvg, SVG_LIMIT } from '../server/safe-svg';
const xml =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor"><path d="M2 8Q5 4 10 8L20 12Z"/></g></svg>';
test('static SVG geometry is rebuilt and themed idempotently, not served as raw XML', () => {
  const safe = safeSvg(xml);
  assert.equal(safeSvg(safe), safe);
  assert.match(safe, /viewBox="0 0 24 24"/);
  assert.match(safe, /#EDF5EE/);
  assert.match(safe, /#9ADBC1/);
  assert.doesNotMatch(safe, /currentColor|width="24"/);
  for (const body of [
    '<script/>',
    '<foreignObject/>',
    '<use href="#a"/>',
    '<image/>',
    '<path d="M0 0Z" style="fill:red"/>',
    '<animate/>',
    '<style/>',
    '<path d="M0 0Z" onload="ignore"/>',
    '<circle r="4" fill="url(#id)"/>',
    '<path d="M0 1e999Z"/>',
    '<ellipse rx="x"/>',
    '<g>'.repeat(20) + '</g>'.repeat(20),
  ])
    assert.throws(() => safeSvg(xml.replace('<g fill', body + '<g fill')));
  for (const v of [
    xml.replace('0 0 24 24', '0 0 -1 0'),
    xml.replace('viewBox', 'other'),
    xml.repeat(2),
    '<!DOCTYPE svg>' + xml,
    xml.replace('</svg>', ''),
    xml + ' '.repeat(SVG_LIMIT),
  ])
    assert.throws(() => safeSvg(v));
});
