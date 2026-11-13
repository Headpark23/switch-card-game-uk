import { expect, test } from "@playwright/test";
// @ts-expect-error plain ES module used by both scripts and tests
import { newGame, legalPlays, step, rng, STYLES } from "../scripts/table-sim.mjs";

// The multi-seat engine must follow the written-rules simulator move for move, for 2 to 6 seats.
test("the table engine plays exactly like the written-rules simulator", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?frame=1");
  const games: unknown[] = [];
  for (const n of [2, 3, 4, 5, 6]) {
    for (let i = 0; i < 12; i++) {
      const random = rng(4242 + i * 13 + n);
      const g = newGame(n, random);
      const start = { n, hands: g.hands.map((h: string[]) => [...h]), draw: [...g.draw], discard: [...g.discard], suit: g.suit };
      const names = Array.from({ length: n }, (_: unknown, k: number) => Object.keys(STYLES)[(k + i) % 4]);
      const moves: unknown[] = [];
      while (g.winner === null && g.moves < 500) {
        const plays = legalPlays(g);
        const decision = STYLES[names[g.cur]](g, plays, random);
        const mover = g.cur;
        const missBefore = g.penalty?.kind === "miss";
        step(g, decision);
        moves.push({ decision, mover, missBefore, after: { cur: g.cur, dir: g.dir, top: g.discard.at(-1), suit: g.suit, sizes: g.hands.map((h: string[]) => h.length), winner: g.winner, pen: g.penalty ? g.penalty.kind + (g.penalty.cards ?? "") : null } });
      }
      games.push({ start, moves });
    }
  }
  const result = await page.evaluate(async (all) => {
    const table = await import("/src/switch/table.ts");
    const problems: string[] = [];
    let checked = 0;
    for (const game of all as any[]) {
      const { start, moves } = game;
      let state: any = {
        hands: start.hands, drawPile: start.draw, discardPile: start.discard, currentSuit: start.suit,
        turn: 0, direction: 1, dealer: start.n - 1, pendingPenalty: null, status: "playing", winner: null, move: 0,
      };
      for (const move of moves) {
        const d = move.decision;
        const action = d.kind === "pickup" ? (move.missBefore ? { type: "accept-missed-turn" } : { type: "draw" }) : { type: "play", cards: d.play.cards, ...(d.play.cards[0].slice(0, -1) === "A" ? { chosenSuit: d.play.suit } : {}) };
        try { state = table.applyTableAction(state, action); } catch (error) { problems.push(`n=${start.n}: ${JSON.stringify(action)} threw ${(error as Error).message}`); break; }
        checked++;
        const a = move.after;
        const pen = state.pendingPenalty ? ({ "draw-two": "two", "black-king": "king", "miss-turn": "miss" } as any)[state.pendingPenalty.kind] + (state.pendingPenalty.cards ?? "") : null;
        const same = state.turn === a.cur && state.direction === a.dir && state.discardPile.at(-1) === a.top && state.currentSuit === a.suit
          && JSON.stringify(state.hands.map((h: string[]) => h.length)) === JSON.stringify(a.sizes) && (state.winner ?? null) === a.winner && pen === a.pen;
        if (!same) { problems.push(`n=${start.n}: diverged after ${JSON.stringify(action)}`); break; }
      }
    }
    return { checked, problems: problems.slice(0, 5) };
  }, games);
  expect(result.problems).toEqual([]);
  expect(result.checked).toBeGreaterThan(1500);
});

test("computer players finish full games at every table size and never lose a card", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?frame=1");
  const result = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const ai = await import("/src/switch/tableAi.ts");
    let seed = 7;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const out: { seats: number; finished: boolean; cards: number }[] = [];
    for (const seats of [2, 3, 4, 5, 6]) {
      for (const level of ["relaxed", "standard", "sharp"] as const) {
        let state = table.createTable(seats, random, seats - 1);
        let guard = 0;
        while (state.status === "playing" && guard++ < 3000) state = table.applyTableAction(state, ai.chooseTableAction(state, random, level));
        out.push({ seats, finished: state.status === "won", cards: state.hands.flat().length + state.drawPile.length + state.discardPile.length });
      }
    }
    return out;
  });
  for (const game of result) {
    expect(game.cards).toBe(52);
    expect(game.finished).toBe(true);
  }
});
