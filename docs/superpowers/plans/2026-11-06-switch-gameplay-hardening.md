# Switch Gameplay Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a focused Switch-only development line with deterministic, tested rules and a trustworthy computer opponent.

**Architecture:** Start from the last focused Switch commit (`8ba02f9`) without rewriting `main`. Move game state transitions and AI choice into pure modules; keep `Prototype.tsx` responsible only for presentation, effects and orchestration. Exercise pure modules through Vite-backed Playwright imports so no new test framework is required.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Playwright 1.61, existing mobile runtime and card assets.

**Spec:** `docs/superpowers/specs/2026-11-06-switch-solo-hardening-design.md`

## Global Constraints

- Switch remains a focused standalone app; do not ship Card Companion code or seeded multi-game data.
- Do not edit protected runtime files named in `AGENTS.md`.
- Keep the approved cream, forest-green and gold visual system.
- Keep the exact copy “When the deck runs out”.
- No production deployment, hosting mutation or data mutation.
- Every behavior change follows red-green-refactor and lands as an independently reversible commit.

## Review Focus

- A draw request larger than the available recyclable cards returns every available card without duplicating or hanging; cover in Task 3.
- Duplicate display labels never identify cards internally; card IDs remain unique and deterministic; cover in Task 2.
- A red king played against exactly one black king clears five, while one played against two leaves five; cover in Task 4.
- AI with multiple equally legal moves always chooses a legal move and never finishes illegally on a seven or two-player jack; cover in Task 5.
- Reloading or leaving a timed computer turn cannot apply a stale move to a replacement game; cover in Task 6.

---

### Task 1: Establish the focused source and verification baseline

**Files:**
- Preserve: current `main` branch and all production services
- Create branch: `codex/switch-solo-hardening` from `8ba02f9`
- Create: `docs/SAFETY-RULES.md`
- Modify: `README.md`
- Test: existing `tests/mobile-runtime.spec.ts`, `tests/sites-worker.test.mjs`, `tests/switch-game.spec.ts`

**Interfaces:**
- Consumes: commit `8ba02f9` and the approved design document.
- Produces: a Switch-only branch and exact local verification commands used by every later task.

- [ ] **Step 1: Create the isolated development line**

Run: `git switch -c codex/switch-solo-hardening 8ba02f9`

Expected: `git branch --show-current` prints `codex/switch-solo-hardening`; `origin/main` remains unchanged.

- [ ] **Step 2: Record safety rules**

Create `docs/SAFETY-RULES.md` with the non-negotiables: preserve `switchScoreKeeper`, never deploy implicitly, never seed fake activity as real, keep one behavior per commit, and require a rollback checklist for release.

- [ ] **Step 3: Run the clean baseline in dependency order**

Run: `npm run check:runtime && npm run build && npm run test:sites && npm run test:runtime`

Expected: runtime integrity passes, build emits `dist/client/index.html`, Sites tests report 4 passing, and Playwright reports the existing 16 tests passing. If the local npm shim remains unavailable, invoke the same locked package CLIs directly and document that environment issue without changing application code.

- [ ] **Step 4: Update the README with source truth**

Document the focused branch purpose, public production URL, the fact that deployment is not automatic from this work, and the four verification commands.

- [ ] **Step 5: Commit**

Run: `git add docs/SAFETY-RULES.md README.md docs/superpowers && git commit -m "docs: establish Switch hardening baseline"`

### Task 2: Define stable card and game types

**Files:**
- Create: `src/switch/types.ts`
- Create: `src/switch/cards.ts`
- Create: `tests/switch-rules.spec.ts`

**Interfaces:**
- Produces: `Suit`, `Rank`, `Card`, `CardId`, `Turn`, `PendingPenalty`, `GameState`, `GameAction`; `createDeck(): Card[]`; `cardLabel(card: Card): string`; `rankOf(id: CardId): Rank`; `suitOf(id: CardId): Suit`.

- [ ] **Step 1: Write failing deck and label tests**

Add Playwright tests that dynamically import `/src/switch/cards.ts`, assert 52 unique IDs, assert `KS` labels as `King of spades`, and assert red/black suit metadata is independent from display color.

- [ ] **Step 2: Verify the tests fail for the missing module**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-rules.spec.ts -g "deck|label"`

Expected: FAIL because `/src/switch/cards.ts` does not exist.

- [ ] **Step 3: Implement card types and helpers**

Use canonical IDs `AS` through `KC`; never use a display label as identity. Keep the full deck immutable and return a new array from `createDeck()`.

- [ ] **Step 4: Verify green**

Run the Task 2 command; expected: all Task 2 tests PASS.

- [ ] **Step 5: Commit**

Run: `git add src/switch/types.ts src/switch/cards.ts tests/switch-rules.spec.ts && git commit -m "refactor: define Switch card model"`

### Task 3: Extract deterministic deck and normal-turn rules

**Files:**
- Create: `src/switch/rules.ts`
- Modify: `tests/switch-rules.spec.ts`

**Interfaces:**
- Consumes: Task 2 card types/helpers.
- Produces: `createInitialGame(random: RandomSource): GameState`; `legalMoves(state: GameState): GameAction[]`; `applyAction(state: GameState, action: GameAction): GameState`; `drawCards(state: GameState, count: number, recipient: Turn): GameState`.

- [ ] **Step 1: Write failing normal-turn tests**

Cover suit/rank matching, ordinary wild ace plus suit selection, voluntary one-card pickup, matching-rank multi-play whose first card matches, draw-pile turnover that keeps the top discard and does not shuffle, and exhaustion with fewer cards than requested.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-rules.spec.ts -g "normal turn|draw pile"`

Expected: FAIL because the rules exports are missing.

- [ ] **Step 3: Implement the pure transitions**

Represent randomness as `type RandomSource = () => number`; clone arrays/state before changes; keep one physical card ID in exactly one zone.

- [ ] **Step 4: Verify green and uniqueness invariant**

Run the Task 3 command; expected: PASS and every tested state contains no duplicate card ID.

- [ ] **Step 5: Commit**

Run: `git add src/switch/rules.ts tests/switch-rules.spec.ts && git commit -m "refactor: extract deterministic Switch rules"`

### Task 4: Implement and prove every power-card chain

**Files:**
- Modify: `src/switch/types.ts`
- Modify: `src/switch/rules.ts`
- Modify: `tests/switch-rules.spec.ts`

**Interfaces:**
- Extends `PendingPenalty` to explicit units: `{ kind: "draw-two"; cards: 2|4|6|8 }`, `{ kind: "black-king"; units: 1|2; cards: 5|10 }`, or `{ kind: "miss-turn" }`.
- `applyAction` remains the single transition API.

- [ ] **Step 1: Write failing power-card tests**

Assert twos stack to 8, eights pass/resolve a missed turn, sevens grant another turn, two-player jacks return play to the actor, aces cannot interrupt active two/eight/black-king penalties, and seven/jack cannot be the final card under this ruleset.

- [ ] **Step 2: Write the failing red/black king regression tests**

Assert black king → red king leaves zero; black king → black king → red king leaves one unit/five cards; two red kings can cancel two black kings only when legally played as the matching-rank set; unresolved units are drawn in full.

- [ ] **Step 3: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-rules.spec.ts -g "power card|king"`

Expected: the stacked-black/one-red assertion fails against the former all-or-nothing logic.

- [ ] **Step 4: Implement explicit penalty-unit transitions**

One red king decrements `units` by exactly one. Preserve a five-card pending penalty while `units === 1`; clear only at zero.

- [ ] **Step 5: Verify green**

Run the Task 3 and Task 4 tests together; expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/switch/types.ts src/switch/rules.ts tests/switch-rules.spec.ts && git commit -m "fix: resolve stacked king penalties correctly"`

### Task 5: Add a deterministic, legal computer strategy

**Files:**
- Create: `src/switch/ai.ts`
- Create: `tests/switch-ai.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `GameAction`, `legalMoves`.
- Produces: `chooseComputerAction(state: GameState, random: RandomSource): GameAction`.

- [ ] **Step 1: Write failing strategy tests**

Assert the AI resolves penalties before ordinary play, never returns an illegal action, never finishes on seven/two-player jack, prefers an action that reduces hand size, prefers a useful disruptive power card on ties, and chooses an ace suit matching the largest remaining suit group.

- [ ] **Step 2: Verify red**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-ai.spec.ts`

Expected: FAIL because `chooseComputerAction` is missing.

- [ ] **Step 3: Implement the ordered strategy**

Score only the legal actions returned by `legalMoves`; use the injected random source solely to break equal scores.

- [ ] **Step 4: Verify green**

Run the Task 5 command; expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/switch/ai.ts tests/switch-ai.spec.ts && git commit -m "feat: add deterministic Switch opponent"`

### Task 6: Connect the existing guided game UI to the engine

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `tests/switch-game.spec.ts`

**Interfaces:**
- Consumes: `createInitialGame`, `legalMoves`, `applyAction`, `chooseComputerAction`.
- Preserves: existing button names, deterministic `testDeck` scenarios and user-visible rules copy unless a test intentionally changes it.

- [ ] **Step 1: Extend failing journey coverage**

Add UI tests for the five-card remainder after one red king counters a ten-card stack, draw-pile turnover, stale timer cancellation after “Play another game”, and visible legal/illegal explanations.

- [ ] **Step 2: Verify red against the existing component**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-game.spec.ts`

Expected: at least the partial king cancellation and stale-timer tests FAIL.

- [ ] **Step 3: Replace component-owned rule calculations with engine actions**

Keep React state updates free of external writes. Store the computer timer handle in an effect cleanup keyed by the game instance/move number.

- [ ] **Step 4: Verify the full gameplay suite**

Run: `node node_modules/@playwright/test/cli.js test tests/switch-rules.spec.ts tests/switch-ai.spec.ts tests/switch-game.spec.ts`

Expected: PASS with no console errors.

- [ ] **Step 5: Commit**

Run: `git add src/Prototype.tsx tests/switch-game.spec.ts && git commit -m "refactor: connect guided game to tested engine"`
