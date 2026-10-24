// The page: reads the daily JSON files, shows the advice, and can recalculate in a worker.
import { CLUBS } from './clubs.js';
import { isStale, money, nextFixtures, groupByClub } from '../src/view.js';

const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const $ = (id) => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
// ?data=data-test loads a different folder of JSON (used to try the page with a real squad). Plain folder names only.
const wanted = new URLSearchParams(location.search).get('data') ?? '';
const DATA = /^[\w-]+$/.test(wanted) ? wanted : 'data';
const getJson = async (path) => {
  const r = await fetch(`${path.replace(/^data\//, `${DATA}/`)}?t=${Math.floor(Date.now() / 600000)}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

async function load() {
  const [status, bootstrap, fixtures, odds, entry, advice] = await Promise.all(
    ['status', 'bootstrap', 'fixtures', 'odds', 'entry', 'advice/latest'].map((n) => getJson(`data/${n}.json`)));
  let squad = null;
  if (status.squadAvailable) squad = await getJson(`data/squad/gw${entry.entry.current_event}.json`).catch(() => null);
  return { status, bootstrap, fixtures, odds, entry, advice, squad };
}

function render(d, advice) {
  const { bootstrap, fixtures } = d;
  const players = new Map(bootstrap.elements.map((p) => [p.id, p]));
  const clubOf = new Map(CLUBS.map((c) => [c.fplName, c]));
  const nameOf = (id) => players.get(id).web_name;
  const info = (id) => advice.info[id];
  const next = bootstrap.events.find((e) => e.id === advice.gw);
  const main = $('main');
  main.replaceChildren();

  $('sub').textContent = `${d.entry.entry.name} · gameweek ${advice.gw} deadline ${new Date(next.deadline_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · data updated ${new Date(d.status.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  const warn = $('warn');
  warn.hidden = !isStale(d.status.updatedAt);
  warn.textContent = 'This data is more than 36 hours old, so injuries and prices may have moved. Check the FPL site before you decide.';

  const row = (id, tag, ptsIdx = 0) => h('li', {},
    h('span', { className: 'pos' }, POS[players.get(id).element_type]),
    h('span', { className: 'name' }, nameOf(id), ' ', h('span', { className: 'pts' }, money(players.get(id).now_cost))),
    info(id)?.estimate ? h('span', { className: 'est', title: 'No bookmaker odds for this fixture, so this is a rougher estimate' }, '~') : null,
    h('span', { className: 'pts', title: 'Predicted points, this gameweek' }, (info(id)?.points?.[ptsIdx] ?? 0).toFixed(1)),
    tag ? h('span', { className: `tag ${tag}` }, tag === 'cap' ? 'C' : tag.toUpperCase()) : null);

  // ---- summary card
  if (advice.mode === 'build-from-scratch') {
    main.append(h('section', { className: 'card' },
      h('h3', {}, 'First week: build your squad'),
      h('div', { className: 'big' }, `${advice.points.toFixed(0)} predicted points over the next 4 gameweeks`),
      h('p', { className: 'muted' }, `Costs ${money(advice.cost)} of £100.0m. Captain ${nameOf(advice.captain)}, vice-captain ${nameOf(advice.viceCaptain)}. Your squad shows on the FPL site after the first deadline, and from then on this page works from your real team.`),
      h('ul', { className: 'rows' }, advice.xi.map((id) => row(id, id === advice.captain ? 'cap' : ''))),
      h('p', { className: 'muted' }, 'Bench: ', advice.bench.map(nameOf).join(', '))));
  } else {
    const g0 = advice.plan[0];
    main.append(h('section', { className: 'card' },
      h('h3', {}, 'This week'),
      h('div', { className: 'big' }, g0.in.length ? g0.out.map((id, i) => `${nameOf(id)} → ${nameOf(g0.in[i])}`).join(',  ') : 'Make no transfers'),
      h('p', { className: 'muted' }, `${advice.freeTransfers} free transfer${advice.freeTransfers === 1 ? '' : 's'}, bank ${money(advice.bank)}${g0.hitPoints ? `, hit ${g0.hitPoints} points` : ''}. Captain ${nameOf(g0.captain)}.`),
      h('ul', { className: 'rows' }, advice.plan.map((g) => h('li', {}, h('span', { className: 'pos' }, `GW${g.gw}`),
        h('span', { className: 'name' }, g.in.length ? g.out.map((id, i) => `${nameOf(id)} → ${nameOf(g.in[i])}`).join(', ') : 'Roll the free transfer'),
        g.hitPoints ? h('span', { className: 'tag sell' }, `${g.hitPoints}`) : null)))));
    main.append(h('section', { className: 'card' }, h('h3', {}, 'Chips'),
      !advice.chips.length ? h('p', { className: 'muted' }, 'No chips left in this half.') : h('ul', { className: 'rows' }, advice.chips.map((c) => h('li', {},
        h('span', { className: 'name' }, { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' }[c.chip]),
        h('span', { className: 'pts' }, c.bestGw ? `best in GW${c.bestGw}, about +${c.gainVsNoChip.toFixed(0)} points` : 'no good week yet'),
        h('span', { className: `tag ${c.playNow ? 'buy' : 'hold'}` }, c.playNow ? 'PLAY NOW' : 'HOLD')))),
      h('p', { className: 'muted' }, 'Whether you still have both sets of chips is not confirmed. Check the Chips screen on the FPL site.')));
  }

  main.append(h('p', { className: 'muted' }, '~ means no bookmaker odds for that match yet, so the number is a rougher estimate. Odds usually appear a few days before each round, and this page picks them up daily.'));

  // ---- club bands
  const shown = advice.mode === 'build-from-scratch' ? advice.squad : [...new Set([...advice.squad, ...advice.plan.flatMap((g) => g.in)])];
  const outNow = new Set(advice.mode === 'transfers' ? advice.plan[0].out : []);
  const inNow = new Set(advice.mode === 'transfers' ? advice.plan[0].in : []);
  const groups = groupByClub(shown, bootstrap.elements, bootstrap.teams);
  main.append(h('h2', {}, advice.mode === 'build-from-scratch' ? 'Your squad, club by club' : 'Your squad and targets, club by club'));
  const bands = h('div', { className: 'bands' });
  for (const g of groups) {
    const club = clubOf.get(g.team.name);
    const band = h('div', { className: 'band' });
    band.style.setProperty('--glow', club.glow); band.style.setProperty('--fill', club.colour); band.style.setProperty('--text', club.text);
    const head = h('button', { className: 'hd', type: 'button', ariaExpanded: 'false' },
      h('span', { className: 'club' }, club.name),
      h('span', { className: 'meta' }, `${g.ids.length} player${g.ids.length === 1 ? '' : 's'} · next: ${nextFixtures(g.team.id, fixtures, bootstrap.teams, advice.gw, 3).join(', ')}`));
    const body = h('div', { className: 'body' }, h('ul', { className: 'rows' },
      g.ids.map((id) => h('div', {}, row(id, inNow.has(id) ? 'buy' : outNow.has(id) ? 'sell' : advice.mode === 'transfers' ? 'hold' : ''),
        h('div', { className: 'why' }, (info(id)?.reasons ?? []).join(' · '))))));
    head.addEventListener('click', () => { const open = band.classList.toggle('open'); head.setAttribute('aria-expanded', String(open)); });
    band.append(head, body);
    bands.append(band);
  }
  main.append(bands);

  // ---- recalculate
  const bank = h('input', { type: 'number', step: '0.1', value: advice.mode === 'transfers' ? (advice.bank / 10).toFixed(1) : '100.0', id: 'in-money' });
  const ft = h('input', { type: 'number', min: '0', max: '5', value: advice.mode === 'transfers' ? advice.freeTransfers : '', id: 'in-ft', disabled: advice.mode !== 'transfers' });
  const btn = h('button', { className: 'go', type: 'button' }, 'Recalculate');
  const msg = h('p', { className: 'muted' });
  btn.addEventListener('click', () => recalc(d, { bank, ft, btn, msg, mode: advice.mode }));
  main.append(h('details', { className: 'recalc' }, h('summary', {}, 'Something different from what the site shows? Recalculate'),
    h('div', { className: 'form' },
      h('label', {}, advice.mode === 'transfers' ? 'Bank (£m)' : 'Budget (£m)', bank),
      advice.mode === 'transfers' ? h('label', {}, 'Free transfers', ft) : null, btn),
    msg));
}

let worker;
function recalc(d, { bank, ft, btn, msg, mode }) {
  btn.disabled = true; msg.textContent = 'Working it out. This can take up to a minute on a slow device…';
  worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const overrides = mode === 'transfers' ? { bank: Math.round(parseFloat(bank.value) * 10), freeTransfers: parseInt(ft.value, 10) } : { budget: Math.round(parseFloat(bank.value) * 10) };
  worker.onmessage = (e) => {
    btn.disabled = false;
    if (!e.data.ok) { msg.textContent = `Could not find an answer: ${e.data.error}`; return; }
    render(d, e.data.advice);
  };
  worker.onerror = (e) => { btn.disabled = false; msg.textContent = `The calculation failed to start: ${e.message}`; };
  worker.postMessage({ bootstrap: { ...d.bootstrap, elements: d.bootstrap.elements }, fplFixtures: d.fixtures, oddsRows: d.odds.rows,
    entry: { history: d.entry.history, transfers: d.entry.transfers, picks: d.squad && { picks: d.squad.picks, entry_history: d.squad.entry_history } },
    date: d.advice.date, overrides });
}

load().then((d) => render(d, d.advice)).catch((err) => {
  $('main').replaceChildren(h('p', { className: 'warn' }, `Couldn't load the data (${err.message}). Try again in a minute.`));
});
