# Switch Leagues: online leagues for friends, family, regions and the world (design)

Status: proposed, not built. No owner decisions yet; every choice below is a recommendation and open questions are listed at the end. Written 15 Nov 2026 after a feasibility review of the online-play code (`api/_room.js`, `api/_roomStore.js`, `api/_db.js`) and `2026-11-14-switch-online-play-design.md`.

## Intent

Turn the online platform into a league format: scheduled matchday events where a division of players is seated into pods and plays real Switch, earning season points. Three audiences share one system:

1. **Friends and family leagues.** Private, run from a club, no accounts.
2. **Regional and venue leagues.** Open to join, self-declared place ("Yorkshire", "Brisbane", a pub), light sign-in.
3. **Global leagues.** Divisions with promotion and relegation, ratings, a public table.

Same felt table, same rules, same computers filling empty seats. The game rules are sacrosanct (`docs/RULES-RULINGS.md`); this spec adds no rule and changes no engine behaviour.

## What already exists and is reused

| Need | Already built |
|---|---|
| Trusted results | Server owns the game and validates every move (`_room.js`) |
| Several games at once | `room.tables`, up to 16 seats, ruling 32 |
| League and cup formats | `src/switch/series.ts`: Group Play (place points N..1), Cup, Knock Out, Darts, Dominoes |
| Absent players | Away seats, computer takes over at 40 s (ruling 23) |
| Empty seats | Computers at any level, with personalities (ruling 29) |
| Groups of people | Shared clubs under an 8-character code, merge sync (`clubSync.ts`, `_clubMerge.js`) |
| Records | Every game is a stat, History, replays, trophies, badges |
| Safe by design | No free text; 18 fixed reactions (ruling 31) |
| Place | `venue` on nights |

## What is missing

1. **Durable storage.** Rooms are Redis documents with a 24-hour expiry on a free database shared with `basic-calculator`. Standings, fixtures and history need a real database.
2. **Persistent identity.** Seat tokens belong to one room. Leagues need someone who is the same person next week.
3. **Scheduling.** Enforcement is lazy and there are no server timers. Matchdays need start times, deadlines, reminders.
4. **Notifications.** Without a nudge a fixture is forgotten.
5. **Ratings.** Switch is luck-heavy; a rating needs many games to mean anything.
6. **Scale and realtime.** Polling costs one Redis command per poll per player.
7. **Safety for a public audience.** Display names are user content.

## Core model

```
League        id, name, kind (family | regional | global), owner, region?, venue?,
              format (group-play | cup | knock-out), podSize, gamesPerMatchday,
              season length, join rule (code | open), created
Season        id, league, start, end, divisions[], rules snapshot
Division      id, season, tier (1 = top), members[], capacity
Matchday      id, season, division, startsAt, joinWindow, status
Pod           id, matchday, seats (people + computers), roomTable ref, result
Standing      season, division, player, points, games, wins, matchdays played
Player        id, display name, region?, identity ref (see Identity), claimed club members
```

A **matchday** is one scheduled event for one division. At the start time the server seats everyone who has joined into pods (see Pods), creates a room using the existing multi-table machinery, and the games run in parallel. Results are written to the league database when each game ends, not when the room expires.

Naming follows the app's one-name-per-thing rule: "League" for the long-running competition, "Season" for one run of it, "Matchday" for one night's event, "Group Play" stays the one-night format. "Seasons" already names the long-running table across nights in the scorekeeper; a league season and a club season are the same idea and should share one screen, not two.

## The format: scheduled matchdays

Recommended over open-ended challenges and asynchronous fixtures. It removes time-zone fixture-chasing, forfeit disputes and half-played games, and leans on the engine that already runs tournaments.

**A matchday:**

1. Matchday announced in the league (Home, Club, and the league page) with its start time shown in the viewer's own time zone.
2. Join window opens (default 30 minutes before). Joining is one tap.
3. At start time the server seats everyone who joined into pods of the league's pod size (default 4), shuffled within the division. A division that does not divide evenly gets one smaller pod, never a bye (a bye is a free result).
4. Each pod plays the league's games-per-matchday (default 3). Place points are N..1 per game as in Group Play, summed per matchday.
5. Computers fill any seat left empty when a pod is short, so a pod never stalls. A computer's results are never ranked (see Fairness).
6. Matchday points add to the season standings. Standings update as each game ends.
7. At season end: promotion and relegation (see Divisions), a champion is announced, `CardShower`.

An **asynchronous daily Switch** (one game, any time in 24 hours, against whoever else is free) is a later extension, not part of the first release.

## Divisions, promotion and relegation

- A season has one or more divisions of 8 to 16 players. Open leagues start new joiners in the lowest division; family and club leagues have one division.
- Top 2 of each division go up, bottom 2 go down. A division of fewer than 8 stays as it is.
- Season points break ties by matchday wins, then a deciding game (as ruling 24 and its tie-break rules for leagues already do).
- Missing a matchday scores zero, not a loss. Missing three in a row marks the player inactive and moves them down at season end. Nobody is ever dropped mid-season without their own action.

## Pods and computers: fairness

- **Ranked pods have at least two people.** Games with fewer are friendlies; they are recorded in the player's own History like every other game ("nobody loses a score") but do not count towards the standings.
- **A computer never takes a league place.** It fills a seat; the places of the humans in the pod are scored among themselves (3 humans and a computer: the computer is removed from the order and humans receive 3, 2, 1). This is the simplest rule that stays fair; open question 2 asks whether to count it differently.
- **Away seats.** The 40-second auto-play stays. A game won mostly on computer-played moves (more than half of that person's moves) does not score league points for the win and is flagged in the record ("the computer played N moves"). Open question 3 asks the owner.
- **Rematch and reseating.** No one plays the same pod twice in a row in a season where it can be avoided.
- **Collusion and multiple accounts.** One league identity per person; same-pod frequency is reported to the league owner (family and club leagues) and monitored in aggregate in open leagues (see Anti-abuse).

## Ratings

Switch has high luck variance, so a rating moves slowly and is secondary to season points.

- **Season points decide a season.** Rating decides starting division and seeding only.
- Multi-player placement rating (Plackett-Luce or a simple multi-player Elo variant), shown only after 20 rated games.
- Before building, measure how many games it takes for rating to separate Hard from Medium and Easy computers: `node scripts/ai-selfplay.mjs 600`. That number sets the "20 games" threshold and tells us whether a rating is worth showing at all. This is the first task, not the last.

## Identity

Three layers, from lightest to heaviest. A player is never forced above the layer their league needs.

| Layer | Who | How |
|---|---|---|
| **Club member** | Friends and family leagues | The existing club code and "Which one are you?" (`joinedNights.ts`). No sign-in. |
| **Signed-in player** | Regional and global leagues | Google sign-in already designed (`docs/google-sign-in.md`); first name and a chosen display name. |
| **Verified age** | Public leagues | See Safety. |

A phone's games follow its owner (`identity.ts`, `claimMe`); signing in must call `claimMe`, never repoint "me" by hand. League ids are linked to the player's existing History so games played before joining a league stay theirs.

Storage keys: new data gets new keys (`docs/STORAGE-KEYS.md`); no existing key is renamed or reset. Proposed: `switchLeagues`, `switchLeagueSeasons`, `switchLeagueMatchdays`.

## Storage and backend

**Decision needed (open question 1).** Redis stays for live rooms. Leagues need a relational store.

| Option | For | Against |
|---|---|---|
| Postgres (Neon or Supabase via Vercel) | Real queries for standings, history, divisions; mature | Another service; migrations |
| Cloudflare D1 | `worker/` already exists and `_db.js` already imitates D1 | Two runtimes to keep in step (Vercel and Cloudflare) |
| Upstash paid, standings kept as sorted sets | Already in the stack | Poor fit for history and queries |

Recommendation: **Postgres**, a new `api/league.js` handler in the same style as `_night.js` (unknown fields dropped, names trimmed), tested with an in-memory fake like the other API tests. Redis is not used for league records.

League records are the system of record. Rooms stay ephemeral: when a game finishes, its result is written to the league database. If that write fails, the room keeps the result and retries on the next request, because the 24-hour room expiry must never be the only copy of a league result.

**Shared clubs.** A family league is a club with a season. Matchdays results flow into the club's shared history through the existing merge rules (`_clubMerge.js`); this resolves the open question in the online-play spec ("Should online results flow into a shared club's history?"). Yes, for league games.

## Scheduling and notifications

- **Scheduler.** Vercel Cron (or Cloudflare scheduled triggers) runs every minute: opens join windows, seats pods, deals, closes matchdays, writes standings, sends reminders. The existing lazy enforcement stays for in-game clocks; only the league lifecycle needs timers.
- **Reminders.** Email for signed-in players (opt-in), web push where available (iOS web push needs the Home Screen app; treat it as best effort), and always an in-app card on Home ("Matchday tonight, 8pm, 3 of 12 joined").
- **No reminders for unsigned family players** beyond what the club already shows. The league owner can share an invitation message ("Switch night, Thursday 8pm: code ABCD1234").
- **Time zones.** Times are stored in UTC, shown in local time, and a league has a home time zone so "Thursday 8pm" means the same wall-clock hour all year across daylight saving.

## Scale and cost

Each poll is one Redis command. Rough estimate (to be measured on a preview deployment): one player polling every 2 seconds is 1,800 commands an hour; 1,000 concurrent players is about 1.8 million an hour, roughly $3.60 an hour at Upstash pay-as-you-go ($0.20 per 100,000 commands). Matchdays are bursty, so costs are bounded by event length.

- **Phase 1 to 2:** polling stays, on a dedicated Switch database (the shared free one cannot carry leagues).
- **Phase 3:** WebSockets with one Cloudflare Durable Object per room (the repo already has a `worker/`), moving realtime off polling. The server-owned engine in `api/_engine.js` ports unchanged; the room store interface (`read`, `create`, `cas`) maps onto it.
- A matchday of 200 people is about 50 pods of 4, all in parallel. Rooms are one document each, so no single hot key.

## Safety, privacy and moderation

The app is no-free-text-chat by design (age rating: see docs/store/LISTING.md); leagues must not weaken that.

- **No free text between people.** Reactions stay the fixed 18. League names, display names and club names are the only user-written strings.
- **Names.** First names or chosen display names (40 characters), checked against a block list and a reserved list on creation and on rename; reported names are reviewed and replaced with a neutral default ("Player 4821"). A **Report** and **Block** action on every other player's name (app store policy for user-generated content).
- **Children.** UK Age Appropriate Design Code applies. Public leagues are 13+ with an age gate; under-13s play only private club leagues with no public listing, no leaderboard exposure and no sign-in. This needs the owner and a privacy review before build.
- **Leaderboards.** Public tables show display name, region and points only. No real names, no photos, no location beyond the region the player chose.
- **No location tracking.** "Region" is self-declared from a fixed list or a venue name the league owner sets.
- **Data held.** The server keeps league records for the life of the league plus 12 months; deleting an account removes the player's name from public tables and keeps anonymous results. `public/privacy.html`, the Privacy screen and store data-safety notes need new wording.
- **Prizes.** Entry is always free; no money, no cash or cash-like prizes, no gambling. Non-monetary recognition only (trophies, titles, `CardShower`). Venue sponsorship of a league name is fine; paying to win is not.

## Anti-abuse

- One identity per signed-in person (Google account); new accounts start in the lowest division and cannot move up for two matchdays.
- Same-pod frequency and win-trading patterns reported to league owners and flagged in aggregate; no automatic bans in the first release.
- A seat that auto-plays more than half its moves is flagged and, in open leagues, unranked for that game.
- Rate limits per address and per league on every write.

## Screens (within the existing design system)

Felt table, real cards, Phosphor icons, no side stripes, no small-caps label above a heading, `FeltHeader` on main screens, `CardShower` on a win. Layout checked on iPhone and Pixel after each meaningful screen change.

- **Club > Leagues.** The leagues you are in, next matchday with a countdown, your position. "Start a league" and "Join a league" (code, or browse regional leagues).
- **Start a league:** name, who can join (club code or open), format, pod size, matchday day and time, season length, home time zone.
- **League page:** standings (current division), next matchday, past matchdays, promotion and relegation zones marked with felt and gold, not stripes.
- **Matchday lobby:** the join button, who is in, pods once seated ("You are in Pod 3 with Alex, Sam, John"), then the existing online table.
- **Between games:** the existing tournament strip: this game's places, matchday points so far, standings.
- **Home:** one resume card ("Matchday tonight, 8pm") next to the existing ones; "Join a league" joins the discovery chips.
- **Me > History:** league games are labelled with league and matchday, tap opens the full record and replay, like every other game.
- **Trophies and badges:** league champion, promotion, ten matchdays played, streak of attended matchdays. No change to existing badge rules.

## Build order and phases

**Phase 0 (first, short): evidence.**
1. Run `node scripts/ai-selfplay.mjs 600` and a multi-player placement sim to find how many games rating needs. Decide whether ratings ship.
2. Verify Redis latency and cost from a Vercel preview with a realistic multi-table game; the Redis Lua script has so far only been checked against a fake.
3. Move rooms to a dedicated database before any public league.

**Phase 1: friends and family leagues (days).**
- A club gets a "League" with a season, scheduled matchdays and an invitation.
- Matchday seats everyone who joins into pods (computers fill gaps, unranked), runs games in the existing multi-table room, writes results to the club's shared history, standings screen.
- No sign-in, no divisions, no notifications beyond the invitation message.
- Tests: node tests for scheduling and standings (fake store), two and three real phones through a whole matchday.

**Phase 2: durable and regional (weeks).**
- Postgres, `api/league.js`, scheduler, sign-in, reminders, divisions with promotion and relegation, regional leagues, display-name checks, report and block, privacy wording.
- Tests: season simulation (promotion, relegation, missed matchdays, ties), moderation flows, a 12-phone matchday on a preview deployment.

**Phase 3: global (months).**
- Ratings (if Phase 0 supports them), global divisions, Durable Object realtime, anti-collusion tooling, league admin tools, age gate, owner dashboards.

## Tests

- **Standings and format (node):** place points, tie-breaks, a missed matchday, a computer-filled pod scoring only humans, promotion and relegation across a season.
- **Fairness (node):** a pod with computer-played moves above the cut-off does not score a win; a late join is refused; a reseat never repeats the last pod where it can be avoided.
- **Secrecy:** no player ever sees another pod's cards (the existing masked-view tests extended to pods).
- **Durability:** a result is not lost if the database write fails; retry on the next request; a room expiring mid-retry does not lose it.
- **Scheduler:** join window, start, close, time-zone and daylight-saving cases.
- **Phones:** two and three real browser phones through a matchday, a closed and reopened app rejoining a pod, a league visible on both phones after a club merge.
- **Layout:** iPhone and Pixel after each meaningful screen.

## Risks

1. **Liquidity.** An empty public league feels dead. Mitigation: start private and regional, computers fill pods, one league per region per tier at first, launch with a seeded "Switch Open" weekly event.
2. **Luck.** Skill may be hard to see. Mitigation: season points not rating decide results; Phase 0 measures it.
3. **Cost.** Matchday polling on a shared free Redis. Mitigation: dedicated database now, Durable Objects later.
4. **Moderation and children.** User-written names are the only vector. Mitigation: block list, report, 13+ for public leagues, private under-13 play.
5. **Operational load.** A scheduler, notifications and a database are a different kind of system from the app so far. Mitigation: phase it; Phase 1 needs none of them.

## Open questions for the owner

1. **Database:** Postgres (recommended), D1, or Upstash? Is a new paid service acceptable?
2. **Computers in a ranked pod:** remove them from the order (recommended), or score them like any seat?
3. **Wins on computer-played moves:** unranked above half the moves (recommended), always count (as the online-play spec proposed), or always count with a flag?
4. **Under-13s:** private club leagues only (recommended), or no leagues at all for under-13s?
5. **Public leagues:** launch in Phase 2 as open regional leagues, or keep leagues private until Phase 3?
6. **Ratings:** show one at all, if Phase 0 says skill is hard to see?
7. **Notifications:** is email acceptable for reminders (needs a sending service), or push and in-app only?
8. **Seasons screen:** merge the league season with the club's existing "Seasons" table, or keep them separate?
9. **Asynchronous daily Switch:** later, or never?
