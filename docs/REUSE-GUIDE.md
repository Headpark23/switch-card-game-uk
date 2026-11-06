# Reusing this app for another physical game

Switch is built as a companion for real card and board game nights. The pattern is:

1. **Learn** (rules story and card reference)
2. **Practise** (guided game with a coach that explains every move)
3. **Prove it** (rules puzzles with a streak and badge)
4. **Play for real** (setup checklist for the physical game)
5. **Keep score** (quick night, then deeper formats, history, stats, share cards)
6. **Settle disputes** (searchable rules and quick-pick chips)

## What is game-agnostic (import from `src/kit`)

| Piece | Purpose |
| --- | --- |
| `CoachPanel`, `Lesson`, `CoachOption` | The per-move "what happened / the rule / why it matters / what you could play / tip" card |
| `RealCards` | Practice-to-table bridge: a tickable setup checklist and a button into scoring |
| `QuickNight` | One-minute scoring: names, tap each round winner, save to history |
| `badgeFor`, `recordResult` | Puzzle streak and badge ladder |
| `cue` | Synthesised sound and vibration with a remembered mute |
| `InstallButton` | Add to phone: native prompt on Android, steps on iPhone |
| `ShareButton` | Canvas share pictures with the Web Share API and a download fallback |
| `enableOffline` | Service worker caching so it works at a table with no signal |

## What you replace for a new game

- `src/switch/rules.ts`: the pure rules engine. Keep the shape: state, `legalMoves`, `applyAction`.
- `src/switch/coach.ts` and `lessons.ts`: the wording of explanations, written against your engine.
- `src/switch/puzzles.ts`: scenarios. Answers are computed from the engine, so a puzzle cannot disagree with the game.
- `src/content.ts`: rules text, power/special items, modes.
- `public/images/cards/`: art. Brand colours live at the top of `src/prototype.css`.
- `public/manifest.webmanifest`, `public/icons/`, `index.html`: name, icons, theme colour.

## Checklist for a new title

1. Copy the repo; rename in the manifest, `index.html` and `AGENTS.md`.
2. Replace the engine and run `npm test` equivalents until the rules tests pass.
3. Rewrite coach and lesson text; add 10 to 12 puzzles.
4. Update `RealCards` steps for the real setup.
5. Run `node scripts/store-screenshots.mjs <url>` for store pictures.
6. Follow `docs/store/PUBLISHING.md`.

## Honest limits

The kit folder re-exports files that still live beside Switch code, and some wording inside `coach.ts` and the scoring formats is Switch-specific. Moving them into a standalone package is a worthwhile next refactor once a second game exists to prove the boundary.
