// The new views: pitch, points bars, fixture ticker. DOM builders only; the numbers come from src/.
import { heatColour, easeColour, pitchRows, nextFixtures } from '../src/view.js';
import { teamStrengths, fixtureExpectations } from '../src/ratings.js';
import { pitchMarkings } from '../src/pitchlines.js';

const h = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (name, attrs = {}) => { const e = document.createElementNS(SVGNS, name); for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val); return e; };

/** Painted pitch lines at the real proportions, redrawn when the pitch changes size. */
function markingsLayer(host) {
  const svg = sv('svg', { class: 'markings', 'aria-hidden': 'true' });
  const defs = sv('defs'), f = sv('filter', { id: 'chalk', x: '-5%', y: '-5%', width: '110%', height: '110%' });
  f.append(sv('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.85', numOctaves: '2', result: 'n' }), sv('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '2.2' }));
  defs.append(f); svg.append(defs);
  const paint = () => {
    svg.querySelector('g')?.remove();
    const w = host.clientWidth || 700, hgt = host.clientHeight || 500;
    const m = pitchMarkings(w, hgt, 10);
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    if (!m) return;
    const g = sv('g', { fill: 'none', stroke: '#f6f8f1', 'stroke-width': '2.4', 'stroke-linecap': 'round', opacity: '.88', filter: 'url(#chalk)' });
    g.append(sv('rect', { x: m.outline.x, y: m.outline.y, width: m.outline.w, height: m.outline.h }),
      sv('line', { x1: m.halfway.x1, y1: m.halfway.y1, x2: m.halfway.x2, y2: m.halfway.y2 }),
      sv('circle', { cx: m.centreCircle.cx, cy: m.centreCircle.cy, r: m.centreCircle.r }),
      sv('circle', { cx: m.centreSpot.cx, cy: m.centreSpot.cy, r: m.centreSpot.r, fill: '#f6f8f1' }));
    for (const e of m.ends) g.append(
      sv('rect', { x: e.penaltyArea.x, y: e.penaltyArea.y, width: e.penaltyArea.w, height: e.penaltyArea.h }),
      sv('rect', { x: e.goalArea.x, y: e.goalArea.y, width: e.goalArea.w, height: e.goalArea.h }),
      sv('circle', { cx: e.spot.x, cy: e.spot.y, r: 2.6, fill: '#f6f8f1' }), sv('path', { d: e.arc }));
    for (const d of m.corners) g.append(sv('path', { d }));
    svg.append(g);
  };
  requestAnimationFrame(paint);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(paint).observe(host);
  return svg;
}

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
  const pitch = h('div', { className: 'pitch' }, pitchRows(lineup.xi, ctx.posOf).map((row) => h('div', { className: 'line' }, row.map(shirt))));
  pitch.prepend(markingsLayer(pitch));
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
