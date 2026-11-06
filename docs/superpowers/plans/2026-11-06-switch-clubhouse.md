# Switch Clubhouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable local player profiles, honest saved statistics and transparent season leagues derived from completed Switch Nights.

**Architecture:** Keep profile parsing, analytical derivation and season scoring in focused pure modules under `src/switch`. Store versioned collections inside the existing scorekeeper extensions. The prototype renders four clubhouse views and uses small inline SVG charts without adding a charting dependency.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Playwright 1.61, localStorage, inline SVG.

**Spec:** `docs/superpowers/specs/2026-11-06-switch-clubhouse-design.md`

## Global Constraints

- Preserve the `switchScoreKeeper` key, schema version 1 compatibility and all unrelated extension fields.
- No Google sign-in, cloud sync, sharing, notification or deployment work.
- Statistics and milestones must derive only from valid saved history.
- App UI changes stay in `src/Prototype.tsx` and `src/prototype.css`; protected runtime files remain unchanged.
- Profiles may be archived, not destructively removed from history.
- Charts require text equivalents and reduced-motion compatibility.

## Review Focus

- Legacy records with the same name must resolve only when exactly one profile matches; Task 1 covers ambiguous and case-normalised names.
- A malformed profile or season must not hide valid entries or erase unrelated extensions; Tasks 1 and 3 cover defensive parsing.
- A night cannot score twice in one season, including double taps; Task 3 covers idempotence.
- Deleting a history record already counted by a season must remove its derived contribution without corrupting the season; Task 3 covers missing-night recalculation.
- A profile with one win must not beat a regular player in “best win rate”; Task 2 covers the three-night minimum.

---

### Task 1: Stable local profiles

**Files:**
- Create: `src/switch/profiles.ts`
- Create: `tests/switch-profiles.spec.ts`

**Interfaces:**
- Produces `LocalProfile`, `getProfiles`, `ensureProfiles`, `renameProfile`, `archiveProfile`, `resolveHistoryPlayerId`, `putProfiles`.

- [ ] Write failing tests for normalised reuse, stable IDs, duplicate rejection, archival, invalid entries, extension preservation and unambiguous legacy resolution.
- [ ] Run the focused tests and verify failure because the module is missing.
- [ ] Implement the minimal immutable profile collection and defensive parser.
- [ ] Run the focused tests and verify they pass.
- [ ] Commit profiles and tests.

### Task 2: Honest statistics and rivalries

**Files:**
- Create: `src/switch/analytics.ts`
- Create: `tests/switch-analytics.spec.ts`

**Interfaces:**
- Consumes `LocalProfile`, `resolveHistoryPlayerId`, `SwitchNightRecord`.
- Produces `PlayerStats`, `ClubhouseSummary`, `Rivalry`, `derivePlayerStats`, `deriveClubhouseSummary`, `deriveRivalries`.

- [ ] Write hand-derived failing fixtures for appearances, wins, win rate, streaks, recent form, format wins, six-month values, milestones, best-win-rate minimum and rivalry records.
- [ ] Verify red for missing analytics exports.
- [ ] Implement deterministic derivation sorted by completion time.
- [ ] Verify focused tests pass.
- [ ] Commit analytics and tests.

### Task 3: Transparent season leagues

**Files:**
- Create: `src/switch/seasons.ts`
- Create: `tests/switch-seasons.spec.ts`

**Interfaces:**
- Produces `SwitchSeason`, `SeasonStanding`, `getSeasons`, `createSeason`, `addNightToSeason`, `completeSeason`, `seasonStandings`, `putSeasons`.

- [ ] Write failing tests for membership validation, 3/1 points, multi-winner records, deterministic ties, idempotent add, completed-season lock, malformed entries, extension preservation and missing history.
- [ ] Verify red for the missing season module.
- [ ] Implement pure immutable season operations and derived standings.
- [ ] Verify focused tests pass.
- [ ] Commit seasons and tests.

### Task 4: Clubhouse interface and profile-backed scoring

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Modify: `tests/switch-scorekeeper.spec.ts`
- Create: `tests/switch-clubhouse.spec.ts`

**Interfaces:**
- Consumes Tasks 1–3.
- Produces Score, Stats, Leagues and History views; profile reuse during score setup; accessible charts; season creation and explicit night counting.

- [ ] Add failing journeys for automatic profile creation/reuse, tab persistence, stats after reload, chart text, season creation, count-once behaviour, completion lock and existing history access.
- [ ] Verify the new journeys fail on the current interface.
- [ ] Implement the clubhouse switcher, profile tokens, stats view, inline SVG chart and season table without changing protected runtime files.
- [ ] Run clubhouse, scorekeeper and gameplay tests; verify green.
- [ ] Commit the interface and journeys.

### Task 5: Verification and roadmap

**Files:**
- Modify: `docs/roadmap/SWITCH-NIGHT-ROADMAP.md`
- Modify: `docs/verification/2026-11-06-switch-hardening-results.md`

- [ ] Run runtime integrity, TypeScript build, hosting tests and the complete browser suite.
- [ ] Verify Score, Stats, Leagues and History on iPhone and Pixel 10 in the correct Switch preview.
- [ ] Record exact evidence, remaining local depth and deferred Google work.
- [ ] Commit the verification documents.
