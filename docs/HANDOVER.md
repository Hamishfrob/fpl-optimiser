# FPL Optimiser: guide for Harvey

This is a web page that suggests who to pick for your Fantasy Premier League team (Hlfcfc). It only advises. You make every move yourself on the FPL site.

The address is https://hamishfrob.github.io/fpl-optimiser/ . On a phone, open it in the browser and use Add to Home Screen so it opens like an app.

## What the page shows

- **Before your first deadline:** the FPL site hides your team from everyone, including this page. So your team is saved by hand in `my-squad.json` (copied from the Pick Team screen on 24 October), and the page shows it with predicted points for each player, your captain and a comparison with the best lineup from the same 15. If you change your team before the deadline, tell Hamish, or type the new team into the box at the bottom of the page (it's remembered in that browser only).
- **Also before the deadline:** a suggested squad from scratch, for comparison.
- **After your first deadline:** the page switches to your real team from the FPL site by itself and shows this week's transfers, the next four weeks of plans, and a Chips panel saying when to use each chip and what it would mean for your players.
- **Club by club:** each club has a coloured band. Click one to open it and see your players there, what they're predicted to score, and why.

## What the signs mean

- **BUY, SELL, HOLD:** what the plan suggests for that player this week.
- **C:** suggested captain.
- **~** (a tilde) next to a number: there are no bookmaker odds for that match yet, so the prediction is a rougher estimate. Odds usually appear a few days before a round, and the page picks them up each day.
- **Red warning at the top:** the data is more than 36 hours old. Check injuries on the FPL site before you decide.

## On deadline day

1. Open the page. Look at the Transfers box and the Chips panel.
2. Open the clubs where it suggests a sale or a purchase and read the reason lines.
3. If the page and the FPL site disagree (for example you made a transfer after the last update), open "Enter or change my team" at the bottom, type in your real team and bank, and press Use this team.
4. Make the moves on the FPL site.

## Things to know

- The page works out free transfers and selling prices from your history, because the FPL site doesn't state them. If a number looks wrong, tell Hamish.
- In your first gameweek the FPL site shows Wildcard and Free Hit as unavailable and Bench Boost and Triple Captain as playable, and the page follows that. Whether the second set of chips arrives as normal for someone who joined late is not confirmed.
- The first set of chips has to be used before the Gameweek 19 deadline (Saturday 2 January 2027, 13:30 GMT). The second set starts after that.
- The predictions use your players' season numbers, the fixture list and bookmaker odds. They're estimates. Football is random.
- Working out advice for a team typed into the page can take up to a minute on a slow computer. The page stays usable while it thinks.
- Your bank before the deadline is an estimate (£100.0m minus your players' current prices). Check it against the FPL site.

## How it updates

A free job runs twice a day (on GitHub, or on GitLab if the project has moved: see `docs/GITLAB.md`). It collects the latest FPL data and bookmaker odds, saves your team, works out the advice and publishes it. You don't need to do anything. If the red warning appears, ask Hamish to check the job.

To follow a different FPL team, change the number in `config.json` (it's the number after `entry/` in the team's FPL address).
