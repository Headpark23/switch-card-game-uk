# Switch Solo App Hardening Design

**Date:** 6 November 2026  
**Status:** Awaiting approval  
**Product decision:** Switch remains a focused standalone app. A broader game-night product may reuse its blueprint later, but is a separate future project.

## Intent

Make the original Switch app dependable, clear and enjoyable enough to serve as the reference implementation for a future multi-game product, without turning Switch itself into that product.

The immediate work is a careful hardening pass: establish a trustworthy source baseline, prove the rules and scoring, preserve existing browser data, improve the card-playing experience, and close the most important mobile and accessibility gaps. Production will not be deployed or changed as part of this work.

## Why this approach

The audit found three materially different versions:

- The public site at `switchcardgame.co.uk` is the focused Switch rules, guided game and six-format scorekeeper previously released as version 4.
- `Headpark23/switch-card-game-uk` now has an unpublished multi-game “Card Companion” on `main`, including seeded people, matches, leagues, premium previews and PWA work.
- `Headpark23/switch-card-game` is the much older original rules site.

The live version contains later Switch functionality that is not present as readable source in either repository history. Shipping current `main` would therefore replace the solo app with an unfinished different product. Patching the minified live bundle would be brittle and difficult to test.

The selected approach is to create a new local development line from the last focused Switch commit (`8ba02f9`), preserve its design/runtime, and rebuild only the proven version-4 scorekeeper improvements around audited, testable modules. Existing `main` stays intact as research for the future multi-game product.

## Approaches considered

### 1. Ship the current Card Companion branch

Fastest route to more features, but rejected. It changes the product identity, seeds apparently real people and match history, mixes ten games before Switch is fully hardened, and introduces a larger unverified data model.

### 2. Restore the focused Switch baseline and harden it incrementally — selected

Safest route. It retains the approved cream, forest-green and gold Switch experience, gives the rules engine and scorekeeper clear boundaries, and lets every improvement be tested and reversed independently.

### 3. Patch the deployed minified bundle

Would most closely mirror production initially, but rejected. The source is compressed, not maintainable, and cannot support confident regression testing or long-term development.

## Goals

- Keep Switch visibly and functionally a standalone Switch app.
- Preserve the existing `switchScoreKeeper` browser-storage key and all readable user-entered names, scores and settings.
- Make the game rules deterministic and directly testable, including draw-pile recycling, multiple-card play, Last Card, twos, eights, sevens, jacks, aces, and red/black king chains.
- Correct the outstanding king-chain edge case: one red king cancels one black king, not an entire multi-king penalty.
- Keep the agreed wording “When the deck runs out”.
- Make suits and ranks quick to recognise, with high-contrast card art and meaningful accessible names.
- Show cards moving between hand, discard and draw areas, while respecting reduced-motion preferences.
- Provide named-player scoring for head-to-head, group leagues, knockout, darts, dominoes and Switch Cup.
- Support any valid non-negative domino score entry rather than fixed increments only.
- Support up to four group leagues and produce separate top-two championship and bottom-two plate playoffs across leagues.
- Support knockout for up to six named players, with `LOST` elimination until one winner remains.
- Support a Switch Cup for up to ten named players with random draws, automatic byes and explicit winner advancement.
- Improve mobile reflow, touch targets, keyboard/focus behavior, visible status changes and screen-reader labels.
- Establish a repeatable clean build and test command before any release is considered.

## Non-goals for this pass

- No multi-game Card Companion launch.
- No accounts, cloud database, payments or paid membership.
- No production deployment, DNS, hosting or advertising changes.
- No deletion or rewriting of existing production data.
- No fabricated community members, scores or league activity presented as real.
- No full Switch Night cloud history or family-group service yet.

## Safety constraints learned from Popmaster and BetBuddy

- Treat live behavior, repository state and deployment state as separate facts; verify all three before release.
- Never equate a feature list or prior “tests passed” message with current evidence.
- Preserve storage keys and load old records before adding new fields.
- Use additive, versioned migrations and retain unknown fields so rollback does not destroy newer data.
- Keep gameplay calculations out of React state-updater side effects.
- Do not present sample people, matches or statistics as genuine user activity.
- Make one independently testable behavior change at a time, with a rollback point.
- Build and test locally; production remains untouched until a separate approved release checklist exists.

## Proposed structure

The protected mobile runtime remains unchanged. App-specific work stays in focused modules:

- `src/switch/rules.ts`: card parsing, legal moves, penalties, finishing rules and pure state transitions.
- `src/switch/ai.ts`: deterministic computer move selection, separated from rendering and timers.
- `src/switch/storage.ts`: versioned scorekeeper loading, validation, migration and saving.
- `src/switch/scoring.ts`: score calculations and competition state for all six formats.
- `src/switch/types.ts`: shared game, card, player, score and tournament types.
- `src/Prototype.tsx`: presentation and orchestration only.
- `src/prototype.css`: the existing Switch visual system, responsive behavior and motion.
- `tests/`: rule, storage, scoring and end-to-end journey coverage.

This split prevents the central mistake seen in earlier apps: critical rules, persistence and UI behavior becoming inseparable inside one large component.

## Data preservation design

The existing `switchScoreKeeper` local-storage entry is treated as user data.

- Load it defensively and validate each known field.
- Preserve valid existing player names, selected format, targets and scores.
- Never clear the value because one optional field is missing or malformed.
- Add a schema version only through an additive migration.
- Keep a last-known-good in-memory copy if saving fails.
- Exclude experimental Switch Night history from this migration until its data model is separately approved.
- Add regression fixtures for empty storage, the current live shape, malformed JSON, partial old records and unknown future fields.

## Gameplay and AI design

The rules engine will be pure: the same input state and chosen action always produce the same result. Random shuffling and AI tie-breaking are injected, allowing deterministic tests.

Penalty rules are represented as counts, not loosely coupled labels:

- Each black king adds five.
- Each red king removes one five-card black-king unit.
- If units remain, the chain continues with the reduced penalty.
- If none remain, normal play resumes.

The AI will first obey legal-move rules, then use a documented small strategy: resolve penalties, avoid illegal finishing cards, prefer plays that reduce hand size, use disruptive power cards when useful, and choose an ace suit based on the remaining hand. It will remain understandable rather than pretending to be an advanced opponent.

## Scorekeeper and competitions

All formats share reusable named players and an undoable action history for the current session.

- **Head-to-head:** flexible target and score increments.
- **Dominoes:** direct numeric entry with validation and optional quick-add shortcuts.
- **Darts:** sets and legs with clear winner state.
- **Group leagues:** one to four leagues, named entrants, standings, and championship/plate playoff generation. Cross-league seeding avoids a team immediately facing the same league opponent where possible.
- **Knockout:** three to six named entrants; marking `LOST` removes a player from subsequent rounds until one champion remains.
- **Switch Cup:** two to ten named entrants; each round is drawn once, odd counts receive one random bye, and only explicitly selected winners advance.

Every destructive session action, such as resetting a competition, requires a clear confirmation and does not erase saved names by default.

## Card readability, movement and accessibility

- Retain the real card image assets and add text alternatives such as “King of spades”.
- Keep red suits visually red and black suits dark, with rank/suit legibility independent of color alone.
- Animate from the actual source area to the destination using short transforms; do not delay the underlying state update or make rules depend on animation completion.
- Disable non-essential motion under `prefers-reduced-motion`.
- Keep all gameplay and score actions keyboard accessible with a visible focus state.
- Use real dialog semantics, focus trapping/return, live regions for turn and penalty changes, and descriptive error messages.
- Keep primary touch targets at least 44 by 44 CSS pixels and verify narrow mobile widths, desktop reflow and 200% zoom behavior.

## Testing and verification

Changes are test-first. Required coverage includes:

- All 52 unique cards and draw-pile turnover without reshuffling.
- Simple and stacked black-king penalties.
- One red king cancelling exactly one black king in a larger chain.
- Legal/illegal multi-card sets, ace suit choice, two/eight chains, seven/jack finishing restrictions and Last Card penalty.
- Storage compatibility and malformed-data recovery without erasure.
- Free-form domino values and invalid input handling.
- Four-league playoff seeding, three-to-six player knockout elimination and two-to-ten player Cup byes/advancement.
- Player names containing whitespace, punctuation and duplicate display names.
- Keyboard-only gameplay and scorekeeping journeys.
- Small-phone, tablet and desktop screenshots plus reduced-motion behavior.
- Clean type-check, production build, packaging tests and browser journey suite.

## Switch Night roadmap

The deeper score/history/family-group idea remains important, but follows the hardened local app:

1. Define a trustworthy local match-history model and export/import backup.
2. Test recurring family/friend groups and rivalry summaries locally.
3. Decide whether Switch history stays inside this app or becomes the first connected experience in the separate game-night product.
4. Only then design accounts, invitations, sharing permissions, cloud sync, privacy and recovery.

This prevents a repeat of adding cloud/community complexity before scoring and identity are fully trustworthy.

## Release boundary

This design authorises local implementation and verification only after approval. A later release requires a separate checklist that identifies the actual host/source connection, takes a recoverable production snapshot, records the deployed version, proves storage compatibility against the live value, and defines rollback. No push or deploy is implied by approving this document.
