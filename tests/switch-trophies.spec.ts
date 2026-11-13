import { expect, test } from "@playwright/test";

test("trophy tiers grow with table size and tournaments", async ({ page }) => {
  await page.goto("/");
  const tiers = await page.evaluate(async () => {
    const t = await import("/src/switch/trophies.ts");
    return [t.trophyTier("domino", 2), t.trophyTier("darts", 3), t.trophyTier("knockout", 3), t.trophyTier("knockout", 4), t.trophyTier("cup", 5)];
  });
  expect(tiers).toEqual(["bronze", "silver", "gold", "platinum", "grand"]);
});

test("the trophy room fills from the sample club and shows badges", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Club", exact: true }).click();
  await page.getByRole("button", { name: "Trophies", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Win a night to start your collection." })).toBeVisible();
  await page.getByRole("button", { name: "Load sample club" }).click();
  await expect(page.getByRole("heading", { name: /trophy room$/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Trophies won" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Game nights badges" }).locator("li").first()).toBeVisible();
  await expect(page.locator(".badge.earned").first()).toBeVisible();
  await expect(page.locator(".badge.locked").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove sample" }).click();
  await expect(page.getByRole("heading", { name: "Win a night to start your collection." })).toBeVisible();
});
