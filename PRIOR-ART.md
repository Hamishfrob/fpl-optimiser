# Prior art

Last checked: 2026-10-24
Queries (GitHub): fpl optimizer, fpl transfer, fpl solver, fantasy premier league, fpl expected points, fpl captain, fpl chip, fpl linear programming
Queries (Exa, meaning-based): open-source multi-gameweek transfer recommender with a solver; app that predicts xPts per player and suggests squad and transfers
Scope agreed with Hamish 2026-10-24: transfer recommender, full squad optimiser, wildcard optimiser. Own team, ordinary points-based league.

## What exists

| Project | What it is | Stars | Verdict | Why |
|---|---|---|---|---|
| solioanalytics/open-fpl-solver | Python + HiGHS solver. Multi-gameweek horizon, hits, free-transfer value, wildcard / free hit / bench boost / triple captain placement, banned players, bench weights. Apache-2.0, pushed 2026-09-15 | 192 | Use (or Copy its model) | Already does all three things we want. It needs a projections CSV (default is Solio's, a paid service) |
| sertalpbilal/fpl_optimized | Same author's daily-published optimised squads. Licence unclear (NOASSERTION), pushed today | 69 | Steal a feature | Daily "best squad" page is the format to match |
| amosbastian/fpl | Async Python wrapper for the official FPL API | 332 | Ignore | Our data pull is a few lines on the keyless endpoint, tested 2026-10-24 |
| vaastav/Fantasy-Premier-League | Historical per-gameweek CSVs of every player, back to 2016 | 1813 | Use (data) | The training data if we build our own projections |
| qazybekb/smartplayfpl-solver | HiGHS multi-gameweek optimiser, Apache-2.0, very new | 1 | Ignore | Duplicates open-fpl-solver with less track record. Re-check later |
| elcaiseri/OpenFPL-Scout-AI | ML predictions plus team selection, MIT | 29 | Steal a feature | Worth a look at how it predicts player points |
| thomaszwagerman/fpl-solver | Basic single-week ILP, MIT | 0 | Ignore | Open-fpl-solver does more |
| LiveFPL, Solio, FPL Review, Fantasy Optima, Squeaky, FPL Estimator | Hosted planners with projections, chip planning, wildcard drafts | - | Steal a feature | Set the expected feature list. Not borrowable code |

## Features we had not thought of

- Hit cost and the value of a banked free transfer are part of the maths. A recommender that ignores them gives bad advice.
- Planning over a horizon (3 to 6 gameweeks), not just this week.
- Expected minutes is as important as expected points. Open-fpl-solver drops players below an expected-minutes floor.
- Bench weights: the bench is worth a small share of points, so don't over-spend on it.
- A "ban list" and a "must keep" list, so the tool respects what Hamish already knows.
- Chip placement is solved together with transfers, not as a separate step.
- Daily refresh, because injuries and price changes land between deadlines.

## Decided against

- Writing our own solver from scratch. HiGHS and a proven model exist.
- Mini-league spying (rival comparison). Not relevant for a points-based league.
- Captain picker, fixture grid and alerts as first scope. Hamish chose transfers, squad and wildcard.

## Nothing found for

- A free, honest projections source wired to a friendly front end. The solver is free but its default projections are paid, and other open tools are command-line only. This is the real gap, and the project is mainly about it.
- A plain-English "why this transfer" explanation on a solver output. Not seen in any open tool. Not verified against the paid hosted tools.

## Not verified

- Star counts and dates come from GitHub on 2026-10-24. I read only the open-fpl-solver README and its settings guide.
- Whether open-fpl-solver runs cleanly on Windows with a current FPL feed. Not tried.
- The quality of any free projection source. Not tested.
