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

/** Pair each sale with a purchase in the same position, so "midfielder to defender" is never shown as one swap. */
export function pairMoves(outs, ins, positionOf) {
  const free = [...ins];
  const pairs = outs.map((o) => {
    const i = free.findIndex((x) => positionOf(x) === positionOf(o));
    return { out: o, in: i >= 0 ? free.splice(i, 1)[0] : undefined };
  });
  for (const p of pairs) if (p.in === undefined && free.length) p.in = free.shift();
  return pairs.filter((p) => p.in !== undefined);
}

/** Milliseconds left to a deadline as days, hours, minutes, seconds (never negative). */
export function countdownParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

/** calm: over two days away. soon: over twelve hours. now: twelve hours or less. */
export function countdownStage(seconds) {
  return seconds > 2 * 86400 ? 'calm' : seconds > 12 * 3600 ? 'soon' : 'now';
}

/** Blue for a low predicted score up to red for 8 or more. */
export function heatColour(points, max = 8) {
  const t = Math.min(1, Math.max(0, points / max));
  return `hsl(${Math.round(210 - t * 190)} 80% 55%)`;
}

const EASE_SCALE = ['#e8605a', '#f0a95a', '#e9dc6b', '#8fd17e', '#3ec27a']; // hard to easy
/** Colour for a fixture from the expected goal difference for that club (about -1.2 hard to +1.2 easy). */
export function easeColour(goalDifference) {
  return EASE_SCALE[Math.max(0, Math.min(4, Math.round(((goalDifference + 1.2) / 2.4) * 4)))];
}

/** Starting XI split into rows for the pitch: goalkeeper, defenders, midfielders, forwards. */
export function pitchRows(xi, positionOf) {
  return [1, 2, 3, 4].map((p) => xi.filter((id) => positionOf(id) === p));
}
