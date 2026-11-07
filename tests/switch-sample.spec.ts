import { expect, test } from "@playwright/test";

test("sample club fills stats, charts and a league, and removes cleanly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByText("Stats appear after your first saved night.")).toBeVisible();
  await page.getByRole("button", { name: "Load sample club" }).click();
  await expect(page.getByText("Showing sample data. It is not your real record.")).toBeVisible();
  await expect(page.getByText("Stats appear after your first saved night.")).toHaveCount(0);
  await expect(page.getByText("Alex").first()).toBeVisible();

  const counts = await page.evaluate(async () => {
    const raw = JSON.parse(localStorage.getItem("switchScorekeeper") ?? localStorage.getItem(Object.keys(localStorage).find((key) => /scorekeeper/i.test(key)) ?? "") ?? "{}");
    const ext = raw.extensions ?? {};
    return { nights: (ext.switchNightHistory ?? []).length, profiles: (ext.switchProfiles ?? []).length, seasons: (ext.switchSeasons ?? []).length, counted: (ext.switchSeasons?.[0]?.nightIds ?? []).length };
  });
  expect(counts.nights).toBe(18);
  expect(counts.profiles).toBe(5);
  expect(counts.seasons).toBe(1);
  expect(counts.counted).toBeGreaterThan(10);

  await page.getByRole("button", { name: "Remove sample" }).click();
  await expect(page.getByText("Stats appear after your first saved night.")).toBeVisible();
});
