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

const POOL_PER_POSITION = { 1: 12, 2: 40, 3: 45, 4: 25 };
const SOLVE_OPTIONS = { time_limit: 25, mip_rel_gap: 0.005 };
const FT_USE_PENALTY = 0.2; // stops trivial transfers, as in open-fpl-solver

/**
 * Multi-gameweek transfer plan. State per gameweek: squad, XI, captain, transfers in/out, free transfers, bank.
 * chips: {[gwIndex]: 'wildcard'|'bboost'|'3xc'} (free hit is handled separately in chips.js).
 * @param {{squad:number[],bank:number,freeTransfers:number,sellPrices:Map<number,number>,players:object[],gwFrom:number,horizon:number,hitCost:number,ftValue:number,chips?:object}} input
 */
export function planTransfers(highs, input) {
  const { squad: start, bank, freeTransfers, sellPrices, gwFrom, horizon, hitCost, ftValue, chips = {}, noTransfers = false } = input;
  const horizonPts = (p) => { let t = 0; for (let k = 0; k < horizon; k++) t += p.points[gwFrom + k] ?? 0; return t; };
  const keep = new Set(start);
  for (const pos of [1, 2, 3, 4]) {
    input.players.filter((p) => p.position === pos).sort((a, b) => horizonPts(b) - horizonPts(a)).slice(0, POOL_PER_POSITION[pos]).forEach((p) => keep.add(p.id));
  }
  const players = input.players.filter((p) => keep.has(p.id));
  const pts = (p, t) => p.points[gwFrom + t] ?? 0;
  const startSet = new Set(start);
  const sp = (p) => (sellPrices.get(p.id) ?? p.cost);
  const obj = [], rows = [], bin = [], cont = [];
  const add = (name, expr, op, rhs) => rows.push(` ${name}: ${expr} ${op} ${rhs}`);
  const wild = (t) => chips[t] === 'wildcard';
  for (let t = 0; t < horizon; t++) {
    const benchW = chips[t] === 'bboost' ? 1 : BENCH_WEIGHT;
    const capMult = chips[t] === '3xc' ? 2 : 1;
    const S = (p) => `s${p.id}_${t}`, X = (p) => `x${p.id}_${t}`, C = (p) => `c${p.id}_${t}`, IN = (p) => `i${p.id}_${t}`, OUT = (p) => `o${p.id}_${t}`;
    for (const p of players) {
      bin.push(S(p), X(p), C(p), IN(p), OUT(p));
      obj.push([pts(p, t) * (1 - benchW), X(p)], [pts(p, t) * benchW, S(p)], [pts(p, t) * capMult, C(p)], [-FT_USE_PENALTY, IN(p)]);
      const prev = t === 0 ? (startSet.has(p.id) ? '1' : '0') : `s${p.id}_${t - 1}`;
      add(`flow${p.id}_${t}`, `${S(p)} - ${IN(p)} + ${OUT(p)}${t === 0 ? '' : ` - ${prev}`}`, '=', t === 0 ? prev : 0);
      add(`xin${p.id}_${t}`, `${X(p)} - ${S(p)}`, '<=', 0);
      add(`cin${p.id}_${t}`, `${C(p)} - ${X(p)}`, '<=', 0);
      if (noTransfers) { add(`noin${p.id}_${t}`, IN(p), '=', 0); add(`noout${p.id}_${t}`, OUT(p), '=', 0); }
    }
    add(`size_${t}`, sum(players.map((p) => [1, S(p)])), '=', 15);
    for (const pos of [1, 2, 3, 4]) add(`pos${pos}_${t}`, sum(players.filter((p) => p.position === pos).map((p) => [1, S(p)])), '=', SQUAD_SIZE[pos]);
    for (const club of new Set(players.map((p) => p.teamId))) add(`club${club}_${t}`, sum(players.filter((p) => p.teamId === club).map((p) => [1, S(p)])), '<=', 3);
    add(`xi_${t}`, sum(players.map((p) => [1, X(p)])), '=', 11);
    const xiPos = (pos) => sum(players.filter((p) => p.position === pos).map((p) => [1, X(p)]));
    add(`xigk_${t}`, xiPos(1), '=', 1); add(`xidef_${t}`, xiPos(2), '>=', 3); add(`ximid_${t}`, xiPos(3), '>=', 2); add(`xifwd_${t}`, xiPos(4), '>=', 1);
    add(`cap_${t}`, sum(players.map((p) => [1, C(p)])), '=', 1);
    // bank after this gameweek
    const flow = [[1, `b${t}`], ...players.flatMap((p) => [[-sp(p), OUT(p)], [p.cost, IN(p)]])];
    add(`bank_${t}`, sum(flow), '=', t === 0 ? bank : 0);
    if (t > 0) rows[rows.length - 1] = ` bank_${t}: ${sum([[1, `b${t}`], [-1, `b${t - 1}`], ...players.flatMap((p) => [[-sp(p), OUT(p)], [p.cost, IN(p)]])])} = 0`;
    // free transfers and hits
    cont.push(`b${t}`, `h${t}`, `f${t}`);
    add(`tr_${t}`, sum([[1, `h${t}`], [1, `f${t}`], ...players.map((p) => [-1, IN(p)])]), '>=', 0);
    // A hit is exactly the transfers beyond the free ones: paying (y=1) forces every free transfer to be used,
    // so the solver cannot buy extra banked free transfers by overpaying.
    bin.push(`y${t}`);
    add(`hit_flag_${t}`, `h${t} - 15 y${t}`, '<=', 0);
    if (!wild(t)) add(`hit_all_ft_${t}`, sum([...players.map((p) => [1, IN(p)]), [-1, `h${t}`], [-1, `f${t}`], [-5, `y${t}`]]), '>=', -5);
    if (wild(t)) add(`nohit_${t}`, `h${t}`, '=', 0);
    obj.push([-hitCost, `h${t}`], [ftValue, `g${t}`]);
    cont.push(`g${t}`); // free transfers carried into the next gameweek
    const used = wild(t) ? [] : players.map((p) => [1, IN(p)]);
    add(`next_${t}`, sum([[1, `g${t}`], [-1, `f${t}`], ...used, [-1, `h${t}`]]), '<=', 1);
    if (t + 1 < horizon) add(`link_${t}`, `f${t + 1} - g${t}`, '=', 0);
  }
  add('ft0', 'f0', '=', freeTransfers);
  const bounds = [];
  for (let t = 0; t < horizon; t++) bounds.push(` 0 <= b${t} <= 100000`, ` 0 <= h${t} <= 15`, ` 0 <= f${t} <= 5`, ` 0 <= g${t} <= 5`);
  const lp = ['Maximize', ` obj: ${sum(obj)}`, 'Subject To', ...rows, 'Bounds', ...bounds, 'Binary', ` ${bin.join(' ')}`, 'End'].join('\n');
  const r = highs.solve(lp, SOLVE_OPTIONS);
  if (!r.Columns || !Object.keys(r.Columns).length || !['Optimal', 'Time limit reached'].includes(r.Status)) throw new Error('No legal plan');
  const v = (name) => r.Columns[name]?.Primal ?? 0;
  const byId = new Map(players.map((p) => [p.id, p]));
  const out = [];
  let total = 0;
  for (let t = 0; t < horizon; t++) {
    const on = (pre, p) => v(`${pre}${p.id}_${t}`) > 0.5;
    const squad = players.filter((p) => on('s', p)).map((p) => p.id);
    const xi = squad.filter((id) => on('x', byId.get(id)));
    const captain = players.find((p) => on('c', p)).id;
    const inn = players.filter((p) => on('i', p)).map((p) => p.id), outt = players.filter((p) => on('o', p)).map((p) => p.id);
    const hit = wild(t) ? 0 : -hitCost * Math.round(v(`h${t}`)) + 0; // + 0 turns -0 into 0
    const bench = squad.filter((id) => !xi.includes(id));
    const gwPoints = xi.reduce((a, id) => a + pts(byId.get(id), t), 0) + pts(byId.get(captain), t) * (1 + (chips[t] === '3xc' ? 2 : 0) - (chips[t] === '3xc' ? 1 : 0))
      + (chips[t] === 'bboost' ? bench.reduce((a, id) => a + pts(byId.get(id), t), 0) : 0);
    total += gwPoints + hit;
    out.push({ gw: gwFrom + t, in: inn, out: outt, hitPoints: hit, squad, xi, bench, captain, bank: Math.round(v(`b${t}`)), points: gwPoints, freeTransfers: Math.round(v(`f${t}`)) });
  }
  return { gameweeks: out, totalPoints: total };
}

export function createSolver(highs) {
  return {
    solveSquad: (input) => solveSquad(highs, input),
    planTransfers: (input) => {
      const plan = planTransfers(highs, input);
      const baseline = planTransfers(highs, { ...input, noTransfers: true });
      return { ...plan, totalGain: plan.totalPoints - baseline.totalPoints };
    },
  };
}
