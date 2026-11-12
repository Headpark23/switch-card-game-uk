import { expect, test } from "@playwright/test";

test("the referee rules on plays against every pending situation", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const r = await import("/src/switch/referee.ts");
    return [
      r.refereeRuling("9H", "H", "nothing", "3H").legal, r.refereeRuling("9H", "H", "nothing", "9S").legal,
      r.refereeRuling("9H", "H", "nothing", "3S").legal, r.refereeRuling("9H", "H", "nothing", "AS").legal,
      r.refereeRuling("2H", "H", "draw-two", "2S").legal, r.refereeRuling("2H", "H", "draw-two", "5H").legal,
      r.refereeRuling("KS", "S", "black-king", "KH").legal, r.refereeRuling("KS", "S", "black-king", "5S").legal,
      r.refereeRuling("8H", "H", "miss-turn", "8D").legal, r.refereeRuling("8H", "H", "miss-turn", "3H").legal,
    ];
  });
  expect(out).toEqual([true, true, false, true, true, false, true, false, true, false]);
});

test("the referee on the Questions page answers a play", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByText("Ask the referee: can I play this?").click();
  await page.getByRole("group", { name: "Your card" }).getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("group", { name: "Your suit" }).getByRole("button", { name: "clubs" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No, not the Three of clubs." })).toBeVisible();
  await page.getByRole("group", { name: "Your card" }).getByRole("button", { name: "A", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ace is wild" })).toBeVisible();
});

test("a night invite has an alert and the bring-the-cards reminder", async ({ page }) => {
  await page.goto("/");
  const ics = await page.evaluate(async () => {
    const m = await import("/src/switch/reminder.ts");
    return m.buildNightInvite(new Date(2026, 10, 13, 19, 30), "Switch card night", 2, new Date(Date.UTC(2026, 10, 7)));
  });
  expect(ics).toContain("DTSTART:20261113T193000");
  expect(ics).toContain("DTEND:20261113T213000");
  expect(ics).toContain("TRIGGER:-PT1H");
  expect(ics).toContain("52 cards");
});

test("plan a night opens from the home screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Plan a night" }).click();
  await expect(page.getByRole("button", { name: "Add to calendar" })).toBeVisible();
});

test("the domino hand counter totals the cards left in a hand", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("heading", { name: "Keep every score straight." })).toBeVisible();
  const names = page.getByPlaceholder("Enter name");
  for (let i = 0; i < await names.count(); i += 1) await names.nth(i).fill("Player " + (i + 1));
  await page.getByLabel("Target score").fill("250");
  await page.getByRole("button", { name: "Start Domino" }).click();
  await expect(page.getByLabel("Score for Player 1")).toBeVisible();
  await page.getByText("Count the cards left in a hand").click();
  for (const label of ["Add a K (worth 13)", "Add a 5 (worth 5)", "Add a A (worth 1)"]) await page.getByRole("button", { name: label }).click();
  await expect(page.getByRole("status").filter({ hasText: "19 points from 3 cards" })).toBeVisible();
  await page.getByRole("button", { name: "19 to Player 1" }).click();
  await expect(page.getByLabel("Score for Player 1")).toHaveValue("19");
});

test("the computer level can be changed from the coach sheet and is remembered", async ({ page }) => {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: /Why & tactics: / }).click();
  await page.getByRole("button", { name: /Computer: Standard/ }).click();
  await expect(page.getByRole("button", { name: /Computer: Sharp/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("switchComputerLevel"))).toBe("sharp");
});
