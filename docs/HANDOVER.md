# FPL Optimiser: guide for Harvey

This is a web page that suggests who to pick for your Fantasy Premier League team (Hlfcfc). It only advises. You make every move yourself on the FPL site.

## What the page shows

- **Before your first deadline:** a full squad of 15, picked to score the most points over the next four gameweeks within £100m. The FPL site hides your team from everyone, including this page, until the first deadline passes. Until then you're picking from scratch, so use this squad as a starting point.
- **After your first deadline:** the page reads your real team and shows this week's transfers, the next four weeks of plans, and when to use each chip.
- **Club by club:** each club has a coloured band. Click one to open it and see your players there, what they're predicted to score, and why.

## What the signs mean

- **BUY, SELL, HOLD:** what the plan suggests for that player this week.
- **C:** suggested captain.
- **~** (a tilde) next to a number: there are no bookmaker odds for that match yet, so the prediction is a rougher estimate. Odds usually appear a few days before a round, and the page picks them up each day.
- **Red warning at the top:** the data is more than 36 hours old. Check injuries on the FPL site before you decide.

## On deadline day

1. Open the page. Look at the "This week" box.
2. Open the clubs where it suggests a sale or a purchase and read the reason lines.
3. If the page and the FPL site disagree (for example you made a transfer after the last update), use **Recalculate** at the bottom and type in your real bank and free transfers.
4. Make the moves on the FPL site.

## Things to know

- The page works out free transfers and selling prices from your history, because the FPL site doesn't state them. If a number looks wrong, correct it with Recalculate.
- The Chips box assumes you have a full set of chips. That isn't confirmed for someone who joined after Gameweek 8. Look at the Chips screen on the FPL site.
- The first set of chips has to be used before the Gameweek 19 deadline (Saturday 2 January 2027, 13:30 GMT). The second set starts after that.
- The predictions use your players' season numbers, the fixture list and bookmaker odds. They're estimates. Football is random.
- Recalculate can take up to a minute on a slow computer. The page stays usable while it thinks.

## How it updates

A free job on GitHub runs twice a day. It collects the latest FPL data and bookmaker odds, saves your team, works out the advice and publishes it. You don't need to do anything. If the red warning appears, ask Hamish to check the job.

To follow a different FPL team, change the number in `config.json` (it's the number after `entry/` in the team's FPL address).
