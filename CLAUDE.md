# FPL Optimiser: notes for Claude

A static web page that advises on one Fantasy Premier League team (config.json, currently Harvey's "Hlfcfc"). The owner, Harvey, is not a programmer: explain in plain words, say what a term means the first time, and test in a real browser before saying something works.

## Rules
- The page only advises. It never logs in to or writes to the FPL site.
- Free data only, no paid APIs, no keys in the repo. Runs in a Chromebook browser, so no build step and no server.
- Never edit `data/` by hand. The daily job writes it (`node job/run.js`).
- Before the first deadline (Sat 31 Oct 2026 11:00 UTC) the FPL site hides the squad, so `my-squad.json` supplies it. Delete that file once the site shows the squad.
- Run `npm test` before every commit. Write the test first for logic changes.
- Private details stay out of the repo: no passwords, tokens or personal email addresses.

## Where things are
- `src/`: the maths (projections, ratings, solver, chips, free transfers). Pure functions, covered by `tests/`.
- `job/`: the daily data job. `web/`: the page (plain ES modules, HiGHS solver compiled to WebAssembly in `web/vendor/`).
- `docs/HANDOVER.md`: plain-English guide. `docs/GITLAB.md`: running it on GitLab. `README.md`: how it works.
- `docs/superpowers/` and `design/`: why it was built this way (spec, plan, design references, Blender scripts for the textures).

## Known unverified
Scoring table values in `src/rules.js`, free transfers and selling prices (derived from history), chip entitlement for a late joiner, the solver on a real Chromebook, and the bank figure in `my-squad.json`. Check `README.md` "Known gaps" before relying on any of them.
