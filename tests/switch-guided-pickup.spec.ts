import { expect, test } from "@playwright/test";

/** Guided practice shows the same pick-up animation as the table: cards slide from the deck, a penalty floats its count, and a last card says Ouch. */
test("forgetting Last Card in practice slides two cards from the deck, floats +2 and says Ouch", async ({ page }) => {
  await page.goto("/?testDeck=lastCard");
  await page.getByRole("button", { name: "Learn rules" }).click();
  await page.getByRole("button", { name: /Guided practice game/ }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();

  await page.getByRole("button", { name: "Select Nine of hearts, legal move" }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByText("One card remaining")).toBeVisible();
  await page.getByRole("button", { name: "Continue without saying it" }).click();

  await expect(page.locator(".draw-count")).toHaveText("+2");
  await expect(page.locator(".ouch")).toHaveText("Ouch!");
  await expect(page.locator(".draw-flier")).toHaveCount(2);
  // They clear away on their own, and the penalty cards are in the hand.
  await expect(page.locator(".draw-count")).toHaveCount(0, { timeout: 8_000 });
  await expect(page.locator(".ouch")).toHaveCount(0);
  await expect(page.getByText("3 cards in your hand")).toBeVisible();
});

test("an ordinary single pick-up in practice slides one card and shows no penalty count", async ({ page }) => {
  await page.goto("/?testDeck=lastCard");
  await page.getByRole("button", { name: "Learn rules" }).click();
  await page.getByRole("button", { name: /Guided practice game/ }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();
  await page.getByRole("button", { name: "Pick up one card instead of playing" }).click();
  await expect(page.locator(".draw-flier")).toHaveCount(1);
  await expect(page.locator(".draw-count")).toHaveCount(0);
  await expect(page.locator(".ouch")).toHaveCount(0);
});
