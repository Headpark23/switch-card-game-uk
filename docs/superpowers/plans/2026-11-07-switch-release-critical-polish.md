# Switch Release-Critical Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the six release-critical fixes from the deep-dive review while preserving existing data and the chosen Switch design.

**Architecture:** Add a validated versioned active-night snapshot to the existing scorekeeper extensions, then restore each format from that snapshot. Keep tutorial and public-surface refinements inside their existing modules and prove every behavior with browser tests.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, localStorage.

**Spec:** `docs/superpowers/specs/2026-11-07-switch-release-critical-polish-design.md`

## Global Constraints

- Preserve the protected mobile runtime and current visual direction.
- Do not deploy.
- Preserve existing saved players, history, seasons and unknown extension keys.
- Use test-first development and make incremental commits.

## Review Focus

- A malformed or old active snapshot must be ignored without erasing other saved data; covered in Task 1 storage tests.
- A completed night must not reappear after it is saved; covered in Task 1 scorekeeper test.
- Multi-card selection must announce both currently legal starters and matching selectable followers accurately; covered in Task 2 guided-game test.
- Users who explicitly enable full guidance must still receive automatic lesson cards; covered in Task 2 guided-game test.
- Removing promotional surfaces must not remove the install or rule-download actions; covered in Task 3 home-navigation test.

---

### Task 1: Restore active game-night sessions

**Files:**
- Create: `src/switch/activeNight.ts`
- Modify: `src/screens/Scorekeeper.tsx`
- Test: `tests/switch-active-night.spec.ts`

**Interfaces:**
- Produces: `getActiveNight(extensions)`, `putActiveNight(extensions, snapshot)` and `clearActiveNight(extensions)`.
- Consumes: existing `ScoreSession`, `KnockoutState`, `CupState` and league progress shapes.

- [ ] Write failing tests for defensive snapshot validation and refresh restoration of ordinary, knockout, cup and group sessions.
- [ ] Run the focused tests and confirm the missing restoration behavior fails.
- [ ] Implement the versioned snapshot helpers and restore React state from them.
- [ ] Persist after every state-changing action; clear on reset and successful history save.
- [ ] Run the focused tests and the full browser suite.
- [ ] Commit the task.

### Task 2: Calm and clarify the guided game

**Files:**
- Modify: `src/screens/GuidedGame.tsx`
- Modify: `src/switch/coach.ts`
- Modify: `src/ui.tsx`
- Test: `tests/switch-coach.spec.ts`

**Interfaces:**
- Consumes: existing card-name helpers and guidance preference storage.
- Produces: full spoken card labels, truthful matching-card states and opening-only automatic guidance by default.

- [ ] Change tests first to require opening-only default guidance, explicit full-guidance opt-in, correct articles and full card names.
- [ ] Run the focused tests and confirm the old behavior fails.
- [ ] Implement the smallest guidance, grammar and accessibility changes.
- [ ] Run focused and full browser tests.
- [ ] Commit the task.

### Task 3: Clarify leagues and remove prototype promotions

**Files:**
- Modify: `src/screens/Scorekeeper.tsx`
- Modify: `src/screens/ClubhouseLeagues.tsx`
- Modify: `src/screens/NightHistory.tsx`
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Test: `tests/switch-gold.spec.ts`
- Test: `tests/switch-scorekeeper.spec.ts`

**Interfaces:**
- Produces: “Tournament Groups” for the one-night playoff format and “Season Leagues” for the ongoing table.

- [ ] Write failing browser assertions for the new names, accurate local-backup copy and absence of demo advertising/membership controls.
- [ ] Run the focused tests and confirm the old experience fails.
- [ ] Update the copy and remove only the prototype monetisation surfaces.
- [ ] Run focused tests, the protected runtime check, production build, offline test, rules simulations and full browser suite.
- [ ] Commit the task.

### Task 4: Review and push

**Files:**
- Review all changes since the plan base.

- [ ] Perform a fresh whole-branch self-review because this session is not authorised to delegate work.
- [ ] Fix any important finding test-first and rerun verification.
- [ ] Confirm the worktree contains only intended commits.
- [ ] Push `codex/switch-solo-hardening` to its existing upstream without force and do not deploy.
