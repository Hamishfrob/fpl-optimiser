import test from 'node:test';
import assert from 'node:assert/strict';
import { pitchMarkings } from '../src/pitchlines.js';

const W = 720, H = 520, M = 10;
const m = pitchMarkings(W, H, M);
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

test('the outline is the pitch rectangle inset by the margin', () => {
  assert.deepEqual(m.outline, { x: M, y: M, w: W - 2 * M, h: H - 2 * M });
});
test('the halfway line runs across the middle and the centre circle is round, in the middle', () => {
  assert.ok(near(m.halfway.y1, H / 2) && m.halfway.y1 === m.halfway.y2);
  assert.ok(near(m.centreCircle.cx, W / 2) && near(m.centreCircle.cy, H / 2));
  assert.ok(m.centreCircle.r > 20 && m.centreCircle.r < H / 4);
});
test('each end has a penalty area 40.3 / 68 of the width and a smaller goal area inside it', () => {
  for (const end of m.ends) {
    assert.ok(near(end.penaltyArea.w, (40.32 / 68) * (W - 2 * M), 1.5));
    assert.ok(near(end.penaltyArea.x + end.penaltyArea.w / 2, W / 2, 1));
    assert.ok(end.goalArea.w < end.penaltyArea.w && end.goalArea.h < end.penaltyArea.h);
    assert.ok(end.goalArea.x > end.penaltyArea.x && end.goalArea.x + end.goalArea.w < end.penaltyArea.x + end.penaltyArea.w);
  }
});
test('the two ends mirror each other about the halfway line', () => {
  const [top, bottom] = m.ends;
  assert.ok(near(top.spot.y - m.outline.y, m.outline.y + m.outline.h - bottom.spot.y, 0.5));
  assert.ok(near(top.penaltyArea.h, bottom.penaltyArea.h, 0.5));
  assert.ok(top.spot.y < H / 2 && bottom.spot.y > H / 2);
});
test('the penalty spot is inside the box and the arc outside it, all within the pitch', () => {
  const top = m.ends[0];
  assert.ok(top.spot.y > top.goalArea.y + top.goalArea.h && top.spot.y < top.penaltyArea.y + top.penaltyArea.h);
  assert.match(top.arc, /^M [\d.]+ [\d.]+ A /);
  for (const c of m.corners) assert.match(c, /^M [\d.]+ [\d.]+ A /);
  assert.equal(m.corners.length, 4);
});
test('a tiny or zero size gives no markings instead of a crash', () => {
  assert.equal(pitchMarkings(0, 0, 10), null);
  assert.equal(pitchMarkings(30, 30, 10), null);
});
