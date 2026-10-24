// Expected goals for any fixture. Uses bookmaker odds where we have them (next round only),
// otherwise an estimate from each team's results so far this season.
// (FPL's own strength_attack/defence fields are all 0 this season, so they are not used.)
const HOME_GOALS = 1.5;  // league-average goals for a home team
const AWAY_GOALS = 1.2;  // league-average goals for an away team (mean of the two is 1.35)
const PRIOR_MATCHES = 4; // matches of average form blended in, so a few results don't swing a rating

/** Attack and defence strength per team from finished fixtures. 1 is average; above 1 scores more / concedes more. */
export function teamStrengths(fplFixtures, teams) {
  const games = fplFixtures.filter((f) => f.finished && f.team_h_score != null);
  const stats = new Map(teams.map((t) => [t.id, { n: 0, gf: 0, ga: 0 }]));
  let totalGoals = 0;
  for (const f of games) {
    const h = stats.get(f.team_h), a = stats.get(f.team_a);
    h.n++; a.n++; h.gf += f.team_h_score; h.ga += f.team_a_score; a.gf += f.team_a_score; a.ga += f.team_h_score;
    totalGoals += f.team_h_score + f.team_a_score;
  }
  const avg = games.length ? totalGoals / (2 * games.length) : 1.35;
  const out = new Map();
  for (const [id, s] of stats) {
    out.set(id, {
      attack: (s.gf + PRIOR_MATCHES * avg) / ((s.n + PRIOR_MATCHES) * avg),
      defence: (s.ga + PRIOR_MATCHES * avg) / ((s.n + PRIOR_MATCHES) * avg),
    });
  }
  return out;
}

/** @param {{team_h:number,team_a:number}} fixture @param {Map<number,{attack:number,defence:number}>} strengths @param {Map<string,object>} oddsByPair key `${homeId}-${awayId}` */
export function fixtureExpectations(fixture, strengths, oddsByPair) {
  const odds = oddsByPair.get(`${fixture.team_h}-${fixture.team_a}`);
  if (odds) return { ...odds, source: 'odds' };
  const h = strengths.get(fixture.team_h), a = strengths.get(fixture.team_a);
  const homeGoals = HOME_GOALS * h.attack * a.defence;
  const awayGoals = AWAY_GOALS * a.attack * h.defence;
  return { homeGoals, awayGoals, homeCleanSheet: Math.exp(-awayGoals), awayCleanSheet: Math.exp(-homeGoals),
    homeWin: homeGoals / (homeGoals + awayGoals), source: 'estimate' };
}
