// Bookmaker odds (football-data.co.uk fixtures.csv) to expected goals and clean-sheet chances.

/** @returns {{date:string,home:string,away:string,avgH:number,avgD:number,avgA:number,avgOver25:number,avgUnder25:number}[]} */
export function parseFixturesCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  const col = (n) => head.indexOf(n);
  const c = { div: col('Div'), date: col('Date'), home: col('HomeTeam'), away: col('AwayTeam'),
    h: col('AvgH'), d: col('AvgD'), a: col('AvgA'), o: col('Avg>2.5'), u: col('Avg<2.5') };
  const rows = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    if (f[c.div] !== 'E0') continue;
    const nums = [f[c.h], f[c.d], f[c.a], f[c.o], f[c.u]].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n <= 1) || [f[c.h], f[c.o]].includes('')) continue;
    rows.push({ date: f[c.date], home: f[c.home], away: f[c.away],
      avgH: nums[0], avgD: nums[1], avgA: nums[2], avgOver25: nums[3], avgUnder25: nums[4] });
  }
  return rows;
}

const MAX_GOALS = 10;
function pmf(lambda) {
  const p = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) p.push((p[k - 1] * lambda) / k);
  return p;
}
function outcome(lh, la) {
  const ph = pmf(lh), pa = pmf(la);
  let home = 0, away = 0, over = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const p = ph[i] * pa[j];
    if (i > j) home += p; else if (j > i) away += p;
    if (i + j > 2.5) over += p;
  }
  return { home, away, over };
}

/** Remove the bookmaker margin, then fit two Poisson goal means to win, loss and over 2.5 chances. */
export function impliedGoals(row) {
  const inv = [1 / row.avgH, 1 / row.avgD, 1 / row.avgA];
  const total = inv[0] + inv[1] + inv[2];
  const pH = inv[0] / total, pA = inv[2] / total;
  const pO = (1 / row.avgOver25) / (1 / row.avgOver25 + 1 / row.avgUnder25);
  const loss = (lh, la) => { const o = outcome(lh, la); return (o.home - pH) ** 2 + (o.away - pA) ** 2 + (o.over - pO) ** 2; };
  let best = { l: Infinity, lh: 1.3, la: 1.1 };
  const search = (lo1, hi1, lo2, hi2, step) => {
    for (let lh = lo1; lh <= hi1; lh += step) for (let la = lo2; la <= hi2; la += step) {
      const l = loss(lh, la);
      if (l < best.l) best = { l, lh, la };
    }
  };
  search(0.1, 4.5, 0.1, 4.5, 0.1);
  search(Math.max(0.05, best.lh - 0.1), best.lh + 0.1, Math.max(0.05, best.la - 0.1), best.la + 0.1, 0.01);
  const { lh, la } = best;
  return { homeGoals: lh, awayGoals: la, homeCleanSheet: Math.exp(-la), awayCleanSheet: Math.exp(-lh), homeWin: pH };
}
