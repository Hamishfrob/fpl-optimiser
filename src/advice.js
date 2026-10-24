// Turns data into advice. Used by the daily job (Node) and by the page's Recalculate button (browser worker).
import { projectAll } from './projections.js';
import { evaluateChips } from './chips.js';
import { deriveFreeTransfers, sellingPrices } from './freeTransfers.js';

const slim = (s) => ({ squad: s.squad, xi: s.xi, bench: s.bench, captain: s.captain });
export const HORIZON = 4;
export const FIRST_SET_DEADLINE_GW = 19; // first set of chips must be used before this gameweek's deadline
const LAST_GW = 38;
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
  const solveFromScratch = () => {
    const summed = players.map((p) => ({ ...p, points: [p.points.reduce((a, b) => a + b, 0)] }));
    const s = solver.solveSquad({ players: summed, budget: overrides.budget ?? 1000, gwIndex: 0 });
    s.squad.forEach((id) => mention.add(id));
    return { squad: s.squad, xi: s.xi, bench: s.bench, captain: s.captain, viceCaptain: s.viceCaptain, cost: s.cost, points: s.points };
  };
  if (!picks) {
    advice = { date, gw, mode: 'build-from-scratch', squadSource: null, ...solveFromScratch() };
  } else {
    const squadIds = picks.picks.map((p) => p.element);
    const bank = overrides.bank ?? picks.entry_history.bank;
    // Before a manager's first deadline every change is free; the model's cap is 5, which is close enough to unlimited.
    const beforeFirstDeadline = !(entry.history?.current ?? []).length;
    const freeTransfers = overrides.freeTransfers ?? (beforeFirstDeadline ? 5 : deriveFreeTransfers(entry.history, entry.transfers, gw));
    const input = { squad: squadIds, bank, freeTransfers, sellPrices: sellingPrices(squadIds, entry.transfers, bootstrap.elements, entry.startedEvent ?? entry.entry?.started_event ?? 1),
      players, gwFrom: 0, horizon, hitCost: 4, ftValue: 1.5 };
    const plan = solver.planTransfers(input);
    const firstHalf = gw <= FIRST_SET_DEADLINE_GW;
    const used = new Set((entry.history.chips ?? []).filter((c) => (firstHalf ? c.event <= FIRST_SET_DEADLINE_GW : c.event > FIRST_SET_DEADLINE_GW)).map((c) => c.name));
    const chips = evaluateChips(solver, { ...input, chipsAvailable: ALL_CHIPS.filter((c) => !used.has(c)), currentGw: gw, blockedNow: beforeFirstDeadline ? ['wildcard', 'freehit'] : [], windowEndGw: firstHalf ? FIRST_SET_DEADLINE_GW : LAST_GW });
    squadIds.forEach((id) => mention.add(id));
    plan.gameweeks.forEach((g) => { g.in.forEach((id) => mention.add(id)); g.xi.forEach((id) => mention.add(id)); });
    // The lineup as actually picked, when positions are known (positions 1-11 start, 12-15 are the bench).
    const lineup = picks.picks.every((p) => p.position) ? (() => {
      const sorted = [...picks.picks].sort((a, b) => a.position - b.position);
      return { xi: sorted.slice(0, 11).map((p) => p.element), bench: sorted.slice(11).map((p) => p.element),
        captain: sorted.find((p) => p.is_captain)?.element, viceCaptain: sorted.find((p) => p.is_vice_captain)?.element };
    })() : null;
    const squadSource = entry.squadSource ?? 'site';
    advice = { date, gw, mode: 'transfers', squadSource, lineup, ...(squadSource === 'manual' ? { suggested: solveFromScratch() } : {}), squad: squadIds, freeTransfers, bank, chipEntitlementVerified: false, totalGain: plan.totalGain,
      plan: plan.gameweeks.map((g, i) => ({ gw: gw + i, in: g.in, out: g.out, hitPoints: g.hitPoints, captain: g.captain, xi: g.xi, bench: g.bench, points: g.points })),
      chips: chips.map((c) => ({ ...c, squadIfNow: c.squadIfNow && slim(c.squadIfNow), detail: c.detail && slim(c.detail) })) };
    chips.forEach((c) => (c.detail?.squad ?? []).concat(c.detail?.bench ?? [], c.detail?.captain ? [c.detail.captain] : []).forEach((id) => mention.add(id)));
  }
  // Predicted points for every player, so the page can score any team without running the solver.
  advice.projections = Object.fromEntries(players.map((p) => [p.id, p.points.map((x) => Math.round(x * 100) / 100)]));
  advice.info = {};
  for (const id of mention) advice.info[id] = { points: proj.points.get(id), estimate: proj.detail.get(id)[0].estimate, reasons: proj.detail.get(id)[0].reasons, fixtures: proj.detail.get(id).map((d) => d.fixtures.join(' + ') || 'blank') };
  return advice;
}
