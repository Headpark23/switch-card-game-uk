# Switch rules: rulings (sacrosanct)

These are the owner's decisions on every point the written rules left open. The app's engine, the in-app rules text and the tests must all agree with this list. Change it only on the owner's say-so.

Decided 7 Nov 2026, after playing 10,000 simulated games (2 to 6 players, four different playing styles) straight from the written rules.

| # | Question | Ruling |
|---|----------|--------|
| 1 | Can an 8 be the winning card with two players? | Yes. An 8 can win. Only a 7 (always) and a jack (two players) cannot be the last card. |
| 2 | Can a 2 or a king be the winning card? | Yes. You win at once and nobody picks up. The same goes for an ace. |
| 3 | Must the first card of a same-number set match the suit? | No. The first card must match the suit or the number of the previous card. The last card played decides the suit. |
| 4 | Does picking up end your turn? | Yes, for both the single card on a normal turn and for penalties from twos or kings. Only a 7 lets you play again. |
| 5 | Several 8s in one play | Still one missed turn, however many 8s. |
| 6 | Several 7s in one play | Still one extra turn, however many 7s. |
| 7 | A black and a red king in one play | Allowed. Each red king cancels one black king inside the same play. |
| 8 | After a 7, if you cannot or will not play | Pick up one card and your turn ends. |
| 9 | Order of cards when the deck runs out | Turn the played pile (not the top card) face down without shuffling, so the oldest card is drawn first. |

## How these are enforced

- `src/switch/rules.ts` is the engine. `scripts/table-sim.mjs` is a second implementation written only from the rules text, for 2 to 6 players.
- `tests/table-sim.test.mjs`: 300 full games per table size must finish, keep all 52 cards, and never end on a forbidden card.
- `tests/switch-rules-sim.spec.ts`: the engine must agree with the simulator on every legal move and every result, for 2, 3 and 4 players.
- `scripts/contentious.mjs` measures how often each open point comes up. `npm run test:rules` runs the quick checks.
- The in-app rules (`src/content.ts`) say all of the above in plain words.

## Scoring rulings (owner decisions, 7 Nov 2026)

10. **Darts:** the first player to three legs wins the set (3-0, 3-1 and 3-2 all count). No two-clear-legs rule. First to the agreed number of sets (3 or 5) wins the match and the scorekeeper then stops.
11. **Knock Out:** a round ends as soon as one player goes out. Whoever holds the most cards then drops out; if level, add up the card values and the highest drops out.
12. **Group Play / leagues:** finishing places earn points (number of players for 1st down to 1). Level on points: most round wins; still level: a deciding game. The app never breaks a tie silently.
13. **Scorekeeper:** follows the written rules. Domino and one v one stop at the target and show the winner; domino records whether an ace counts as 1 or 11; darts offers 3 or 5 sets.

`scripts/scoring-sim.mjs` plays every format through the real scoring modules.
