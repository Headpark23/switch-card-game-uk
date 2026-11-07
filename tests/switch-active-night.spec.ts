import { expect, test, type Page } from "@playwright/test";

async function openScorekeeper(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ways to play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
}

async function reopenScorekeeper(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Ways to play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
}

async function fillNames(page: Page) {
  const fields = page.getByPlaceholder("Enter name");
  for (let index = 0; index < await fields.count(); index += 1) await fields.nth(index).pressSequentially(`Player ${index + 1}`);
}

test("active-night storage ignores malformed snapshots and preserves unrelated extensions", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const active = await import("/src/switch/activeNight.ts");
    const malformed = { keepMe: true, switchActiveNight: { version: 1, kind: "score", session: { players: "nope" } } };
    const valid = {
      version: 1,
      kind: "knockout",
      state: { players: [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }, { id: "c", name: "Casey" }], eliminatedIds: ["c"], championId: null },
    };
    const stored = active.putActiveNight(malformed, valid);
    return {
      malformed: active.getActiveNight(malformed),
      valid: active.getActiveNight(stored),
      cleared: active.clearActiveNight(stored),
    };
  });

  expect(result.malformed).toBeNull();
  expect(result.valid).toMatchObject({ version: 1, kind: "knockout", state: { eliminatedIds: ["c"] } });
  expect(result.cleared).toEqual({ keepMe: true });
});

test("an unfinished Domino match resumes after refresh with undo history", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("switchScoreKeeper", JSON.stringify({
    schemaVersion: 1,
    selectedFormat: "domino",
    players: [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }],
    scores: {},
    target: 100,
    extensions: {},
  })));
  await page.reload();
  await page.getByRole("button", { name: "Ways to play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByLabel("Target score").fill("250");
  await page.getByRole("button", { name: "Start Domino" }).click();
  await page.getByLabel("Score for Player 1").fill("37");
  await page.getByRole("button", { name: "Add" }).first().click();

  await reopenScorekeeper(page);
  await expect(page.getByText("37 points", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo last score" })).toBeEnabled();
});

test("Knockout and Cup progress resume after refresh", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Knockout" }).click();
  await fillNames(page);
  await page.getByRole("button", { name: "Start Knockout" }).click();
  await page.getByRole("button", { name: "LOST" }).first().click();
  await reopenScorekeeper(page);
  await expect(page.getByText("2 still playing", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset session" }).click();
  await page.getByRole("button", { name: "Switch Cup" }).click();
  await fillNames(page);
  await page.getByRole("button", { name: "Start Switch Cup" }).click();
  await page.getByText("Choose winner").locator("..").getByRole("button").first().click();
  await reopenScorekeeper(page);
  await expect(page.getByRole("button", { name: "Draw next round" })).toBeVisible();
});

test("partly entered group-league finishing order resumes after refresh", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Tournament Groups" }).click();
  await fillNames(page);
  await page.getByRole("button", { name: "Start Tournament Groups" }).click();
  await page.getByRole("button", { name: "Player 1 finished 1st" }).click();

  await reopenScorekeeper(page);
  await expect(page.getByRole("button", { name: "Player 1 finished 1st" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Player 2 finished 2nd" })).toBeVisible();

  await page.getByRole("button", { name: "Clear this round" }).first().click();
  await reopenScorekeeper(page);
  await expect(page.getByRole("button", { name: "Player 1 finished 1st" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Player 2 finished 1st" })).toBeEnabled();
});

