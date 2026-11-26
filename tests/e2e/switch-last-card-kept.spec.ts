import { expect, test, type Page } from "@playwright/test";

/**
 * Owner reports, 18 Nov 2026: "I pressed Last Card and it forgot, then gave me two cards."
 * A call you have made stays made until you pick up cards or play your hand down to two or more.
 * Accepting a missed turn (an eight played at you) picks nothing up, so it must not lose the call.
 */

type Seed = { hands: string[][]; discard: string[]; suit: string; turn: number; draw?: string[] };

async function seedTable(page: Page, seed: Seed) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchTableSpeed", "quick");
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-test-game", opponents: seed.hands.length - 1, level: "standard", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: seed.hands, drawPile: seed.draw ?? ["5D", "8C", "JD", "QS", "KD", "7C", "9S", "10H"], discardPile: seed.discard, currentSuit: seed.suit, turn: seed.turn, direction: 1, dealer: 0, pendingPenalty: null, status: "playing", winner: null, move: 3 },
    }));
  }, seed);
}

async function resume(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await expect(page.locator(".table-game")).toBeVisible();
}

test("a Last Card call survives accepting a missed turn (an eight played at you)", async ({ page }) => {
  // The computer's only legal play is the eight of hearts, which makes you miss a turn. You have no eight.
  await seedTable(page, { hands: [["9H", "4C"], ["8H", "3S"]], discard: ["4D", "6H"], suit: "H", turn: 0 });
  await resume(page);
  await page.getByTestId("last-card-button").click();
  await page.getByRole("button", { name: /Select Nine of hearts/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByRole("button", { name: "Accept missed turn" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("last-card-button")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Accept missed turn" }).click();
  // Still called, and the computer never gets to catch you out however long it waits.
  await expect(page.getByTestId("last-card-button")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(6000);
  await expect(page.locator(".player-hand button")).toHaveCount(1);
});

test("playing two 7s as your last two cards keeps your Last Card call for the forced pickup (called before)", async ({ page }) => {
  await seedTable(page, { hands: [["7H", "7C"], ["3C", "4C", "8C"]], discard: ["4D", "6H"], suit: "H", turn: 0 });
  await resume(page);
  await page.getByRole("button", { name: /Select Seven of hearts/ }).click();
  await page.getByTestId("last-card-button").click();
  await page.getByRole("button", { name: /Select Seven of clubs/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.locator(".player-hand button")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.getByTestId("last-card-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("haha-banner")).toHaveCount(0);
  await page.waitForTimeout(6000);
  await expect(page.locator(".player-hand button")).toHaveCount(1);
  await expect(page.getByTestId("haha-banner")).toHaveCount(0);
});

test("playing two 7s as your last two cards recognises Last Card pressed after selecting both", async ({ page }) => {
  await seedTable(page, { hands: [["7H", "7C"], ["3C", "4C", "8C"]], discard: ["4D", "6H"], suit: "H", turn: 0 });
  await resume(page);
  await page.getByRole("button", { name: /Select Seven of hearts/ }).click();
  await page.getByRole("button", { name: /Select Seven of clubs/ }).click();
  await page.getByTestId("last-card-button").click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.locator(".player-hand button")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.getByTestId("last-card-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("haha-banner")).toHaveCount(0);
  await page.waitForTimeout(6000);
  await expect(page.locator(".player-hand button")).toHaveCount(1);
});

test("playing two 7s without calling Last Card still gives the two-card penalty on top of the forced pickup", async ({ page }) => {
  await seedTable(page, { hands: [["7H", "7C"], ["3C", "4C", "8C"]], discard: ["4D", "6H"], suit: "H", turn: 0 });
  await resume(page);
  await page.getByRole("button", { name: /Select Seven of hearts/ }).click();
  await page.getByRole("button", { name: /Select Seven of clubs/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByTestId("haha-banner")).toContainText("HAHA - you never said Last Card");
  await expect(page.locator(".player-hand button")).toHaveCount(3, { timeout: 10_000 });
});
