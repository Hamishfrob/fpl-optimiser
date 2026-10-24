// Picking a starting XI from 15 players, and checking that a typed-in squad is legal. Pure, used by the page.
const FORMATIONS = [[3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1], [5, 2, 3]]; // defenders, midfielders, forwards

/** Best legal XI by predicted points. positionOf(id) is 1 to 4; pointsOf(id) is predicted points. */
export function bestLineup(ids, positionOf, pointsOf) {
  const byPos = (p) => ids.filter((id) => positionOf(id) === p).sort((a, b) => pointsOf(b) - pointsOf(a));
  const [gks, defs, mids, fwds] = [1, 2, 3, 4].map(byPos);
  const sum = (list) => list.reduce((a, id) => a + pointsOf(id), 0);
  let best = null;
  for (const [d, m, f] of FORMATIONS) {
    if (defs.length < d || mids.length < m || fwds.length < f) continue;
    const xi = [gks[0], ...defs.slice(0, d), ...mids.slice(0, m), ...fwds.slice(0, f)];
    const total = sum(xi);
    if (!best || total > best.total) best = { xi, total };
  }
  const ranked = [...best.xi].sort((a, b) => pointsOf(b) - pointsOf(a));
  const bench = ids.filter((id) => !best.xi.includes(id))
    .sort((a, b) => (positionOf(a) === 1 ? -1 : 0) - (positionOf(b) === 1 ? -1 : 0) || pointsOf(b) - pointsOf(a));
  return { xi: best.xi, bench, captain: ranked[0], viceCaptain: ranked[1], total: best.total + pointsOf(ranked[0]) };
}

const NEED = { 1: ['goalkeepers', 2], 2: ['defenders', 5], 3: ['midfielders', 5], 4: ['forwards', 3] };

/** Plain-English errors for a typed-in squad (empty list means legal), and its value in tenths of £m. */
export function validateSquad(ids, players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const errors = [];
  if (new Set(ids).size !== ids.length) errors.push('You have picked the same player twice.');
  const unique = [...new Set(ids)].filter((id) => byId.has(id));
  if (unique.length !== 15) errors.push(`You need 15 players (you have ${unique.length}).`);
  for (const [pos, [label, n]] of Object.entries(NEED)) {
    const have = unique.filter((id) => byId.get(id).element_type === Number(pos)).length;
    if (unique.length === 15 && have !== n) errors.push(`You need ${n} ${label} (you have ${have}).`);
  }
  const perClub = {};
  for (const id of unique) perClub[byId.get(id).team] = (perClub[byId.get(id).team] ?? 0) + 1;
  if (Object.values(perClub).some((n) => n > 3)) errors.push('You can have at most 3 from one club.');
  return { errors, value: unique.reduce((a, id) => a + byId.get(id).now_cost, 0) };
}
