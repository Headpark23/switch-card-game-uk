# Switch rules: rulings (sacrosanct)

These are the owner's decisions on every point the written rules left open. The app's engine, the in-app rules text and the tests must all agree with this list. Change it only on the owner's say-so.

Decided 7 Nov 2026, after playing 10,000 simulated games (2 to 6 players, four different playing styles) straight from the written rules.

| # | Question | Ruling |
|---|----------|--------|
| 1 | Can an 8 be the winning card with two players? | Yes. An 8 can win. Only a 7 (always), a jack (two players) and two or four jacks played together (any table, ruling 18) cannot win. They may still be played as the last cards, but they force a pickup (ruling 19). |
| 2 | Can a 2 or a king be the winning card? | Yes. You win at once and nobody picks up. The same goes for an ace. |
| 3 | Must the first card of a same-number set match the suit? | No. The first card must match the suit or the number of the previous card. The last card played decides the suit. |
| 4 | Does picking up end your turn? | Yes, for both the single card on a normal turn and for penalties from twos or kings. Only a 7 lets you play again. |
| 5 | Several 8s in one play | Still one missed turn, however many 8s. |
| 6 | Several 7s in one play | Still one extra turn, however many 7s. |
| 7 | A black and a red king in one play | Allowed. How they count is set by ruling 14: card by card, in the order played. |
| 8 | After a 7, if you cannot or will not play | Pick up one card and your turn ends. |
| 9 | Order of cards when the deck runs out | Turn the played pile (not the top card) face down without shuffling, so the oldest card is drawn first. |

## How these are enforced

- `src/switch/rules.ts` is the engine. `scripts/table-sim.mjs` is a second implementation written only from the rules text, for 2 to 6 players.
- `tests/table-sim.test.mjs`: 300 full games per table size must finish, keep all 52 cards, and never win on a forbidden card.
- `tests/switch-rules-sim.spec.ts`: the engine must agree with the simulator on every legal move and every result, for 2, 3 and 4 players.
- `scripts/contentious.mjs` measures how often each open point comes up. `npm run test:rules` runs the quick checks.
- The in-app rules (`src/content.ts`) say all of the above in plain words.

## Scoring rulings (owner decisions, 7 Nov 2026)

10. **Darts:** the first player to three legs wins the set (3-0, 3-1 and 3-2 all count). No two-clear-legs rule. First to the agreed number of sets (3 or 5) wins the match and the scorekeeper then stops.
11. **Knock Out (owner revised 2026-11-07):** each round, the player who finishes last loses and is out; everyone else progresses. Six players become 5, then 4, 3, 2, and the last two play for the win. Number of cards held is irrelevant.
12. **Group Play / leagues:** finishing places earn points (number of players for 1st down to 1). Level on points: most round wins; still level: a deciding game. The app never breaks a tie silently.
13. **Scorekeeper:** follows the written rules. Domino and one v one stop at the target and show the winner; domino records whether an ace counts as 1 or 11; darts offers 3 or 5 sets.

`scripts/scoring-sim.mjs` plays every format through the real scoring modules.

14. **Kings count card by card, in the order played (8 Nov 2026, replaces the net-count part of ruling 7).** A black king adds 5, a red king takes 5 off, never below nothing. One black = 5; black on 5 = 10; one red on 10 = 5; two reds on 10 = 0; black then red = 0; red then black = 5; two reds then two blacks = 10; one red then two blacks = 10. A lone red king with nothing pending is an ordinary card. Mixed sets may still be played; the order laid down decides the result.

15. **One v One is played to a number of games (7 Nov 2026, owner request; replaces the odd best-of legs and the points target).** The host types how many games to play, any whole number: with 4, the first player to win 4 games takes the match and the scorekeeper stops. Scores count games won. The scorekeeper also offers best of an odd number of games (first to a majority wins), added at the owner's request on the same day (commit 1cd9239).

16. **Leagues can be different sizes, and the draw is random (7 Nov 2026, owner request).** Each league has 3 to 6 players (for example two leagues of 4 and one of 3), and plays as many games as it has players: 3 games for 3 players, 4 for 4. Points are the number of players in that league for first, down to 1 for last. Names are typed first and the app draws who goes in which league at random. Playoffs: the top two in each league contest the championship; everyone else (third place and below) contests the plate, paired across leagues where possible, and with an odd number one plate player gets a bye. The Switch Cup is drawn at random too, and with an odd number a random player gets a bye each round.

17. **League playoffs are knockouts (8 Nov 2026, owner request).** The championship is a knockout among the top two from every league (two leagues: 4 players, 3 games: 4 become 3, 3 become 2, the last two play for the title). The plate is the same knockout among everyone ranked third or lower. Each game, the player who finishes last drops out. One player alone in the plate takes a bye.

18. **Two or four jacks mean play again (13 Nov 2026, owner ruling).** One or three jacks reverse the direction of play; with two players that brings play straight back, so the same player plays again. Two or four jacks never reverse: the direction stays as it was and whoever played them plays again, at every table size. Because they mean play again, two or four jacks cannot be a player's last cards (the same reason a seven cannot). One or three jacks can still be the winning play with three or more players. This replaces the earlier reading that two jacks cancel out and play moves on.

19. **A seven or jacks that cannot win may still be played as the last cards, but they force a pickup (14 Nov 2026, owner clarification of the finishing rule and rulings 1 and 18).** A seven (any table), a jack (two players) and two or four jacks together (any table) cannot win the game. They are NOT illegal as the last cards: the player puts them down, picks up one card from the deck, says "Last Card" again, and their turn ends. They are left holding that one card and the next player plays. Direction of play is unchanged, nothing else happens (no extra turn), and the played cards still set the suit. This replaces the earlier engine behaviour that refused the play altogether.

20. **Last Card is the player's own call, and finishing needs it too (14 Nov 2026, owner request).** Against the computer there is an always-visible Last Card button at the side of the table; nothing ever prompts for it. Playing out your final cards (a single card, a set such as two tens, or a seven or jacks that cannot win) without having called it means you do not win on that play: the play stands and you pick up two cards. Holding exactly one card without having called it lets a computer spot it and you pick up two. A call is used up by the play it covers, so after a pickup you call again. Engine: `penaliseMissedLastCard` in `src/switch/table.ts`; screen: `src/screens/TableGame.tsx`.

## Computer game types (owner decisions, 14 Nov 2026)

21. **Tables of 7 and 8 use two decks (owner choice, 14 Nov 2026).** One deck cannot deal seven cards each to 7 or 8 players (8 x 7 = 56). Tables of 7 or 8 shuffle two 52-card decks together (104 cards). Dealing, play, penalties, jacks and every other rule are unchanged. A table is you plus 1 to 7 computers, so 2 to 8 seats. A card from the second deck is the same card to the rules (it matches suit and number exactly as its twin does); only the screen and the engine tell the two copies apart.

22. **Computer game types (owner request, 14 Nov 2026).** PLAY offers: Single game, Knock Out, Group Play (two leagues of 4 at a full table of 8), Switch Cup, Darts scoring and Dominoes scoring. Every game of every type is played as real Switch at the table, and every type is recorded in the player's stats, trophies and badges. The computer players are John, Paul, George, Ringo, Ziggy, Marley and Bowie, in that order.
    - **Knock Out:** ruling 25 (1 v 1 games, winners go through).
    - **Group Play:** ruling 12 and 16 (place points, round wins, a deciding game), ruling 17 (knockout playoffs).
    - **Switch Cup:** head-to-head knockout rounds as in the scorekeeper; games between two computers are simulated and shown as a result.
    - **Darts scoring:** each Switch game is a leg; first to three legs wins a set (ruling 10); the player picks 3 or 5 sets to win the match.
    - **Dominoes scoring (reverse of the scorekeeper's domino):** the player picks a number. After every game each player adds up the cards still in their hand (ace 1, 2 to 10 face value, jack 11, queen 12, king 13; the winner of the game has none, so adds nothing) and adds that to their running total. The first player to reach or pass the chosen number LOSES the match. If two or more pass it in the same game, the highest total loses. The player with the lowest total wins. Totals are kept for every player.

24. **A league round is played on until every place is decided (owner correction, 14 Nov 2026; clarifies ruling 12 and 22).** A league game does not stop when the first player is out. With four players: the first out scores 4 points and leaves the table, the other three keep playing, the next out scores 3, and the last two play on for 2 and 1. With three players it is 3, 2 and 1; every league size follows the same pattern (size for first down to 1 for last). The rest of the table plays by the same rules on the cards that are left: a jack finishing or bouncing play back follows the number of players still in, so with two left it is a two-player game. A deciding game between level players is played the same way. Going out without having called Last Card (ruling 20) puts the player back in with two cards and no place. Engine: `playOn` games in `src/switch/table.ts`; league games and deciding games in `src/switch/series.ts`; `tests/switch-play-on.spec.ts`. Knock Out is separate (ruling 11) and the play-offs (ruling 17) are unchanged.

25. **Knock Out against the computer is 1 v 1 (owner correction, 14 Nov 2026; replaces ruling 11 for the PLAY tab).** Players are drawn in pairs and each pair plays one game of Switch, head to head. The winner goes through to the next round, the loser is out, and the pattern repeats until one player is left. With an odd number one randomly drawn player gets a bye each round. Games between two computers are simulated. This is the same bracket as the Switch Cup. The scorekeeper's Knock Out (ruling 11) and the guide text are unchanged until the owner says otherwise.

26. **Last Card goes in before the final card is selected (owner clarification, 14 Nov 2026; adds to ruling 20).** To win with a set of the same number (two, three or four cards), the player selects the first card or cards, taps Last Card, then selects the final card. Saying it after the final card is already selected is too late, and the player picks up two cards as in ruling 20. Calling before selecting anything also counts. The Last Card button sits in the player's own card area. Screen: `src/screens/TableGame.tsx`; tests: `tests/switch-2-table.spec.ts`.

27. **Pace at the table (owner request, 14 Nov 2026).** A computer takes at least 5 seconds over every move it makes against you, at every pace setting (the pace setting still changes how fast cards fly). You have 5 seconds to say Last Card: a computer cannot spot that you forgot until 5 seconds of its turn have passed, and those 5 seconds count as its thinking time. Games between computers are still instant. "Play selected" always stays inside the phone, riding just above the tab bar. Automated test browsers skip the waits unless a test sets `switchRealPace` to 1. Code: `MIN_THINK_MS` and `LAST_CARD_GRACE_MS` in `src/switch/presentation.ts`.

## Online play (owner decision, 14 Nov 2026)

23. **Turn clock at an online table.** A player who has made no move 30 seconds into their turn is told the computer will play their move in 10 seconds, with a visible countdown to them and to the table. At 40 seconds the computer plays that one move for them. A move made first always wins. The computer calls Last Card correctly when it plays for someone, so a computer-played move never costs a human the two-card penalty (ruling 20). No rule of play changes: the engine is the same. Open: what happens after repeated computer-played moves (see the online play spec).
