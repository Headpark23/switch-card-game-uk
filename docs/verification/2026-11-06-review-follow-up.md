# Review follow-up — 6 November 2026

Not deployed. Changes are uncommitted on `codex/switch-solo-hardening`.

## What changed

1. **Browser suite runs.** Playwright's Chromium was installed. Result: 59 passed, 3 skipped, 0 failed.
2. **Rules.** The first card is always an ordinary card. Either side can start (`createInitialGame(random, firstTurn)`). Sets of matching cards may be played in any order, and the last card sets the suit (`isLegalPlay`). Rule text updated to match.
3. **Computer levels.** Relaxed, Standard (the original greedy opponent, unchanged) and Sharp. Over 3,000 simulated games per pairing: Standard beat Relaxed 73%, Sharp beat Standard 57.5%, Standard against itself 50.8%.
4. **Two to six players.** `src/switch/table.ts` and a pass-and-play screen. A two-seat table matches the original engine move for move over 177,000 simulated steps. Tables of 2 to 6 keep 52 unique cards and always finish (1,500 games each).
5. **Structure.** `Prototype.tsx` went from one 55 KB file to a 250-line shell plus `content.ts`, `ui.tsx` and `screens/`. The guided game now holds engine state directly; the `toEngine`/`mergeEngine` adapters are gone.
6. **Polish.** Scorekeeper, guided game and pass-and-play load on demand. Card art and the hero image are WebP (3.0 MB to 0.5 MB in `public/images`). Demo ads and the ad-free preview show in development builds only. The `?testDeck=` hook is development-only and is absent from the production bundle.
7. **Clubhouse parked.** The three Clubhouse UI tests are `test.fixme` until the screens exist.

## Not covered

- The "Call it out" Last Card challenge has no automated UI test (the computer rarely reaches one card in a scripted game).
- Pass and play has one smoke test, not a full played game.
- Guided-game layout was checked on iPhone only; pass-and-play on iPhone and Pixel 10.
- Pass and play is one shared phone. There is no online play.
