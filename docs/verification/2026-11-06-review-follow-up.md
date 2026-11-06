# Review follow-up — 6 November 2026

Not deployed. Work lives on `codex/switch-solo-hardening`.

## Direction

Switch is a **companion for a physical card night** (scores, leagues, stats). Playing on the phone is kept only as a tutorial. Pass-and-play for 2 to 6 players, three computer levels and the Last Card call-out challenge were built and then removed on this basis. The computer levels remain in `src/switch/ai.ts` with tests but have no UI.

## What changed

1. **Browser suite runs.** Playwright's Chromium was installed; the suite runs clean apart from one timing flake in the protected runtime keyboard test, which passes in isolation.
2. **Rules.** The first card is always an ordinary card, and either side can start. Sets of matching cards may be played in any order, and the last card sets the suit. Rule text updated to match.
3. **Structure.** `Prototype.tsx` went from one 55 KB file to a small shell plus `content.ts`, `ui.tsx` and `screens/`. The guided game holds engine state directly.
4. **Polish.** Scorekeeper and guided game load on demand. Card art and the hero image are WebP. Demo ads and the ad-free preview show in development builds only; the `?testDeck=` hook is development-only.
5. **Clubhouse.** Profiles, stats, league seasons and night history are real screens with tests. "Start a game night" is the main action on the home screen. Backup and restore of everything on the device is tested.
6. **Tutorial clarity.** A turn banner shows whose turn it is, the whole game fits one iPhone or Pixel 10 screen (tested), and the coach explains each move and lists your options.
7. **The "two eights" report.** Not an engine bug. The computer can answer an eight with its own eight; the message now says so ("The computer had an eight (X)...").

## Not covered

- No service worker yet, so the app is not usable offline after a cold start with no network.
- A score session in progress is saved, but there is no explicit "resume" prompt after a reload.
- Computer levels have no UI by design.
