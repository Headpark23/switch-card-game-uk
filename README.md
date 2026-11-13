# Switch Card Game

**Switch: your game-night club.** A mobile web app for the card game Switch, built around four equal experiences:

1. **Play** Switch against 1 to 4 computer opponents.
2. **Score** real game nights played with real cards.
3. **Club** leagues, competitions, trophies and shared history.
4. **Me** personal stats, badges, trophies and the Switch Passport.

Learning the rules stays complete, under Home → Learn rules. Guided practice there never counts towards your stats.

Live site: [switchcardgame.co.uk](https://switchcardgame.co.uk). Production deploys automatically from `main` on Vercel; see `docs/release/` for the release and rollback checklists.

## Navigation

Five permanent tabs: **Home | Play | Score | Club | Me**. The lit tab always matches the section on screen.

| Tab | What it holds |
|---|---|
| **Home** | Greeting, resume cards for an unfinished game or scorecard, four launch tiles, recent activity, and links to Learn rules, Puzzles, Questions, Plan a night and Join a night |
| **Play** | Competitive games against 1 to 4 computers at Relaxed, Standard or Sharp; pace setting; resume; your record |
| **Score** | The scorecard for every format, Quick night, Ways to play, and saved nights |
| **Club** | Stats, Seasons, Trophies and History for the whole club |
| **Me** | Your record, history, record against the computer, badges, Passport, trophies and Settings |

## Features

**Playing the computer**
- 1 to 4 opponents, three difficulty levels; jacks reverse play at bigger tables
- Every move is shown in order: the computer pauses, each card travels from the seat that played it and lands one at a time, then the power card's effect is announced (`src/switch/presentation.ts`)
- Red glow on the active seat with readable labels (YOUR MOVE, MAX IS CHOOSING)
- Pace: Quick, Natural or Relaxed; reduced-motion supported
- Unfinished games can be resumed; each finished game is logged exactly once

**Scoring real nights**
- One v One, Domino, Darts, Group Play (leagues with championship and plate playoffs), Knock Out and Switch Cup, with undo and in-app confirmations
- Quick night: names, tap each round's winner, finish
- Dealer tracker, venue and country, live sharing so friends can follow a night by code

**Club and achievements**
- Reusable local player profiles and honest stats derived only from saved nights: win rate, streaks, form, milestones, rivalries
- Seasons across nights, leaderboard with a crown, a nameable club, shareable pictures of a night, a league table or the leaderboard
- Badges, trophies and a Switch Passport of countries played in
- Full backup file you can restore on a new phone; optional Google sign-in for cloud backup when configured

**Learning (unranked)**
- Interactive five-step rules guide, power-card reference and searchable questions
- Guided practice game with optional hints and a coach that explains every move (`src/switch/coach.ts`, `CoachPanel` in `src/ui.tsx`); it ends with an invitation to play the computer for real
- Twelve rules puzzles whose answers come from the real rules engine

**Shell**
- Installable web app that works offline after one visit (`public/sw.js`, production builds only)
- Everything is stored on the device; see `docs/STORAGE-KEYS.md` for every storage key
- Responsive iPhone and Pixel 10 preview frames

## Rules

The rules are fixed by the owner's rulings in `docs/RULES-RULINGS.md`. The engine (`src/switch/rules.ts`, `src/switch/table.ts`) is checked against an independent simulator written from the rules text (`scripts/table-sim.mjs`).

## Run locally

```bash
npm install
```

```bash
npm run dev
```

## Validate

```bash
npm run check:runtime
```

```bash
npm run build
```

```bash
npm run test:sites
```

```bash
npm run test:rules
```

```bash
npm run test:runtime
```

```bash
npm run test:offline
```

Reuse the coach and lessons for other games: `src/kit` and `docs/REUSE-GUIDE.md`. App-store steps: `docs/store/PUBLISHING.md`.
