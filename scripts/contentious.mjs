// Counts how often the situations the written rules leave open actually happen in real games.
// Usage: node scripts/contentious.mjs [games per table size]
import { legalPlays, newGame, rng, step, STYLES, rankOf, suitOf, pretty } from "./table-sim.mjs";

const games = Number(process.argv[2] ?? 2000);
const out = {};
for (const n of [2, 4]) {
  const c = { games, setLeadsOnlyByRank: 0, positionsWithSets: 0, finishedOnPenaltyCard: 0, finishedOn8: 0, lone7orJ: 0, nothingToDraw: 0, partialPenalty: 0, jackFinishes: 0, eightPlayedAsLast2p: 0, positions: 0, exampleOnlyByRank: null, exampleFinishOn8: null };
  for (let i = 0; i < games; i++) {
    const random = rng(31 + i * 13 + n);
    const g = newGame(n, random);
    const names = Array.from({ length: n }, (_, k) => Object.keys(STYLES)[(k + i) % 4]);
    while (g.winner === null && g.moves < 800) {
      const plays = legalPlays(g);
      c.positions++;
      const top = g.discard.at(-1);
      for (const p of plays) {
        if (p.cards.length > 1 && !g.penalty && rankOf(p.cards[0]) !== "A") {
          c.positionsWithSets++;
          const anySuit = p.cards.some((x) => suitOf(x) === g.suit);
          if (!anySuit) { c.setLeadsOnlyByRank++; c.exampleOnlyByRank ??= `top ${pretty(top)} (suit ${g.suit}), plays ${p.cards.map(pretty).join(" ")}`; break; }
        }
      }
      const hand = g.hands[g.cur];
      if (hand.length === 1 && (rankOf(hand[0]) === "7" || (rankOf(hand[0]) === "J" && n === 2))) c.lone7orJ++;
      const before = g.hands.reduce((s, h) => s + h.length, 0);
      const wasPenalty = g.penalty;
      const decision = STYLES[names[g.cur]](g, plays, random);
      const line = step(g, decision);
      if (/nothing left/.test(line)) c.nothingToDraw++;
      if (/only \d+ left/.test(line)) c.partialPenalty++;
      void before; void wasPenalty;
      if (g.winner !== null) {
        const r = rankOf(g.discard.at(-1));
        if (["2", "8", "K"].includes(r)) c.finishedOnPenaltyCard++;
        if (r === "8") { c.finishedOn8++; c.exampleFinishOn8 ??= line; }
        if (r === "J") c.jackFinishes++;
      }
    }
  }
  out[`${n} players`] = c;
}
console.log(JSON.stringify(out, null, 1));
