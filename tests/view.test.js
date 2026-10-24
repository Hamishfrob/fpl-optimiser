import test from 'node:test';
import assert from 'node:assert/strict';
import { isStale, money, nextFixtures, groupByClub, pairMoves } from '../src/view.js';

const NOW = new Date('2026-10-25T12:00:00Z');
test('data 35 hours old is fresh, 37 hours old is stale', () => {
  assert.equal(isStale('2026-10-24T01:00:00Z', NOW), false);
  assert.equal(isStale('2026-10-23T23:00:00Z', NOW), true);
});
test('a missing or unreadable update time counts as stale', () => {
  assert.equal(isStale(undefined, NOW), true);
  assert.equal(isStale('not a date', NOW), true);
});
test('money shows tenths of a million as pounds', () => {
  assert.equal(money(157), '£15.7m'); assert.equal(money(40), '£4.0m'); assert.equal(money(5), '£0.5m');
});
const teams = [{ id: 1, short_name: 'ARS' }, { id: 2, short_name: 'EVE' }, { id: 3, short_name: 'LIV' }];
const fx = [
  { event: 9, team_h: 1, team_a: 2 }, { event: 10, team_h: 3, team_a: 1 }, { event: 11, team_h: 1, team_a: 3 }, { event: 8, team_h: 2, team_a: 1 },
];
test('nextFixtures lists upcoming opponents with home or away, from the given gameweek', () => {
  assert.deepEqual(nextFixtures(1, fx, teams, 9, 3), ['EVE (H)', 'LIV (A)', 'LIV (H)']);
  assert.deepEqual(nextFixtures(2, fx, teams, 9, 3), ['ARS (A)']);
});
test('groupByClub groups player ids by team, biggest group first, then alphabetical', () => {
  const players = [{ id: 10, team: 2 }, { id: 11, team: 1 }, { id: 12, team: 1 }, { id: 13, team: 3 }];
  const g = groupByClub([10, 11, 12, 13], players, teams.map((t) => ({ ...t, name: t.short_name })));
  assert.deepEqual(g.map((x) => [x.team.id, x.ids]), [[1, [11, 12]], [2, [10]], [3, [13]]]);
});

test('pairMoves matches each sale with a purchase in the same position', () => {
  const pos = new Map([[1, 'DEF'], [2, 'MID'], [3, 'MID'], [4, 'DEF']]);
  const pairs = pairMoves([1, 2], [3, 4], (id) => pos.get(id));
  assert.deepEqual(pairs.map((p) => [p.out, p.in]), [[1, 4], [2, 3]]);
});
test('pairMoves still returns every sale and purchase when positions do not line up', () => {
  const pairs = pairMoves([1], [2], (id) => (id === 1 ? 'DEF' : 'MID'));
  assert.deepEqual(pairs.map((p) => [p.out, p.in]), [[1, 2]]);
});
