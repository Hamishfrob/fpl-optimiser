# Design references: the Anfield / match-night redesign

Checked 2026-10-24. Brief from Hamish: a pitch and stadium feel, Anfield as the reference because Harvey is a Liverpool fan, more colour, more life. No crests, badges, sponsor logos, slogans or copied photos go into the project (the repository will be public). Only principles and colours.

## References

| # | Reference | Reached? | What to take | What to leave |
|---|---|---|---|---|
| 1 | Photo "The Kop in May 2024", Wikimedia Commons (https://commons.wikimedia.org/wiki/File:The_Kop_in_May_2024_Anfield.jpg), viewed 2026-10-24 | Yes, screenshot | Banked rows of red seats. White seats spell letters in the seating. A steel roof with cross-bracing, floodlights along its front edge, and a red fascia ribbon. Grass cut in light and dark stripes, seen low and at an angle | The photo itself, the lettering, the sponsor text |
| 2 | Wikipedia, Anfield (https://en.wikipedia.org/wiki/Anfield), read 2026-10-24 | Yes, first half of the article only | Four stands: the Kop (single tier, all seated, flags and scarves), Main Stand (three tiers, tunnel at pitch level), Kenny Dalglish Stand, Anfield Road End. Floodlights moved onto the rooflines in 1973. Pitch 101 x 68 m. Attack the Kop in the second half | Sign, gates and statues (trademarked or memorial) |
| 3 | liverpoolfc.com Anfield page | No, 404 | Nothing taken | |
| 4 | Harvey's own FPL Pick Team screen (screenshot from Hamish, 2026-10-24 17:30) | Yes | Pitch with GK at the top, shirts with name plate and next opponent underneath, bench strip with position labels, C and V badges | Official branding |
| 5 | Dot-matrix stadium scoreboard (amber LEDs on black) | Not fetched, general knowledge | Amber dot digits for the countdown, which also make the countdown feel like part of the ground | |
| 6 | Own mockups, docs/mockups/design-ideas.html (Hamish approved all four ideas) | Yes | Pitch view, fixture ticker, points bars, countdown | |

Nothing here was measured from pixels. The seat red, steel grey and grass greens below were judged by eye from reference 1 and are mine, not measured. Reference 5 comes from general knowledge.

## Dominant direction: match night at the Kop

One idea, built as a picture made from Harvey's own data: the top of the page is a banked stand of red seats, and Harvey's team name is spelled in white seats, as the real stand does. Everything below is the pitch and the ground around it.

- Night sky, floodlights glowing at the top corners (soft warm radial glow).
- Header: seat-block stand (canvas) with the team name in white seats. Seats ripple on load and shimmer on hover. A red ribbon beneath it, like the roof fascia, carries the gameweek and predicted points.
- Scoreboard: the countdown in amber dot-matrix digits that tick, green/amber/red states change the lamp colour.
- Pitch: his XI on striped grass with real pitch markings, shirts in club colours, bench on the touchline. Toggle to points bars.
- Fixture ticker for his clubs, then the chips as "floodlight" cards (PLAY NOW glows and pulses), then the club bands as before.
- Palette (mine): night #0b0d12, seat red #b3161f, club red #c8102e (Liverpool's own, from clubs.js), steel #5f6b7a, roof edge #cfd6df, grass light #3f8f3a and dark #357f32, line white #eef3ee, scoreboard amber #ffb000.

## Decision ledger

| Change | Why |
|---|---|
| Team name spelled in white seats in a red stand | Reference 1: white seats spell letters in the Kop. Data-as-picture: the page's one piece of personal data, the team name |
| Amber dot-matrix countdown | Reference 5 and the approved countdown idea. One dot font drives both seats and scoreboard |
| Floodlight glow, steel roof line, red ribbon | Reference 1 roof, lights and fascia |
| Striped pitch with markings | References 1 and 4 |
| No badge, no slogan, no sign | Trademark and public repository |

## Built 2026-10-24 (what shipped against the lock)

- Header: banked stand with HLFCFC (the team name from the data) in white seats, steel roof strip, floodlight glows, red ribbon, dot-matrix scoreboard countdown (lamp colour green/amber/red by stage). Files: web/stand.js, web/dotfont.js.
- Team panel: pitch with striped grass and markings, bench on the touchline, tabs for Points bars and List. Files: web/views.js.
- Fixture ticker for the manager's clubs (estimates from results so far). Chips glow like floodlights when "play now".
- Checked at 1100px and 390px wide; ticker scrolls sideways inside its card on phones.
- Not done: no light mode, no crowd-noise effects, no club-badge imagery (deliberate).
- Weakest points still open: seat colours and grass greens are by eye, not measured; scoreboard and stand redraw every frame/second (cheap, but untested on a real Chromebook).
