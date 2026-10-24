import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLUBS, contrastRatio, BAND_BG } from '../web/clubs.js';

const boot = JSON.parse(readFileSync(new URL('./fixtures/bootstrap.json', import.meta.url)));

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
});
test('there are 20 clubs and every one matches an FPL team name', () => {
  assert.equal(CLUBS.length, 20);
  const names = new Set(boot.teams.map((t) => t.name));
  for (const c of CLUBS) assert.ok(names.has(c.fplName), c.fplName);
  assert.equal(new Set(CLUBS.map((c) => c.fplName)).size, 20);
});
test('text on the opened (full colour) band is readable: contrast at least 4.5', () => {
  for (const c of CLUBS) assert.ok(contrastRatio(c.text, c.colour) >= 4.5, `${c.name}: ${contrastRatio(c.text, c.colour).toFixed(2)}`);
});
test('the club-colour edge and name stand out against the dark band: contrast at least 3', () => {
  for (const c of CLUBS) assert.ok(contrastRatio(c.glow, BAND_BG) >= 3, `${c.name}: ${contrastRatio(c.glow, BAND_BG).toFixed(2)}`);
});
