import { expect, test } from "@playwright/test";

test("games open on an ordinary card and honour who plays first", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    let seed = 5;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    let power = 0;
    let wrongFirst = 0;
    let broken = 0;
    for (let game = 0; game < 400; game += 1) {
      const first = game % 2 ? "player" : "computer";
      const state = rules.createInitialGame(random, first);
      if (/^(A|2|7|8|J|K)/.test(state.discardPile[0])) power += 1;
      if (state.turn !== first) wrongFirst += 1;
      const all = [...state.playerHand, ...state.computerHand, ...state.drawPile, ...state.discardPile];
      if (all.length !== 52 || new Set(all).size !== 52) broken += 1;
    }
    return { power, wrongFirst, broken, defaultFirst: rules.createInitialGame(random).turn };
  });
  expect(result).toEqual({ power: 0, wrongFirst: 0, broken: 0, defaultFirst: "player" });
});

test("a set of matching cards may be played in any order and the last card sets the suit", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const state = {
      playerHand: ["9H", "9S", "9D", "3C"],
      computerHand: ["4D"],
      drawPile: ["5C", "6C"],
      discardPile: ["5H"],
      currentSuit: "H",
      turn: "player",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    };
    const spadesLast = rules.applyAction(state, { type: "play", cards: ["9H", "9D", "9S"] });
    const diamondsLast = rules.applyAction(state, { type: "play", cards: ["9H", "9S", "9D"] });
    let rejected = "";
    try {
      rules.applyAction(state, { type: "play", cards: ["9S", "9H", "9D"] }); // 9S cannot lead on a heart
    } catch (error) {
      rejected = String(error);
    }
    return { spades: spadesLast.currentSuit, diamonds: diamondsLast.currentSuit, rejected };
  });
  expect(result.spades).toBe("S");
  expect(result.diamonds).toBe("D");
  expect(result.rejected).toContain("not legal");
});

test("difficulty levels are ordered by strength", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const ai = await import("/src/switch/ai.ts");
    let seed = 99;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const mirror = (s: any) => ({
      ...s,
      playerHand: s.computerHand,
      computerHand: s.playerHand,
      turn: s.turn === "player" ? "computer" : "player",
    });
    function seatAWinRate(a: string, b: string, games: number) {
      let wins = 0;
      let finished = 0;
      for (let game = 0; game < games; game += 1) {
        let state: any = rules.createInitialGame(random, game % 2 ? "player" : "computer");
        while (state.status === "playing" && state.move < 800) {
          const action = state.turn === "computer"
            ? ai.chooseComputerAction(state, random, a)
            : ai.chooseComputerAction(mirror(state), random, b);
          state = rules.applyAction(state, action);
        }
        if (state.status === "won") { finished += 1; if (state.winner === "computer") wins += 1; }
      }
      return wins / finished;
    }
    return {
      standardVsRelaxed: seatAWinRate("standard", "relaxed", 600),
      sharpVsStandard: seatAWinRate("sharp", "standard", 600),
    };
  });
  expect(result.standardVsRelaxed).toBeGreaterThan(0.6);
  expect(result.sharpVsStandard).toBeGreaterThan(0.52);
});
