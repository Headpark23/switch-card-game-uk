import { expect, test, type Page } from "@playwright/test";

async function openScorekeeper(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Modes", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("heading", { name: "Keep every score straight." })).toBeVisible();
}

async function fillVisibleNames(page: Page) {
  const names = page.getByPlaceholder("Enter name");
  for (let index = 0; index < await names.count(); index += 1) await names.nth(index).fill(`Player ${index + 1}`);
}

test("named domino scores persist, validate and undo", async ({ page }) => {
  await openScorekeeper(page);
  await expect(page.getByText(/Google sign-in is ready for a client ID/)).toBeVisible();
  await fillVisibleNames(page);
  await page.getByLabel("Target score").fill("250");
  await page.getByRole("button", { name: "Start Domino" }).click();

  await page.getByLabel("Score for Player 1").fill("137");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText("137 points")).toBeVisible();
  await page.getByRole("button", { name: "Undo last score" }).click();
  await expect(page.getByText("0 points").first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Modes", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.locator('input[value="Player 1"]')).toBeVisible();
  await expect(page.locator('input[value="Player 2"]')).toBeVisible();
});

test("unreadable saved scores stay untouched until explicit setup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("switchScoreKeeper", "{broken"));
  await page.reload();
  await page.getByRole("button", { name: "Modes", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("alert")).toContainText("have not been overwritten");
  expect(await page.evaluate(() => localStorage.getItem("switchScoreKeeper"))).toBe("{broken");
});

test("six-player LOST mode reaches one champion", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Knockout" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Knockout" }).click();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "LOST" }).last().click();
  await expect(page.getByText("CHAMPION", { exact: true })).toBeVisible();
});

test("two complete leagues create championship and plate playoffs", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group leagues" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group leagues" }).click();
  await expect(page.getByRole("heading", { name: "Cross-league playoffs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Championship" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plate" })).toBeVisible();
});

test("ten-player Cup draws fixtures and a champion", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Switch Cup" }).click();
  for (let index = 2; index < 10; index += 1) await page.getByRole("button", { name: "More players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Switch Cup" }).click();
  for (let round = 0; round < 4; round += 1) {
    const chooseWinner = page.getByText("Choose winner");
    while (await chooseWinner.count()) {
      const fixture = chooseWinner.first().locator("..");
      await fixture.getByRole("button").first().click();
    }
    const next = page.getByRole("button", { name: "Draw next round" });
    if (await next.count()) await next.click();
  }
  await expect(page.getByText(/is champion/)).toBeVisible();
});
