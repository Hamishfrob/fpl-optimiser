# FPL Optimiser: design

Status: DRAFT 2026-10-24, awaiting Hamish's approval. Nothing is built.
Prior art: see `PRIOR-ART.md` in the project root (checked 2026-10-24).

## Intent

Hamish's friend Harvey plays Fantasy Premier League (team "Hlfcfc", team number 11160462, ordinary points-based league). He joined on 24 October 2026 and his first gameweek is Gameweek 9. Hamish wants a tool that makes the weekly decisions better and makes checking them enjoyable.

The tool answers four questions: which 15 players to start with, which transfers to make this week, when to play each chip, and what a Wildcard or Free Hit squad should be.

## Goals

1. Full squad optimiser. Before the Gameweek 9 deadline (Saturday 31 October 2026, 11:00 UTC) Harvey has an unlimited free pick, so the tool must recommend the best legal 15-player squad within £100m, max 3 per club. This is the first thing to ship.
2. Transfer recommender. From his real squad, bank and free transfers, suggest this week's transfers, counting the 4-point cost of each extra one and the value of banking a free transfer. Plans several gameweeks ahead.
3. Chip planner. Uses the game's own four chips (Wildcard, Free Hit, Bench Boost, Triple Captain), two sets this season, first set before the Gameweek 19 deadline (2 January 2027, 13:30 GMT). Says each week "play it now" or "hold", and for Wildcard and Free Hit builds the squad to move to.
4. A permanent record of Harvey's squad and of each week's advice, so recommendations always start from his real team and he can see what the tool said versus what he did.
5. Runs on a Chromebook, free to run, no paid services, no Claude needed at run time.
6. Looks good: club colours, dynamic. See "Look" below.
7. Explains itself. Every suggestion shows why (predicted points, fixtures, bookmaker view) so Harvey can overrule it.

## Non-goals

- No backtesting (Hamish's decision).
- No mini-league comparison with rivals (points-based league).
- No paid data, paid APIs or paid AI calls.
- No login, no password, no writing to the FPL site. The tool only advises. Harvey makes the moves himself.
- Captain picker, price-change predictor and phone alerts are later, not first scope.

## Anti-goals

- A tool that sounds sure when it isn't. Predictions are estimates and the page says so.
- Anything Harvey can't run on a Chromebook (no Python install, no terminal).

## Constraints

- Static web page, public, hosted on Hamish's GitHub (free). Hamish has said a public repository is fine.
- The official FPL data feed sends no CORS header (tested 2026-10-24), so a browser page can't call it directly. A scheduled job (GitHub Actions, free) fetches data daily and commits JSON files the page reads.
- The solver runs in the browser as WebAssembly. Candidate: the `highs` package on npm (exists; not yet tested on a Chromebook).
- Squad is hidden by the FPL site until after a deadline, so from Gameweek 9 onward it can be read, but not before. Week 1 is a from-scratch build.

## Decided with Hamish

- Build on the open-source solver `solioanalytics/open-fpl-solver` (Apache-2.0): reuse its model (multi-gameweek horizon, hits, free-transfer value, chip placement, bench weights). Our own projections replace its paid Solio data.
- Bookmaker odds are a core input.
- Public page, free data only.
- Chips means the game's chips, not a hypothetical team.
- Squad is stored as a permanent record, not re-entered each week.
- Look: club colours down the page, dynamic (final layout still to be chosen from mockups A, B, C).

## Data sources (tested 2026-10-24)

| Source | What it gives | Tested |
|---|---|---|
| fantasy.premierleague.com/api/bootstrap-static/ | All players, prices, form, xG, xA, injury notes, chance of playing, ownership, transfers in/out, gameweek deadlines | Yes, 668 players, 20 teams |
| .../api/entry/{id}/, /history/, /transfers/, /event/{n}/picks/ | Harvey's squad, bank, value, chips used, transfer history | Yes for a sample team and for 11160462 (no squad yet, picks give 404 until his first deadline) |
| football-data.co.uk/fixtures.csv | Bookmaker odds for the next round only (about 10 matches): win/draw/win, over/under 2.5 goals, Asian handicap | Yes, 10 Premier League rows today |
| github.com/vaastav/Fantasy-Premier-League | Historical per-gameweek player data | Not fetched. Only needed if the builder wants to calibrate rates |

Not available free: odds beyond the next round. Later gameweeks use a team-strength rating (see below).

## How it works (builder decides details)

1. Daily job: pull the three sources above, write JSON into `data/`, commit. Also write `data/squad/gw{n}.json` for Harvey after each deadline and keep history.
2. Projections (my call, version 1): for each player and gameweek, expected points = chance of playing x expected minutes x per-90 attacking rate (from FPL xG/xA) x fixture factor, plus clean-sheet and goals-conceded terms for defenders and goalkeepers, plus appearance points. Next-round fixture factor comes from bookmaker odds (implied team goals and clean-sheet chance). Later rounds use a team-strength rating built from those odds and the season's xG and xGC. The page labels later rounds as rougher.
3. Solver in the browser: choose squad and transfers over a horizon of about 4 to 6 gameweeks, with hits, free-transfer value, bench weights, and chip gameweeks as options.
4. Free transfers: the site doesn't state the count, so it's derived from his transfer history. The page lets Harvey correct it by hand, because this derivation isn't verified.
5. Recommendation log: each weekly run stores what was advised, so it can be compared later with what was done.

## Look

Hamish's brief: the page is built around the Premier League clubs, listed down the page, each in its own club colours, and it's dynamic. Three layouts are mocked up for him to react to: A club bands stacked down the page, B tile board of all 20 clubs, C squad list with a club-colour edge. No official club badges (copyright); use club-colour blocks and names. DECIDED 2026-10-24: layout A (club bands down the page) in the "dark page, club colour as the glow" style: neutral dark bands with a thick left edge and the name tinted in the club colour, and the full club colour flooding the band only when it is opened. Hamish found full-colour bands too strong. Mockup: `.superpowers/brainstorm/1370-1792856370/content/bands-softer.html` (option 2). Text colour is chosen per club for contrast.

Accessibility note: some club colour pairs have poor contrast (white clubs, yellow clubs). Text colour must be chosen per club to stay readable.

## Left to the builder

Exact points table (this season's bonus system was rebuilt, and I did not find the full table), solver settings, file layout, test approach, how the daily job is scheduled, and how the page handles the few minutes when a deadline has passed but data hasn't refreshed.

## Open questions for Hamish

1. (Answered: layout A, dark style.)
2. Does a late joiner (Harvey, joined after Gameweek 8) still get both chip sets and the 2 January cutoff? Not verified. Needs checking on the FPL site's chips screen.
3. Should the daily job also run just before each deadline, or is once a day enough?

## My calls to check

- Version 1 projection method above (simple, explained, replaceable).
- Horizon of 4 to 6 gameweeks.
- Squad history kept as one file per gameweek in the repository.
- Public repository and public data files (Harvey's squad is visible to anyone who finds the repo; his FPL squad is public on the FPL site once a deadline passes anyway).
