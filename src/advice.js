// Turns data into advice. Used by the daily job (Node) and by the page's Recalculate button (browser worker).
import { projectAll } from './projections.js';
import { evaluateChips } from './chips.js';
import { deriveFreeTransfers, sellingPrices } from './freeTransfers.js';

export const HORIZON = 4;
export const FIRST_SET_DEADLINE_GW = 19;
const ALL_CHIPS = ['wildcard', 'freehit', 'bboost', '3xc'];

/**
 * @param {{bootstrap:object, fplFixtures:object[], oddsRows:object[], entry:{history:object,transfers:object[],picks:object|null}, solver:object, date:string,
 *          overrides?:{bank?:number, freeTransfers?:number, budget?:number, horizon?:number}}} input
 * @returns advice object (see docs/superpowers/specs). `info` holds predicted points and reasons for every player mentioned.
 */
export function computeAdvice({ bootstrap, fplFixtures, oddsRows, entry, solver, date, overrides = {} }) {
  const nextEvent = bootstrap.events.find((e) => e.is_next) ?? bootstrap.events.find((e) => !e.finished);
  const gw = nextEvent.id;
  const horizon = overrides.horizon ?? HORIZON;
  const proj = projectAll(bootstrap, fplFixtures, oddsRows, gw, horizon);
  const players = bootstrap.elements.map((e) => ({ id: e.id, position: e.element_type, teamId: e.team, cost: e.now_cost, points: proj.points.get(e.id) }));
  const mention = new Set();
  let advice;
  const picks = entry.picks;
  if (!picks) {
    const summed = players.map((p) => ({ ...p, points: [p.points.reduce((a, b) => a + b, 0)] }));
    const s = solver.solveSquad({ players: summed, budget: overrides.budget ?? 1000, gwIndex: 0 });
    s.squad.forEach((id) => mention.add(id));
    advice = { date, gw, mode: 'build-from-scratch', squad: s.squad, xi: s.xi, bench: s.bench, captain: s.captain, viceCaptain: s.viceCaptain, cost: s.cost, points: s.points };
  } else {
    const squadIds = picks.picks.map((p) => p.element);
    const bank = overrides.bank ?? picks.entry_history.bank;
    const freeTransfers = overrides.freeTransfers ?? deriveFreeTransfers(entry.history, entry.transfers, gw);
    const input = { squad: squadIds, bank, freeTransfers, sellPrices: sellingPrices(squadIds, entry.transfers, bootstrap.elements),
      players, gwFrom: 0, horizon, hitCost: 4, ftValue: 1.5 };
    const plan = solver.planTransfers(input);
    const used = new Set((entry.history.chips ?? []).filter((c) => c.event <= FIRST_SET_DEADLINE_GW).map((c) => c.name));
    const chips = evaluateChips(solver, { ...input, chipsAvailable: ALL_CHIPS.filter((c) => !used.has(c)), currentGw: gw, firstSetDeadlineGw: FIRST_SET_DEADLINE_GW });
    squadIds.forEach((id) => mention.add(id));
    plan.gameweeks.forEach((g) => { g.in.forEach((id) => mention.add(id)); g.xi.forEach((id) => mention.add(id)); });
    advice = { date, gw, mode: 'transfers', squad: squadIds, freeTransfers, bank, chipEntitlementVerified: false, totalGain: plan.totalGain,
      plan: plan.gameweeks.map((g) => ({ gw: g.gw, in: g.in, out: g.out, hitPoints: g.hitPoints, captain: g.captain, xi: g.xi, bench: g.bench, points: g.points })),
      chips: chips.map((c) => ({ ...c, squadIfNow: c.squadIfNow && { squad: c.squadIfNow.squad, xi: c.squadIfNow.xi, bench: c.squadIfNow.bench, captain: c.squadIfNow.captain } })) };
    chips.forEach((c) => c.squadIfNow?.squad.forEach((id) => mention.add(id)));
  }
  advice.info = {};
  for (const id of mention) advice.info[id] = { points: proj.points.get(id), estimate: proj.detail.get(id)[0].estimate, reasons: proj.detail.get(id)[0].reasons, fixtures: proj.detail.get(id).map((d) => d.fixtures.join(' + ') || 'blank') };
  return advice;
}
