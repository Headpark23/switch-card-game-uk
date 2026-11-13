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
| `switchAccount` | Google sign-in session for cloud backup |

## Added in Switch 2.0

| Key | Purpose | Notes |
|---|---|---|
| `switchTableGame` | The competitive game in progress, so it can be resumed | Removed once the game is logged. Its `id` is the id the result is logged under, so a game can only ever be counted once. |
| `switchTableSpeed` | Computer pace: `quick`, `natural` or `relaxed` | Defaults to `natural`. |

## Practice is unranked

From Switch 2.0, guided practice (Learn the Rules) writes nothing to `switchComputerGames`. Games logged by guided practice **before** this change cannot be told apart from competitive ones (the record has no flag) and have been left exactly as they were.
