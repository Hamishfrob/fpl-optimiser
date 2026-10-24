// Chip advice: for each chip still available, which gameweek is best and whether to play it now.
// Bench Boost and Triple Captain gains are read straight off the no-chip plan (no extra solves).
// Wildcard is a re-plan with the chip forced into each week. Free Hit is the best squad for one week.
const MIN_GAIN_NOW = 4; // points; a smaller gain is not worth spending a chip on (our call, spec is silent)

/**
 * @param {{solveSquad:Function, planTransfers:Function}} solver from createSolver
 * @param {object} input planner input plus {chipsAvailable: string[], currentGw: number, firstSetDeadlineGw: number}
 * @returns {{chip:string, bestGw:number|null, gainVsNoChip:number, playNow:boolean, squadIfNow?:object}[]}
 */
export function evaluateChips(solver, input) {
  const { chipsAvailable, currentGw, firstSetDeadlineGw, horizon, gwFrom, players } = input;
  const byId = new Map(players.map((p) => [p.id, p]));
  const pts = (id, t) => byId.get(id).points[gwFrom + t] ?? 0;
  const weeks = [...Array(horizon).keys()].filter((t) => currentGw + t <= firstSetDeadlineGw);
  const base = solver.planTransfers(input);
  const value = [...input.squad].reduce((a, id) => a + (input.sellPrices.get(id) ?? byId.get(id).cost), 0) + input.bank;

  return chipsAvailable.map((chip) => {
    const options = []; // {t, gain, squad?}
    for (const t of weeks) {
      const g = base.gameweeks[t];
      if (chip === 'bboost') options.push({ t, gain: g.bench.reduce((a, id) => a + pts(id, t), 0) });
      else if (chip === '3xc') options.push({ t, gain: pts(g.captain, t) });
      else if (chip === 'freehit') {
        if (currentGw + t === 1) continue; // Free Hit cannot be played in Gameweek 1
        const best = solver.solveSquad({ players, budget: value, gwIndex: gwFrom + t });
        options.push({ t, gain: best.points - g.points, squad: best });
      } else if (chip === 'wildcard') {
        const plan = solver.planTransfers({ ...input, chips: { [t]: 'wildcard' } });
        options.push({ t, gain: plan.totalPoints - base.totalPoints, squad: plan.gameweeks[t] });
      }
    }
    if (!options.length) return { chip, bestGw: null, gainVsNoChip: 0, playNow: false };
    const best = options.reduce((a, b) => (b.gain > a.gain ? b : a));
    const bestGw = currentGw + best.t;
    const playNow = best.t === 0 && best.gain >= MIN_GAIN_NOW;
    return { chip, bestGw, gainVsNoChip: best.gain, playNow, ...(playNow && best.squad ? { squadIfNow: best.squad } : {}) };
  });
}
