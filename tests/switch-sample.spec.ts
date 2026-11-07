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

test("the bottom bar has five tabs and Club opens stats, leagues and history", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("button")).toHaveCount(5);
  await nav.getByRole("button", { name: "Club" }).click();
  await expect(nav.getByRole("button", { name: "Club" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Leagues", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Club" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: "Play" }).click();
  await expect(nav.getByRole("button", { name: "Play" })).toHaveAttribute("aria-current", "page");
});

test("every card face is a real image of the same shape", async ({ page }) => {
  await page.goto("/");
  const shapes = await page.evaluate(async () => {
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const out = new Set<string>();
    for (const suit of ["S", "H", "D", "C"]) for (const rank of ranks) {
      const img = new Image(); img.src = `/images/cards/${rank}${suit}.webp`; await img.decode();
      out.add(`${img.naturalWidth}x${img.naturalHeight}`);
    }
    const back = new Image(); back.src = "/images/cards/back.webp"; await back.decode();
    out.add(`${back.naturalWidth}x${back.naturalHeight}`);
    return [...out];
  });
  expect(shapes).toEqual(["256x372"]);
});
