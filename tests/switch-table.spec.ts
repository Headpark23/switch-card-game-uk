import { expect, test } from "@playwright/test";
// @ts-expect-error plain ES module used by both scripts and tests
import { newGame, legalPlays, step, rng, STYLES } from "../scripts/table-sim.mjs";

// The multi-seat engine must follow the written-rules simulator move for move, for 2 to 8 seats.
test("the table engine plays exactly like the written-rules simulator", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?frame=1");
  const games: unknown[] = [];
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
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
        const action = d.kind === "pickup" ? (move.missBefore ? { type: "accept-missed-turn" } : { type: "draw" }) : { type: "play", cards: d.play.cards, ...(d.play.cards[0].replace("'", "").slice(0, -1) === "A" ? { chosenSuit: d.play.suit } : {}) };
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
    const out: { seats: number; expected: number; finished: boolean; cards: number }[] = [];
    for (const seats of [2, 3, 4, 5, 6, 7, 8]) {
      for (const level of ["relaxed", "standard", "sharp"] as const) {
        let state = table.createTable(seats, random, seats - 1);
        let guard = 0;
        while (state.status === "playing" && guard++ < 3000) state = table.applyTableAction(state, ai.chooseTableAction(state, random, level));
        out.push({ seats, expected: seats > 6 ? 104 : 52, finished: state.status === "won", cards: state.hands.flat().length + state.drawPile.length + state.discardPile.length });
      }
    }
    return out;
  });
  for (const game of result) {
    expect(game.cards).toBe(game.expected);
    expect(game.finished).toBe(true);
  }
});

// Ruling 19: a seven, or jacks that cannot win, may be played as the very last cards. The player picks up one card
// from the deck and the turn passes on the way play was going; nobody wins. Jacks that can win still win.
test("a last seven or last two jacks force a one-card pickup at a table, while one or three jacks still win", async ({ page }) => {
  await page.goto("/?frame=1");
  const result = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const base = {
      hands: [["7H"], ["4D", "5D"], ["6D", "9D"]],
      drawPile: ["5C", "6C", "AC"],
      discardPile: ["9H"],
      currentSuit: "H",
      turn: 0,
      direction: 1,
      dealer: 2,
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    } as any;
    const summary = (s: any) => ({ hands: s.hands.map((h: string[]) => h.length), mine: s.hands[0], turn: s.turn, direction: s.direction, status: s.status, winner: s.winner, top: s.discardPile.at(-1), suit: s.currentSuit });
    const seven = summary(table.applyTableAction(base, { type: "play", cards: ["7H"] }));
    const sevenListed = table.tableLegalMoves(base).some((a: any) => a.type === "play" && a.cards[0] === "7H");
    const twoJacks = summary(table.applyTableAction({ ...base, hands: [["JH", "JS"], base.hands[1], base.hands[2]] }, { type: "play", cards: ["JH", "JS"] }));
    const oneJack = summary(table.applyTableAction({ ...base, hands: [["JH"], base.hands[1], base.hands[2]] }, { type: "play", cards: ["JH"] }));
    const threeJacks = summary(table.applyTableAction({ ...base, hands: [["JH", "JS", "JD"], base.hands[1], base.hands[2]] }, { type: "play", cards: ["JH", "JS", "JD"] }));
    const reversed = summary(table.applyTableAction({ ...base, direction: -1, hands: [["7H"], base.hands[1], base.hands[2]] }, { type: "play", cards: ["7H"] }));
    const twoPlayerJack = summary(table.applyTableAction({ ...base, hands: [["JH"], ["4D"]], turn: 0 }, { type: "play", cards: ["JH"] }));
    return { seven, sevenListed, twoJacks, oneJack, threeJacks, reversed, twoPlayerJack };
  });

  expect(result.sevenListed).toBe(true);
  // The seven lands, the top card of the deck (AC) is picked up, and seat 1 plays next. Nothing else happens.
  expect(result.seven).toEqual({ hands: [1, 2, 2], mine: ["AC"], turn: 1, direction: 1, status: "playing", winner: null, top: "7H", suit: "H" });
  expect(result.twoJacks).toMatchObject({ hands: [1, 2, 2], mine: ["AC"], turn: 1, direction: 1, status: "playing", winner: null, top: "JS", suit: "S" });
  // One or three jacks can win at a table of three.
  expect(result.oneJack).toMatchObject({ hands: [0, 2, 2], status: "won", winner: 0 });
  expect(result.threeJacks).toMatchObject({ hands: [0, 2, 2], status: "won", winner: 0 });
  // Play was going anticlockwise, so it passes to the seat on the other side. The direction is not changed.
  expect(result.reversed).toMatchObject({ hands: [1, 2, 2], turn: 2, direction: -1, status: "playing", winner: null });
  // With two players a lone jack cannot win either: pick up and pass.
  expect(result.twoPlayerJack).toMatchObject({ hands: [1, 1], mine: ["AC"], turn: 1, status: "playing", winner: null });
});
