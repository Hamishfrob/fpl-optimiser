import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveFreeTransfers, sellingPrice, sellingPrices } from '../src/freeTransfers.js';

const wk = (event, event_transfers = 0, cost = 0) => ({ event, event_transfers, event_transfers_cost: cost });

test('a week with no transfers adds one, capped at five', () => {
  const h = { current: [1, 2, 3, 4, 5, 6, 7].map((e) => wk(e)), chips: [] };
  assert.equal(deriveFreeTransfers(h, [], 3), 2);
  assert.equal(deriveFreeTransfers(h, [], 6), 5);
  assert.equal(deriveFreeTransfers(h, [], 8), 5);
});
test('after the first gameweek a new manager has one free transfer', () => {
  assert.equal(deriveFreeTransfers({ current: [wk(9, 15)], chips: [] }, [], 10), 1);
});
test('using the single free transfer leaves one next week, not two', () => {
  assert.equal(deriveFreeTransfers({ current: [wk(1), wk(2, 1)], chips: [] }, [], 3), 1);
});
test('two transfers from one free transfer cost 4 and leave one next week', () => {
  assert.equal(deriveFreeTransfers({ current: [wk(1), wk(2, 2, 4)], chips: [] }, [], 3), 1);
});
test('a banked transfer is kept when one is used the week after', () => {
  assert.equal(deriveFreeTransfers({ current: [wk(1), wk(2), wk(3, 1)], chips: [] }, [], 4), 2);
});
test('Wildcard and Free Hit weeks do not consume free transfers', () => {
  const h = { current: [wk(1), wk(2), wk(3, 9)], chips: [{ name: 'wildcard', event: 3 }] };
  assert.equal(deriveFreeTransfers(h, [], 4), 3);
});
test('a real manager history gives a number between 1 and 5', () => {
  const h = JSON.parse(readFileSync(new URL('./fixtures/entry1-history.json', import.meta.url)));
  const n = deriveFreeTransfers(h, [], 9);
  assert.ok(Number.isInteger(n) && n >= 1 && n <= 5);
});

test('selling price: half the profit, rounded down to 0.1m', () => {
  assert.equal(sellingPrice(50, 54), 52);
  assert.equal(sellingPrice(50, 55), 52);
  assert.equal(sellingPrice(50, 51), 50);
  assert.equal(sellingPrice(50, 47), 47);
});
test('sellingPrices uses the latest transfer in, or the start price for original picks', () => {
  const players = [{ id: 7, now_cost: 56, cost_change_start: 6 }, { id: 8, now_cost: 40, cost_change_start: 0 }];
  const transfers = [{ element_in: 8, element_in_cost: 38, event: 3 }];
  const m = sellingPrices([7, 8], transfers, players);
  assert.equal(m.get(7), 53);
  assert.equal(m.get(8), 39);
});

test('a manager who joined after gameweek 1 is assumed to have bought original picks at the current price', () => {
  const players = [{ id: 7, now_cost: 56, cost_change_start: 6 }];
  assert.equal(sellingPrices([7], [], players, 9).get(7), 56);
  assert.equal(sellingPrices([7], [], players, 1).get(7), 53);
});
