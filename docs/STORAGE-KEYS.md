# Storage keys (inventory, 13 Nov 2026)

Everything lives in the browser's `localStorage` on the phone. The Switch 2.0 redesign **added two new keys and changed no existing key, schema or identifier**. No migration was run.

## Club data: one key, many records

`switchScoreKeeper` holds `{ schemaVersion: 1, selectedFormat, players, scores, target, extensions }`. Unknown fields are kept on save (`src/switch/storage.ts`). The club's records sit inside `extensions`:

| Extension key | What it holds | Module |
|---|---|---|
| `switchProfiles` | Saved players (id, name, colour, archived) | `profiles.ts` |
| `switchMe` | Which profile is the person holding the phone | `computerLog.ts` |
| `switchNightHistory` | Every saved game night | `history.ts` |
| `switchComputerGames` | Finished competitive games v the computer (id, level, opponents, won, place, moves) | `computerLog.ts` |
| `switchSeasons` | Long-running seasons across nights | `seasons.ts` |
| `switchActiveNight` | The scorecard in progress (score, knockout, cup, league) | `activeNight.ts` |
| `switchDealers` | Who deals next at the real table | `dealer.ts` |
| `switchClub` | Club name | `club.ts` |
| `switchLastPlace` | Last venue used | `places.ts` |

Badges, passport stamps, trophies and stats are **derived** from these records on screen; they are not stored separately.

## Settings and per-device keys

| Key | Purpose |
|---|---|
| `switchWelcome` | First-visit flag |
| `switchTable` | Last opponents and level chosen in Play |
| `switchComputerLevel` | Computer level (shared with guided practice) |
| `switchGuidance` | Guided-game automatic coaching on/off |
| `switchFeedback` | Sounds and vibration on/off |
| `switchPuzzles` | Puzzle progress |
| `switchInstallDismissed` | Install banner dismissed at |
| `switchSharedNight` | Live-share code and token for a hosted night |
| `switchShareOutbox` | Saved nights waiting to reach the shared code, so a dropped signal never loses a result | Emptied as each result is sent. |
| `switchJoinedNights` | Shared codes this phone has joined, and which player its owner is | Results saved under those codes are added to this phone's history. Kept for three weeks. |
| `switchShareInvites` | Who the host sent a live game to, and when, so the host can always see what has gone out | Shown beside "Joined" once that friend opens the link. Overwritten by sending again. |
| `switchAccount` | Google sign-in session for cloud backup |

## Added in Switch 2.0

| Key | Purpose | Notes |
|---|---|---|
| `switchTableGame` | The competitive game in progress, so it can be resumed | Removed once the game is logged. Its `id` is the id the result is logged under, so a game can only ever be counted once. |
| `switchTableSpeed` | Computer pace: `quick`, `natural` or `relaxed` | Defaults to `natural`. |

## Practice is unranked

From Switch 2.0, guided practice (Learn the Rules) writes nothing to `switchComputerGames`. Games logged by guided practice **before** this change cannot be told apart from competitive ones (the record has no flag) and have been left exactly as they were.

## Shared clubs (13 Nov 2026)

| Key | Purpose | Notes |
|---|---|---|
| `switchClubLink` | The shared club this phone belongs to: `{ code, joinedAt, lastSyncAt }` | Absent when the phone is not in a shared club. Leaving removes only this key; every player and night stays on the phone. |
| `switchNightAliases` | Other names this phone's owner has picked on a host's scoreboard (e.g. "Becky" for Rebecca), newest first, up to 8 | Lets later nights and clubs recognise them without asking "Which one are you?". Picking a name on a night also sets the owner's saved player straight away if the phone did not know them yet. |
| `switchRemovedNights` (inside the club document) | Ids of nights deleted on this phone | Sent to the shared club so a deleted night does not come back from another phone. |

Profiles gain an optional `updatedAt`, and `switchClub` an `updatedAt`, so two phones can tell which rename or archive is newer. Older records without them still load.


## Anonymous usage counts (14 Nov 2026)

Five new keys, added by `src/switch/telemetry.ts` and `src/switch/useTableTelemetry.ts`. None holds an identifier, and none changes an existing key. They are all removed by "Delete data on this device" (they start with `switch`).

| Key | Purpose | Notes |
|---|---|---|
| `switchStatsSeen` | The UTC day this phone was first counted | Only "has been counted", never an id. Decides whether an open is a new device. |
| `switchStatsDay` | The UTC day this phone was last counted as active | Lets the server count one active device per day. |
| `switchStatsOptOut` | `1` when the person has turned counting off (Me > Privacy) | Nothing is sent while set, and the outbox is emptied. |
| `switchStatsOutbox` | Counts waiting to be sent (up to 100) | Sent when online, then removed. |
| `switchStatsTable` | The running penalty-card tally of the game in progress | Removed once the game is over. Separate from `switchTableGame`, which is untouched. |

`switchStatsTest` is only ever set by tests, to let an automated browser send counts.

## Rivals (14 Nov 2026)

No new key. Each record in `switchComputerGames` gains an optional `rivals` list (`[{ name, place }]`): how each computer at the table finished. Me > Computer ranks John, Paul and the rest by how often they finished ahead of you. Games saved before this carry no `rivals` and are simply left out of that ranking.

## Online play with friends (14 Nov 2026)

| Key | What it holds | Notes |
| --- | --- | --- |
| `switchOnlineTable` | Your seat at a private table: `{ code, token, name, savedAt }` | The token is the only thing that proves the seat is yours. Kept 26 hours (tables last 24), so closing the app and coming back drops you straight back in. Cleared by "Leave the table". |
| `switchOnlineName` | The name you last used at a table | A convenience so the name field is already filled in. |

Finished online games are saved in `switchComputerGames` like every other game: each record gains an optional `online` (`{ code, humans, autoMoves }`) and its `rivals` may carry `human: true`. Games saved before this carry neither and are unaffected.

## Table talk and replays (14 Nov 2026)

New per-device keys, outside the club document and never synced or shared:

| Key | Purpose | Notes |
|---|---|---|
| `switchGameReplays` | Your last 30 finished games, move by move, as the table saw them (cards played, how many everyone held) plus every reaction sent, for Me > History > Watch the replay | Filed under the same id as the game's record in `switchComputerGames`. Replays now also hold every hand (see the end of this file). |
| `switchReplayDraft` | The game in progress, recorded as it goes | Replaced by the next game; moved into `switchGameReplays` when the game ends. |
| `switchReactionLog` | Every reaction sent or received: game id, time, move number, who, which reaction, whether it was you, a computer, online | Newest 3,000. Me > Table talk is worked out from it. |
| `switchSpicyTalk` | `"1"` when spicy talk (swearing) is on for this phone, otherwise `"0"` or absent | Off by default (15 Nov 2026). Never synced or shared; each phone decides what it shows. |

## One player per account (15 Nov 2026)

`switchAccountMe` sits inside the club document (`extensions`) and is synced with Google sign-in. It names the saved player who is "me" for the whole account. Each phone or browser makes its own "You" player, so before this a signed-in person's games were split across devices (15 on the website, 54 on the phone) even though sync had copied every game to both. On sync, a device folds its own "me" into the account's (`unifyIdentity` in `src/switch/sync.ts`); a real name beats the automatic "You". No existing key changed.
- `switchSampleDismissed` ("1" once the sample club was removed; the offer never returns). Added 16 Nov 2026.

## Hands in replays and game lengths (21 Nov 2026)

| Key / field | What it holds | Notes |
| --- | --- | --- |
| `switchRecordReplays` | Up to four replays: the games that hold your longest or shortest game by moves or by time | Kept beyond the newest 30 of `switchGameReplays` so a record can always be watched. Only replays that carry hands are kept here. |
| `seconds` on each record in `switchComputerGames` | How long the game took to play, in seconds | Optional. Pauses over two minutes (the app closed mid-game) are cut short. Games saved before this have none; Me works it out from a replay still on the phone. |
| `start.hands`, `drew`, `moves`, `seconds` in a replay | Every seat's cards at the deal, the cards each move picked up, and the finished game's move count and playing time | Replays now show every hand face up (replaces "public information only" above). Against the computer the phone records them; at an online table the server sends them only after the game ends. Older replays have none and show card counts only. |
