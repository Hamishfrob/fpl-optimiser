# FPL Optimiser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public web page, runnable on a Chromebook, that recommends Harvey's Fantasy Premier League squad, transfers and chip timing from free data and bookmaker odds.

**Architecture:** A daily Node job (GitHub Actions) fetches the official FPL feed, the bookmaker odds file and Harvey's squad, and commits JSON into `data/`. Pure JavaScript modules in `src/` turn that data into predicted points and solve for the best squad and transfers using the HiGHS solver compiled to WebAssembly, running in the browser. A static page in the dark "club glow" style shows the result.

**Tech Stack:** JavaScript ES modules (no build step), Node 20+ built-in test runner (`node --test`), `highs` npm package (WebAssembly solver), GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-24-fpl-optimiser-design.md`. Prior art: `PRIOR-ART.md`. Model to borrow: `solioanalytics/open-fpl-solver` (Apache-2.0).

## Global Constraints

- Free to run. No paid APIs, no API keys, no Claude calls at run time.
- Runs on a Chromebook browser: no install, no terminal. Static files only.
- Harvey's team number is 11160462. First deadline: Saturday 31 October 2026 11:00 UTC (Gameweek 9). Milestone 1 must be live before it.
- Squad rules: 15 players (2 GK, 5 DEF, 5 MID, 3 FWD), budget £100.0m, max 3 per club. Starting XI needs 1 GK, at least 3 DEF, at least 2 MID, at least 1 FWD.
- Transfers: 1 free transfer per gameweek, bank up to 5, each extra costs 4 points.
- Chips: two sets of Wildcard, Free Hit, Triple Captain, Bench Boost. First set before the Gameweek 19 deadline (Saturday 2 January 2027, 13:30 GMT). Free Hit cannot be used in Gameweek 1. No Assistant Manager chip.
- Prices in the FPL feed (`now_cost`) are tenths of a million (55 means £5.5m).
- The FPL feed sends no CORS header, so the page never calls it. The page reads only files in `data/`.
- No official club badges. Club colour blocks and names only.
- The page says plainly when a number is an estimate and when data is stale.
- Plain English in all user-facing text. No em-dashes in prose.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Public repository is fine (Hamish's decision), but create it private and flip it public only in Task 12.

## Review Focus

Failure modes the spec implies but no obvious task covers. Each has a test in the owning task.

1. Player ruled out or doubtful (chance of playing 0, 25, 50, 75, null). Expected: 0 projects to 0 points and is never recommended; null means fully fit. (Task 5)
2. Blank gameweek (club has no fixture) and double gameweek (two fixtures). Expected: blank gives 0, double sums both. (Task 5)
3. A fixture with no bookmaker odds, or an odds team name that does not match any FPL team. Expected: fall back to team strength and label the number "estimate"; an unmatched name fails the daily job loudly and never silently drops a match. (Tasks 2, 3)
4. No squad file yet (picks return 404 before the first deadline), or data older than 36 hours. Expected: page shows "build from scratch" mode; stale data shows a visible warning with the last update time. (Tasks 9, 10)
5. Selling price is not the current price: a player bought at £5.0m now worth £5.4m sells for £5.2m (profit halved, rounded down to £0.1m). Expected: budget uses selling prices derived from transfer history. Not verified against the live site, so the page allows a manual bank correction. (Task 7)

---

## File structure

```
index.html                  page shell (served at site root)
web/app.js                  loads data, runs solver, renders bands
web/clubs.js                20 clubs: name, colour, text colour
web/style.css               dark band styling
web/vendor/                 highs.js + highs.wasm copied from the npm package
src/teams.js                odds-file team names to FPL team ids
src/odds.js                 parse fixtures CSV, odds to expected goals and clean sheets
src/ratings.js              team strength for gameweeks beyond the odds
src/rules.json              points per action, per position
src/projections.js          expected points per player per gameweek
src/solver.js               squad and transfer optimisation over HiGHS
src/freeTransfers.js        free-transfer count and selling prices from history
src/chips.js                chip evaluation
job/fetch.js                network calls (Node only)
job/run.js                  daily job entry point, writes data/
data/                       generated JSON (committed)
tests/ and tests/fixtures/  node:test files and saved real responses
.github/workflows/          daily.yml, pages (Task 12)
README.md, docs/HANDOVER.md plain-English guide for Harvey
```

---

### Task 1: Repository and test harness

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` runs `node --test tests/`. `package.json` has `"type": "module"`.

- [ ] **Step 1:** `git init`, create `.gitignore` containing `node_modules/`, `.superpowers/`, `*.log`. Commit the existing design, plan and PRIOR-ART files first.
- [ ] **Step 2:** Write `tests/smoke.test.js` asserting `1 + 1 === 2`. Run `npm test`. Expected: pass.
- [ ] **Step 3:** Create the private GitHub repo from the folder: `gh repo create fpl-optimiser --private --source=. --push`.
- [ ] **Step 4:** Confirm no secrets reached any commit: `git log -p | grep -i -E "key|token|secret"` returns nothing relevant. (None are needed in this project.)
- [ ] **Step 5:** Commit.

### Task 2: Data fetching and saved fixtures

**Files:**
- Create: `job/fetch.js`, `src/teams.js`, `tests/fetch.test.js`, `tests/fixtures/bootstrap.json`, `tests/fixtures/fixtures.csv`, `tests/fixtures/entry-history.json`
- Test: `tests/teams.test.js`

**Interfaces:**
- Produces from `job/fetch.js`: `fetchBootstrap(): Promise<object>`, `fetchFixtures(): Promise<object[]>` (FPL fixtures list), `fetchOddsCsv(): Promise<string>`, `fetchEntry(id: number): Promise<{entry, history, transfers, picks: object|null}>` where `picks` is the latest gameweek's picks or `null` on a 404. All send a browser-like User-Agent.
- Produces from `src/teams.js`: `oddsNameToTeamId(name: string, fplTeams: object[]): number` (throws `Error('Unknown team in odds file: <name>')`).

- [ ] **Step 1:** Save one real response of each feed into `tests/fixtures/` using the live endpoints (bootstrap-static, football-data fixtures.csv, entry 11160462 history).
- [ ] **Step 2:** Test `oddsNameToTeamId`: every home and away name in `fixtures.csv` Premier League rows (Div `E0`) resolves; `'Man United'` and `'Man City'`, `'Ipswich'`, `'Hull'`, `'Coventry'`, `"Nott'm Forest"` map to the FPL names `Man Utd`, `Man City`, `Ipswich Town`, `Hull City`, `Coventry City`, `Nott'm Forest`; `'Atlantis FC'` throws the exact error above.
- [ ] **Step 3:** Run, expect fail. Implement `teams.js` with an explicit alias table (never fuzzy matching). Run, expect pass.
- [ ] **Step 4:** Implement the four fetchers. `fetchEntry` returns `picks: null` on HTTP 404 and throws on any other non-200. Test with a stubbed `fetch` that a 404 gives `picks: null` and a 500 throws.
- [ ] **Step 5:** Commit.

### Task 3: Odds to expected goals and clean sheets

**Files:**
- Create: `src/odds.js`
- Test: `tests/odds.test.js`

**Interfaces:**
- Produces: `parseFixturesCsv(text: string): OddsRow[]` where `OddsRow = {date, home, away, avgH, avgD, avgA, avgOver25, avgUnder25}` for Div `E0` only, handling the leading byte-order mark.
- Produces: `impliedGoals(row: OddsRow): {homeGoals: number, awayGoals: number, homeCleanSheet: number, awayCleanSheet: number, homeWin: number}`.

- [ ] **Step 1:** Tests: `parseFixturesCsv(fixture)` returns 10 rows and the first is Ipswich v Nott'm Forest with `avgH` 3.01. With even odds `avgH=avgA=3.0, avgD=3.0` and over/under 2.5 evens, `homeGoals` equals `awayGoals` within 0.01, and `homeCleanSheet` equals `Math.exp(-awayGoals)` within 0.001. Shorter home odds always give a larger `homeGoals` than longer ones. Probabilities are between 0 and 1.
- [ ] **Step 2:** Run, expect fail.
- [ ] **Step 3:** Implement. Remove the bookmaker margin (normalise 1/odds so the three sum to 1), then fit two Poisson means (home, away) to the win probability and the over 2.5 probability by simple numeric search (grid then refine). Clean sheet = `exp(-opponentGoals)`.
- [ ] **Step 4:** Run, expect pass. Commit.

### Task 4: Team strength for later gameweeks

**Files:**
- Create: `src/ratings.js`
- Test: `tests/ratings.test.js`

**Interfaces:**
- Consumes: bootstrap `teams` (check the real fixture for the `strength_attack_home`, `strength_defence_home` style fields before coding; if absent, use season goals from standings).
- Produces: `fixtureExpectations(fixture: {team_h, team_a}, teams: object[], oddsByPair?: Map): {homeGoals, awayGoals, homeCleanSheet, awayCleanSheet, source: 'odds'|'estimate'}`.

- [ ] **Step 1:** Tests: with odds present for the pair, `source` is `'odds'` and values equal `impliedGoals`. Without odds, `source` is `'estimate'`, stronger home attack against weaker defence gives more `homeGoals`, and all values are finite and positive.
- [ ] **Step 2:** Run, expect fail. Implement by scaling each team's attack and defence strength so the league average is about 1.4 goals per team per match (state this constant in the file). Run, expect pass. Commit.

### Task 5: Player projections

**Files:**
- Create: `src/rules.json`, `src/projections.js`
- Test: `tests/projections.test.js`

**Interfaces:**
- Consumes: `fixtureExpectations` (Task 4), bootstrap player objects.
- Produces: `expectedPoints(player: object, fixtures: FixtureExp[], rules: object): {points: number, estimate: boolean, reasons: string[]}` for one gameweek (`fixtures` has 0, 1 or 2 entries), and `projectAll(bootstrap, fixtures, oddsRows, gwFrom: number, horizon: number): Map<playerId, number[]>`.

- [ ] **Step 1:** Fetch the official scoring table (premierleague.com FPL rules and the 2026/27 rule-changes page) and write it to `src/rules.json`: points for appearance, goals by position, assists, clean sheet by position, goals conceded penalty, saves, cards, own goals, penalties, and the rebuilt bonus rules. Record the source URL and date in the file. If a figure cannot be found, mark it `"unverified": true` and say so on the page.
- [ ] **Step 2:** Tests: a player with `chance_of_playing_next_round` 0 projects exactly 0; `null` is treated as 100; 50 halves the points. A blank gameweek (no fixtures) gives 0 and a double gameweek gives the sum of two single-fixture results. A midfielder with higher expected goals than another projects higher on the same fixture. A defender on a high clean-sheet fixture projects higher than on a low one. `estimate` is true when any fixture's source is `'estimate'`. `reasons` is non-empty and names the fixture and chance of playing.
- [ ] **Step 3:** Run, expect fail. Implement `expectedPoints`: chance of playing x expected minutes share x (appearance points + per-90 attack rate from xG and xA x fixture goals factor x position points + clean sheet probability x clean sheet points - expected goals conceded penalty). Use per-90 rates from the player's season totals with a shrink toward the position average for players with fewer than 450 minutes (state the constant).
- [ ] **Step 4:** Run, expect pass. Commit.

### Task 6: Solver wrapper and full squad optimiser

**Files:**
- Create: `src/solver.js`, `web/vendor/` (copy `highs.js` and `highs.wasm` from `node_modules/highs/build/`)
- Test: `tests/solver.test.js`

**Interfaces:**
- Consumes: `projectAll` output, bootstrap players and teams.
- Produces: `createSolver(highs: HighsInstance)` returning `{ solveSquad(input): SquadResult }`, where `input = {players: {id, position, teamId, cost, points: number[]}[], budget: number, gwIndex: number, locked?: number[], banned?: number[]}` and `SquadResult = {squad: number[], xi: number[], bench: number[], captain: number, viceCaptain: number, cost: number, points: number}`. Costs are in tenths of a million.
- Spike result to record in a comment at the top of `solver.js`: the exact call used to load HiGHS in Node (`await (await import('highs')).default()`) and in the browser, and the call that solves an LP string.

- [ ] **Step 1 (spike):** In Node, install `highs`, solve a two-variable LP, print the result shape. Then load `web/vendor/highs.js` in a local page opened in the in-app browser and solve the same LP. If the browser load fails, stop and report: the browser-solver assumption in the design is wrong.
- [ ] **Step 2:** Tests on a synthetic 40-player pool: result has 15 players in the 2/5/5/3 split, at most 3 per club, cost at most the budget, an 11-man XI that satisfies the formation rules, the captain is in the XI and has the highest points of the XI. Locked players are always included and banned players never are. If the pool cannot satisfy the rules, throws `Error('No legal squad')`.
- [ ] **Step 3:** Run, expect fail. Implement by writing an integer programme (binary variable per player for squad, per player for XI, one for captain) as an LP text string and solving it. Bench weights per open-fpl-solver defaults (first sub counts a little, the rest almost nothing; copy its documented values with attribution in a comment).
- [ ] **Step 4:** Run, expect pass. Commit.

### Task 7: Free transfers, selling prices and the transfer planner

**Files:**
- Create: `src/freeTransfers.js`
- Modify: `src/solver.js` (add `planTransfers`)
- Test: `tests/freeTransfers.test.js`, `tests/planner.test.js`

**Interfaces:**
- Produces: `deriveFreeTransfers(history: object, transfers: object[], nextGw: number): number` (1 to 5); `sellingPrice(boughtAt: number, now: number): number` in tenths; `sellingPrices(squadIds: number[], transfers: object[], players: object[]): Map<playerId, number>`.
- Produces: `planTransfers(input): TransferPlan` where `input = {squad: number[], bank: number, freeTransfers: number, sellPrices: Map, players, horizon: number, hitCost: 4, ftValue: number}` and `TransferPlan = {gameweeks: {gw, in: number[], out: number[], hitPoints: number}[], totalGain: number}`.

- [ ] **Step 1:** Tests for free transfers: a gameweek with no transfers adds 1 up to a cap of 5; using 1 transfer from 1 free leaves 0 and next week 1; 2 transfers from 1 free costs 4 points and leaves 0. Wildcard and Free Hit weeks do not consume free transfers (per the Premier League chips article; mark as unverified in a comment and keep the manual override). Selling price: bought 50, now 54, sells 52; bought 50, now 55, sells 52 (profit 5, half is 2.5, rounded down to 2); price fell, sells at the lower price.
- [ ] **Step 2:** Run, expect fail. Implement.
- [ ] **Step 3:** Planner tests: with a better player available and 1 free transfer, the plan makes the transfer; a swap gaining 2 points does not justify a 4-point hit, a swap gaining 9 does; budget never goes negative; the three-per-club limit holds after transfers.
- [ ] **Step 4:** Run, expect fail. Implement as one integer programme over the horizon following open-fpl-solver (squad state per gameweek, transfers in and out, free-transfer state, hit penalty, small value for a banked free transfer). Keep the code to what the tests need.
- [ ] **Step 5:** Run, expect pass. Commit.

### Task 8: Chip planner

**Files:**
- Create: `src/chips.js`
- Test: `tests/chips.test.js`

**Interfaces:**
- Consumes: `planTransfers`, `solveSquad`.
- Produces: `evaluateChips(input): ChipAdvice[]` where `input` extends the planner input with `chipsAvailable: ('wildcard'|'freehit'|'bboost'|'3xc')[]`, `currentGw`, `deadlineGw19: number`; `ChipAdvice = {chip, bestGw: number, gainVsNoChip: number, playNow: boolean, squadIfNow?: SquadResult}`.

- [ ] **Step 1:** Tests: a double gameweek for a team the squad owns makes Bench Boost and Triple Captain `bestGw` that gameweek; Free Hit is never `bestGw` 1; no chip with `bestGw` after `deadlineGw19` while the first set is unused; `playNow` is true only when this gameweek has the highest gain; a chip not in `chipsAvailable` is never returned; Wildcard `squadIfNow` is a legal squad.
- [ ] **Step 2:** Run, expect fail. Implement by re-running the planner with each chip forced into each candidate gameweek and comparing totals against the no-chip plan.
- [ ] **Step 3:** Run, expect pass. Commit.

### Task 9: Daily job, squad history and advice log

**Files:**
- Create: `job/run.js`, `data/.gitkeep`
- Test: `tests/run.test.js`

**Interfaces:**
- Consumes: Tasks 2 to 8.
- Produces files: `data/bootstrap.json` (trimmed to fields the page needs), `data/fixtures.json`, `data/odds.json`, `data/squad/gw{n}.json` (one per gameweek once picks exist), `data/status.json` `{updatedAt: ISO string, gw: number, squadAvailable: boolean}`, `data/advice/{YYYY-MM-DD}.json` (what the tool recommended that day).

- [ ] **Step 1:** Tests with stubbed fetchers: with `picks: null`, writes `status.json` with `squadAvailable: false` and no squad file; with picks, writes `data/squad/gw8.json` and never overwrites an earlier gameweek's file with different content; an odds team name that fails to match makes `run` throw before writing anything (no half-updated data).
- [ ] **Step 2:** Run, expect fail. Implement. Team number comes from `config.json` (`{"entryId": 11160462}`).
- [ ] **Step 3:** Run, expect pass. Commit.

### Task 10: The page (milestone 1: full squad builder)

**Files:**
- Create: `index.html`, `web/app.js`, `web/clubs.js`, `web/style.css`
- Test: `tests/clubs.test.js`

**Interfaces:**
- Produces from `web/clubs.js`: `CLUBS: {name: string, fplName: string, colour: string, text: string}[]` (20 entries matching bootstrap team names) and `contrastRatio(a: string, b: string): number`.

- [ ] **Step 1:** Tests: `CLUBS` has 20 entries and every `fplName` appears in the `bootstrap.json` fixture. For every club, `contrastRatio(text, colour)` is at least 4.5 (the opened-band colours) and the club colour tinted into the dark band meets 3.0 against `#23252b` for the name text. `contrastRatio('#000000', '#ffffff')` is 21.
- [ ] **Step 2:** Run, expect fail. Implement colours using `.superpowers/brainstorm/1370-1792856370/content/bands-softer.html` option 2 as the visual reference: neutral dark bands, thick left edge in the club colour, club-tinted name, full colour only when a band is opened.
- [ ] **Step 3:** `app.js`: load `data/*.json`, load HiGHS from `web/vendor/`, create the solver, and render one band per club listing the recommended players there with the reason lines from `projections`. Top of page: the recommended 15 with captain, XI and bench, total predicted points, and a line "Estimates, not promises. Odds cover this round only." When `status.squadAvailable` is false show "First week: build your squad from scratch." Show `updatedAt` and a red warning if older than 36 hours. Each band shows a loading state while the solver runs.
- [ ] **Step 4:** Verify in the in-app browser, desktop and a 1366x768 Chromebook-size viewport: bands open and close, text readable, no console errors, solver result appears within 10 seconds. Screenshot for Hamish.
- [ ] **Step 5:** Commit. **Milestone 1 reached: the squad builder works from `data/` produced by running `node job/run.js` locally.**

### Task 11: Transfers and chips screens (milestone 2)

**Files:**
- Modify: `web/app.js`, `index.html`
- Test: manual verification plus `tests/status.test.js` for the pure helpers moved into `src/`

- [ ] **Step 1:** When a squad file exists, show "This week's transfers" (from `planTransfers`) and a "Chips" panel (from `evaluateChips`) with "Play now" or "Hold" and the gain in points. Inputs for bank and free transfers are pre-filled from `deriveFreeTransfers` and editable. A "Wildcard squad" button shows `squadIfNow`.
- [ ] **Step 2:** Pure helpers (stale-data check, week-1 mode check) live in `src/status.js` with tests: 35 hours old is fresh, 37 hours old is stale; missing squad means week-1 mode.
- [ ] **Step 3:** Verify in the in-app browser with a saved real squad fixture and with the no-squad case. Commit.

### Task 12: Daily automation, publishing and handover

**Files:**
- Create: `.github/workflows/daily.yml`, `docs/HANDOVER.md`
- Modify: `README.md`

- [ ] **Step 1:** `daily.yml`: runs `node job/run.js` on a schedule (once a day, plus a manual button, plus one run a few hours before each deadline using the gameweek dates), commits changed `data/` files. Test the workflow manually once and confirm a commit appears.
- [ ] **Step 2:** Turn on GitHub Pages from the main branch root. Flip the repository to public (Hamish approved). Open the live URL in the in-app browser and confirm the page loads and the solver runs there.
- [ ] **Step 3:** Write `docs/HANDOVER.md` and the README for Harvey in plain English: the page address, what each part means, what to do on deadline day, how to correct bank and free transfers, and that the page advises only. Run `python "C:/Users/hamis/OneDrive/Coding/copy-editing-skill/check_language.py" .` on README and HANDOVER and fix findings.
- [ ] **Step 4:** Check the two open questions with Hamish: whether Harvey has both chip sets, and whether a pre-deadline run is enough. Record the answers in the design document.
- [ ] **Step 5:** Commit. Add the project to Hamish's memory index.

---

## Self-review

- Spec coverage: squad optimiser (6, 10), transfer recommender (7, 11), chips (8, 11), permanent squad record and advice log (9), Chromebook and free (Global Constraints, 6 spike, 12), look (10), explanations (5 `reasons`, 10), data sources (2), bookmaker odds (3), later-round estimate label (4, 5, 10). Non-goals (no backtest, no mini-league, no writing to FPL) have no tasks, as intended.
- Type consistency: `fixtureExpectations` (4) feeds `expectedPoints` (5) feeds `projectAll`, consumed by `solveSquad` (6) and `planTransfers` (7), both consumed by `evaluateChips` (8). Costs are tenths of £m throughout.
- Known unknowns recorded in tasks, not hidden: official points table (5), HiGHS in the browser (6 spike), free transfer rules with chips (7), selling price derivation (7), chip entitlement for a late joiner (12).
