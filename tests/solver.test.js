import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolver } from '../src/solver.js';
import Highs from '../web/vendor/highs.mjs';

const highs = await Highs();
const solver = createSolver(highs);

// Deterministic 48-player pool: 6 GK, 14 DEF, 16 MID, 12 FWD over 12 clubs.
function pool() {
  const out = []; let id = 1;
  const add = (pos, n, base) => { for (let i = 0; i < n; i++, id++) out.push({ id, position: pos, teamId: (id % 12) + 1, cost: base + (i % 5) * 5, points: [base / 10 + (i % 7) * 0.4, 3, 3] }); };
  add(1, 6, 40); add(2, 14, 45); add(3, 16, 55); add(4, 12, 60);
  return out;
}
const byId = (p) => new Map(p.map((x) => [x.id, x]));

test('result is a legal squad: 2/5/5/3, <=3 per club, within budget', async () => {
  const p = pool(), m = byId(p);
  const r = solver.solveSquad({ players: p, budget: 1000, gwIndex: 0 });
  assert.equal(r.squad.length, 15);
  const count = (pos) => r.squad.filter((i) => m.get(i).position === pos).length;
  assert.deepEqual([count(1), count(2), count(3), count(4)], [2, 5, 5, 3]);
  const clubs = {}; for (const i of r.squad) clubs[m.get(i).teamId] = (clubs[m.get(i).teamId] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(clubs)) <= 3);
  assert.ok(r.cost <= 1000);
  assert.equal(r.cost, r.squad.reduce((a, i) => a + m.get(i).cost, 0));
});

test('the XI has 11 valid players, the bench has 4, captain is the best XI player', () => {
  const p = pool(), m = byId(p);
  const r = solver.solveSquad({ players: p, budget: 1000, gwIndex: 0 });
  assert.equal(r.xi.length, 11); assert.equal(r.bench.length, 4);
  assert.ok(r.xi.every((i) => r.squad.includes(i)));
  assert.equal(new Set([...r.xi, ...r.bench]).size, 15);
  const n = (pos) => r.xi.filter((i) => m.get(i).position === pos).length;
  assert.equal(n(1), 1); assert.ok(n(2) >= 3 && n(3) >= 2 && n(4) >= 1);
  assert.equal(m.get(r.bench[0]).position, 1, 'first bench slot is the spare goalkeeper');
  assert.ok(r.xi.includes(r.captain));
  assert.equal(r.captain, [...r.xi].sort((a, b) => m.get(b).points[0] - m.get(a).points[0])[0]);
  assert.ok(r.xi.includes(r.viceCaptain) && r.viceCaptain !== r.captain);
});

test('locked players are always in and banned players never are', () => {
  const p = pool();
  const worst = p.filter((x) => x.position === 4).sort((a, b) => a.points[0] - b.points[0])[0].id;
  const best = p.filter((x) => x.position === 3).sort((a, b) => b.points[0] - a.points[0])[0].id;
  const r = solver.solveSquad({ players: p, budget: 1000, gwIndex: 0, locked: [worst], banned: [best] });
  assert.ok(r.squad.includes(worst)); assert.ok(!r.squad.includes(best));
});

test('a budget too small for any legal squad throws', () => {
  assert.throws(() => solver.solveSquad({ players: pool(), budget: 300, gwIndex: 0 }), /No legal squad/);
});

test('a larger budget never gives fewer predicted points', () => {
  const p = pool();
  const lo = solver.solveSquad({ players: p, budget: 800, gwIndex: 0 });
  const hi = solver.solveSquad({ players: p, budget: 1000, gwIndex: 0 });
  assert.ok(hi.points >= lo.points - 1e-9);
});
