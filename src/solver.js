// Squad and transfer optimisation using the HiGHS solver (WebAssembly).
// How to load HiGHS (verified 2026-10-24 in Node 24 and in Chrome 152, not yet on a real Chromebook):
//   import Highs from '../web/vendor/highs.mjs';  const highs = await Highs();  highs.solve(lpTextString)
// The model follows solioanalytics/open-fpl-solver (Apache-2.0): binary squad/XI/captain variables,
// budget, 3-per-club and formation constraints, small value on the bench.

export const SQUAD_SIZE = { 1: 2, 2: 5, 3: 5, 4: 3 };
const BENCH_WEIGHT = 0.08; // flat value per bench point (open-fpl-solver uses per-slot weights)

const sum = (terms) => terms.map(([c, v]) => `${c < 0 ? '-' : '+'} ${Math.abs(c)} ${v}`).join(' ').replace(/^\+ /, '');

function solveLp(highs, lp) {
  const r = highs.solve(lp);
  if (r.Status !== 'Optimal') throw new Error('No legal squad');
  return r;
}

/** @param {{id:number,position:1|2|3|4,teamId:number,cost:number,points:number[]}[]} players  costs in tenths of £m */
export function solveSquad(highs, { players, budget, gwIndex, locked = [], banned = [] }) {
  const pts = (p) => p.points[gwIndex] ?? 0;
  const obj = [];
  for (const p of players) {
    obj.push([pts(p) - BENCH_WEIGHT * pts(p), `x${p.id}`], [BENCH_WEIGHT * pts(p), `s${p.id}`], [pts(p), `c${p.id}`]);
  }
  const rows = [];
  const add = (name, expr, op, rhs) => rows.push(` ${name}: ${expr} ${op} ${rhs}`);
  add('squad_size', sum(players.map((p) => [1, `s${p.id}`])), '=', 15);
  for (const pos of [1, 2, 3, 4]) {
    add(`pos${pos}`, sum(players.filter((p) => p.position === pos).map((p) => [1, `s${p.id}`])), '=', SQUAD_SIZE[pos]);
  }
  add('budget', sum(players.map((p) => [p.cost, `s${p.id}`])), '<=', budget);
  for (const t of new Set(players.map((p) => p.teamId))) {
    add(`club${t}`, sum(players.filter((p) => p.teamId === t).map((p) => [1, `s${p.id}`])), '<=', 3);
  }
  add('xi_size', sum(players.map((p) => [1, `x${p.id}`])), '=', 11);
  const xiPos = (pos) => sum(players.filter((p) => p.position === pos).map((p) => [1, `x${p.id}`]));
  add('xi_gk', xiPos(1), '=', 1); add('xi_def', xiPos(2), '>=', 3); add('xi_mid', xiPos(3), '>=', 2); add('xi_fwd', xiPos(4), '>=', 1);
  add('one_captain', sum(players.map((p) => [1, `c${p.id}`])), '=', 1);
  for (const p of players) { add(`xi_in_squad${p.id}`, `x${p.id} - s${p.id}`, '<=', 0); add(`cap_in_xi${p.id}`, `c${p.id} - x${p.id}`, '<=', 0); }
  for (const id of locked) add(`lock${id}`, `s${id}`, '=', 1);
  for (const id of banned) add(`ban${id}`, `s${id}`, '=', 0);
  const vars = players.flatMap((p) => [`s${p.id}`, `x${p.id}`, `c${p.id}`]);
  const lp = `Maximize\n obj: ${sum(obj)}\nSubject To\n${rows.join('\n')}\nBinary\n ${vars.join(' ')}\nEnd`;
  const r = solveLp(highs, lp);
  const on = (v) => r.Columns[v].Primal > 0.5;
  const byId = new Map(players.map((p) => [p.id, p]));
  const squad = players.filter((p) => on(`s${p.id}`)).map((p) => p.id);
  const xi = squad.filter((id) => on(`x${id}`));
  const captain = players.find((p) => on(`c${p.id}`)).id;
  const bench = squad.filter((id) => !xi.includes(id))
    .sort((a, b) => (byId.get(a).position === 1 ? -1 : 0) - (byId.get(b).position === 1 ? -1 : 0) || pts(byId.get(b)) - pts(byId.get(a)));
  const viceCaptain = xi.filter((id) => id !== captain).sort((a, b) => pts(byId.get(b)) - pts(byId.get(a)))[0];
  return {
    squad, xi, bench, captain, viceCaptain,
    cost: squad.reduce((a, id) => a + byId.get(id).cost, 0),
    points: xi.reduce((a, id) => a + pts(byId.get(id)), 0) + pts(byId.get(captain)),
  };
}

export function createSolver(highs) {
  return { solveSquad: (input) => solveSquad(highs, input) };
}
