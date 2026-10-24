import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFixturesCsv, impliedGoals } from '../src/odds.js';

const csv = readFileSync(new URL('./fixtures/fixtures.csv', import.meta.url), 'utf8');
const row = (h, d, a, over, under) => ({ avgH: h, avgD: d, avgA: a, avgOver25: over, avgUnder25: under });

test('parseFixturesCsv returns the Premier League rows with average odds', () => {
  const rows = parseFixturesCsv(csv);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].home, 'Ipswich');
  assert.equal(rows[0].away, "Nott'm Forest");
  assert.equal(rows[0].avgH, 3.01);
});

test('parseFixturesCsv skips rows with no odds', () => {
  const text = 'Div,Date,Time,HomeTeam,AwayTeam,AvgH,AvgD,AvgA,Avg>2.5,Avg<2.5\nE0,01/01/2027,15:00,A,B,,,,,\nE0,01/01/2027,15:00,C,D,2,3,4,1.8,2\n';
  assert.deepEqual(parseFixturesCsv(text).map((r) => r.home), ['C']);
});

test('even odds give equal goals and clean sheet = exp(-opponent goals)', () => {
  const g = impliedGoals(row(3, 3, 3, 2, 2));
  assert.ok(Math.abs(g.homeGoals - g.awayGoals) < 0.01);
  assert.ok(Math.abs(g.homeCleanSheet - Math.exp(-g.awayGoals)) < 0.001);
  assert.ok(Math.abs(g.awayCleanSheet - Math.exp(-g.homeGoals)) < 0.001);
});

test('a shorter home price means more home goals and fewer away goals', () => {
  const fav = impliedGoals(row(1.4, 4.5, 8, 1.8, 2));
  const dog = impliedGoals(row(4, 3.6, 1.9, 1.8, 2));
  assert.ok(fav.homeGoals > dog.homeGoals);
  assert.ok(fav.awayGoals < dog.awayGoals);
  assert.ok(fav.homeWin > 0.6 && dog.homeWin < 0.3);
});

test('all outputs are probabilities or positive goal counts', () => {
  const g = impliedGoals(row(2.1, 3.7, 3.1, 1.53, 2.5));
  for (const k of ['homeCleanSheet', 'awayCleanSheet', 'homeWin']) assert.ok(g[k] > 0 && g[k] < 1);
  assert.ok(g.homeGoals > 0.2 && g.homeGoals < 5 && g.awayGoals > 0.2 && g.awayGoals < 5);
});
