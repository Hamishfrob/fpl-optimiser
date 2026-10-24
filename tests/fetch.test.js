import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEntry, fetchBootstrap } from '../job/fetch.js';

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => String(body) });

test('fetchEntry returns picks null when the squad is not published yet (404)', async () => {
  const stub = async (url) => {
    if (url.includes('/picks/')) return reply(404, { detail: 'Not found.' });
    if (url.endsWith('/history/')) return reply(200, { current: [], chips: [] });
    if (url.endsWith('/transfers/')) return reply(200, []);
    return reply(200, { id: 1, current_event: 8 });
  };
  const r = await fetchEntry(1, stub);
  assert.equal(r.picks, null);
  assert.deepEqual(r.transfers, []);
});

test('fetchEntry asks for the current gameweek picks', async () => {
  const seen = [];
  const stub = async (url) => {
    seen.push(url);
    if (url.includes('/picks/')) return reply(200, { picks: [] });
    if (url.endsWith('/history/')) return reply(200, { current: [], chips: [] });
    if (url.endsWith('/transfers/')) return reply(200, []);
    return reply(200, { id: 1, current_event: 9 });
  };
  const r = await fetchEntry(1, stub);
  assert.ok(seen.some((u) => u.endsWith('/entry/1/event/9/picks/')));
  assert.deepEqual(r.picks, { picks: [] });
});

test('any other failure throws', async () => {
  await assert.rejects(() => fetchBootstrap(async () => reply(500, {})), /500/);
});
