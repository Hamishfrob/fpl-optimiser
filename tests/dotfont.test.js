import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphRows, textGrid } from '../web/dotfont.js';

test('every letter, digit and the scoreboard symbols is 7 rows of 5 dots', () => {
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-. ') {
    const rows = glyphRows(ch);
    assert.equal(rows.length, 7, ch);
    for (const r of rows) assert.match(r, /^[#.]{5}$/, ch);
  }
});
test('letters are case-insensitive and unknown characters come out blank', () => {
  assert.deepEqual(glyphRows('h'), glyphRows('H'));
  assert.deepEqual(glyphRows('é'), glyphRows(' '));
});
test('different characters look different', () => {
  const seen = new Set();
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') seen.add(glyphRows(ch).join('/'));
  assert.equal(seen.size, 36);
});
test('textGrid joins characters with one blank column', () => {
  const g = textGrid('HI');
  assert.equal(g.cols, 11);
  assert.equal(g.rows.length, 7);
  assert.ok(g.rows.every((r) => r.length === 11));
  assert.equal(g.rows[0][5], '.');
});
