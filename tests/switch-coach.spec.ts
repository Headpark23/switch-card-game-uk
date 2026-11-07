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
  await expect(page.getByRole("button", { name: /Why & tactics: Play/ })).toBeVisible();

  await page.getByRole("button", { name: "Play 9H, legal move" }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible({ timeout: 4_000 });
  await page.getByRole("button", { name: /Why & tactics/ }).click();
  await expect(page.getByRole("dialog")).toContainText("What that means");
  await expect(page.getByRole("dialog")).toContainText("Coach's pick");
  await page.getByRole("button", { name: "Got it" }).click();
});

test("every move has a lesson card with what was played and what you could play", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Play 9H, legal move" }).click();
  await expect(page.getByText("GUIDED GAME · COMPUTER TURN")).toBeVisible();
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 4_000 });

  await page.getByRole("button", { name: /Tell me more|Why & tactics/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("An eight: miss a turn");
  await expect(sheet).toContainText("What was played");
  await expect(sheet).toContainText("The computer played the eight of hearts.");
  await expect(sheet).toContainText("The rule");
  await expect(sheet).toContainText("Coach's pick");
  await expect(sheet).toContainText("Your cards, one by one");
  await expect(sheet).toContainText("Accept the missed turn");
  await expect(sheet).toContainText("Tactics for this hand");
  await expect(sheet).toContainText("Tip");
});

test("a guidance card comes up every turn, and the computer waits for you to close it", async ({ page }) => {
  await page.goto("/?testDeck=1&guide=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();

  // The opening card.
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Game on");
  await sheet.getByRole("button", { name: "Got it" }).click();
  await expect(sheet).toHaveCount(0);

  // Your move gets a card, and the computer does not move until it is closed.
  await page.getByRole("button", { name: "Play 9H, legal move" }).click();
  await expect(sheet).toContainText("You played the nine of hearts.");
  await page.waitForTimeout(1_200);
  await expect(page.getByText("GUIDED GAME · COMPUTER TURN")).toBeVisible();
  await sheet.getByRole("button", { name: "Got it" }).click();

  // The computer's move gets a card with your options.
  await expect(sheet).toContainText("An eight: miss a turn", { timeout: 4_000 });
  await expect(sheet).toContainText("Coach's pick");
  await expect(sheet).toContainText("Your cards, one by one");

  // Guidance can be switched off for good.
  await sheet.getByRole("button", { name: "Turn off automatic guidance cards" }).click();
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("switchGuidance"))).toBe("off");
});

test("the tactics coach recommends a legal move with reasons for any hand", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const tactics = await import("/src/switch/tactics.ts");
    const rules = await import("/src/switch/rules.ts");
    const base = { drawPile: [], discardPile: ["7H"], currentSuit: "H", turn: "player", pendingPenalty: null, status: "playing", winner: null, move: 0 };
    const cases = [
      { ...base, playerHand: ["3H", "7C", "9S", "KD", "AS"], computerHand: ["4C", "5C", "6C", "9D", "10D"] },
      { ...base, playerHand: ["9H"], computerHand: ["4C"], discardPile: ["9D"] },
      { ...base, playerHand: ["2S", "9H"], computerHand: ["4C", "5D"], pendingPenalty: { kind: "draw-two", cards: 2 }, discardPile: ["2D"] },
      { ...base, playerHand: ["9S", "KD"], computerHand: ["4C", "5D", "3C"], pendingPenalty: { kind: "black-king", units: 1, cards: 5 }, discardPile: ["KS"], currentSuit: "S" },
      { ...base, playerHand: ["9H"], computerHand: ["4C", "5D", "3C"], pendingPenalty: { kind: "miss-turn" }, discardPile: ["8D"], currentSuit: "D" },
      { ...base, playerHand: ["3S", "4S"], computerHand: ["4C", "5D", "3C"], discardPile: ["9D"], currentSuit: "D" },
    ];
    return cases.map((state) => {
      const advice = tactics.adviseMove(state as never);
      const legal = rules.legalMoves(state as never);
      const okPlay = advice.kind !== "play" || legal.some((m: { type: string; cards?: string[] }) => m.type === "play" && JSON.stringify(m.cards) === JSON.stringify(advice.cards));
      return { kind: advice.kind, headline: advice.headline, reasons: advice.reasons.length, notes: advice.notes.length === state.playerHand.length, okPlay };
    });
  });
  for (const entry of result) { expect(entry.okPlay).toBe(true); expect(entry.reasons).toBeGreaterThan(0); expect(entry.notes).toBe(true); }
  expect(result[1].headline).toMatch(/Play the 9 of hearts/);
  expect(result[2].headline).toMatch(/Play the 2 of spades/);
  expect(result[3].headline).toMatch(/Play the K of diamonds/);
  expect(result[4].kind).toBe("accept");
  expect(result[5].kind).toBe("pickup");
});
