import { expect, test, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const profiles = [["alex", "Alex"], ["blair", "Blair"], ["casey", "Casey"]].map(([id, name]) => ({ version: 1, id, name, colour: "forest", createdAt: "2026-01-01T00:00:00.000Z", archived: false }));
    const winners = ["alex", "blair", "alex", "casey", "alex"];
    const nights = winners.map((winner, i) => ({ version: 1, id: `n${i}`, completedAt: `2026-0${i + 1}-05T20:00:00.000Z`, title: `Friday night ${i + 1}`, format: "domino", formatLabel: "Domino", players: profiles.map(({ id, name }) => ({ id, name })), winnerIds: [winner], outcome: `${winner} won`, details: [] }));
    localStorage.setItem("switchScoreKeeper", JSON.stringify({ schemaVersion: 1, selectedFormat: "domino", players: [], scores: {}, target: 100, extensions: { switchProfiles: profiles, switchNightHistory: nights } }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Stats", exact: true }).first().click();
}

test("the leaderboard ranks by real wins and crowns the leader", async ({ page }) => {
  await seed(page);
  const rows = page.getByRole("list", { name: "Club leaderboard" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Alex");
  await expect(rows.first()).toContainText("3 wins · 60%");
  await expect(rows.first().getByLabel("Leader")).toBeVisible();
});

test("a club name appears in the header and on the leaderboard", async ({ page }) => {
  await seed(page);
  await page.getByText("Name your club").click();
  await page.getByLabel("Club name").fill("The Friday Club");
  await page.getByRole("button", { name: "Save club name" }).click();
  await expect(page.getByRole("heading", { name: "The Friday Club leaderboard" })).toBeVisible();
  await expect(page.getByText("THE FRIDAY CLUB", { exact: true })).toBeVisible();
});

test("share buttons make a real PNG picture", async ({ page }) => {
  await seed(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share the leaderboard" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("switch-leaderboard.png");
  const bytes = await (await import("node:fs/promises")).readFile((await file.path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(bytes.length).toBeGreaterThan(10_000);
  await expect(page.getByText("Picture saved. Send it to the group chat.")).toBeVisible();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Friday night 1").click();
  const night = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share this night" }).click();
  expect((await night).suggestedFilename()).toBe("switch-friday-night-1.png");
});
