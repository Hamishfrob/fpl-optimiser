import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolver } from '../src/solver.js';
import Highs from '../web/vendor/highs.mjs';

const highs = await Highs();
const solver = createSolver(highs);

function pool() {
  const out = []; let id = 1;
  const add = (pos, n, base) => { for (let i = 0; i < n; i++, id++) out.push({ id, position: pos, teamId: (id % 12) + 1, cost: base + (i % 5) * 5, points: [base / 10 + (i % 7) * 0.4] }); };
  add(1, 6, 40); add(2, 14, 45); add(3, 16, 55); add(4, 12, 60);
  return out;
}
const sellAll = (squad, players) => new Map(squad.map((id) => [id, players.find((p) => p.id === id).cost]));
const base = (players) => {
  const s = solver.solveSquad({ players, budget: 1000, gwIndex: 0 });
  return { s, squad: s.squad, sell: sellAll(s.squad, players) };
};
// Add a new midfielder at the same club and price as a squad midfielder, worth `extra` more points.
function withUpgrade(players, squad, extra) {
  const inSquad = new Set(squad);
  const victim = players.filter((p) => inSquad.has(p.id) && p.position === 3).sort((a, b) => a.points[0] - b.points[0])[0];
  const target = { id: 999, position: 3, teamId: victim.teamId, cost: victim.cost, points: [victim.points[0] + extra] };
  return { players: [...players, target], victim: victim.id, target: target.id };
}
const run = (players, squad, sell, ft, extra = {}) => solver.planTransfers({ squad, bank: 0, freeTransfers: ft, sellPrices: sell, players, gwFrom: 0, horizon: 1, hitCost: 4, ftValue: 1.5, ...extra });

test('with a free transfer a worthwhile upgrade is made', () => {
  const p0 = pool(), { squad, sell } = base(p0);
  const { players, victim, target } = withUpgrade(p0, squad, 2);
  const plan = run(players, squad, sell, 1);
  assert.deepEqual(plan.gameweeks[0].out, [victim]); assert.deepEqual(plan.gameweeks[0].in, [target]);
  assert.equal(plan.gameweeks[0].hitPoints, 0);
});
test('a swap worth 2 points does not justify a 4-point hit', () => {
  const p0 = pool(), { squad, sell } = base(p0);
  const { players } = withUpgrade(p0, squad, 2);
  const plan = run(players, squad, sell, 0);
  assert.deepEqual(plan.gameweeks[0].in, []);
});
test('a swap worth 9 points is worth a 4-point hit', () => {
  const p0 = pool(), { squad, sell } = base(p0);
  const { players, target } = withUpgrade(p0, squad, 9);
  const plan = run(players, squad, sell, 0);
  assert.deepEqual(plan.gameweeks[0].in, [target]);
  assert.equal(plan.gameweeks[0].hitPoints, -4);
});
test('bank never goes negative and the club limit holds after transfers', () => {
  const p0 = pool(), { squad, sell } = base(p0);
  const { players } = withUpgrade(p0, squad, 9);
  const plan = run(players, squad, sell, 2, { horizon: 1 });
  const g = plan.gameweeks[0];
  assert.ok(g.bank >= 0);
  const m = new Map(players.map((p) => [p.id, p])); const clubs = {};
  for (const id of g.squad) clubs[m.get(id).teamId] = (clubs[m.get(id).teamId] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(clubs)) <= 3);
  assert.equal(g.squad.length, 15);
});
test('a multi-gameweek plan returns one entry per gameweek', () => {
  const p0 = pool().map((p) => ({ ...p, points: [p.points[0], p.points[0], p.points[0]] })), { squad, sell } = base(p0);
  const plan = run(p0, squad, sell, 1, { horizon: 3 });
  assert.equal(plan.gameweeks.length, 3);
  assert.ok(plan.totalGain >= -1e-9);
});

test('no transfers means no hit: a quiet week never pays for free-transfer padding', () => {
  const p0 = pool().map((p) => ({ ...p, points: [p.points[0], p.points[0], p.points[0], p.points[0]] })), { squad, sell } = base(p0);
  const plan = run(p0, squad, sell, 1, { horizon: 4 });
  for (const g of plan.gameweeks) if (g.in.length === 0) assert.equal(g.hitPoints, 0);
  assert.ok(plan.gameweeks.every((g) => g.hitPoints <= 0));
});
