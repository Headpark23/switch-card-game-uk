import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

test("cards are selected in the player's own order and played with a button", async ({ page }) => {
  await page.goto("/?testDeck=partialKing");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Select King of spades, legal move" }).click();
  await page.getByRole("button", { name: "Select King of hearts as another matching card" }).click();
  await expect(page.getByRole("button", { name: "Deselect King of spades, number 1 in your play" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deselect King of hearts, number 2 in your play" })).toBeVisible();
  await expect(page.getByText(/played in the order you tapped them/)).toBeVisible();
  // nothing has been played until the button is pressed
  await expect(page.getByText(/GUIDED GAME · YOUR TURN/)).toBeVisible();
  await page.getByRole("button", { name: "Deselect King of hearts, number 2 in your play" }).click();
  await expect(page.getByText("1 card selected")).toBeVisible();
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByRole("button", { name: "Select King of spades, legal move" })).toBeVisible();
});

test("an illegal card flashes red and says why", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  const bad = page.getByRole("button", { name: "Select Two of clubs, not currently playable" });
  await bad.click();
  await expect(bad).toHaveClass(/illegal/);
  await expect(page.getByRole("alert")).toContainText(/cannot follow the current card/);
  // a different number cannot join a selection
  await page.getByRole("button", { name: "Select Nine of hearts, legal move" }).click();
  await page.getByRole("button", { name: /Three of clubs, choose only matching nines/ }).click();
  await expect(page.getByRole("alert")).toContainText(/same number or picture/);
});

test("a played card visibly travels from the hand and takes over a second to land", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Select Nine of hearts, legal move" }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  const flights = await page.evaluate(() => document.getAnimations().map((a) => (a.effect as KeyframeEffect).getTiming().duration).filter((d) => Number(d) >= 1300));
  expect(flights.length).toBeGreaterThan(0);
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 9_000 });
});
