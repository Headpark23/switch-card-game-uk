import { expect, test } from "@playwright/test";

test("every puzzle has at least one legal card and a correct answer is accepted by the real rules", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const p = await import("/src/switch/puzzles.ts");
    return p.puzzles.map((puzzle) => {
      const legal = p.legalCardsFor(puzzle);
      return { id: puzzle.id, legal: legal.length, ok: p.checkAnswer(puzzle, legal).correct, bad: p.checkAnswer(puzzle, []).correct };
    });
  });
  for (const entry of result) { expect(entry.legal, entry.id).toBeGreaterThan(0); expect(entry.ok, entry.id).toBe(true); expect(entry.bad, entry.id).toBe(false); }
});

test("puzzles score a right answer, explain a wrong one and track the streak", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Puzzles", exact: true }).click();
  await expect(page.getByText("PUZZLE 1 OF 12")).toBeVisible();
  for (const card of ["3H", "7C", "2H"]) await page.getByRole("button", { name: card, exact: true }).click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("Spot on.")).toBeVisible();
  await expect(page.getByText("Rookie")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await page.getByRole("button", { name: "9H", exact: true }).click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("Not quite.")).toBeVisible();
});

test("quick night: names, tap round winners, finish, and it lands in history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await page.getByRole("button", { name: /Quick night/ }).click();
  const names = page.getByPlaceholder("Enter name");
  await names.nth(0).fill("Ann"); await names.nth(1).fill("Ben");
  await page.getByRole("button", { name: "Deal the cards" }).click();
  await page.getByRole("button", { name: "Ann won the round" }).click();
  await page.getByRole("button", { name: "Ann won the round" }).click();
  await page.getByRole("button", { name: "Ben won the round" }).click();
  await page.getByRole("button", { name: "Finish the night" }).click();
  await expect(page.getByText("Ann takes the night.")).toBeVisible();
  await page.getByRole("button", { name: "See history" }).click();
  await expect(page.getByText(/Quick night/).first()).toBeVisible();
});

test("dispute chips filter the rule answers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "last card", exact: true }).click();
  await expect(page.getByText(/matching answer/)).toBeVisible();
});

test("a new player is welcomed towards the rules, and the welcome makes way once they have played", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("New to Switch?")).toBeVisible();
  await page.getByRole("button", { name: /New to Switch/ }).click();
  await expect(page.getByRole("heading", { name: /Learn Switch/ })).toBeVisible();
  await page.locator(".rules-back").click();
  await page.evaluate(async () => { const log = await import("/src/switch/logGame.ts"); log.logComputerGame({ id: "cpu-welcome", opponents: 1, level: "standard", won: true, place: 1, moves: 20 }); });
  await page.reload();
  await expect(page.getByText("New to Switch?")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
});
