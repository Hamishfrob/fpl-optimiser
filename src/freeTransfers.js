// Free-transfer count and selling prices, worked out from public history because the FPL site doesn't state them.
// UNVERIFIED against a live account: the page lets the user correct bank and free transfers by hand.
const CAP = 5;

/** Free transfers available in gameweek nextGw. @param {{current:object[],chips:object[]}} history */
export function deriveFreeTransfers(history, transfers, nextGw) {
  const chipWeeks = new Set((history.chips ?? []).filter((c) => c.name === 'wildcard' || c.name === 'freehit').map((c) => c.event));
  const weeks = [...history.current].sort((a, b) => a.event - b.event).filter((w) => w.event < nextGw);
  let ft = 1;
  weeks.forEach((w, i) => {
    if (i === 0) { ft = 1; return; }               // first gameweek: unlimited squad pick, then one free transfer
    if (chipWeeks.has(w.event)) { ft = Math.min(CAP, ft + 1); return; }
    ft = Math.min(CAP, Math.max(ft - w.event_transfers, 0) + 1);
  });
  return ft;
}

/** Sell price in tenths of £m: you keep half of any rise, rounded down; a fall is lost in full. */
export function sellingPrice(boughtAt, now) {
  return now > boughtAt ? boughtAt + Math.floor((now - boughtAt) / 2) : now;
}

/** @returns {Map<number, number>} player id to selling price */
export function sellingPrices(squadIds, transfers, players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const out = new Map();
  for (const id of squadIds) {
    const p = byId.get(id);
    const buys = transfers.filter((t) => t.element_in === id).sort((a, b) => b.event - a.event || String(b.time).localeCompare(String(a.time)));
    const boughtAt = buys.length ? buys[0].element_in_cost : p.now_cost - p.cost_change_start;
    out.set(id, sellingPrice(boughtAt, p.now_cost));
  }
  return out;
}
