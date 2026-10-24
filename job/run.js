// Daily job: fetch the free data, write it as JSON the web page reads, and log today's advice.
// Everything is computed first and written last, so a failure never leaves half-updated data.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as real from './fetch.js';
import { parseFixturesCsv } from '../src/odds.js';
import { createSolver } from '../src/solver.js';
import { computeAdvice } from '../src/advice.js';
import Highs from '../web/vendor/highs.mjs';

const PLAYER_FIELDS = ['id', 'web_name', 'team', 'element_type', 'now_cost', 'cost_change_start', 'chance_of_playing_next_round',
  'news', 'status', 'minutes', 'starts', 'expected_goals_per_90', 'expected_assists_per_90', 'defensive_contribution_per_90',
  'saves_per_90', 'yellow_cards', 'red_cards', 'bonus', 'selected_by_percent', 'form', 'total_points', 'expected_goals', 'expected_assists'];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

export async function runDaily({ outDir, entryId, fetchers = real, now = new Date(), horizon }) {
  const [bootstrap, fplFixtures, oddsCsv, entry] = await Promise.all([
    fetchers.fetchBootstrap(), fetchers.fetchFixtures(), fetchers.fetchOddsCsv(), fetchers.fetchEntry(entryId)]);
  const oddsRows = parseFixturesCsv(oddsCsv);
  const solver = createSolver(await Highs());
  const date = now.toISOString().slice(0, 10);
  const advice = computeAdvice({ bootstrap, fplFixtures, oddsRows, entry, solver, date, overrides: { horizon } }); // throws on an unmatched odds team name
  const gw = advice.gw;
  const picks = entry.picks;
  const files = new Map();
  const put = (path, data) => files.set(path, JSON.stringify(data));
  if (picks) {
    const pickedGw = picks.entry_history.event;
    put(`squad/gw${pickedGw}.json`, { gw: pickedGw, fetchedAt: now.toISOString(), picks: picks.picks, entry_history: picks.entry_history, active_chip: picks.active_chip ?? null });
  }
  put('advice/latest.json', advice);
  put(`advice/${date}.json`, advice);
  put('bootstrap.json', { teams: bootstrap.teams.map((t) => pick(t, ['id', 'name', 'short_name'])), events: bootstrap.events.map((e) => pick(e, ['id', 'name', 'deadline_time', 'is_current', 'is_next', 'finished'])),
    elements: bootstrap.elements.map((e) => pick(e, PLAYER_FIELDS)) });
  put('fixtures.json', fplFixtures.map((f) => pick(f, ['id', 'event', 'team_h', 'team_a', 'kickoff_time', 'finished', 'team_h_score', 'team_a_score'])));
  put('odds.json', { fetchedAt: now.toISOString(), rows: oddsRows });
  put('entry.json', { entry: pick(entry.entry, ['id', 'name', 'player_first_name', 'current_event']), history: entry.history, transfers: entry.transfers });
  put('status.json', { updatedAt: now.toISOString(), gw, squadAvailable: Boolean(picks) });

  for (const [path, text] of files) {
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return advice;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  // Optional: node job/run.js --entry 1 --out data-test  (try the page with any public team's squad)
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const { entryId } = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
  const advice = await runDaily({ outDir: join(root, arg('--out') ?? 'data'), entryId: Number(arg('--entry') ?? entryId) });
  console.log(`Wrote data for gameweek ${advice.gw} (${advice.mode}).`);
}
