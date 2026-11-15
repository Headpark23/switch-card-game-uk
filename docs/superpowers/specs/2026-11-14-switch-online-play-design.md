# Switch Online Play: friends and family (design)

Status: proposed, not built. Owner decisions of 14 Nov 2026 are marked **(owner)**.

## Intent

Let people who are not in the same room play real Switch together on their phones: a private table for friends and family, with computers filling any empty seats. It sits in **Play**, next to playing the computer. No public matchmaking, no accounts needed, no free-text chat.

## Owner decisions

1. **Online games count (owner).** Every finished online game is a stat (win or loss) and shows in Me > History, like every other game ("nobody loses a score").
2. **Reactions (owner).** 18 fixed reactions (sayings and emojis) and nothing else. See "Reactions".
3. **Absent players (owner).** A visible countdown. If a player makes no move for 30 seconds, they are told the computer will play for them in 10 seconds. At 40 seconds the computer plays that move. See "Turn clock".
4. **Where it lives (owner).** In Play.

## How it works

**The server owns the game.** Hands are secret, so one phone cannot hold the whole `TableState`. The server holds the real state and deals with `createTable`, validates every move with `applyTableAction` (it throws on an illegal play), and sends each seat a masked view.

- A seat's view has its own hand in full. Every other hand, and the draw pile, are arrays of placeholders of the right length. The discard pile is public.
- Because `planTurn` and `visibleAt` in `presentation.ts` read only hand lengths for other seats, they work unchanged on a masked state. Each move arrives as `{ move, seat, action, after (masked) }`, and the phone animates it exactly as it does against the computer. (This is much smaller than first feared; the engine decides once and the screen walks the steps.)
- Computers are seats the server plays with `chooseTableAction`, at the level the host chose. The same function covers an absent human.
- Seats: 2 to 8, humans and computers mixed, two decks from 7 seats (ruling 21). First version: a single game. Series modes (Knock Out, Cup, Darts, Dominoes) stay computer-only until this has proved itself.

**Joining.** A 6-character room code, same alphabet as night codes, stored under its own namespace (`game-room/CODE`). The host gets a seat token, and each friend gets one on joining. A link `/?table=CODE` opens "Join this table", with the code also shown in the invite text because an iPhone Safari tab and the Home Screen app keep separate storage (as clubs already handle). A phone remembers its seat token, so closing the app and returning drops the player straight back into the game (as `switchTableGame` does today).

## API (`api/room.js`, handler in `api/_room.js`, store in `api/_roomHandler.js`)

| Call | Purpose |
|---|---|
| `POST /api/room` | Host creates a room: seats, computer level, host first name. Returns code and host token. |
| `PATCH /api/room?code=` | A friend joins with a first name. Returns seat and token. Names must be unique at the table. |
| `POST /api/room?code=&op=start` | Host starts. Empty seats become computers. Deals. |
| `GET /api/room?code=&since=N` | Masked view for the caller's seat, plus moves after `N`, the turn deadline and `serverNow`. |
| `POST /api/room?code=&op=move` | `{ action, lastCard, expect }`. Rejected with 409 if `expect` is not the current move. |
| `POST /api/room?code=&op=react` | `{ id }`, one of the 18 reaction ids. |

Everything is validated and trimmed in the same style as `_night.js`: unknown fields dropped, names 40 characters, rooms expire 24 hours after the last move.

## Realtime and storage

- **First version: polling.** Phones poll every 1.5 s while the app is visible and 5 s when idle. A game is a few writes a second at most.
- **Storage: Redis (Upstash), decided 14 Nov 2026.** Blob is ruled out. The Vercel Hobby plan allows the whole team 2,000 Blob writes and 10,000 Blob reads a month (268 and 165 already used by club and night sharing), and a four-player game polling every 1.5 s would use the reads in about an hour and the writes in about 17 games. The existing free Upstash database `upstash-kv-aquamarine-cloud` (500,000 commands a month, shared with the `basic-calculator` project) was connected to `switch-card-night` for Production and Preview. Variables: `ROOMS_KV_REST_API_URL`, `ROOMS_KV_REST_API_TOKEN`, `ROOMS_KV_REST_API_READ_ONLY_TOKEN`, `ROOMS_KV_URL`, `ROOMS_REDIS_URL`.
- **Sharing a database.** Every room key starts with `switch:room:` so nothing can touch the other app's data, and rooms always get an expiry (24 hours after the last move). Watch the shared allowance: one hour of a four-player game polling every 1.5 s is about 10,000 commands. Past 500,000 a month the free tier is full; moving Switch to its own pay-as-you-go database ($0.20 per 100,000 commands) is the fallback.
- **Safe writes.** A move is applied with an atomic check on the move counter (a small Lua script or a transaction), so two writers can never both win. The handler talks to a `store` with `read`, `write` and `update` so tests can use an in-memory fake, as the other API tests do.
- **One command per poll.** Upstash counts commands, not bytes, so a poll is a single `GET` of the whole table (a few kilobytes). Reading a counter first would double the cost. A poll writes only when something actually changed (a move, or a person's "last seen" at most every 10 seconds).
- **Not WebSockets yet.** Vercel's native WebSockets are in public beta with a 300 s default connection limit and no cross-instance broadcast. Revisit later, or use a hosted realtime service, only if polling feels slow.
- **Rate limit.** The club limit (120 requests a minute per address) would stop a family of four on one home connection, each polling every 1.5 s. Room reads get their own larger limit keyed by address and code.

## Turn clock (owner decision 3)

Server-authoritative. Each turn records `turnStartedAt` when it begins. The view carries `serverNow` so each phone corrects its own clock.

- **0 to 30 s:** nothing shown.
- **30 s:** the seat is told: "Still there? The computer will play your move in 10 seconds." A 10-second countdown shows on their phone. Everyone else sees: "Alex is taking a while. The computer plays for them in 7 s."
- **40 s:** the computer plays that move (standard level) and the game goes on.
- A move made before 40 s always wins; the server rejects the computer's move if the human's arrived first.
- **Enforcement is lazy.** There are no timers on the server. Any request that arrives after the deadline triggers the computer move, so a game nobody is watching simply pauses and expires after 24 hours.
- **Last Card.** The call is part of a play (`lastCard: true`, ruling 20). The computer always calls it correctly when it plays for someone, and a computer-played move never costs a human the two-card penalty.
- **Proposed, not decided:** after two computer-played moves in a row the seat is marked "away", the computer plays it after about 5 s, and a "Back in" button hands control back. A human who is away should not stall the table 40 s a turn.
- A game won on a computer-played move still counts for that player, with a note in the record ("the computer played N moves for you"). Open question, see below.

## Reactions (owner decision 2)

Fixed ids, nothing typed. The server stores only the id, the seat and the time, so no text can be injected. They appear as a bubble by the seat for about 3 seconds, one per seat every 2 seconds, and can be switched off in the table settings.

Replaced on 14 Nov 2026 by cheeky banter and our own stickers (ruling 31, `src/switch/reactions.ts`).

Sayings (10): Read 'em and weep · Is that all you've got? · Sweating yet? · Oh, you absolute sausage · Pick up, sunshine · Who taught you to play? · Lucky so-and-so · Not today, sweetheart · Revenge is coming · Behave!

Stickers (8): Smug King · Salty · Card shark · Sweating ace · Mic drop · Facepalm jack · Crying joker · Seven on fire

The reaction picker is one button at the side of the table, next to Last Card. The emoji are message content, not icons, so this does not break the rule against emoji as icons; the button itself is a Phosphor icon.

## Stats and records (owner decision 1)

- A new key, `switchOnlineGames` (shape as `switchComputerGames`, plus the opponents with a flag for human or computer, finishing place, moves, and how many moves the computer played). Existing keys are untouched; see `docs/STORAGE-KEYS.md`.
- Each phone logs the finished game itself, under the game id (room code plus game number), so logging twice can only replace and never duplicate. The server keeps the result in the room for 24 hours so a player whose app was closed at the final move still gets it when they return.
- Me > History, stats, streaks, badges and trophies read these records alongside games against the computer. The record in History names who you played, and tapping it opens the full game.
- Games with computers filling seats count the same as any other.
- Telemetry (the owner dashboard counts) adds online games and rooms without recording names.

## Screens (in Play)

- `PlayLobby.tsx`: directly under the felt header, "Play with friends" with two actions, **Start a table** and **Join with a code**. Resume card extended for an online game in progress.
- **Table room (waiting room):** the code, an invite button (`navigator.share`, falling back to copy, with the code in the text), the seats as they fill, the host's choice of seat count and computer level, and Start.
- **Online table:** the existing table screen, fed by the room instead of by local state. `TableGame.tsx` mixes state and display, so the first step is to pull the display out into a component that takes a masked state plus callbacks. Computer games must pass their existing tests unchanged before online is wired in.
- Design stays within the existing system: felt table, real cards, Phosphor icons, no side stripes, `CardShower` on a win, Active seat red glow and readable text.

## Privacy and safety

- No chat, no free text, no profiles shared with strangers, no public lists of rooms. A room exists only for people who have its code.
- The server holds first names, seat tokens, cards and moves for up to 24 hours after the last move. The privacy page, store data-safety notes and `public/privacy.html` need a line saying so. (They have uncommitted edits from another piece of work at the time of writing, so that edit should land after those are committed.)
- The seat token is the only credential and lives only on the player's phone. Hands and draw-pile order never leave the server except each player's own hand.

## Tests

- **Secrecy (node):** for a dealt room and after many random moves, no view for seat B contains any card of seat A's hand or the draw-pile order.
- **Fairness (node):** moves from the wrong seat, stale `expect` values, illegal plays and the clock all behave; a human move at 39 s beats the computer; at 40 s the computer plays.
- **Rules:** the online server plays the same engine as the table, so `tests/switch-table.spec.ts` and the rules simulator keep guarding it. A seeded multi-seat room game is compared with the simulator.
- **Two or three real phones (Playwright, like `switch-two-phones.spec.ts`):** create, join, play to the end, both history screens show the game, a phone closed and reopened mid-game rejoins, an absent seat is auto-played, reactions appear on the other phones.
- **Layout:** iPhone and Pixel after each meaningful screen change.

## Build order

1. Storage: done. Redis connected to the Switch project (see above). Check latency from a Vercel preview deployment once the room handler exists.
2. Engine on the server: bundle `table.ts`, `rules.ts`, `cards.ts` and `tableAi.ts` for the API (Vercel compiling an `api/*.ts` handler, or a build step with the bundler already installed), with the secrecy test.
3. Room handler, store, clock and reactions, all unit tested in node.
4. Pull the display out of `TableGame.tsx` into a reusable table view.
5. Lobby, waiting room, online table, reaction and clock UI.
6. Records, History, privacy copy, telemetry.
7. Two-phone and three-phone Playwright tests, device layouts, release checklist.

## Open questions for the owner

- A win on a move the computer played: count it as the player's win (proposed), or mark it differently?
- After two computer-played moves in a row, should the seat go to "away" with a short delay (proposed), or stay at 40 s every turn?
- Should online results also flow into a shared club's history for players who are in the same club (proposed, later phase)?
- Series modes online (Knock Out, Cup, Darts, Dominoes): later, or never?

## Built so far: the server (14 Nov 2026)

Done and tested, not deployed and with no screens yet.

- `api/_room.js`: tables, seats, dealing, move checking, Last Card, the turn clock, reactions, masked views, the HTTP handler. `api/_roomStore.js`: the Redis store (compare-and-set with a small Lua script). `api/_roomHandler.js` and `api/room.js`: the route, with its own generous rate limit (900 requests a minute per address). `api/_engine.js`: the app's table engine and computer player, bundled for the server by `npm run build:engine` (runs before every build; `tests/room.test.mjs` fails if the committed copy is out of date).
- `tests/room.test.mjs` (18 tests, part of `npm run test:sites`): no seat is ever shown another seat's cards across whole games, stale and illegal moves are refused, the clock, away seats, computers playing in turn, reactions, rematch, expiry, collisions and the Redis commands.
- The Redis store has only been checked against a fake. Its Lua script and Upstash's REST address are verified for real on the first Vercel preview deployment.

### Choices made while building (each can be changed)

- **Calls and moves.** `POST /api/room?code=&op=` takes `join`, `start`, `move`, `call` (Last Card on its own), `react` and `again` (host deals again). A move can carry `lastCard: true`.
- **Last Card online.** Same as ruling 20: emptying your hand without having called means you pick up two. Holding exactly one card without having called is spotted by the table after 5 seconds (the computer does this against you at home), unless you call first. Open for the owner: is an automatic spot after 5 seconds what you want, or should another person have to press a button?
- **Away seats.** Built as proposed: two computer-played moves in a row marks a person "away"; the computer then plays for them after 5 seconds, and any move of their own brings them back.
- **Nobody there.** If no person has polled for 30 seconds, all clocks stop and start again when someone returns, so a game nobody is watching is never played out.
- **A move that arrives just late.** A move reaching the server within 1 second of the 40-second deadline still beats the computer.
- **Seating.** People and computers are seated in a random order at the start. Everyone's view turns the table so they are seat 0, which is what the existing table screen expects.
- **Reactions.** The 18 ids are fixed in `REACTIONS` (`api/_room.js`); the wording and emoji belong in the app.

## Built so far: the screens (14 Nov 2026)

- **Play > Play with friends** (`FriendsTable.tsx`): Start a table (name, 2 to 8 seats, Easy/Medium/Hard) or Join with a code. A link `/?table=CODE` opens the join form with the code in and shows who is already there.
- **Waiting room and table** (`OnlineTable.tsx`): the code in large type, an Invite button (share sheet, or copies the invitation), who has sat down, and Deal for the host. The game itself reuses the felt table, card flights and pick-up animations; each turn the server reports is shown through `planTurn`/`visibleAt` like a computer's. If several turns arrive at once the table simply shows where it now stands.
- **Last Card**: the button tells the table at once; said after choosing the final card it is too late (ruling 26), so the server is not told.
- **Absent players**: from 30 seconds a banner says the computer will play their move in N seconds (the server's own clock, so a wrong phone clock cannot change it). Away seats are labelled.
- **Reactions**: a sheet of the 18, shown beside the sender for a few seconds. A test fails if the app's list and the server's ever differ.
- **Results**: when a game ends it is saved once under the table's game id ("Won online", "Online · 4 players" in Me > History; Night detail marks computer-played moves).
- `tests/switch-online-play.spec.ts` runs two real browser phones against the real server code: set up, join by link, deal, each sees only their own cards, a move reaches the other phone, a reaction appears.
- Found by that test and fixed: the answer to "start" was cut for the host's seat number from before the seats were shuffled, so the host could briefly be shown another seat's view. Now cut for wherever the token sits after the shuffle (regression test in `tests/room.test.mjs`).
- Still to do: a Vercel preview to try the Redis store for real; privacy wording (Privacy screen, `public/privacy.html`, store listing) to say tables are kept for a day.

## Built so far: ways to play online (14 Nov 2026)

- Owner decisions: all five ways to play online; Knock Out is "last one out leaves" (ruling 11); anyone sitting out watches live. Recorded as ruling 30.
- Server: `room.seats` is everyone at the table and `room.table` lists who is in the current game. A tournament (`room.series`) is the app's own `src/switch/series.ts`, bundled into `api/_engine.js`; it moves on after each game, plays computer-only games instantly, and deals the next game with a person in it 20 seconds later (`TIMING.betweenMs`) or when the host taps Deal. Views now carry `players`, `series` (standings state, title, outcome, next deal time) and `you.watching`.
- Screens: a way-to-play picker on Start a table (seat minimum per mode, Darts sets, Dominoes number); the way to play on the waiting room and the invitation; a strip naming the game being played; a watching panel instead of a hand; between games, this game's places, the standings, other results and "Next: … You are in it / You will watch" with the countdown; at the end, the final places and Play another.
- Stats: each game you play is saved with its mode and tournament id; when the tournament ends its result is written onto your last game in it, so trophies and badges count it.
- Fixed on the way: Last Card's 5 seconds could be cut short by another phone checking in at exactly 5 seconds; the table now allows a second for the call to travel, whoever is looking.
- Tests: `tests/room.test.mjs` plays a whole tournament of each type with two people and computers, checking nobody ever sees another hand and a watcher cannot move; `tests/switch-online-play.spec.ts` runs Darts across two games and a Cup game with one person watching on two real browser phones.
- Simplification to know about: games of a tournament are played one at a time, never side by side, so in a big Cup or Group Play people may watch for a while.

## Built so far: games at the same time (14 Nov 2026)

- Owner decisions (ruling 32): up to 16 at a table; two bigger leagues; a Knock Out of more than 8 split onto tables; computer-only games in real time.
- Server: a room is now `seats` (everyone) plus `tables` (one game each, with its own cards, clock, moves and move counter). Every request catches up on the next event anywhere in the room, in time order: a missed Last Card spotted, a move played for a computer or an absent person, or a waiting game dealt. Each waiting game has its own deal time (`ready`), 20 seconds after the game that led to it. `news` holds the announcements; `history` keeps every finished game so each person's games are saved even if their phone was closed when it ended.
- View: your own live game always comes first; otherwise the game you chose to watch (`&watch=tableId`), else your last game. `tables` lists every game with card counts only. Polling slows to every 3 seconds while you are not playing, to keep the Redis free tier comfortable on a big night.
- Screens: "Bigger nights" seat buttons (10, 12, 14, 16) for Knock Out, Cup and Group Play; announcements slide in at the top on every screen; between games, your next game with its countdown, "Playing now" with a Watch button per game, both leagues' standings and the night's announcements.
- Old tables (one game per room) are refused with a message to start a new one.
- Cost to know about: a big night means many phones polling. Each poll is one Redis command; 16 phones at 1.5 to 3 seconds is roughly 20,000 to 40,000 commands an hour. Upstash's free tier allows 500,000 a month, so a few big nights a month fit; more would need the paid tier.
