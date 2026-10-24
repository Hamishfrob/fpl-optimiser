// The new views: pitch, points bars, fixture ticker. DOM builders only; the numbers come from src/.
import { heatColour, easeColour, pitchRows, nextFixtures } from '../src/view.js';
import { teamStrengths, fixtureExpectations } from '../src/ratings.js';

const h = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

/** ctx: {advice, players:Map, teams:Map, fixtures, clubFor(id), proj(id,k), total4(id), posOf(id), nameOf(id), onPick(text)} */
export function pitchView(ctx, lineup) {
  const { players, teams, fixtures, advice } = ctx;
  const nextLabel = (id, n) => nextFixtures(players.get(id).team, fixtures, [...teams.values()], advice.gw, n);
  const shirt = (id) => {
    const c = ctx.clubFor(id), badge = id === lineup.captain ? 'C' : id === lineup.viceCaptain ? 'V' : '';
    const kit = h('div', { className: 'kit' }, ctx.proj(id).toFixed(1));
    kit.style.background = c.colour; kit.style.color = c.text;
    const el = h('div', { className: 'shirt', tabIndex: 0, role: 'button', ariaLabel: `${ctx.nameOf(id)}, predicted ${ctx.proj(id).toFixed(1)}` },
      badge ? h('div', { className: `cap ${badge === 'V' ? 'vc' : ''}` }, badge) : null, kit,
      h('div', { className: 'nm' }, ctx.nameOf(id)), h('div', { className: 'fx' }, nextLabel(id, 1)[0] ?? '-'));
    const show = () => ctx.onPick(`${ctx.nameOf(id)} (${c.name}): predicted ${ctx.proj(id).toFixed(1)} in GW${advice.gw}, ${ctx.total4(id).toFixed(0)} over the next four. Next: ${nextLabel(id, 3).join(', ')}.`);
    el.addEventListener('click', show); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
    return el;
  };
  const pitch = h('div', { className: 'pitch' }, h('div', { className: 'box top' }), h('div', { className: 'box bottom' }),
    pitchRows(lineup.xi, ctx.posOf).map((row) => h('div', { className: 'line' }, row.map(shirt))));
  const bench = h('div', { className: 'bench' }, h('span', { className: 'label' }, 'Bench'), lineup.bench.map(shirt));
  return h('div', {}, pitch, bench);
}

export function barsView(ctx, lineup) {
  const wrap = h('div', { className: 'bars' });
  const draw = () => {
    wrap.replaceChildren(...[...lineup.xi, ...lineup.bench].map((id, i) => {
      const c = ctx.clubFor(id), v = ctx.proj(id);
      const dot = h('span', { className: 'dotc' }); dot.style.background = c.glow;
      const fill = h('div', { className: 'f' }); fill.style.background = heatColour(v);
      const row = h('div', { className: `barrow${i === lineup.xi.length ? ' benchstart' : ''}` }, h('div', { className: 'n' }, dot, ctx.nameOf(id)), h('div', { className: 't' }, fill), h('div', { className: 'v' }, v.toFixed(1)));
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${Math.min(100, (v / 8) * 100)}%`; }));
      return row;
    }));
  };
  draw();
  return { el: wrap, replay: draw };
}

/** Next four matches for each of the manager's clubs. Colour is the club's expected goal difference, from results so far. */
export function tickerView(ctx, ownedIds) {
  const { players, teams, fixtures, advice } = ctx;
  const strengths = teamStrengths(fixtures, [...teams.values()]);
  const own = new Map();
  for (const id of ownedIds) { const t = players.get(id).team; own.set(t, [...(own.get(t) ?? []), id]); }
  const rows = [...own].sort((a, b) => teams.get(a[0]).name.localeCompare(teams.get(b[0]).name)).map(([tid, ids]) => {
    const club = ctx.clubs.find((c) => c.fplName === teams.get(tid).name);
    const head = h('td', { className: 'tclub' }, club.name, h('small', {}, ids.map(ctx.nameOf).join(', ')));
    head.style.setProperty('--glow', club.glow);
    const cells = fixtures.filter((f) => f.event >= advice.gw && (f.team_h === tid || f.team_a === tid)).sort((a, b) => a.event - b.event).slice(0, 4).map((f) => {
      const home = f.team_h === tid, e = fixtureExpectations(f, strengths, new Map());
      const d = home ? e.homeGoals - e.awayGoals : e.awayGoals - e.homeGoals;
      const cell = h('div', { className: 'cell', title: `GW${f.event}: expected goal difference ${d >= 0 ? '+' : ''}${d.toFixed(1)}` }, `${teams.get(home ? f.team_a : f.team_h).short_name} ${home ? '(H)' : '(A)'}`, h('small', {}, `GW${f.event}`));
      cell.style.background = easeColour(d);
      return h('td', {}, cell);
    });
    return h('tr', {}, head, cells);
  });
  const legend = h('div', { className: 'legend' }, 'Hard');
  for (const c of ['#e8605a', '#f0a95a', '#e9dc6b', '#8fd17e', '#3ec27a']) { const i = h('i'); i.style.background = c; legend.append(i); }
  legend.append('Easy');
  return h('div', {}, legend, h('div', { className: 'tickwrap' }, h('table', { className: 'tick' }, rows)), h('p', { className: 'muted' }, 'Colours are estimates from each club\'s results so far this season, not bookmaker odds.'));
}
