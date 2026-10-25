# FPL Optimiser

Live at https://hamishfrob.github.io/fpl-optimiser/ . A web page that recommends a Fantasy Premier League squad, this week's transfers and when to play each chip. It runs in the browser, so it works on a Chromebook, and it uses only free data.

For the person using it, read `docs/HANDOVER.md`. To run it on GitLab, read `docs/GITLAB.md`. To work on it with Claude, `CLAUDE.md` has the ground rules.

Folders: `src/` the maths, `job/` the daily data job, `web/` the page, `tests/` the checks, `data/` generated, `design/` the look (Blender texture scripts and references), `docs/` guides plus the original spec and plan.

## How it works

1. A daily job (`job/run.js`, scheduled in `.github/workflows/daily.yml`) fetches the official FPL data, bookmaker odds from football-data.co.uk, and the squad for the team in `config.json`. It writes JSON files into `data/`.
2. `src/` turns that data into predicted points per player (`projections.js`), then finds the best squad, transfers and chip timing with the HiGHS solver compiled to WebAssembly (`solver.js`, `chips.js`, `advice.js`).
3. The page (`index.html`, `web/`) shows the latest advice from `data/advice/latest.json`. The "Enter or change my team" box at the bottom re-runs the maths in the browser for a team typed in by hand (saved in that browser only).

Design: `docs/superpowers/specs/2026-10-24-fpl-optimiser-design.md`. Build plan: `docs/superpowers/plans/2026-10-24-fpl-optimiser.md`. Prior art: `PRIOR-ART.md`.

## Running it

Run the tests:

```
npm test
```

Refresh the data by hand:

```
node job/run.js
```

Try the page with any public team's squad (writes to `data-test/`, which Git ignores):

```
node job/run.js --entry 1 --out data-test
```

Then open the page with `?data=data-test` on the end of its address. Serve the folder with any static server, for example `python -m http.server 8765`.

## Known gaps

- Predictions are a first version and have not been tested against past seasons (a deliberate decision).
- The scoring table in `src/rules.js` lists which values are unverified.
- Free transfers and selling prices are derived from history and not checked against a live account.
- Whether a manager who joins late gets both chip sets is not confirmed.
- The solver has run in Node and in Chrome 152. It has not been run on a real Chromebook.
