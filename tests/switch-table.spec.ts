import { expect, test, type Page } from "@playwright/test";

test("a table of two to six keeps 52 unique cards and always finishes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    let seed = 11;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const summary: Record<number, { finished: number; broken: number; reversals: number }> = {};

    for (let seats = 2; seats <= 6; seats += 1) {
      summary[seats] = { finished: 0, broken: 0, reversals: 0 };
      for (let game = 0; game < 120; game += 1) {
        let state = table.createTable(seats, random, game % seats);
        while (state.status === "playing" && state.move < 3000) {
          const all = [...state.hands.flat(), ...state.drawPile, ...state.discardPile];
          if (all.length !== 52 || new Set(all).size !== 52) summary[seats].broken += 1;
          const moves = table.tableLegalMoves(state);
          const plays = moves.filter((move: { type: string }) => move.type === "play");
          const move = plays.length && random() < 0.85
            ? plays[Math.floor(random() * plays.length)]
            : moves.find((m: { type: string }) => m.type !== "play") ?? moves[0];
          const before = state.direction;
          state = table.applyTableAction(state, move);
          if (state.direction !== before) summary[seats].reversals += 1;
        }
        if (state.status === "won") summary[seats].finished += 1;
      }
    }
    return summary;
  });

  for (let seats = 2; seats <= 6; seats += 1) {
    expect(result[seats].finished).toBe(120);
    expect(result[seats].broken).toBe(0);
  }
  expect(result[2].reversals).toBe(0); // two players: a jack means play again
  expect(result[4].reversals).toBeGreaterThan(0);
});

test("jacks reverse with three or more players, sevens repeat, eights skip one seat", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const base = {
      hands: [["JH", "7H", "3C"], ["4D", "5D"], ["6D", "9S"], ["10D", "QS"]],
      drawPile: ["2C", "3C", "4C", "5C", "6C", "7C"],
      discardPile: ["9H"],
      currentSuit: "H",
      turn: 0,
      direction: 1,
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    };
    const isPlay = (card: string) => (m: { type: string; cards?: string[] }) => m.type === "play" && m.cards?.[0] === card;
    const jack = table.applyTableAction(base, { type: "play", cards: ["JH"] });
    const seven = table.applyTableAction(base, { type: "play", cards: ["7H"] });
    const eight = table.applyTableAction(
      { ...base, hands: [["8H", "3C"], ...base.hands.slice(1)] },
      { type: "play", cards: ["8H"] },
    );
    const accepted = table.applyTableAction(eight, { type: "accept-missed-turn" });
    const lastJack = table.tableLegalMoves({ ...base, hands: [["JH"], ...base.hands.slice(1)] });
    const twoPlayerJack = table.tableLegalMoves({ ...base, hands: [["JH"], ["4D"]] });
    return {
      jack: { turn: jack.turn, direction: jack.direction },
      seven: seven.turn,
      eight: { turn: eight.turn, pending: eight.pendingPenalty },
      acceptedTurn: accepted.turn,
      jackCanFinish: lastJack.some(isPlay("JH")),
      jackCanFinishTwoPlayer: twoPlayerJack.some(isPlay("JH")),
    };
  });

  expect(result.jack).toEqual({ turn: 3, direction: -1 });
  expect(result.seven).toBe(0);
  expect(result.eight).toEqual({ turn: 1, pending: { kind: "miss-turn" } });
  expect(result.acceptedTurn).toBe(2);
  expect(result.jackCanFinish).toBe(true);
  expect(result.jackCanFinishTwoPlayer).toBe(false);
});

async function openTable(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Modes", exact: true }).click();
  await page.getByRole("button", { name: "Play with friends on this phone" }).click();
  await expect(page.getByRole("heading", { name: "One phone. Everyone plays." })).toBeVisible();
}

test("pass and play hides each hand behind a cover screen", async ({ page }) => {
  await openTable(page);
  const names = page.getByPlaceholder(/Player \d/);
  await names.nth(0).fill("Alex");
  await names.nth(1).fill("Sam");
  await names.nth(2).fill("Jo");
  await page.getByRole("button", { name: "Deal the cards" }).click();

  await expect(page.getByRole("heading", { name: /up\./ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Players and cards held" })).toContainText("7 cards");
  await expect(page.locator(".player-hand")).toHaveCount(0);

  await page.getByRole("button", { name: /show my hand/ }).click();
  await expect(page.locator(".player-hand button")).toHaveCount(7);

  const legal = page.getByRole("button", { name: /, legal move/ });
  if (await legal.count()) {
    await legal.first().click();
    const chooser = page.getByRole("dialog", { name: "Choose a suit" });
    if (await chooser.isVisible()) await chooser.getByRole("button", { name: /clubs/i }).click();
  } else {
    await page.locator(".draw-pile").click();
  }
  // The turn passes to a cover screen, or a seven keeps the same player: both are valid.
  await expect(page.getByRole("button", { name: /show my hand/ }).or(page.locator(".player-hand")).first()).toBeVisible();
});
