import { expect, test, type Page } from "@playwright/test";

/** Picking up shows cards travelling from the deck to the hand. A penalty is slower, shows its count, and "Ouch!" pops up if it lands on a last card. */
type Seed = { hands: string[][]; discard: string[]; suit: string; pending?: unknown };

async function resumeSeeded(page: Page, seed: Seed) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchTableSpeed", "natural");
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-test-game", opponents: seed.hands.length - 1, level: "standard", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: seed.hands, drawPile: ["5D", "8C", "JD", "QS", "KD", "7C", "2S", "10H", "4S", "3S", "6H", "8D"], discardPile: seed.discard, currentSuit: seed.suit, turn: 0, direction: 1, dealer: 0, pendingPenalty: seed.pending ?? null, status: "playing", winner: null, move: 3 },
    }));
  }, seed);
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await expect(page.locator(".table-game")).toBeVisible();
}

test("a penalty pick-up slides cards from the deck, floats the count, and says Ouch on a last card", async ({ page }) => {
  await resumeSeeded(page, { hands: [["9S"], ["4D", "5D"], ["6D", "9D"]], discard: ["2H"], suit: "H", pending: { kind: "draw-two", cards: 4 } });
  await page.getByRole("button", { name: "Pick up 4 cards" }).click();
  await expect(page.getByTestId("draw-count")).toHaveText("+4");
  await expect(page.getByTestId("ouch")).toHaveText("Ouch!");
  // Four card backs leave the deck, one after another.
  await expect(page.locator(".draw-flier")).toHaveCount(4);
  // The whole pick-up takes its time: a penalty is slower than a single card.
  await expect(page.getByTestId("draw-count")).toHaveCount(0, { timeout: 8_000 });
  await expect(page.locator(".draw-flier")).toHaveCount(0);
  await expect(page.getByText("5 in hand")).toBeVisible();
});

test("a penalty on a player with several cards floats the count but never says Ouch", async ({ page }) => {
  await resumeSeeded(page, { hands: [["9S", "3C", "4C"], ["4D", "5D"], ["6D", "9D"]], discard: ["2H"], suit: "H", pending: { kind: "draw-two", cards: 2 } });
  await page.getByRole("button", { name: "Pick up 2 cards" }).click();
  await expect(page.getByTestId("draw-count")).toHaveText("+2");
  await expect(page.getByTestId("ouch")).toHaveCount(0);
});

test("an ordinary single pick-up slides one card and shows no penalty count", async ({ page }) => {
  await resumeSeeded(page, { hands: [["9S"], ["4D", "5D"], ["6D", "9D"]], discard: ["3H"], suit: "H" });
  await page.getByRole("button", { name: "Draw a card" }).click();
  await expect(page.locator(".draw-flier")).toHaveCount(1);
  await expect(page.getByTestId("draw-count")).toHaveCount(0);
  await expect(page.getByTestId("ouch")).toHaveCount(0);
});
