import test from 'node:test';
import assert from 'node:assert/strict';
import { bestLineup, validateSquad } from '../src/lineup.js';

// ids 1-2 GK, 3-7 DEF, 8-12 MID, 13-15 FWD
const pos = (id) => (id <= 2 ? 1 : id <= 7 ? 2 : id <= 12 ? 3 : 4);
const base = { 1: 4, 2: 3, 3: 5, 4: 5, 5: 4, 6: 3, 7: 2, 8: 6, 9: 5, 10: 4, 11: 3, 12: 2, 13: 7, 14: 4, 15: 1 };
const ids = Object.keys(base).map(Number);

test('the lineup has 11 starters, 4 on the bench, and a legal formation', () => {
  const l = bestLineup(ids, pos, (id) => base[id]);
  assert.equal(l.xi.length, 11); assert.equal(l.bench.length, 4);
  const n = (p) => l.xi.filter((id) => pos(id) === p).length;
  assert.equal(n(1), 1); assert.ok(n(2) >= 3 && n(3) >= 2 && n(4) >= 1);
  assert.equal(new Set([...l.xi, ...l.bench]).size, 15);
});
test('it picks the best goalkeeper, puts the spare goalkeeper first on the bench, and captains the top scorer', () => {
  const l = bestLineup(ids, pos, (id) => base[id]);
  assert.ok(l.xi.includes(1) && !l.xi.includes(2));
  assert.equal(l.bench[0], 2);
  assert.equal(l.captain, 13);
  assert.equal(l.viceCaptain, 8);
});
test('the total is the starters plus the captain counted twice', () => {
  const l = bestLineup(ids, pos, (id) => base[id]);
  assert.equal(l.total, l.xi.reduce((a, id) => a + base[id], 0) + base[13]);
});
test('it chooses a formation that scores more when the points are lopsided', () => {
  const heavyFwd = { ...base, 13: 9, 14: 9, 15: 9 };
  const l = bestLineup(ids, pos, (id) => heavyFwd[id]);
  assert.equal(l.xi.filter((id) => pos(id) === 4).length, 3);
});

const players = (list) => list.map(([id, team, element_type, now_cost = 50]) => ({ id, team, element_type, now_cost }));
const legal = players([[1, 1, 1], [2, 2, 1], [3, 1, 2], [4, 2, 2], [5, 3, 2], [6, 4, 2], [7, 5, 2], [8, 6, 3], [9, 7, 3], [10, 8, 3], [11, 9, 3], [12, 10, 3], [13, 11, 4], [14, 12, 4], [15, 13, 4]]);
test('a legal squad has no errors and a value', () => {
  const r = validateSquad(legal.map((p) => p.id), legal);
  assert.deepEqual(r.errors, []); assert.equal(r.value, 750);
});
test('wrong size, wrong positions, too many from a club and duplicates are each reported', () => {
  assert.match(validateSquad([1, 2, 3], legal).errors.join(' '), /15 players/);
  const dup = validateSquad([...legal.map((p) => p.id).slice(0, 14), 1], legal);
  assert.match(dup.errors.join(' '), /same player/);
  const fourClub = legal.map((p) => (p.id <= 4 ? { ...p, team: 1 } : p));
  assert.match(validateSquad(legal.map((p) => p.id), fourClub).errors.join(' '), /3 from one club/);
  const wrongPos = legal.map((p) => (p.id === 15 ? { ...p, element_type: 3 } : p));
  assert.match(validateSquad(legal.map((p) => p.id), wrongPos).errors.join(' '), /3 forwards/);
});
