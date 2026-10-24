import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamStrengths, fixtureExpectations } from '../src/ratings.js';

const boot = JSON.parse(readFileSync(new URL('./fixtures/bootstrap.json', import.meta.url)));
const fx = JSON.parse(readFileSync(new URL('./fixtures/fpl-fixtures.json', import.meta.url)));
const id = (n) => boot.teams.find((t) => t.name === n).id;
const flat = new Map(boot.teams.map((t) => [t.id, { attack: 1, defence: 1 }]));

test('teamStrengths covers all 20 teams with finite positive numbers', () => {
  const s = teamStrengths(fx, boot.teams);
  assert.equal(s.size, 20);
  for (const v of s.values()) assert.ok(v.attack > 0 && v.defence > 0 && Number.isFinite(v.attack + v.defence));
});

test('a team that scores more has a higher attack strength, shrunk toward 1', () => {
  const finished = (h, a, hs, as) => ({ finished: true, team_h: h, team_a: a, team_h_score: hs, team_a_score: as });
  const teams = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const games = [finished(1, 2, 4, 0), finished(2, 3, 1, 1), finished(3, 1, 0, 3), finished(1, 3, 2, 0)];
  const s = teamStrengths(games, teams);
  assert.ok(s.get(1).attack > s.get(2).attack);
  assert.ok(s.get(1).attack > 1 && s.get(1).attack < 9 / 3.0 / 1.35 * 4);
  assert.ok(s.get(1).defence < s.get(3).defence);
});

test('with no finished games every team is average', () => {
  const s = teamStrengths([{ finished: false, team_h: 1, team_a: 2 }], [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(s.get(1), { attack: 1, defence: 1 });
});

test('with odds for the pair the odds numbers are used and labelled odds', () => {
  const odds = new Map([[`${id('Arsenal')}-${id('Everton')}`,
    { homeGoals: 2.4, awayGoals: 0.6, homeCleanSheet: 0.55, awayCleanSheet: 0.09, homeWin: 0.7 }]]);
  const r = fixtureExpectations({ team_h: id('Arsenal'), team_a: id('Everton') }, flat, odds);
  assert.equal(r.source, 'odds');
  assert.equal(r.homeGoals, 2.4);
});

test('without odds the estimate is labelled; league-average teams give 1.35 goals each on average', () => {
  const r = fixtureExpectations({ team_h: id('Arsenal'), team_a: id('Everton') }, flat, new Map());
  assert.equal(r.source, 'estimate');
  assert.ok(Math.abs((r.homeGoals + r.awayGoals) / 2 - 1.35) < 0.001);
});

test('stronger home attack against weaker away defence gives more home goals and fewer away clean sheets', () => {
  const s = new Map(flat);
  const base = fixtureExpectations({ team_h: 1, team_a: 2 }, new Map([[1, { attack: 1, defence: 1 }], [2, { attack: 1, defence: 1 }]]), new Map());
  const better = fixtureExpectations({ team_h: 1, team_a: 2 }, new Map([[1, { attack: 1.4, defence: 1 }], [2, { attack: 1, defence: 1.3 }]]), new Map());
  assert.ok(better.homeGoals > base.homeGoals);
  assert.ok(better.awayCleanSheet < base.awayCleanSheet);
});
