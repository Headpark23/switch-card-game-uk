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

/**
 * Takes your turns the simplest legal way until the game ends and "Continue" appears (or the whole series is over).
 * Once you are out, it skips to the result as a player would, instead of watching the computers play on. It allows a
 * set time rather than a set number of checks, because every move is shown step by step and a long game is not a stuck one.
 */
async function playUntilGameEnds(page: Page) {
  const done = page.getByTestId("series-continue");
  const skip = page.getByRole("button", { name: "Skip to the result" });
  const deadline = Date.now() + 280_000;
  while (Date.now() < deadline) {
    if (await done.isVisible()) return;
    if (await skip.isVisible()) { await skip.click(); continue; }
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

test("the picker offers every game type, 1 to 5 computers (one deck, ruling 38), and never a table a type cannot run", async ({ page }) => {
  await openPlay(page, {});
  const types = page.getByRole("group", { name: "Game type" });
  for (const name of ["Games", "Last One Out", "Group Play", "Switch Cup", "Darts scoring", "Dominoes scoring"]) await expect(types.getByRole("button", { name })).toBeVisible();
  const opponents = page.getByRole("group", { name: "Computer opponents" });
  await expect(opponents.getByRole("button")).toHaveCount(5);
  await types.getByRole("button", { name: "Group Play" }).click();
  // Group Play needs 6 players: 1 to 4 computers are unavailable, 5 is the only choice.
  await expect(opponents.getByRole("button", { name: "4 opponents" })).toBeDisabled();
  await expect(opponents.getByRole("button", { name: "5 opponents" })).toBeEnabled();
  await opponents.getByRole("button", { name: "5 opponents" }).click();
  // Nobody picked: five computers are a surprise until the cards are dealt.
  await expect(page.locator(".lobby-seat")).toHaveText(["?", "?", "?", "?", "?"]);
  for (const name of ["Paul", "Ringo", "Ziggy", "Marley", "Bowie"]) await page.getByRole("group", { name: "Who you are playing" }).getByRole("button", { name: `Pick ${name}` }).click();
  await expect(page.locator(".lobby-seat")).toHaveText(["Paul", "Ringo", "Ziggy", "Marley", "Bowie"]);
  await expect(page.getByText(/two decks/)).toHaveCount(0);
  await types.getByRole("button", { name: "Dominoes scoring" }).click();
  await expect(page.getByTestId("domino-limit")).toHaveText("100");
  await page.getByRole("button", { name: "Raise the number by 10" }).click();
  await expect(page.getByTestId("domino-limit")).toHaveText("110");
  await types.getByRole("button", { name: "Darts scoring" }).click();
  await expect(page.getByRole("group", { name: "Sets to win" })).toBeVisible();
});

test("Dominoes scoring is played to the end at the table and lands in your stats", async ({ page }) => {
  test.setTimeout(600_000);
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

test("against the computer, Games replaces Single game: First to / Best of and a count, one game being a single game", async ({ page }) => {
  await openPlay(page, {});
  await expect(page.getByRole("group", { name: "Game type" }).getByRole("button", { name: "Single game" })).toHaveCount(0);
  const count = page.getByRole("group", { name: "Number of games" });
  // The default is one game, dealt exactly as before.
  await expect(page.getByTestId("match-note")).toContainText("Single game");
  await expect(page.getByRole("button", { name: /Deal me in/ })).toBeVisible();
  await count.getByRole("button", { name: "Best of" }).click();
  await expect(count.getByRole("button", { name: "Best of 3" })).toBeVisible();
  await count.getByRole("button", { name: "Best of 5" }).click();
  await expect(page.getByTestId("match-note")).toContainText("Best of 5 games");
  await expect(page.getByRole("button", { name: "Start Best of 5 games" })).toBeVisible();
  await count.getByRole("button", { name: "First to" }).click();
  await expect(count.getByRole("button", { name: "First to 5" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Start First to 5 wins" })).toBeVisible();
});

test("a First to 2 match against the computer is played to the end and lands in your stats as Games", async ({ page }) => {
  test.setTimeout(600_000);
  await openPlay(page, { mode: "match", matchType: "first", games: 2, opponents: 1, level: "relaxed" });
  await page.getByRole("button", { name: "Start First to 2 wins" }).click();
  for (let round = 0; round < 6; round += 1) {
    if (await page.getByTestId("series-result").isVisible()) break;
    await page.getByTestId("series-play").click();
    await playUntilGameEnds(page);
    await page.getByTestId("series-continue").click();
  }
  await expect(page.getByTestId("series-result")).toBeVisible();
  const list = await games(page);
  expect(list.every((game) => game.mode === "match")).toBe(true);
  expect(list.filter((game) => game.series)).toHaveLength(1);
});

test("every game type says what it is, and opening one explains how it plays and scores", async ({ page }) => {
  await openPlay(page, {});
  const types = page.getByRole("group", { name: "Game type" });
  // Each type carries a short description before you even choose it.
  await expect(types.getByText("The last player still holding cards drops out", { exact: false })).toHaveCount(0);
  await expect(types.getByText(/Everyone plays. The last player still holding cards drops out/)).toBeVisible();
  await expect(types.getByText(/Two leagues, then the championship and plate/)).toBeVisible();
  await types.getByRole("button", { name: "Last One Out" }).click();
  const detail = page.getByTestId("mode-detail");
  await expect(detail).toContainText("How Last One Out plays");
  await expect(detail).toContainText("five become four, four become three");
  await expect(detail).toContainText("Scoring.");
  await types.getByRole("button", { name: "Group Play" }).click();
  await expect(detail).toContainText("the first out scores as many points as there are players in the league");
  await types.getByRole("button", { name: "Dominoes scoring" }).click();
  await expect(detail).toContainText("Ace is 1 up to king 13");
});

test("you can pick which computers to play, or leave it to chance, and a picked table is the one you get", async ({ page }) => {
  test.setTimeout(240_000);
  await openPlay(page, { mode: "lastout", opponents: 3, level: "relaxed" });
  const who = page.getByRole("group", { name: "Who you are playing" });
  await expect(page.getByTestId("picker-note")).toContainText("Surprise me");
  await who.getByRole("button", { name: "Pick Bowie" }).click();
  await who.getByRole("button", { name: "Pick Marley" }).click();
  await expect(page.getByTestId("picker-note")).toContainText("Bowie, Marley picked. 1 more seat is drawn at random.");
  await who.getByRole("button", { name: "Pick John" }).click();
  // The table is full: nobody else can be picked until someone is removed.
  await expect(who.getByRole("button", { name: "Pick Ringo" })).toBeDisabled();
  await expect(page.locator(".lobby-seat")).toHaveText(["Bowie", "Marley", "John"]);
  await who.getByRole("button", { name: "Pick at random" }).click();
  await expect(page.locator(".lobby-seat")).toHaveText(["?", "?", "?"]);
  await who.getByRole("button", { name: "Pick Bowie" }).click();
  await who.getByRole("button", { name: "Pick Ziggy" }).click();
  await page.getByRole("button", { name: /Start Last One Out/ }).click();
  await expect(page.getByTestId("series-play")).toBeVisible();
  // Bowie and Ziggy are on the standings, with one more computer drawn.
  const board = page.locator(".series-board");
  await expect(board).toContainText("Bowie");
  await expect(board).toContainText("Ziggy");
});

test("Last One Out: the last player holding cards drops out, game after game, until one is left", async ({ page }) => {
  test.setTimeout(600_000);
  await openPlay(page, { mode: "lastout", opponents: 2, level: "relaxed" });
  await page.getByRole("button", { name: /Start Last One Out/ }).click();
  for (let round = 0; round < 4; round += 1) {
    await expect(page.getByTestId("series-play").or(page.getByTestId("series-result"))).toBeVisible();
    if (await page.getByTestId("series-result").isVisible()) break;
    await page.getByTestId("series-play").click();
    await playUntilGameEnds(page);
    await page.getByTestId("series-continue").click();
  }
  await expect(page.getByTestId("series-result")).toBeVisible();
  const list = await games(page);
  expect(list.every((game) => game.mode === "lastout")).toBe(true);
  expect(list.filter((game) => game.series)).toHaveLength(1);
});

test("Last One Out lets you choose how many rounds to win: a one-off game or first to several", async ({ page }) => {
  await openPlay(page, { mode: "lastout", opponents: 2, level: "relaxed" });
  const rounds = page.getByRole("group", { name: "Rounds to win" });
  await expect(rounds.getByRole("button", { name: "One-off game" })).toHaveAttribute("aria-pressed", "true");
  await rounds.getByRole("button", { name: "First to 3 round wins" }).click();
  await expect(page.getByTestId("rounds-note")).toContainText("First to 3 round wins takes the series");
  await page.getByRole("button", { name: /Start Last One Out · first to 3 round wins/ }).click();
  await expect(page.getByTestId("series-play")).toBeVisible();
  await expect(page.locator(".series-board")).toContainText("Round 1 · first to 3 round wins");
});
