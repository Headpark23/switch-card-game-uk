# Switch Experience and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hardened Switch app readable, responsive, accessible and visibly polished, then produce evidence for a later controlled release without deploying it.

**Architecture:** Keep visual changes in app-owned Switch components and `prototype.css`; preserve the protected runtime. Motion is a presentation layer driven by the already-committed state transition, never a gameplay dependency. Verification combines automated journeys, screenshot review and a release-readiness report.

**Tech Stack:** React 19, TypeScript 7, existing Motion dependency, CSS media queries, Playwright screenshot/journey tests.

**Spec:** `docs/superpowers/specs/2026-11-06-switch-solo-hardening-design.md`

## Global Constraints

- Preserve the focused Switch brand and real card assets.
- Do not alter the protected mobile runtime.
- Motion must respect `prefers-reduced-motion` and cannot gate state changes.
- Minimum interactive target is 44 by 44 CSS pixels.
- Do not claim WCAG compliance from screenshots alone.
- No push or deployment in this plan.

## Review Focus

- A 320 CSS-pixel viewport and 200% zoom keep every primary action reachable without horizontal page scrolling; cover in Task 3.
- Long player names and translated-style text do not overlap score controls or brackets; cover in Task 3.
- Screen-reader announcements do not repeat on every render and clearly identify turn, penalty and winner changes; cover in Task 2.
- Rapid card actions cannot queue duplicate state changes while an animation is visible; cover in Task 1.
- Reduced-motion users see the same destination state immediately with no hidden card or stale live message; cover in Task 1.

---

### Task 1: Improve card readability and source-to-destination movement

**Files:**
- Create: `src/components/PlayingCard.tsx`
- Create: `src/components/CardMoveLayer.tsx`
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Modify: `tests/switch-game.spec.ts`

**Interfaces:**
- `PlayingCardProps { card: Card; hidden?: boolean; size: "hand"|"table"|"reference" }` exposes a descriptive accessible label.
- `CardMoveLayerProps { move: VisualMove|null; onSettled(): void }`; `VisualMove` identifies source/destination/card but does not mutate game state.

- [ ] **Step 1: Write failing accessibility and motion-state tests**

Assert card labels use full rank/suit names, moved cards leave the hand exactly once, rapid double activation cannot play twice, and reduced motion updates the visible zones without an animated overlay.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-game.spec.ts -g "card label|card movement|reduced motion"`

Expected: FAIL because shared card/move components are missing.

- [ ] **Step 3: Implement real-asset card rendering and movement**

Use existing PNG assets. Commit the game transition first, render a short transform between measured zones, and mark the transient image `aria-hidden="true"`.

- [ ] **Step 4: Add reduced-motion CSS**

Under `@media (prefers-reduced-motion: reduce)`, remove transforms/fades and settle the overlay immediately.

- [ ] **Step 5: Verify green**

Run the Task 1 command; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/components/PlayingCard.tsx src/components/CardMoveLayer.tsx src/Prototype.tsx src/prototype.css tests/switch-game.spec.ts && git commit -m "feat: clarify and animate Switch cards"`

### Task 2: Complete keyboard, dialog and status accessibility

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `src/components/SwitchScorekeeper.tsx`
- Modify: `src/components/CompetitionBracket.tsx`
- Modify: `src/prototype.css`
- Create: `tests/switch-accessibility.spec.ts`

**Interfaces:**
- Consumes existing components; no new gameplay API.
- Produces one polite turn/status live region, one assertive validation/winner region, labelled dialogs with focus return, and keyboard-operable score/game controls.

- [ ] **Step 1: Write failing keyboard journey tests**

Tab from navigation through a complete legal card play, open/close suit choice with Escape and focus return, enter a domino score, mark a knockout loss, and advance a Cup winner without pointer input.

- [ ] **Step 2: Write failing semantic/status tests**

Assert dialog names/descriptions, field error association, current navigation state, full card labels, and exactly one live announcement for turn, penalty and champion changes.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-accessibility.spec.ts`

Expected: FAIL on missing focus/status guarantees.

- [ ] **Step 4: Implement semantics and focus behavior**

Use native controls and the existing dialog primitives. Do not create keyboard-only alternate behavior.

- [ ] **Step 5: Verify green**

Run the Task 2 command; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/Prototype.tsx src/components/SwitchScorekeeper.tsx src/components/CompetitionBracket.tsx src/prototype.css tests/switch-accessibility.spec.ts && git commit -m "fix: make Switch journeys keyboard accessible"`

### Task 3: Verify mobile, tablet, desktop and zoom reflow

**Files:**
- Modify: `src/prototype.css`
- Create: `tests/switch-responsive.spec.ts`
- Create: `artifacts/audit/` screenshots generated by tests (do not commit browser caches)

**Interfaces:**
- Produces validated layouts at 320×568, 390×844, 768×1024 and 1440×900 plus a 200%-zoom equivalent narrow layout.

- [ ] **Step 1: Write failing overflow and target-size tests**

For rules, guided game, scorekeeper, leagues, knockout and Cup, assert `scrollWidth <= clientWidth`, primary controls are visible, and interactive rectangles are at least 44×44 except inline text links with adequate surrounding spacing.

- [ ] **Step 2: Add long-name fixtures**

Use a 40-character player name and duplicate names; assert score controls and bracket labels remain readable at every viewport.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-responsive.spec.ts`

Expected: FAIL on at least the smallest/long-name layouts before CSS hardening.

- [ ] **Step 4: Add app-owned responsive rules only**

Adjust grid columns, wrapping, sticky controls and bracket overflow in `prototype.css`; do not edit runtime/device chrome.

- [ ] **Step 5: Capture and inspect screenshots**

Save ordered screenshots for the six core journeys at phone and desktop sizes. Reject blank, loading, cropped or wrong-state captures.

- [ ] **Step 6: Verify green**

Run the Task 3 command; expected: PASS with accepted screenshots and no horizontal page overflow.

- [ ] **Step 7: Commit**

Run: `git add src/prototype.css tests/switch-responsive.spec.ts artifacts/audit && git commit -m "fix: harden Switch responsive layouts"`

### Task 4: Run the complete clean verification story

**Files:**
- Modify only if a failing test identifies a root cause; use a new failing regression test before each fix.
- Create: `docs/verification/2026-11-06-switch-hardening-results.md`

**Interfaces:**
- Produces: fresh, reproducible evidence for runtime integrity, type-check/build, packaging and every browser journey.

- [ ] **Step 1: Reinstall from the lockfile in a clean generated directory state**

Run: `npm ci`

Expected: exit 0; document any host-specific npm shim issue separately from application results.

- [ ] **Step 2: Verify protected runtime and build**

Run: `npm run check:runtime && npm run build`

Expected: runtime integrity passes; TypeScript and Vite exit 0; required Sites files exist.

- [ ] **Step 3: Verify packaging and all browser tests**

Run: `npm run test:sites && npm run test:runtime`

Expected: zero failures, zero skipped requirements, no browser console errors.

- [ ] **Step 4: Review the approved design line by line**

Record each requirement as `verified`, `deferred by design`, or `not verified`, with its test/evidence path. Explicitly record the Switch Night cloud/history roadmap as deferred.

- [ ] **Step 5: Commit verification evidence**

Run: `git add docs/verification/2026-11-06-switch-hardening-results.md && git commit -m "docs: record Switch hardening verification"`

### Task 5: Prepare a no-deploy release handoff

**Files:**
- Create: `docs/release/SWITCH-RELEASE-CHECKLIST.md`
- Create: `docs/release/SWITCH-ROLLBACK.md`

**Interfaces:**
- Produces: a future release gate; performs no release.

- [ ] **Step 1: Document source/host reconciliation requirements**

Require identification of the host project behind `switchcardgame.co.uk`, the exact source commit, a production asset/version fingerprint and proof that the live `switchScoreKeeper` fixture loads locally.

- [ ] **Step 2: Document backup and rollback**

Require a tagged source baseline, previous deployment ID, tested rollback route, quiet release window and post-release checks for rules, guided game and every score format.

- [ ] **Step 3: Document release stop conditions**

Stop for storage loss/migration warnings, missing scores/names, different domain content, console errors, failed mobile journey or any unapproved multi-game content.

- [ ] **Step 4: Commit**

Run: `git add docs/release && git commit -m "docs: add Switch release and rollback gates"`
