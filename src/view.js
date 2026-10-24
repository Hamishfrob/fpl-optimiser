// Small pure helpers for the page, kept out of the DOM code so they can be tested.
const STALE_HOURS = 36;

export function isStale(updatedAt, now = new Date(), hours = STALE_HOURS) {
  const t = Date.parse(updatedAt);
  return !Number.isFinite(t) || now.getTime() - t > hours * 3600 * 1000;
}

export const money = (tenths) => `£${(tenths / 10).toFixed(1)}m`;

/** Upcoming opponents for a team from gameweek gw onward, as "EVE (H)". */
export function nextFixtures(teamId, fixtures, teams, gw, n) {
  const short = new Map(teams.map((t) => [t.id, t.short_name]));
  return fixtures.filter((f) => f.event >= gw && (f.team_h === teamId || f.team_a === teamId))
    .sort((a, b) => a.event - b.event).slice(0, n)
    .map((f) => (f.team_h === teamId ? `${short.get(f.team_a)} (H)` : `${short.get(f.team_h)} (A)`));
}

/** Group player ids by their club. Biggest group first, then alphabetical by club name. */
export function groupByClub(ids, players, teams) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const groups = new Map();
  for (const id of ids) {
    const t = byId.get(id).team;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(id);
  }
  return [...groups].map(([teamId, list]) => ({ team: teams.find((t) => t.id === teamId), ids: list }))
    .sort((a, b) => b.ids.length - a.ids.length || a.team.name.localeCompare(b.team.name));
}
