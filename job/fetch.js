// Network calls. Node only: the FPL feed sends no CORS header, so the web page never calls it.
const BASE = 'https://fantasy.premierleague.com/api';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (fpl-optimiser daily job)' };

async function get(url, fetchImpl, { allow404 = false, text = false } = {}) {
  const res = await fetchImpl(url, { headers: HEADERS, redirect: 'follow' });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return text ? res.text() : res.json();
}

export const fetchBootstrap = (f = fetch) => get(`${BASE}/bootstrap-static/`, f);
export const fetchFixtures = (f = fetch) => get(`${BASE}/fixtures/`, f);
export const fetchOddsCsv = (f = fetch) => get('https://www.football-data.co.uk/fixtures.csv', f, { text: true });

/** Harvey's public squad data. picks is null until the first deadline has passed (404). */
export async function fetchEntry(id, f = fetch) {
  const entry = await get(`${BASE}/entry/${id}/`, f);
  const [history, transfers] = await Promise.all([
    get(`${BASE}/entry/${id}/history/`, f),
    get(`${BASE}/entry/${id}/transfers/`, f),
  ]);
  const picks = entry.current_event
    ? await get(`${BASE}/entry/${id}/event/${entry.current_event}/picks/`, f, { allow404: true })
    : null;
  return { entry, history, transfers, picks };
}
