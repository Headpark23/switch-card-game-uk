import { expect, test } from "@playwright/test";

test("the add-to-phone button explains how to install and the manifest is served", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const json = await manifest.json();
  expect(json.display).toBe("standalone");
  for (const icon of json.icons) expect((await request.get(icon.src)).ok()).toBe(true);

  await page.goto("/");
  await page.getByRole("button", { name: /Add Switch to your phone/ }).first().click();
  await expect(page.getByText(/Add to Home screen|Add to Home Screen/).first()).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
});

test("a one-tap install banner shows on the main screens, opens the steps and can be dismissed", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Install Switch" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Add Switch to your phone" }).click();
  await expect(page.getByText(/Add to Home screen|Add to Home Screen/).first()).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await banner.getByRole("button", { name: "Dismiss install banner" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Install Switch" })).toHaveCount(0);
});
