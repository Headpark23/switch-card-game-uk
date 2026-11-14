import { expect, test, type Page } from "@playwright/test";

// Playing the computer in every game type: the picker, a whole series played at the table, and what lands in your stats.

async function openPlay(page: Page, choice: Record<string, unknown>) {
  await page.addInitScript((saved) => {
    try {
      window.localStorage.setItem("switchTable", JSON.stringify(saved));
      window.localStorage.setItem("switchTableSpeed", "quick");
    } catch { /* storage unavailable */ }
  }, choice);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Play", exact: true }).click();
}

/** Takes your turns the simplest legal way until the game ends and "Continue" appears (or the whole series is over). */
async function playUntilGameEnds(page: Page) {
  const done = page.getByTestId("series-continue");
  for (let turn = 0; turn < 900; turn += 1) {
    if (await done.isVisible()) return;
    const status = (await page.getByTestId("turn-status").textContent({ timeout: 1000 }).catch(() => "")) ?? "";
    if (!status.includes("YOUR MOVE")) { await page.waitForTimeout(120); continue; }
    const hand = page.locator(".player-hand button[data-card]");
    const call = page.getByTestId("last-card-button");
    if ((await hand.count()) <= 2 && (await call.getAttribute("aria-pressed")) !== "true") await call.click();
    const accept = page.getByRole("button", { name: /Accept missed turn/ });
    if (await accept.isVisible()) { await accept.click(); continue; }
    const legal = page.locator('.player-hand button[aria-label$="legal move"]');
    if (await legal.count()) {
      await legal.first().click();
      await page.getByRole("button", { name: /Play selected/ }).click();
      const suit = page.getByRole("dialog", { name: "Choose a suit" });
      if (await suit.isVisible()) await suit.getByRole("button").first().click();
    } else {
      await page.locator(".draw-pile").click();
    }
    await page.waitForTimeout(80);
  }
  throw new Error("the game never finished");
}

const games = (page: Page) => page.evaluate(() => {
  const club = JSON.parse(window.localStorage.getItem("switchClub") ?? "null");
  const raw = window.localStorage.getItem("switchScorekeeper") ?? "";
  void club; void raw;
  const everything = Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)] as const);
  for (const [, value] of everything) {
    try {
      const parsed = JSON.parse(value ?? "null");
      const list = parsed?.extensions?.switchComputerGames;
      if (Array.isArray(list)) return list as { id: string; mode?: string; seriesId?: string; series?: { won: boolean; place: number; players: number } }[];
    } catch { /* not the club */ }
  }
  return [];
});

test("the picker offers every game type, 1 to 7 computers, and never a table a type cannot run", async ({ page }) => {
  await openPlay(page, {});
  const types = page.getByRole("group", { name: "Game type" });
  for (const name of ["Single game", "Knock Out", "Group Play", "Switch Cup", "Darts scoring", "Dominoes scoring"]) await expect(types.getByRole("button", { name })).toBeVisible();
  const opponents = page.getByRole("group", { name: "Computer opponents" });
  await expect(opponents.getByRole("button")).toHaveCount(7);
  await types.getByRole("button", { name: "Group Play" }).click();
  // Group Play needs 6 players at least: 1 to 4 computers are unavailable, 5 to 7 are fine.
  await expect(opponents.getByRole("button", { name: "4 opponents" })).toBeDisabled();
  await expect(opponents.getByRole("button", { name: "5 opponents" })).toBeEnabled();
  await opponents.getByRole("button", { name: "7 opponents" }).click();
  await expect(page.locator(".lobby-seat")).toHaveText(["John", "Paul", "George", "Ringo", "Ziggy", "Marley", "Bowie"]);
  await expect(page.getByText("Seven or eight players use two decks.")).toBeVisible();
  await types.getByRole("button", { name: "Dominoes scoring" }).click();
  await expect(page.getByTestId("domino-limit")).toHaveText("100");
  await page.getByRole("button", { name: "Raise the number by 10" }).click();
  await expect(page.getByTestId("domino-limit")).toHaveText("110");
  await types.getByRole("button", { name: "Darts scoring" }).click();
  await expect(page.getByRole("group", { name: "Sets to win" })).toBeVisible();
});

test("Dominoes scoring is played to the end at the table and lands in your stats", async ({ page }) => {
  test.setTimeout(240_000);
  await openPlay(page, { mode: "dominoes", opponents: 1, level: "relaxed", limit: 10 });
  await page.getByRole("button", { name: /Start Dominoes scoring/ }).click();
  for (let round = 0; round < 12; round += 1) {
    const result = page.getByTestId("series-result");
    if (await result.isVisible()) break;
    await page.getByTestId("series-play").click();
    await playUntilGameEnds(page);
    await page.getByTestId("series-continue").click();
  }
  await expect(page.getByTestId("series-result")).toBeVisible();
  const list = await games(page);
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((game) => game.mode === "dominoes")).toBe(true);
  expect(list.filter((game) => game.series)).toHaveLength(1);
  await page.getByRole("button", { name: /See my stats and trophies/ }).click();
  await page.getByRole("button", { name: /Computer/ }).first().click().catch(() => undefined);
});

test("Knock Out against two computers drops the last player each game until one is left", async ({ page }) => {
  test.setTimeout(240_000);
  await openPlay(page, { mode: "knockout", opponents: 2, level: "relaxed" });
  await page.getByRole("button", { name: /Start Knock Out/ }).click();
  for (let round = 0; round < 4; round += 1) {
    if (await page.getByTestId("series-result").isVisible()) break;
    await page.getByTestId("series-play").click();
    await playUntilGameEnds(page);
    await page.getByTestId("series-continue").click();
  }
  await expect(page.getByTestId("series-result")).toBeVisible();
  const list = await games(page);
  expect(list.every((game) => game.mode === "knockout")).toBe(true);
  expect(list.filter((game) => game.series)).toHaveLength(1);
  expect(list.find((game) => game.series)?.series?.players).toBe(3);
});
