import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolver } from '../src/solver.js';
import { evaluateChips } from '../src/chips.js';
import Highs from '../web/vendor/highs.mjs';

const highs = await Highs();
const solver = createSolver(highs);

function pool(boost = {}) {
  const out = []; let id = 1;
  const add = (pos, n, base) => { for (let i = 0; i < n; i++, id++) { const b = base / 10 + (i % 7) * 0.4; out.push({ id, position: pos, teamId: (id % 12) + 1, cost: base + (i % 5) * 5, points: [0, 1, 2, 3].map((k) => b * (boost[k] ?? 1)) }); } };
  add(1, 6, 40); add(2, 14, 45); add(3, 16, 55); add(4, 12, 60);
  return out;
}
function setup(players, extra = {}) {
  const s = solver.solveSquad({ players, budget: 1000, gwIndex: 0 });
  const sell = new Map(s.squad.map((id) => [id, players.find((p) => p.id === id).cost]));
  return { squad: s.squad, bank: 1000 - s.cost, freeTransfers: 1, sellPrices: sell, players, gwFrom: 0, horizon: 4, hitCost: 4, ftValue: 1.5,
    chipsAvailable: ['wildcard', 'freehit', 'bboost', '3xc'], currentGw: 10, firstSetDeadlineGw: 19, ...extra };
}
const find = (advice, chip) => advice.find((a) => a.chip === chip);

test('a big gameweek three weeks out is the best week for Bench Boost and Triple Captain', () => {
  const advice = evaluateChips(solver, setup(pool({ 2: 2 })));
  assert.equal(find(advice, 'bboost').bestGw, 12);
  assert.equal(find(advice, '3xc').bestGw, 12);
  assert.equal(find(advice, 'bboost').playNow, false);
});
test('playNow is true only when this gameweek is the best one', () => {
  const advice = evaluateChips(solver, setup(pool({ 0: 2 })));
  assert.equal(find(advice, 'bboost').bestGw, 10);
  assert.equal(find(advice, 'bboost').playNow, true);
});
test('Free Hit cannot be played in Gameweek 1', () => {
  const advice = evaluateChips(solver, setup(pool({ 0: 3 }), { currentGw: 1 }));
  assert.notEqual(find(advice, 'freehit').bestGw, 1);
});
test('while the first set is unused no chip is suggested after the Gameweek 19 deadline', () => {
  const advice = evaluateChips(solver, setup(pool({ 3: 5 }), { currentGw: 18 }));
  for (const a of advice) assert.ok(a.bestGw === null || a.bestGw <= 19, `${a.chip} suggested GW${a.bestGw}`);
});
test('a chip that is not available is never returned', () => {
  const advice = evaluateChips(solver, setup(pool(), { chipsAvailable: ['bboost'] }));
  assert.deepEqual(advice.map((a) => a.chip), ['bboost']);
});
test('Wildcard and Free Hit now come with a legal squad', () => {
  const advice = evaluateChips(solver, setup(pool({ 0: 2 })));
  for (const chip of ['wildcard', 'freehit']) {
    const a = find(advice, chip);
    if (a.playNow) assert.equal(a.squadIfNow.squad.length, 15);
  }
  const w = find(advice, 'wildcard');
  assert.ok(w.squadIfNow === undefined || w.squadIfNow.squad.length === 15);
});
