# Switch Scorekeeper and Competitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and strengthen the six-format Switch scorekeeper while preserving every valid value already stored by the live app.

**Architecture:** Keep persistence, validation and competition calculations in pure `src/switch` modules. The UI consumes stable commands and snapshots rather than owning tournament math. Load the legacy `switchScoreKeeper` shape additively and write only after successful validation.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Playwright 1.61, browser `localStorage`.

**Spec:** `docs/superpowers/specs/2026-11-06-switch-solo-hardening-design.md`

## Global Constraints

- Preserve the exact local-storage key `switchScoreKeeper`.
- Preserve valid names, scores, targets, selected format and unknown future fields.
- Never replace unreadable storage with defaults automatically.
- Support only Switch formats in this app.
- Do not present sample people, matches or leagues as user activity.
- No cloud sync, accounts or production deployment in this plan.

## Review Focus

- Malformed JSON remains untouched while the app opens a safe empty session and reports that saved data could not be read; cover in Task 1.
- Duplicate display names remain separate players through stable IDs; cover in Task 2.
- Decimal, negative, blank, very large and pasted domino values receive explicit validation without corrupting totals; cover in Task 3.
- Odd Cup entrants receive exactly one bye per odd round and no player appears twice; cover in Task 6.
- Four leagues with fewer than four completed entrants do not create misleading playoffs; cover in Task 4.

---

### Task 1: Add versioned, non-destructive storage compatibility

**Files:**
- Create: `src/switch/storage.ts`
- Create: `tests/switch-storage.spec.ts`
- Create: `tests/fixtures/switch-scorekeeper-live-v4.json`

**Interfaces:**
- Produces: `SCOREKEEPER_STORAGE_KEY = "switchScoreKeeper"`; `loadScorekeeper(raw: string | null): LoadResult`; `saveScorekeeper(currentRaw: string | null, state: ScorekeeperState): string`; `migrateScorekeeper(input: unknown): ScorekeeperState`.
- `LoadResult` is `{ status: "empty"|"loaded"|"unreadable"; state: ScorekeeperState; originalRaw: string|null }`.

- [ ] **Step 1: Capture an anonymised legacy fixture**

Derive field names and value types from the public live bundle, replace names/scores with neutral values, and store no private user data.

- [ ] **Step 2: Write failing compatibility tests**

Assert empty load, valid legacy load, partial-record defaults, malformed JSON returning `unreadable` without a replacement write, and preservation of unknown top-level fields during save.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-storage.spec.ts`

Expected: FAIL because storage functions are missing.

- [ ] **Step 4: Implement additive migration and serialisation**

Use `schemaVersion: 1`; validate arrays and finite numbers; preserve unknown fields under `extensions` and preserve the original raw string until the first explicit user edit.

- [ ] **Step 5: Verify green**

Run the Task 1 command; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/switch/storage.ts tests/switch-storage.spec.ts tests/fixtures/switch-scorekeeper-live-v4.json && git commit -m "feat: preserve legacy Switch score data"`

### Task 2: Define reusable players and undoable score sessions

**Files:**
- Modify: `src/switch/types.ts`
- Create: `src/switch/scoring.ts`
- Create: `tests/switch-scoring.spec.ts`

**Interfaces:**
- Produces: `Player { id: string; name: string }`; `ScoreSession`; `ScoreCommand`; `createSession(format, players, options): ScoreSession`; `applyScoreCommand(session, command): ScoreSession`; `undoScoreCommand(session): ScoreSession`.

- [ ] **Step 1: Write failing player/session tests**

Cover trimmed-but-not-normalised display names, punctuation, duplicate names with distinct IDs, two-to-ten player limits by format, score command history and undo restoring the exact prior snapshot.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-scoring.spec.ts -g "player|undo"`

Expected: FAIL because scoring exports are missing.

- [ ] **Step 3: Implement immutable commands and snapshots**

Reject empty names; generate IDs independently from names; keep at most 100 undo snapshots for the active session.

- [ ] **Step 4: Verify green**

Run the Task 2 command; expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/switch/types.ts src/switch/scoring.ts tests/switch-scoring.spec.ts && git commit -m "feat: add named score sessions and undo"`

### Task 3: Implement head-to-head, domino and darts scoring

**Files:**
- Modify: `src/switch/scoring.ts`
- Modify: `tests/switch-scoring.spec.ts`

**Interfaces:**
- Adds `HeadToHeadState`, `DominoState`, `DartsState` and format-specific `ScoreCommand` variants while retaining `applyScoreCommand`.

- [ ] **Step 1: Write failing format tests**

Assert flexible positive integer targets, arbitrary non-negative integer domino round values, quick adds as optional shortcuts only, blank/negative/decimal/unsafe-integer rejection, darts legs/sets and win-by-two behavior.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-scoring.spec.ts -g "head-to-head|domino|darts"`

Expected: FAIL for missing commands and validation.

- [ ] **Step 3: Implement minimal calculations and validation messages**

Use integer arithmetic only. Return typed validation errors rather than silently clamping user input.

- [ ] **Step 4: Verify green**

Run the Task 3 command; expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/switch/scoring.ts tests/switch-scoring.spec.ts && git commit -m "feat: implement flexible table scoring"`

### Task 4: Implement one-to-four leagues and cross-league playoffs

**Files:**
- Create: `src/switch/leagues.ts`
- Create: `tests/switch-leagues.spec.ts`

**Interfaces:**
- Produces: `League`, `LeagueStanding`, `PlayoffBracket`; `rankLeague(results): LeagueStanding[]`; `createCrossLeaguePlayoffs(leagues, random): { championship: PlayoffBracket; plate: PlayoffBracket }`.

- [ ] **Step 1: Write failing standings/playoff tests**

Cover one through four configured leagues, stable tie ordering, top two into championship, bottom two into plate, four-player semifinal/final structure for two leagues, larger seeded knockout for three/four leagues, and avoiding same-league opening fixtures when alternatives exist.

- [ ] **Step 2: Write insufficient-data tests**

Assert playoffs return a typed `not-ready` result when fewer than two leagues are included or any included league lacks four ranked entrants.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-leagues.spec.ts`

Expected: FAIL because league functions are missing.

- [ ] **Step 4: Implement deterministic seeding**

Use injected randomness only among equivalent valid seeds; never duplicate a player in championship or plate.

- [ ] **Step 5: Verify green**

Run the Task 4 command; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/switch/leagues.ts tests/switch-leagues.spec.ts && git commit -m "feat: add cross-league Switch playoffs"`

### Task 5: Implement LOST knockout for three to six players

**Files:**
- Create: `src/switch/knockout.ts`
- Create: `tests/switch-knockout.spec.ts`

**Interfaces:**
- Produces: `KnockoutState`; `createKnockout(players): KnockoutState`; `markLost(state, playerId): KnockoutState`; `undoKnockout(state): KnockoutState`.

- [ ] **Step 1: Write failing elimination tests**

For three through six players, assert `LOST` eliminates exactly one active player, eliminated players cannot lose twice, state remains open above one active player, and the final active player is champion.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-knockout.spec.ts`

Expected: FAIL because knockout functions are missing.

- [ ] **Step 3: Implement immutable elimination and undo**

Preserve the full entrant list for history; derive active entrants rather than deleting player records.

- [ ] **Step 4: Verify green**

Run the Task 5 command; expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/switch/knockout.ts tests/switch-knockout.spec.ts && git commit -m "feat: add LOST knockout mode"`

### Task 6: Implement Switch Cup draws, byes and winner advancement

**Files:**
- Create: `src/switch/cup.ts`
- Create: `tests/switch-cup.spec.ts`

**Interfaces:**
- Produces: `CupState`, `CupRound`, `CupFixture`; `createCup(players, random): CupState`; `selectCupWinner(state, fixtureId, playerId): CupState`; `drawNextCupRound(state, random): CupState`.

- [ ] **Step 1: Write failing draw tests**

Cover every entrant count from two through ten; assert unique fixtures, exactly one bye when odd, zero byes when even, deterministic output with a fixed random source and no next-round draw before all fixtures have winners.

- [ ] **Step 2: Write failing advancement tests**

Assert only fixture entrants can be selected, winners plus the bye advance exactly once, fresh round pairings are generated, and one remaining entrant becomes champion.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-cup.spec.ts`

Expected: FAIL because Cup functions are missing.

- [ ] **Step 4: Implement Fisher-Yates draw with injected randomness**

Store every completed round; never redraw a round whose fixtures have already been shown.

- [ ] **Step 5: Verify green**

Run the Task 6 command; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/switch/cup.ts tests/switch-cup.spec.ts && git commit -m "feat: add verified Switch Cup draws"`

### Task 7: Build the Switch-only scorekeeper UI

**Files:**
- Create: `src/components/SwitchScorekeeper.tsx`
- Create: `src/components/CompetitionBracket.tsx`
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Create: `tests/switch-scorekeeper.spec.ts`

**Interfaces:**
- Consumes: storage and scoring modules from Tasks 1–6.
- Produces: accessible UI for all six formats without exposing seeded multi-game content.

- [ ] **Step 1: Write failing named-player and persistence journeys**

Cover entering names, reload preservation, legacy fixture loading, explicit unreadable-data warning, duplicate display names, undo and reset confirmation that retains names.

- [ ] **Step 2: Write failing mode journeys**

Cover arbitrary domino entry, league championship/plate generation, six-player LOST flow and ten-player Cup with a bye and final champion.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-scorekeeper.spec.ts`

Expected: FAIL because the UI does not exist on the focused baseline.

- [ ] **Step 4: Implement the scorekeeper screens**

Use labelled inputs, native buttons, clear current-format status and confirmation for session reset. Save only after explicit edits and successful validation.

- [ ] **Step 5: Verify green and regression**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-scorekeeper.spec.ts tests/switch-game.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/components/SwitchScorekeeper.tsx src/components/CompetitionBracket.tsx src/Prototype.tsx src/prototype.css tests/switch-scorekeeper.spec.ts && git commit -m "feat: restore robust Switch scorekeeper"`
