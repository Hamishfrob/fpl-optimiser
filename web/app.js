// The page: reads the daily JSON files and shows your team, the chips, and club-by-club bands.
// It runs the solver (in a worker) only for Recalculate and for a team typed in by hand.
import { CLUBS } from './clubs.js';
import { isStale, money, nextFixtures, pairMoves, countdownParts, countdownStage } from '../src/view.js';
import { pitchView, barsView, tickerView } from './views.js';
import { drawStand, drawBoard } from './stand.js';
import { bestLineup, validateSquad } from '../src/lineup.js';

const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const CHIP_INFO = {
  wildcard: ['Wildcard', 'Change as many players as you like, for free, and keep the new squad.'],
  freehit: ['Free Hit', 'Change as many players as you like for one gameweek. Your old squad comes back afterwards.'],
  bboost: ['Bench Boost', 'Your four bench players score points too, for one gameweek.'],
  '3xc': ['Triple Captain', 'Your captain scores triple points instead of double, for one gameweek.'],
};
const $ = (id) => document.getElementById(id);
$('how-btn').addEventListener('click', () => { $('how').showModal(); $('how').scrollTop = 0; });
$('how').addEventListener('click', (e) => { if (e.target === $('how')) $('how').close(); }); // click outside to close
const h = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
// ?data=data-test loads a different folder of JSON (used to try the page with another team). Plain folder names only.
const wanted = new URLSearchParams(location.search).get('data') ?? '';
const DATA = /^[\w-]+$/.test(wanted) ? wanted : 'data';
const getJson = async (path) => {
  const r = await fetch(`${path.replace(/^data\//, `${DATA}/`)}?t=${Math.floor(Date.now() / 600000)}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};
const store = {
  get() { try { return JSON.parse(localStorage.getItem('fplSquad')); } catch { return null; } },
  set(v) { try { localStorage.setItem('fplSquad', JSON.stringify(v)); } catch { /* storage blocked: the team is just not remembered */ } },
};

async function load() {
  const [status, bootstrap, fixtures, odds, entry, advice] = await Promise.all(
    ['status', 'bootstrap', 'fixtures', 'odds', 'entry', 'advice/latest'].map((n) => getJson(`data/${n}.json`)));
  let squad = null;
  if (status.squadAvailable) squad = await getJson(`data/squad/gw${entry.entry.current_event}.json`).catch(() => null);
  return { status, bootstrap, fixtures, odds, entry, advice, squad };
}

let viewMode = 'pitch';
let stopStand = null, clock = null, resizeTimer = null;
const STAGE_TEXT = {
  calm: ['#3ec27a', 'Plenty of time. Check the injury news nearer the day.'],
  soon: ['#ffcf5c', 'Time to settle your transfers.'],
  now: ['#ff6b6b', 'Last chance: lock in your team.'],
};

/** The stadium header: the team name in white seats, the gameweek ribbon, and the live scoreboard countdown. */
function drawHeader(teamName, advice, deadlineIso) {
  stopStand?.();
  stopStand = drawStand($('stand'), teamName);
  $('ribbon-right').textContent = `Gameweek ${advice.gw}`;
  const deadline = Date.parse(deadlineIso);
  clearInterval(clock);
  const tick = () => {
    const left = deadline - Date.now();
    const p = countdownParts(left), stage = countdownStage(left / 1000);
    const two = (n) => String(n).padStart(2, '0');
    drawBoard($('board'), `${two(p.days)}:${two(p.hours)}:${two(p.mins)}:${two(p.secs)}`, STAGE_TEXT[stage][0]);
    $('boardwrap').dataset.stage = stage;
    $('cwhat').textContent = left > 0 ? STAGE_TEXT[stage][1] : 'The deadline has passed. The page switches to your real team after the next update.';
  };
  tick();
  clock = setInterval(tick, 1000);
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => drawHeader(teamName, advice, deadlineIso), 250); }, { once: true });
}

function render(d, advice) {
  const { bootstrap, fixtures } = d;
  const players = new Map(bootstrap.elements.map((p) => [p.id, p]));
  const teamName = new Map(bootstrap.teams.map((t) => [t.id, t.name]));
  const clubOf = new Map(CLUBS.map((c) => [c.fplName, c]));
  const clubFor = (id) => clubOf.get(teamName.get(players.get(id).team));
  const nameOf = (id) => players.get(id).web_name;
  const proj = (id, k = 0) => advice.projections?.[id]?.[k] ?? 0;
  const total4 = (id) => (advice.projections?.[id] ?? []).reduce((a, b) => a + b, 0);
  const posOf = (id) => players.get(id).element_type;
  const next = bootstrap.events.find((e) => e.id === advice.gw);
  const mine = advice.mode === 'transfers' ? advice.squad : [];
  const mineSet = new Set(mine);
  const main = $('main');
  main.replaceChildren();

  $('sub').textContent = `${d.entry.entry.name} · gameweek ${advice.gw} deadline ${new Date(next.deadline_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · data updated ${new Date(d.status.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  drawHeader(d.entry.entry.name, advice, next.deadline_time);
  const warn = $('warn');
  warn.hidden = !isStale(d.status.updatedAt);
  warn.textContent = 'This data is more than 36 hours old, so injuries and prices may have moved. Check the FPL site before you decide.';

  const clubDot = (id) => { const c = clubFor(id); const s = h('span', { className: 'dot', title: c.name }); s.style.background = c.glow; return s; };
  const row = (id, opts = {}) => h('li', { className: opts.mine ? 'mine' : '' },
    h('span', { className: 'pos' }, POS[posOf(id)]), clubDot(id),
    h('span', { className: 'name' }, nameOf(id), ' ', h('span', { className: 'pts' }, money(players.get(id).now_cost))),
    h('span', { className: 'pts', title: 'Predicted points, this gameweek' }, proj(id, 0).toFixed(1)),
    h('span', { className: 'pts', title: 'Predicted points, next four gameweeks' }, total4(id).toFixed(0)),
    h('span', { className: 'slot' }, opts.tag ? h('span', { className: `tag ${opts.tag}` }, opts.tag === 'cap' ? 'C' : opts.tag === 'vc' ? 'V' : opts.tag.toUpperCase()) : null));
  const head = h('li', { className: 'colhead' }, h('span', { className: 'pos' }), h('span', { className: 'name' }, 'Player'),
    h('span', { className: 'pts' }, `GW${advice.gw}`), h('span', { className: 'pts' }, 'Next 4'), h('span', { className: 'slot' }));

  // ---- 1. YOUR TEAM
  if (advice.mode === 'transfers') {
    const best = bestLineup(mine, posOf, (id) => proj(id, 0));
    const picked = advice.lineup?.captain ? advice.lineup : null;
    const pickedTotal = picked ? picked.xi.reduce((a, id) => a + proj(id, 0), 0) + proj(picked.captain, 0) : 0;
    const lineup = picked ? { ...picked, total: pickedTotal } : best;
    const lineup4 = bestLineup(mine, posOf, (id) => total4(id));
    const better = picked && best.total - pickedTotal >= 0.5
      ? ` The best lineup from the same 15 is predicted ${best.total.toFixed(0)}: captain ${nameOf(best.captain)}, and ${best.xi.filter((id) => !picked.xi.includes(id)).map(nameOf).join(', ') || 'the same eleven'} starting.` : '';
    const source = advice.squadSource === 'manual' ? 'Entered by hand. The FPL site shows your real team after the first deadline, and this page then switches to it by itself.' : 'Read from the FPL site.';
    const ctx = { advice, players, teams: new Map(bootstrap.teams.map((t) => [t.id, t])), fixtures, clubs: CLUBS, clubFor, proj, total4, posOf, nameOf, onPick: (text) => { detail.textContent = text; } };
    const detail = h('p', { className: 'muted detail' }, 'Tap a player for the detail.');
    const holder = h('div', { className: 'viewholder' });
    const bars = barsView(ctx, lineup);
    const views = {
      pitch: () => h('div', {}, pitchView(ctx, lineup), detail),
      bars: () => h('div', {}, bars.el, h('button', { className: 'go ghost', type: 'button', onclick: bars.replay }, 'Replay')),
      list: () => h('div', {}, h('ul', { className: 'rows' }, head, lineup.xi.map((id) => row(id, { mine: true, tag: id === lineup.captain ? 'cap' : id === lineup.viceCaptain ? 'vc' : '' }))),
        h('p', { className: 'label' }, 'Bench'), h('ul', { className: 'rows' }, lineup.bench.map((id) => row(id, { mine: true })))),
    };
    const tabs = h('div', { className: 'tabs', role: 'tablist' });
    const show = (m) => {
      viewMode = m;
      holder.replaceChildren(views[m]());
      [...tabs.children].forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.m === m)); b.classList.toggle('on', b.dataset.m === m); });
      if (m === 'bars') bars.replay();
    };
    for (const [m, label] of [['pitch', 'Pitch'], ['bars', 'Points bars'], ['list', 'List']]) {
      tabs.append(h('button', { className: 'tab', type: 'button', role: 'tab', onclick: () => show(m) }, label));
      tabs.lastChild.dataset.m = m;
    }
    main.append(h('section', { className: 'card team' },
      h('h2', { className: 'first' }, 'Your team'),
      h('div', { className: 'big' }, `${lineup.total.toFixed(0)} predicted points in gameweek ${advice.gw}`),
      h('p', { className: 'muted' }, `${picked ? 'Your lineup as picked' : 'Best lineup'}: captain ${nameOf(lineup.captain)}${lineup.viceCaptain ? `, vice-captain ${nameOf(lineup.viceCaptain)}` : ''}. About ${lineup4.total.toFixed(0)} points for the squad over the next four gameweeks.${better} ${source}`),
      tabs, holder,
      h('button', { className: 'go ghost', type: 'button', onclick: () => $('team-entry')?.scrollIntoView() }, 'Edit my team')));
    show(viewMode);
  } else {
    main.append(h('section', { className: 'card team' }, h('h2', { className: 'first' }, 'Your team'),
      h('p', {}, 'The FPL site hides your team until your first deadline passes, so this page can\'t see it yet. Type it in below (it takes a minute) and everything on this page will be about your players.')));
  }

  // ---- 2. THIS WEEK'S MOVES
  if (advice.mode === 'transfers') {
    const g0 = advice.plan[0];
    const moves = (g) => pairMoves(g.out, g.in, posOf).map((m) => `${nameOf(m.out)} → ${nameOf(m.in)}`);
    main.append(h('section', { className: 'card' }, h('h3', {}, 'Transfers'),
      h('div', { className: 'big' }, g0.in.length ? moves(g0).join(',  ') : 'Make no transfers'),
      h('p', { className: 'muted' }, advice.squadSource === 'manual'
        ? `Before your first deadline every change is free, so treat this as a suggestion. Bank ${money(advice.bank)}.`
        : `${advice.freeTransfers} free transfer${advice.freeTransfers === 1 ? '' : 's'}, bank ${money(advice.bank)}${g0.hitPoints ? `, hit ${g0.hitPoints} points` : ''}.`),
      h('ul', { className: 'rows' }, advice.plan.map((g) => h('li', {}, h('span', { className: 'pos' }, `GW${g.gw}`),
        h('span', { className: 'name' }, g.in.length ? moves(g).join(', ') : 'Roll the free transfer'),
        g.hitPoints ? h('span', { className: 'tag sell' }, `${g.hitPoints}`) : null)))));
  }

  if (advice.mode === 'transfers') {
    const tctx = { advice, players, teams: new Map(bootstrap.teams.map((t) => [t.id, t])), fixtures, clubs: CLUBS, nameOf };
    main.append(h('section', { className: 'card' }, h('h2', { className: 'first' }, 'Next four matches for your clubs'), tickerView(tctx, mine)));
  }

  // ---- 3. CHIPS
  const chipCards = Object.entries(CHIP_INFO).map(([key, [label, blurb]]) => {
    const c = advice.chips?.find((x) => x.chip === key);
    const card = h('div', { className: `chip${c?.playNow ? ' play' : ''}` }, h('h4', {}, label), h('p', { className: 'muted' }, blurb));
    if (advice.mode !== 'transfers') { card.append(h('p', {}, 'Type in your team to see what this would do for it.')); return card; }
    if (!c) { card.append(h('span', { className: 'tag hold' }, 'USED'), h('p', { className: 'muted' }, 'Already played in this half of the season.')); return card; }
    if (!c.bestGw) { card.append(h('span', { className: 'tag hold' }, 'HOLD'), h('p', {}, 'No good week in the next four.')); return card; }
    const k = c.bestGw - advice.gw, d2 = c.detail ?? {};
    card.append(h('span', { className: `tag ${c.playNow ? 'buy' : 'hold'}` }, c.playNow ? 'PLAY NOW' : 'HOLD'),
      h('p', {}, `Best in GW${c.bestGw}: about ${c.gainVsNoChip >= 1 ? '+' : ''}${c.gainVsNoChip.toFixed(0)} points.`));
    let means = '';
    if (key === 'bboost' && d2.bench) means = `Your bench would add ${d2.bench.map((id) => `${nameOf(id)} ${proj(id, k).toFixed(1)}`).join(', ')}.`;
    else if (key === '3xc' && d2.captain) means = `${nameOf(d2.captain)} is predicted ${proj(d2.captain, k).toFixed(1)}, so tripling him adds about ${proj(d2.captain, k).toFixed(0)} points over a normal captaincy.`;
    else if (d2.squad) {
      const inn = d2.squad.filter((id) => !mineSet.has(id)), out = mine.filter((id) => !d2.squad.includes(id));
      const l = bestLineup(d2.squad, posOf, (id) => proj(id, k));
      means = inn.length ? `Out: ${out.map(nameOf).join(', ')}. In: ${inn.map(nameOf).join(', ')}. That squad is predicted ${l.total.toFixed(0)} points in GW${c.bestGw}.` : 'It would keep your current squad.';
      if (key === 'freehit') means += ' Your own squad returns the week after.';
    }
    card.append(h('p', { className: 'means' }, h('strong', {}, 'For your team: '), means));
    return card;
  });
  main.append(h('section', { className: 'chips' }, h('h2', {}, 'Chips'),
    h('p', { className: 'muted' }, `You get two sets of the four chips this season. The first set has to be played before the Gameweek 19 deadline (Saturday 2 January, 13:30). Whether the second set arrives as normal for a late joiner is not confirmed.${advice.squadSource === 'manual' ? ' In your first gameweek Wildcard and Free Hit are unavailable, as the FPL site shows. Bench Boost and Triple Captain can be played.' : ''}`),
    h('div', { className: 'chipgrid' }, chipCards)));

  // ---- 4. SUGGESTED SQUAD (secondary)
  const sug = advice.mode === 'build-from-scratch' ? advice : advice.suggested;
  if (sug) {
    main.append(h('details', { className: 'card sug', open: advice.mode === 'build-from-scratch' },
      h('summary', {}, advice.mode === 'build-from-scratch' ? 'Suggested squad for your first week' : 'For comparison: the best squad if you were starting from scratch'),
      h('p', { className: 'muted' }, `${sug.points.toFixed(0)} predicted points over four weeks for ${money(sug.cost)}. Captain ${nameOf(sug.captain)}.`),
      h('ul', { className: 'rows' }, head, sug.xi.map((id) => row(id, { mine: mineSet.has(id), tag: id === sug.captain ? 'cap' : '' }))),
      h('p', { className: 'muted' }, 'Bench: ', sug.bench.map(nameOf).join(', '))));
  }
  main.append(h('p', { className: 'muted' }, '~ means no bookmaker odds for that match yet, so the number is a rougher estimate. Odds usually appear a few days before each round, and this page picks them up daily.'));

  // ---- 5. CLUB BANDS (all 20, yours first)
  const byClub = new Map(CLUBS.map((c) => [c.fplName, { club: c, own: [], rest: [] }]));
  for (const p of bootstrap.elements) {
    const g = byClub.get(teamName.get(p.team));
    (mineSet.has(p.id) ? g.own : g.rest).push(p.id);
  }
  const groups = [...byClub.values()].sort((a, b) => b.own.length - a.own.length || a.club.name.localeCompare(b.club.name));
  main.append(h('h2', {}, 'Club by club'), h('p', { className: 'muted' }, 'Clubs with your players come first and are marked. Open a band to see them and the best players you don\'t have there.'));
  const bands = h('div', { className: 'bands' });
  for (const g of groups) {
    const teamId = bootstrap.teams.find((t) => t.name === g.club.fplName).id;
    const band = h('div', { className: `band${g.own.length ? ' has' : ''}` });
    band.style.setProperty('--glow', g.club.glow); band.style.setProperty('--fill', g.club.colour); band.style.setProperty('--text', g.club.text);
    const names = g.own.length ? g.own.map(nameOf).join(', ') : '';
    const btn = h('button', { className: 'hd', type: 'button', ariaExpanded: 'false' },
      h('span', { className: 'club' }, g.club.name, g.own.length ? h('span', { className: 'badge' }, String(g.own.length)) : null),
      h('span', { className: 'meta' }, names ? h('b', {}, names) : null, names ? h('br') : null, `next: ${nextFixtures(teamId, fixtures, bootstrap.teams, advice.gw, 3).join(', ')}`));
    const best = g.rest.sort((a, b) => total4(b) - total4(a)).slice(0, 2);
    const body = h('div', { className: 'body' },
      g.own.length ? h('ul', { className: 'rows' }, head.cloneNode(true), g.own.sort((a, b) => total4(b) - total4(a)).map((id) => row(id, { mine: true }))) : h('p', { className: 'muted' }, 'None of your players are here.'),
      h('p', { className: 'label' }, 'Best here that you don\'t have'),
      h('ul', { className: 'rows' }, best.map((id) => row(id))));
    btn.addEventListener('click', () => { const open = band.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); });
    band.append(btn, body);
    bands.append(band);
  }
  main.append(bands);

  // ---- 6. TEAM ENTRY AND RECALCULATE
  main.append(teamEntry(d, advice, players, teamName, clubOf));
}

function teamEntry(d, advice, players, teamName, clubOf) {
  const label = (p) => `${p.web_name} · ${teamName.get(p.team)} · ${POS[p.element_type]} · ${money(p.now_cost)}`;
  const byLabel = new Map(d.bootstrap.elements.map((p) => [label(p), p.id]));
  const list = h('datalist', { id: 'players' }, d.bootstrap.elements.sort((a, b) => b.total_points - a.total_points).map((p) => h('option', { value: label(p) })));
  const current = advice.mode === 'transfers' ? advice.squad : (store.get()?.ids ?? []);
  const inputs = Array.from({ length: 15 }, (_, i) => h('input', { type: 'text', value: current[i] ? label(players.get(current[i])) : '', placeholder: `Player ${i + 1}` }));
  inputs.forEach((i) => i.setAttribute('list', 'players'));
  const bank = h('input', { type: 'number', step: '0.1', min: '0', value: ((store.get()?.bank ?? advice.bank ?? 0) / 10).toFixed(1) });
  const msg = h('p', { className: 'muted' });
  const btn = h('button', { className: 'go', type: 'button' }, 'Use this team');
  btn.addEventListener('click', () => {
    const ids = inputs.map((i) => byLabel.get(i.value.trim())).filter((x) => x !== undefined);
    const bad = inputs.filter((i) => i.value.trim() && !byLabel.has(i.value.trim()));
    const v = validateSquad(ids, d.bootstrap.elements);
    const errors = [...(bad.length ? [`Pick each player from the list that appears as you type (${bad.length} not recognised).`] : []), ...v.errors];
    if (errors.length) { msg.textContent = errors.join(' '); return; }
    const b = Math.round(parseFloat(bank.value) * 10) || 0;
    store.set({ ids, bank: b });
    run(d, { ids, bank: b }, btn, msg);
  });
  const clear = h('button', { className: 'go ghost', type: 'button' }, 'Clear saved team');
  clear.addEventListener('click', () => { try { localStorage.removeItem('fplSquad'); } catch { /* ignore */ } location.reload(); });
  return h('details', { className: 'card', id: 'team-entry', open: advice.mode === 'build-from-scratch' },
    h('summary', {}, 'Enter or change my team'),
    h('p', { className: 'muted' }, 'Type a surname and pick the player from the list. The team is saved in this browser only. Once the FPL site shows your team, this page uses that instead.'),
    list, h('div', { className: 'entry' }, inputs),
    h('div', { className: 'form' }, h('label', {}, 'Money in the bank (£m)', bank), btn, advice.mode === 'transfers' && advice.squadSource === 'manual' ? clear : null), msg);
}

let worker;
function run(d, { ids, bank }, btn, msg) {
  btn.disabled = true; msg.textContent = 'Working it out. This can take up to a minute on a slow device…';
  worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    btn.disabled = false;
    if (!e.data.ok) { msg.textContent = `Could not find an answer: ${e.data.error}`; return; }
    render(d, e.data.advice);
    window.scrollTo(0, 0);
  };
  worker.onerror = (e) => { btn.disabled = false; msg.textContent = `The calculation failed to start: ${e.message}`; };
  worker.postMessage({ bootstrap: d.bootstrap, fplFixtures: d.fixtures, oddsRows: d.odds.rows, date: d.advice.date, overrides: {},
    entry: { squadSource: 'manual', history: { current: [], chips: [] }, transfers: [],
      picks: { picks: ids.map((element) => ({ element })), entry_history: { event: 0, bank }, active_chip: null } } });
}

load().then((d) => {
  render(d, d.advice);
  const saved = store.get();
  // A team typed in earlier is used until the site (or the daily job) supplies one.
  if (d.advice.mode === 'build-from-scratch' && saved?.ids?.length === 15) {
    const msg = h('p', { className: 'muted' }, 'Working out advice for your saved team…');
    $('main').prepend(msg);
    run(d, saved, h('button'), msg);
  }
}).catch((err) => {
  $('main').replaceChildren(h('p', { className: 'warn' }, `Couldn't load the data (${err.message}). Try again in a minute.`));
});
