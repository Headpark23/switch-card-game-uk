# Switch Card Game

A polished, mobile-first guide to the UK card game Switch, with an interactive rules story and a complete guided game against the computer.

## Source and release status

The `codex/switch-solo-hardening` branch is the focused development line for making the standalone Switch app dependable before any wider game-night product is considered. The public site is [switchcardgame.co.uk](https://switchcardgame.co.uk), but work on this branch does not deploy automatically and must not be treated as production until a separate release and rollback checklist is approved.

The multi-game Card Companion experiment remains outside this branch. Do not copy its seeded people, scores, matches, leagues, premium previews, or broader game catalogue into Switch.

## Current features

- Interactive five-step rules guide and searchable questions
- Full 52-card shuffled deck with no duplicate physical cards
- Draw-pile turnover without reshuffling when the pack is exhausted
- Guided computer opponent with optional legal-move hints and three levels (Relaxed, Standard, Sharp)
- Pass-and-play for two to six people on one phone, with a cover screen between turns
- Last Card challenge: spot the computer forgetting to call it
- Games always open on an ordinary card; sets of matching cards can be played in any order
- Power-card chains for twos, eights, black kings and red-king counters
- Tactical choice to pick up instead of playing a legal card
- Wild aces with suit selection
- Responsive iPhone and Pixel preview frames
- Demonstration advertising placements and an ad-free upgrade preview (development builds only)

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check:runtime
npm run build
npm run test:sites
npm run test:runtime
```

![Switch rules-first design](rules-first-home.png)
