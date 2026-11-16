# Owner dashboard (14 Nov 2026)

`/stats.html` is a private page for the owner: audience, games against the computer, penalty cards, game nights and clubs, screen use, and records. `/stats.html#demo` shows the layout with clearly labelled made-up numbers.

## Switching it on

1. In the Vercel project, add an environment variable `STATS_TOKEN`: any long secret (12 characters or more). Redeploy.
2. Open `https://<your site>/stats.html` and paste the token. It is kept for that browser tab only (`sessionStorage`); "Lock" forgets it.

Without `STATS_TOKEN` the data endpoint answers 503 and the dashboard stays off. Wrong tokens get 401, rate-limited to 20 tries a minute.

## What is counted, and how

| Source | Where | What it gives |
|---|---|---|
| Phone events | `POST /api/stat` (`api/_stats.js`) | Opens, new and returning devices, platform, installed-app share, screens opened, finished games (level, table size, result, place, moves, minutes, penalty cards dealt and received by whom, power cards played), practice starts and finishes, nights saved by format, one-off actions. |
| Server events | `api/hit.js`, `api/_clubHandler.js`, `api/_nightHandler.js` | Visits per day, shared clubs created, club syncs, live nights shared, friends who joined. |
| Server snapshot | `GET /api/stats` (`api/_statsSnapshot.js`) | Cloud backups, shared clubs and their sizes and formats, live shared nights, read from the stored files. Counts only. |

Counters are kept as one small file per UTC day, `stats/days/YYYY-MM-DD.json` in the private blob store. Nothing but named numbers is stored: no id, name, score, club, address or user agent. `tests/stats.test.mjs` checks this.

## Games played, and what gets finished (16 Nov 2026)

The top of the dashboard answers "how much is played, of what, and what is left unfinished". It follows the date range buttons.

| Section | What it shows | Counted by |
|---|---|---|
| Games played | Total finished, split into against the computer, online with friends and scored nights, a per-day chart, and "What stands out" (red/amber findings, most and least played types) | Phone events (`game`, `night`) and the server (`online.*`) |
| What gets finished | For every type: started, finished, not finished, completion %. Red under 60% with at least 5 starts | `game_start` + `game` (by `mode`), `night_start` + `night` (by format), online tables `started` + `finished` |
| Against the computer, in depth | Game types, table size 1 to 7, level, where games are left (`game_quit`, by moves played), win rate by type, tournaments and matches as a whole (`series`) | Phone |
| Online tables, in depth | Tables made, started, finished, people and seats per table, game types, how often the computer had to play for a quiet person | The server, in `api/_onlineStats.js`, so closing the app never loses a table |
| Scoring types, in depth | Most and least popular scorekeeper, players per night, begun v saved by number of players | Phone |

Notes: unfinished = started minus finished, so a game still going or resumed later is a small, harmless gap; look for large gaps that persist. Online counters are worked out by the server from what changed in a table (`handleRoom(..., observe)` in `api/_room.js`) and only after the change was saved; they hold no names, codes or scores. Games finished before 16 Nov 2026 carry no game type and appear as "Before game types were counted". "Left early" for single games is an Exit with the game still going; it can be resumed.

## Limits to keep in mind

- "Devices" are phones or browsers, not people, and there is no id to join days together, so weekly or monthly unique users cannot be calculated. Clearing site data makes a phone look new.
- Day files are updated read-then-write, so two events in the same instant can lose one. These are trend figures.
- Phones that opt out (Me > Privacy), send Do Not Track or Global Privacy Control, or are automated browsers are not counted.
- Counting began on the day the first event arrived. Lifetime visits before that are only in the footer counter.

## Adding something to count

1. Send it from the app with `track({ e: "name", ... })` (`src/switch/telemetry.ts`).
2. Teach `countersFor` in `api/_stats.js` to turn it into counters. Anything it does not list is dropped.
3. Show it in `public/stats.html` and add a case to `tests/stats.test.mjs`.

## Keeping the promises honest

The privacy screen, `public/privacy.html` and the store listing all say what is counted. If a new count could identify someone, or the store forms (Google Play Data safety, App Store privacy labels) are filled in, they need to match. The store listing text in `docs/store/PUBLISHING.md` still says "no analytics" and must be updated before the next submission.
