import { expect, test, type Page } from "@playwright/test";

async function openClubhouse(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
}

test("score setup creates and reuses stable local profiles", async ({ page }) => {
  await openClubhouse(page);
  const names = page.getByPlaceholder("Enter name");
  await names.nth(0).fill("Alex");
  await names.nth(1).fill("Blair");
  await page.getByRole("button", { name: "Start Domino" }).click();

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}"));
  expect(saved.extensions.switchProfiles).toHaveLength(2);
  const alexId = saved.extensions.switchProfiles.find((profile: { name: string }) => profile.name === "Alex").id;
  expect(saved.players[0].id).toBe(alexId);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Change game type" }).click();
  await expect(page.getByRole("button", { name: "Use saved player Alex" })).toBeVisible();
  await names.nth(0).fill(" alex ");
  await page.getByRole("button", { name: "Start Domino" }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}"));
  expect(saved.extensions.switchProfiles).toHaveLength(2);
  expect(saved.players[0].id).toBe(alexId);
});

test("stats show real saved performance, chart values, form and milestones", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const profiles = [
      { version: 1, id: "alex", name: "Alex", colour: "forest", createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1, id: "blair", name: "Blair", colour: "gold", createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const night = (id: string, month: number, winnerId: string) => ({ version: 1, id, completedAt: `2026-0${month}-01T20:00:00.000Z`, title: `Night ${id}`, format: month === 2 ? "cup" : "domino", formatLabel: "Switch", players: profiles.map(({ id: playerId, name }) => ({ id: playerId, name })), winnerIds: [winnerId], outcome: `${winnerId} won`, details: [] });
    localStorage.setItem("switchScoreKeeper", JSON.stringify({ schemaVersion: 1, selectedFormat: "domino", players: [], scores: {}, target: 100, extensions: { switchProfiles: profiles, switchNightHistory: [night("3", 3, "alex"), night("2", 2, "blair"), night("1", 1, "alex")] } }));
  });
  await openClubhouse(page);
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Alex's record" })).toBeVisible();
  await expect(page.getByText("67%", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Alex wins over six months")).toBeVisible();
  await expect(page.getByText("W L W", { exact: true })).toBeVisible();
  await expect(page.getByText("First win", { exact: true })).toBeVisible();
});

test("league seasons count eligible history once and lock when completed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const profiles = [
      { version: 1, id: "alex", name: "Alex", colour: "forest", createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1, id: "blair", name: "Blair", colour: "gold", createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const history = [{ version: 1, id: "night-1", completedAt: "2026-11-01T20:00:00.000Z", title: "Family Friday", format: "domino", formatLabel: "Domino", players: profiles.map(({ id, name }) => ({ id, name })), winnerIds: ["alex"], outcome: "Alex won", details: [] }];
    localStorage.setItem("switchScoreKeeper", JSON.stringify({ schemaVersion: 1, selectedFormat: "domino", players: [], scores: {}, target: 100, extensions: { switchProfiles: profiles, switchNightHistory: history } }));
  });
  await openClubhouse(page);
  await page.getByRole("button", { name: "Leagues", exact: true }).click();
  await page.getByLabel("League name").fill("Family League");
  await page.getByRole("button", { name: "Create league season" }).click();
  await page.getByRole("button", { name: "Count Family Friday in Family League" }).dblclick();

  await expect(page.getByRole("row", { name: /1 Alex 1 1 3/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /2 Blair 1 0 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Count Family Friday in Family League" })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete Family League" }).click();
  await expect(page.getByText("Season complete", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Family Friday", { exact: true })).toBeVisible();
});

test("a backup file can be downloaded and restored, and a wrong file changes nothing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const profiles = [{ version: 1, id: "alex", name: "Alex", colour: "forest", createdAt: "2026-01-01T00:00:00.000Z", archived: false }];
    localStorage.setItem("switchScoreKeeper", JSON.stringify({ schemaVersion: 1, selectedFormat: "domino", players: [], scores: {}, target: 100, extensions: { switchProfiles: profiles } }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Back up everything/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^switch-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
  expect(JSON.parse(backup).extensions.switchProfiles[0].name).toBe("Alex");

  // A file that is not a Switch backup is rejected and nothing is overwritten.
  await page.getByLabel("Restore backup file").setInputFiles({ name: "nope.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText("That file is not a Switch backup, so nothing was changed.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper")!).extensions.switchProfiles[0].name)).toBe("Alex");

  // Wipe the device, then restore from the backup.
  await page.evaluate(() => localStorage.removeItem("switchScoreKeeper"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restore backup file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}").extensions?.switchProfiles?.[0]?.name)).toBe("Alex");
});
