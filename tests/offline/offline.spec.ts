import { expect, test } from "@playwright/test";

test("after one visit the app works with no network, including saved nights", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Give the app time to save its files.
  await expect.poll(async () => page.evaluate(async () => (await (await caches.open("switch-offline-v3")).keys()).length), { timeout: 15_000 }).toBeGreaterThan(60);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start a game night" })).toBeVisible();

  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByText(/GUIDED GAME/)).toBeVisible();
  await expect(page.locator("img.playing-card").first()).toBeVisible();
  expect(await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))).toBe(true);

  // No guidance card covers the table any more; the quiet coach strip is there instead.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Exit game" }).click();
  await page.getByRole("button", { name: "Start a game night" }).click();
  await expect(page.getByPlaceholder("Enter name").first()).toBeVisible();
});
