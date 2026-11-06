import { expect, test } from "@playwright/test";

const base = {
  playerHand: ["9H", "5S", "3C", "KH"],
  computerHand: ["4D", "5D", "6D"],
  drawPile: ["QC", "QD", "QH", "QS"],
  discardPile: ["5H"],
  currentSuit: "H",
  turn: "player",
  pendingPenalty: null,
  status: "playing",
  winner: null,
  move: 3,
};

test("the coach lists every kind of option the engine offers", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (state) => {
    const coach = await import("/src/switch/coach.ts");
    const ordinary = coach.explainOptions(state as never);
    const twos = coach.explainOptions({ ...state, pendingPenalty: { kind: "draw-two", cards: 2 }, playerHand: ["2S", "9H"] } as never);
    const kings = coach.explainOptions({ ...state, pendingPenalty: { kind: "black-king", cards: 5 }, playerHand: ["KH", "KS", "9H"] } as never);
    const eight = coach.explainOptions({ ...state, pendingPenalty: { kind: "miss-turn" }, playerHand: ["9H"] } as never);
    const stuck = coach.explainOptions({ ...state, playerHand: ["9S"], discardPile: ["5H"], currentSuit: "H" } as never);
    return { ordinary, twos, kings, eight, stuck };
  }, base);

  expect(result.ordinary.map((o: { label: string }) => o.label)).toEqual([
    "Match the suit (hearts)", "Match the number (five)", "Or pick up one card",
  ]);
  expect(result.twos.map((o: { label: string }) => o.label)).toEqual(["Stack a two", "Pick up 2"]);
  expect(result.kings.map((o: { label: string }) => o.label)).toEqual(["Play a black king", "Play a red king", "Pick up 5"]);
  expect(result.eight.map((o: { label: string }) => o.label)).toEqual(["Miss your turn"]);
  expect(result.stuck.map((o: { label: string }) => o.label)).toEqual(["Pick up one card"]);
});

test("the coach explains what each power card just did", async ({ page }) => {
  await page.goto("/");
  const text = await page.evaluate(async (state) => {
    const rules = await import("/src/switch/rules.ts");
    const coach = await import("/src/switch/coach.ts");
    const s = state as never;
    const play = (hand: string[], pile: string, suit: string, cards: string[], extra: object = {}) => {
      const before = { ...state, playerHand: hand, discardPile: [pile], currentSuit: suit, ...extra } as never;
      const after = rules.applyAction(before, { type: "play", cards } as never);
      return coach.explainEffect(before, after, cards as never, "you");
    };
    void s;
    return {
      two: play(["2H", "9S"], "5H", "H", ["2H"]),
      eight: play(["8H", "9S"], "5H", "H", ["8H"]),
      seven: play(["7H", "9S"], "5H", "H", ["7H"]),
      king: play(["KS", "9S"], "5S", "S", ["KS"]),
      plain: play(["9H", "9S"], "5H", "H", ["9H"]),
    };
  }, base);

  expect(text.two).toMatch(/must pick up 2 cards unless they stack another two/);
  expect(text.eight).toMatch(/misses a turn unless it plays an eight/);
  expect(text.seven).toMatch(/play again/);
  expect(text.king).toMatch(/pick up 5 cards/);
  expect(text.plain).toMatch(/Ordinary card/);
});

test("an unplayable tap says why, and keeps the rule wording", async ({ page }) => {
  await page.goto("/");
  const messages = await page.evaluate(async (state) => {
    const coach = await import("/src/switch/coach.ts");
    return {
      plain: coach.explainUnplayable("3C" as never, state as never),
      twos: coach.explainUnplayable("9H" as never, { ...state, pendingPenalty: { kind: "draw-two", cards: 2 } } as never),
      ace: coach.explainUnplayable("AS" as never, { ...state, pendingPenalty: { kind: "black-king", cards: 5 } } as never),
    };
  }, base);
  expect(messages.plain).toContain("cannot follow the current card");
  expect(messages.twos).toContain("only another two can answer");
  expect(messages.ace).toContain("cannot interrupt");
});

test("the guided game shows what happened and the options on your turn", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByRole("region", { name: "Coach" })).toContainText("Your options");
  await expect(page.getByRole("region", { name: "Coach" })).toContainText("Or pick up one card");

  await page.getByRole("button", { name: "Play 9H, legal move" }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible({ timeout: 4_000 });
  await expect(page.getByRole("region", { name: "Coach" })).toContainText("What that means");
});

test("every move has a lesson card with what was played and what you could play", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Play 9H, legal move" }).click();
  await expect(page.getByText("GUIDED GAME · COMPUTER TURN")).toBeVisible();
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 4_000 });

  await page.getByRole("button", { name: "Tell me more" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("An eight: miss a turn");
  await expect(sheet).toContainText("What was played");
  await expect(sheet).toContainText("The computer played the eight of hearts.");
  await expect(sheet).toContainText("The rule");
  await expect(sheet).toContainText("What you could play now");
  await expect(sheet).toContainText("Miss your turn");
  await expect(sheet).toContainText("Tip");
});
