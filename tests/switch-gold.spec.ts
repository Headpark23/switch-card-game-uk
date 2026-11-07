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
  await page.getByRole("button", { name: "Quick night", exact: true }).click();
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

test("the welcome card appears once and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("New here? Start with the five moves.")).toBeVisible();
  await page.getByRole("button", { name: /Learn the rules/ }).click();
  await page.getByRole("button", { name: "Home" }).click();
  await page.reload();
  await expect(page.getByText("New here? Start with the five moves.")).toHaveCount(0);
});
