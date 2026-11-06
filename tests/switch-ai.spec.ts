import { expect, test } from "@playwright/test";

test("computer resolves penalties and always returns a legal action", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const ai = await import("/src/switch/ai.ts");
    const rules = await import("/src/switch/rules.ts");
    const state = {
      playerHand: ["4D", "5D"],
      computerHand: ["2C", "3D", "9S"],
      drawPile: ["6C", "7C", "8C", "10C"],
      discardPile: ["2H"],
      currentSuit: "H",
      turn: "computer",
      pendingPenalty: { kind: "draw-two", cards: 2 },
      status: "playing",
      winner: null,
      move: 3,
    };
    const action = ai.chooseComputerAction(state, () => 0);
    return { action, legal: rules.legalMoves(state) };
  });

  expect(result.action).toEqual({ type: "play", cards: ["2C"] });
  expect(result.legal).toContainEqual(result.action);
});

test("computer prefers fewer cards, then a useful power card", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const ai = await import("/src/switch/ai.ts");
    const base = {
      playerHand: ["4D", "5D"],
      computerHand: ["9H", "9S", "3C"],
      drawPile: ["6C", "7C", "8C", "10C"],
      discardPile: ["5H"],
      currentSuit: "H",
      turn: "computer",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 3,
    };
    const pair = ai.chooseComputerAction(base, () => 0);
    const power = ai.chooseComputerAction(
      { ...base, computerHand: ["2H", "9H", "3C"] },
      () => 0,
    );
    return { pair, power };
  });

  expect(result.pair).toEqual({ type: "play", cards: ["9H", "9S"] });
  expect(result.power).toEqual({ type: "play", cards: ["2H"] });
});

test("computer chooses an ace suit from its remaining hand", async ({ page }) => {
  await page.goto("/");

  const action = await page.evaluate(async () => {
    const ai = await import("/src/switch/ai.ts");
    return ai.chooseComputerAction(
      {
        playerHand: ["4D", "5D"],
        computerHand: ["AS", "3C", "4C", "5H"],
        drawPile: ["6C", "7C", "8C", "10C"],
        discardPile: ["9D"],
        currentSuit: "D",
        turn: "computer",
        pendingPenalty: null,
        status: "playing",
        winner: null,
        move: 3,
      },
      () => 0,
    );
  });

  expect(action).toEqual({ type: "play", cards: ["AS"], chosenSuit: "C" });
});

test("computer never finishes illegally on a seven or two-player jack", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const ai = await import("/src/switch/ai.ts");
    const state = {
      playerHand: ["4D", "5D"],
      computerHand: ["7H"],
      drawPile: ["6C", "8C"],
      discardPile: ["9H"],
      currentSuit: "H",
      turn: "computer",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 3,
    };
    return {
      seven: ai.chooseComputerAction(state, () => 0),
      jack: ai.chooseComputerAction({ ...state, computerHand: ["JH"] }, () => 0),
    };
  });

  expect(result.seven).toEqual({ type: "draw" });
  expect(result.jack).toEqual({ type: "draw" });
});
