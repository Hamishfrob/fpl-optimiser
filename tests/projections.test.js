import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectedPoints, projectAll } from '../src/projections.js';
import { parseFixturesCsv } from '../src/odds.js';

import rules from '../src/rules.js';
const boot = JSON.parse(readFileSync(new URL('./fixtures/bootstrap.json', import.meta.url)));
const fx = JSON.parse(readFileSync(new URL('./fixtures/fpl-fixtures.json', import.meta.url)));
const csv = readFileSync(new URL('./fixtures/fixtures.csv', import.meta.url), 'utf8');

const base = { element_type: 3, chance_of_playing_next_round: 100, minutes: 720, starts: 8,
  expected_goals_per_90: 0.3, expected_assists_per_90: 0.2, defensive_contribution_per_90: 5, saves_per_90: 0,
  yellow_cards: 1, red_cards: 0, bonus: 8, team: 1 };
const ctx = { teamPlayed: 8, posAvg: { 1: { xg: 0, xa: 0 }, 2: { xg: 0.05, xa: 0.08 }, 3: { xg: 0.15, xa: 0.12 }, 4: { xg: 0.3, xa: 0.1 } } };
const fix = (gf, ga, cs, source = 'odds') => ({ goalsFor: gf, goalsAgainst: ga, cleanSheet: cs, source, label: 'v Test (H)' });
const pts = (p, f) => expectedPoints(p, f, rules, ctx).points;

test('a player ruled out (chance 0) projects exactly 0', () => assert.equal(pts({ ...base, chance_of_playing_next_round: 0 }, [fix(1.35, 1.35, 0.26)]), 0));
test('null chance of playing means fully fit', () => assert.equal(pts({ ...base, chance_of_playing_next_round: null }, [fix(1.35, 1.35, 0.26)]), pts(base, [fix(1.35, 1.35, 0.26)])));
test('50 percent chance halves the points', () => {
  const full = pts(base, [fix(1.35, 1.35, 0.26)]);
  assert.ok(Math.abs(pts({ ...base, chance_of_playing_next_round: 50 }, [fix(1.35, 1.35, 0.26)]) - full / 2) < 1e-9);
});
test('blank gameweek is 0 and double gameweek is the sum of two singles', () => {
  const a = fix(1.8, 0.9, 0.4), b = fix(1.0, 1.7, 0.18);
  assert.equal(pts(base, []), 0);
  assert.ok(Math.abs(pts(base, [a, b]) - (pts(base, [a]) + pts(base, [b]))) < 1e-9);
});
test('a midfielder with higher xG per 90 projects higher on the same fixture', () => {
  assert.ok(pts({ ...base, expected_goals_per_90: 0.5 }, [fix(1.35, 1.35, 0.26)]) > pts(base, [fix(1.35, 1.35, 0.26)]));
});
test('a defender projects higher on a fixture with a better clean sheet chance', () => {
  const d = { ...base, element_type: 2 };
  assert.ok(pts(d, [fix(1.35, 0.6, 0.55)]) > pts(d, [fix(1.35, 2.0, 0.13)]));
});
test('a forward gets no clean sheet points and a goalkeeper goal is worth 10', () => {
  const f = { ...base, element_type: 4, expected_assists_per_90: 0, defensive_contribution_per_90: 0, bonus: 0, yellow_cards: 0 };
  const lowCs = pts(f, [fix(1.35, 2, 0.13)]), highCs = pts(f, [fix(1.35, 0.5, 0.6)]);
  assert.ok(Math.abs(lowCs - highCs) < 1e-9);
  assert.equal(rules.goal.GKP, 10);
});
test('estimate is true when any fixture is an estimate, and reasons name the fixture and chance of playing', () => {
  const r = expectedPoints({ ...base, chance_of_playing_next_round: 75 }, [fix(1.35, 1.35, 0.26, 'estimate')], rules, ctx);
  assert.equal(r.estimate, true);
  assert.ok(r.reasons.some((x) => x.includes('v Test (H)')));
  assert.ok(r.reasons.some((x) => x.includes('75%')));
});
test('projectAll covers every player for every gameweek and is finite', () => {
  const r = projectAll(boot, fx, parseFixturesCsv(csv), 9, 3);
  assert.equal(r.points.size, boot.elements.length);
  for (const arr of r.points.values()) { assert.equal(arr.length, 3); for (const x of arr) assert.ok(Number.isFinite(x) && x >= 0); }
  const top = [...r.points.entries()].sort((a, b) => b[1][0] - a[1][0])[0];
  assert.ok(top[1][0] > 2 && top[1][0] < 14, `top player GW9 projection ${top[1][0]}`);
});

test('a doubtful player is doubtful for the next round only, later weeks assume he is fit', () => {
  const out = { ...base, chance_of_playing_next_round: 0 };
  const f = [fix(1.35, 1.35, 0.26)];
  assert.equal(expectedPoints(out, f, rules, { ...ctx, gwOffset: 0 }).points, 0);
  assert.ok(expectedPoints(out, f, rules, { ...ctx, gwOffset: 1 }).points > 2);
});
test('projectAll applies chance of playing to the first gameweek only', () => {
  const doubtful = boot.elements.find((e) => e.chance_of_playing_next_round === 0 || e.chance_of_playing_next_round === 25) ?? boot.elements[0];
  const el = boot.elements.map((e) => (e.id === doubtful.id ? { ...e, chance_of_playing_next_round: 0 } : e));
  const r = projectAll({ ...boot, elements: el }, fx, parseFixturesCsv(csv), 9, 3);
  const pts = r.points.get(doubtful.id);
  assert.equal(pts[0], 0);
  assert.ok(pts[1] > 0 || pts[2] > 0);
});
