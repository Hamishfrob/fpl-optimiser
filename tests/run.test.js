import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDaily } from '../job/run.js';

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const boot = fx('bootstrap.json');
const csv = readFileSync(new URL('./fixtures/fixtures.csv', import.meta.url), 'utf8');
const NOW = new Date('2026-10-24T09:00:00Z');

// A legal 15-man squad drawn from the trimmed fixture, to stand in for Harvey's picks.
function legalPicks() {
  const need = { 1: 2, 2: 5, 3: 5, 4: 3 }, per = {}, picks = [];
  for (const e of boot.elements) {
    per[e.team] = per[e.team] ?? 0;
    if (need[e.element_type] > 0 && per[e.team] < 3) { need[e.element_type]--; per[e.team]++; picks.push({ element: e.id, position: picks.length + 1, multiplier: 1, is_captain: false, is_vice_captain: false }); }
  }
  assert.equal(picks.length, 15);
  return picks;
}
function fetchers({ picks = null, odds = csv } = {}) {
  return {
    fetchBootstrap: async () => boot,
    fetchFixtures: async () => fx('fpl-fixtures.json'),
    fetchOddsCsv: async () => odds,
    fetchEntry: async () => ({ entry: { id: 11160462, name: 'Hlfcfc', current_event: 8 }, history: { current: [{ event: 8, bank: 5, value: 1000, event_transfers: 0, event_transfers_cost: 0 }, ], chips: [] }, transfers: [], picks: picks && { picks, entry_history: { event: 8, bank: 5, value: 995 }, active_chip: null } }),
  };
}
const out = () => mkdtempSync(join(tmpdir(), 'fpl-'));

test('before the first deadline: no squad file, status says so, advice is a from-scratch squad', async () => {
  const dir = out();
  await runDaily({ outDir: dir, entryId: 11160462, fetchers: fetchers(), now: NOW });
  const status = JSON.parse(readFileSync(join(dir, 'status.json')));
  assert.equal(status.squadAvailable, false);
  assert.equal(status.updatedAt, NOW.toISOString());
  assert.equal(existsSync(join(dir, 'squad')) && readdirSync(join(dir, 'squad')).length > 0, false);
  const advice = JSON.parse(readFileSync(join(dir, 'advice', '2026-10-24.json')));
  assert.equal(advice.mode, 'build-from-scratch');
  assert.equal(advice.squad.length, 15);
});

test('with picks: writes data/squad/gw8.json and an advice file with transfers and chips', async () => {
  const dir = out();
  await runDaily({ outDir: dir, entryId: 11160462, fetchers: fetchers({ picks: legalPicks() }), now: NOW, horizon: 2 });
  const squad = JSON.parse(readFileSync(join(dir, 'squad', 'gw8.json')));
  assert.equal(squad.picks.length, 15);
  assert.equal(JSON.parse(readFileSync(join(dir, 'status.json'))).squadAvailable, true);
  const advice = JSON.parse(readFileSync(join(dir, 'advice', '2026-10-24.json')));
  assert.equal(advice.mode, 'transfers');
  assert.ok(Array.isArray(advice.plan) && advice.chips.length === 4);
  assert.deepEqual(advice.plan.map((g) => g.gw), [9, 10], 'plan weeks carry real gameweek numbers');
});

test('earlier gameweek squad files are never touched', async () => {
  const dir = out();
  mkdirSync(join(dir, 'squad'), { recursive: true });
  writeFileSync(join(dir, 'squad', 'gw7.json'), '{"keep":"me"}');
  await runDaily({ outDir: dir, entryId: 11160462, fetchers: fetchers({ picks: legalPicks() }), now: NOW, horizon: 2 });
  assert.equal(readFileSync(join(dir, 'squad', 'gw7.json'), 'utf8'), '{"keep":"me"}');
});

test('an odds team name that matches nothing stops the job before anything is written', async () => {
  const dir = out();
  const bad = csv.replace('Arsenal', 'Atlantis FC');
  await assert.rejects(() => runDaily({ outDir: dir, entryId: 11160462, fetchers: fetchers({ odds: bad }), now: NOW }), /Unknown team in odds file: Atlantis FC/);
  assert.deepEqual(readdirSync(dir), []);
});
