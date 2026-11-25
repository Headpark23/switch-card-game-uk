# Switch Card Game

**Switch: your game-night club.** A responsive web app (phone, tablet, and desktop) for the card game Switch, built around four equal experiences:

1. **Play** Switch against 1 to 5 computer opponents, or at a private online table with friends and family.
2. **Score** real game nights played with real cards.
3. **Club** leagues, seasons, trophies, and shared club history.
4. **Me** personal stats, game replays, badges, trophies, and the Switch Passport.

Learning the rules stays complete under Home → Learn the rules. Guided practice never counts towards your stats.

Live site: [switchcardgame.co.uk](https://switchcardgame.co.uk). Production deploys automatically from `main` on Vercel; see [docs/release/](docs/release/) for release and rollback checklists.

## Project Structure

- `src/` — Frontend React + TypeScript app
  - `src/screens/` — Full page screens (`HomeHub`, `PlayLobby`, `TableGame`, `OnlineTable`, `Scorekeeper`, `MePage`, `GuidedGame`, etc.)
  - `src/components/` — Reusable UI components (`ui.tsx`, `HistoryPanel`, `MeCharts`, `GameEnding`, `tableTalk`, `Confirm`, etc.)
  - `src/services/` — App-level services and static copy (`auth`, `content`, `feedback`, `offline`)
  - `src/switch/` — Domain logic grouped by area:
    - `engine/` — Core single-deck Switch rules, cards, table state, and hand sorting
    - `ai/` — Computer players, tactics, coaching, lessons, puzzles, and referee
    - `formats/` — Scoring formats (One v One, Dominoes, Darts, Group Play, Last One Out, Switch Cup, Seasons, Series)
    - `store/` — Local persistence, club state, profiles, history, and game replays
    - `sync/` — Shared club sync, live night sharing, join codes, and online room client
    - `stats/` — Analytics, badges, trophies, presentation timing, reactions, and telemetry
  - `src/mobile/` — Protected mobile preview runtime (checked by `mobile-runtime.lock.json`)
  - `src/kit/` — Reusable companion-app exports (see [docs/REUSE-GUIDE.md](docs/REUSE-GUIDE.md))
- `shared/` — Pure JS modules shared by both the phone app and online server (`clubMerge`, `voices`, `cardTalk`)
- `api/` — Vercel serverless API endpoints and online room/sync handlers (`api/_engine.js` is built from `src/switch/`)
- `worker/` — Cloudflare Sites static worker and sync adapter
- `tests/` — Automated tests split into `tests/unit/` (Node tests), `tests/e2e/` (Playwright specs), and `tests/offline/`
- `docs/` — Active documentation (`RULES-RULINGS.md`, `STORAGE-KEYS.md`, `release/`, `store/`), with historical reviews and plans kept in `docs/archive/`

## Navigation

Five permanent destinations (bottom bar on phones, navigation rail on tablets, sidebar on desktop): **Home | Play | Score | Club | Me**.

| Tab | What it holds |
|---|---|
| **Home** | Greeting, resume cards for an unfinished game or scorecard, four launch tiles, recent activity, shared club card, and links to Learn the rules, Puzzles, Questions, Plan a night, and Join a night |
| **Play** | Competitive games against 1 to 5 computers (Easy, Medium, or Hard) or online with friends and family; pace setting; resume; your record |
| **Score** | The scorecard for every format, Quick night, Ways to play, and saved nights |
| **Club** | Stats, Seasons, Trophies, and History for the whole club |
| **Me** | Your record, history, replays, record against the computer, badges, Passport, trophies, and Settings |

## Rules

The rules are fixed by the owner's rulings in [docs/RULES-RULINGS.md](docs/RULES-RULINGS.md) (single deck of 52 cards, up to 6 players at a table). The engine (`src/switch/engine/`) is verified against an independent simulator (`scripts/table-sim.mjs`).

## Run Locally & Validate

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run check:runtime   # Verify 28 protected mobile runtime files
npm run build           # Type-check, bundle api/_engine.js, build client & Sites worker
npm run test:sites      # Server, sync, club, night-share & room unit tests
npm run test:rules      # Independent Switch rules simulator
npm run test:runtime    # Full Playwright E2E suite
npm run test:offline    # Offline service-worker build test
```
