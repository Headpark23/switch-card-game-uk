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
- **Storage: Vercel Blob with `ifMatch`.** The room document carries the move counter; a write that loses a race gets a precondition failure, re-reads and retries once. Turn-based play means one writer at a time, apart from joins, reactions and the absent-player takeover.
- **Spike first.** Before building on it, measure Blob read-after-write latency and consistency from the deployed function. If the 95th percentile is above about 1.5 s, or races show up, swap the store for Redis (Upstash through the Vercel Marketplace) behind the same `store.read` / `store.write` shape. The handler does not change.
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

Sayings (10): Good game! · Nice one! · Well played · Ouch! · Bad luck · Phew! · Your turn! · Take your time · Rematch? · Cheers!

Emoji (8): 👏 😂 😮 😬 😢 🔥 🎉 😎

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

1. Spike: Blob `ifMatch` latency and races from a deployed function (decides Blob or Redis).
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
