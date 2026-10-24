// Expected FPL points per player per gameweek. Version 1: simple and explainable, replaceable later.
import rulesJson from './rules.js';
import { impliedGoals } from './odds.js';
import { oddsNameToTeamId } from './teams.js';
import { teamStrengths, fixtureExpectations } from './ratings.js';

const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function poissonTail(mu, k) {
  if (k <= 0) return 1;
  let term = Math.exp(-mu), cdf = term;
  for (let i = 1; i < k; i++) { term *= mu / i; cdf += term; }
  return Math.max(0, 1 - cdf);
}
// Expected value of floor(G / 2) for G ~ Poisson(lambda): the "1 point lost per 2 goals conceded" rule.
const expectedHalfGoals = (lambda) => lambda / 2 - (1 - Math.exp(-2 * lambda)) / 4;

const shrink = (rate, minutes, prior, rules) => {
  const w = clamp(minutes / rules.shrink_minutes, 0, 1);
  return rate * w + prior * (1 - w);
};

/** @param {object} player FPL element @param {{goalsFor:number,goalsAgainst:number,cleanSheet:number,source:string,label:string}[]} fixtures 0, 1 or 2 */
export function expectedPoints(player, fixtures, rules, ctx) {
  const pos = POS[player.element_type];
  // The FPL "chance of playing" is for the next round only; later weeks assume he is fit.
  const chance = (ctx.gwOffset ?? 0) > 0 || player.chance_of_playing_next_round == null ? 1 : player.chance_of_playing_next_round / 100;
  const share = ctx.teamPlayed > 0 ? clamp(player.minutes / (ctx.teamPlayed * 90), 0, 1) : 0.5;
  const e90 = chance * share;
  const prior = ctx.posAvg[player.element_type];
  const xg90 = shrink(player.expected_goals_per_90 ?? 0, player.minutes, prior.xg, rules);
  const xa90 = shrink(player.expected_assists_per_90 ?? 0, player.minutes, prior.xa, rules);
  const nineties = player.minutes / 90 + 5;
  const bonus90 = ((player.bonus ?? 0) + 0.6) / nineties;
  const card90 = -(((player.yellow_cards ?? 0) * -rules.yellow) + ((player.red_cards ?? 0) * -rules.red) + 0.2) / nineties;
  const threshold = rules.defcon.threshold[pos];
  const defcon = threshold > 0 ? rules.defcon.points * poissonTail(player.defensive_contribution_per_90 ?? 0, threshold) : 0;

  let points = 0;
  for (const f of fixtures) {
    const attack = f.goalsFor / rules.league_avg_goals;
    const perMatch = rules.appearance_full
      + rules.goal[pos] * xg90 * attack
      + rules.assist * xa90 * attack
      + rules.clean_sheet[pos] * f.cleanSheet
      + rules.goals_conceded_per_2[pos] * expectedHalfGoals(f.goalsAgainst)
      + (pos === 'GKP' ? (rules.save_per_3 * (player.saves_per_90 ?? 0) / 3) * (f.goalsAgainst / rules.league_avg_goals) : 0)
      + defcon + bonus90 + card90;
    points += e90 * perMatch;
  }
  const reasons = fixtures.length ? [
    `Fixtures: ${fixtures.map((f) => f.label).join(' and ')}`,
    `Chance of playing: ${Math.round(chance * 100)}%`,
    `Expected goals per 90: ${xg90.toFixed(2)}, assists per 90: ${xa90.toFixed(2)}`,
  ] : ['No fixture this gameweek'];
  return { points, estimate: fixtures.some((f) => f.source === 'estimate'), reasons };
}

/** @param {object} bootstrap {teams, elements} @param {object[]} fplFixtures @param {object[]} oddsRows parsed rows @returns {{points:Map<number,number[]>, detail:Map<number,object[]>}} */
export function projectAll(bootstrap, fplFixtures, oddsRows, gwFrom, horizon) {
  const rules = rulesJson;
  const { teams, elements } = bootstrap;
  const strengths = teamStrengths(fplFixtures, teams);
  const oddsByPair = new Map();
  for (const row of oddsRows) {
    oddsByPair.set(`${oddsNameToTeamId(row.home, teams)}-${oddsNameToTeamId(row.away, teams)}`, impliedGoals(row));
  }
  const teamPlayed = new Map(teams.map((t) => [t.id, 0]));
  for (const f of fplFixtures) if (f.finished) { teamPlayed.set(f.team_h, teamPlayed.get(f.team_h) + 1); teamPlayed.set(f.team_a, teamPlayed.get(f.team_a) + 1); }
  const posAvg = {};
  for (const type of [1, 2, 3, 4]) {
    const ps = elements.filter((e) => e.element_type === type && e.minutes >= 450);
    const m = (k) => (ps.length ? ps.reduce((a, e) => a + (e[k] ?? 0), 0) / ps.length : 0);
    posAvg[type] = { xg: m('expected_goals_per_90'), xa: m('expected_assists_per_90') };
  }
  const short = new Map(teams.map((t) => [t.id, t.short_name]));
  const points = new Map(), detail = new Map();
  for (const p of elements) { points.set(p.id, []); detail.set(p.id, []); }
  for (let gw = gwFrom; gw < gwFrom + horizon; gw++) {
    const games = fplFixtures.filter((f) => f.event === gw);
    for (const p of elements) {
      const mine = [];
      for (const g of games) {
        if (g.team_h !== p.team && g.team_a !== p.team) continue;
        const e = fixtureExpectations(g, strengths, oddsByPair);
        const home = g.team_h === p.team;
        mine.push(home
          ? { goalsFor: e.homeGoals, goalsAgainst: e.awayGoals, cleanSheet: e.homeCleanSheet, source: e.source, label: `v ${short.get(g.team_a)} (H)` }
          : { goalsFor: e.awayGoals, goalsAgainst: e.homeGoals, cleanSheet: e.awayCleanSheet, source: e.source, label: `@ ${short.get(g.team_h)} (A)` });
      }
      const r = expectedPoints(p, mine, rules, { teamPlayed: teamPlayed.get(p.team), posAvg, gwOffset: gw - gwFrom });
      points.get(p.id).push(r.points);
      detail.get(p.id).push({ estimate: r.estimate, reasons: r.reasons, fixtures: mine.map((m) => m.label) });
    }
  }
  return { points, detail };
}
