# Switch Night Local History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trustworthy, local-only completed-night history with format-specific results, export and confirmed deletion.

**Architecture:** Add a pure history module that validates completion, creates immutable snapshots and defensively reads the additive extension. Keep browser download/confirmation and rendering in the existing prototype UI. Reuse the exact storage key and merge extensions through the existing serializer.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Playwright 1.61, browser localStorage.

**Spec:** `docs/superpowers/specs/2026-11-06-switch-night-history-design.md`

## Global Constraints

- Preserve `switchScoreKeeper` and schema version 1.
- No account, cloud sync, sharing or deployment.
- No automatic history writes and no fictional activity.
- Keep all app-specific UI changes in `src/Prototype.tsx` and `src/prototype.css`.
- Run the protected-runtime check before preview and handoff.

## Review Focus

- A tied target score must not invent a winner; cover in Task 1.
- Invalid or future history records must not crash the screen or erase unrelated extensions; cover in Task 1.
- Repeated save taps must not create duplicate records; cover in Task 2.
- Delete must remove only the selected record after confirmation; cover in Task 2.
- Export must include complete snapshots without active mutable state references; cover in Task 2.

---

### Task 1: Pure completed-night records

**Files:**
- Create: `src/switch/history.ts`
- Create: `tests/switch-history.spec.ts`

**Interfaces:**
- Produces: `SwitchNightRecord`, `HistorySource`, `getHistory(extensions)`, `completionFromSession`, `completionFromKnockout`, `completionFromCup`, `completionFromLeagues`, `createNightRecord`, `addNight`, `deleteNight`, and `exportHistory`.

- [ ] Write failing tests for all six formats, target ties, immutable snapshots, invalid entries, add/delete and export.
- [ ] Run the focused test and verify it fails because the module is missing.
- [ ] Implement the smallest pure versioned history model that passes.
- [ ] Run the focused test and verify it passes.
- [ ] Commit the pure history module and tests.

### Task 2: Scorekeeper completion and history UI

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Modify: `tests/switch-scorekeeper.spec.ts`

**Interfaces:**
- Consumes the Task 1 pure history APIs.
- Produces an explicit completed-night save panel, local history list, JSON export and confirmed per-record deletion.

- [ ] Add failing browser journeys for empty history, save-once, reload, expanded details, export and confirmed deletion.
- [ ] Run the scorekeeper test and verify the new journeys fail.
- [ ] Implement the completion panel and history UI using keyboard-aware fields and existing storage merging.
- [ ] Run the scorekeeper and gameplay suites and verify they pass.
- [ ] Commit the UI and journeys.

### Task 3: Release verification

**Files:**
- Modify: `docs/verification/2026-11-06-switch-hardening-results.md`

- [ ] Run runtime integrity, build, hosting tests and the full browser suite.
- [ ] Verify the saved result on iPhone and Pixel 10 in the correct Switch preview.
- [ ] Record the final evidence and remaining Phase 2 work.
- [ ] Commit the verification update.
