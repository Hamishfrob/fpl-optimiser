import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oddsNameToTeamId } from '../src/teams.js';

const boot = JSON.parse(readFileSync(new URL('./fixtures/bootstrap.json', import.meta.url)));
const csv = readFileSync(new URL('./fixtures/fixtures.csv', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const nameOf = (id) => boot.teams.find((t) => t.id === id).name;

test('every Premier League team name in the odds file resolves', () => {
  const lines = csv.split(/\r?\n/).slice(1).filter((l) => l.startsWith('E0,'));
  assert.ok(lines.length >= 5);
  for (const l of lines) {
    const [, , , home, away] = l.split(',');
    oddsNameToTeamId(home, boot.teams);
    oddsNameToTeamId(away, boot.teams);
  }
});

test('odds-file short names map to the FPL team names', () => {
  const pairs = [['Man United', 'Man Utd'], ['Man City', 'Man City'], ['Ipswich', 'Ipswich Town'],
    ['Hull', 'Hull City'], ['Coventry', 'Coventry City'], ["Nott'm Forest", "Nott'm Forest"], ['Tottenham', 'Spurs']];
  for (const [odds, fpl] of pairs) assert.equal(nameOf(oddsNameToTeamId(odds, boot.teams)), fpl);
});

test('an unknown team name throws a clear error', () => {
  assert.throws(() => oddsNameToTeamId('Atlantis FC', boot.teams), /Unknown team in odds file: Atlantis FC/);
});
