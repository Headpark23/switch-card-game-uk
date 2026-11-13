import { expect, test, type Page } from "@playwright/test";

async function openScorekeeper(page: Page) {
  await page.goto("/?typedDraw=1");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("heading", { name: "Keep every score straight." })).toBeVisible();
}

async function fillVisibleNames(page: Page) {
  const names = page.getByPlaceholder("Enter name");
  for (let index = 0; index < await names.count(); index += 1) await names.nth(index).fill(`Player ${index + 1}`);
}

test("named domino scores persist, validate and undo", async ({ page }) => {
  await openScorekeeper(page);
  await expect(page.getByText(/Google sign-in is ready for a client ID/)).toHaveCount(0);
  await fillVisibleNames(page);
  await page.getByLabel("Target score").fill("250");
  await page.getByRole("button", { name: "Start Domino" }).click();

  await page.getByLabel("Score for Player 1").fill("137");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText("137 points")).toBeVisible();
  await page.getByRole("button", { name: "Undo last score" }).click();
  await expect(page.getByText("0 points").first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByText("0 points").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo last score" })).toBeDisabled();
});

test("unreadable saved scores stay untouched until explicit setup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("switchScoreKeeper", "{broken"));
  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("alert")).toContainText("have not been overwritten");
  expect(await page.evaluate(() => localStorage.getItem("switchScoreKeeper"))).toBe("{broken");
});

test("six-player LOST mode reaches one champion", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Knock Out", exact: true }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Knock Out" }).click();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "LOST" }).last().click();
  await expect(page.getByText("CHAMPION", { exact: true })).toBeVisible();
});

test("two complete leagues create championship and plate playoffs", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toHaveCount(0);
  // Four rounds per league. Players finish in the same order each time, so nothing is level.
  const places = ["1st", "2nd", "3rd"];
  for (let round = 0; round < 4; round += 1) {
    for (const first of [1, 5]) {
      for (let place = 0; place < 3; place += 1) await page.getByRole("button", { name: `Player ${first + place} finished ${places[place]}` }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
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
    const next = page.getByRole("button", { name: /^(Draw next round|Crown the champion)/ });
    if (await next.count()) await next.click();
  }
  await expect(page.getByText(/is champion/)).toBeVisible();
});

test("a completed night is named, saved once and restored with its result", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("No completed nights saved yet.")).toBeVisible();
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await fillVisibleNames(page);
  await page.getByLabel("Target score").fill("10");
  await page.getByRole("button", { name: "Start Domino" }).click();
  await page.getByLabel("Score for Player 1").fill("10");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByLabel("Night name").fill("Friday Final");
  await page.getByRole("button", { name: "Save completed night" }).dblclick();

  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
  await expect(page.getByText("Friday Final", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Player 1 won", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save completed night" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}").extensions.switchNightHistory)).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Friday Final", { exact: true }).click();
  await expect(page.getByText("Player 1 — 10 points", { exact: true })).toBeVisible();
});

test("history exports and deletes only after confirmation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("switchScoreKeeper", JSON.stringify({
    schemaVersion: 1,
    selectedFormat: "domino",
    players: [],
    scores: {},
    target: 100,
    extensions: {
      keepMe: true,
      switchNightHistory: [{
        version: 1,
        id: "night-1",
        completedAt: "2026-11-06T20:30:00.000Z",
        title: "Family Friday",
        format: "domino",
        formatLabel: "Domino",
        players: [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }],
        winnerIds: ["a"],
        outcome: "Alex won",
        details: [{ heading: "Final scores", lines: ["Alex — 120 points", "Blair — 80 points"] }],
      }],
    },
  })));
  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();

  await page.getByRole("button", { name: "History", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export history" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("switch-night-history.json");

  await page.getByText("Family Friday", { exact: true }).click();
  let prompt = "";
  await page.getByRole("button", { name: "Delete Family Friday" }).click();
  const confirmSheet = page.getByRole("dialog");
  prompt = (await confirmSheet.innerText());
  await confirmSheet.getByRole("button", { name: "Delete night" }).click();
  expect(prompt).toContain("Family Friday");
  await expect(page.getByText("No completed nights saved yet.")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}"));
  expect(saved.extensions.keepMe).toBe(true);
});

for (const device of ["iPhone", "Pixel 10"]) {
  test(`scorekeeper setup shows every option without scrolling on ${device}`, async ({ page }) => {
    await page.goto("/");
    if (device !== "iPhone") {
      await page.getByRole("button", { name: /Preview device/ }).click();
      await page.getByText("Pixel 10").click();
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
    await expect(page.locator(".score-start")).toBeVisible();
    const fit = await page.evaluate(() => {
      const start = document.querySelector(".score-start")!.getBoundingClientRect();
      const tabs = document.querySelector(".bottom-tabs")!.getBoundingClientRect();
      return { startBottom: start.bottom, tabsTop: tabs.top };
    });
    expect(fit.startBottom).toBeLessThanOrEqual(fit.tabsTop);
  });
}

test("a league finished level on points and wins asks for a deciding game", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  const places = ["1st", "2nd", "3rd"];
  // Rounds 1-2 swap the first two places, then rounds 3-4 swap them back, so players 1 and 2 finish level.
  const orders = [[1, 2, 3], [2, 1, 3], [1, 2, 3], [2, 1, 3]];
  for (const order of orders) {
    for (let place = 0; place < 3; place += 1) await page.getByRole("button", { name: `Player ${order[place]} finished ${places[place]}` }).click();
    for (let place = 0; place < 3; place += 1) await page.getByRole("button", { name: `Player ${4 + order[place]} finished ${places[place]}` }).click();
  }
  await expect(page.getByText(/are level on points and round wins. They play one deciding game/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toHaveCount(0);
  await page.getByRole("button", { name: "Player 1 won" }).first().click();
  await page.getByRole("button", { name: "Player 5 won" }).first().click();
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
});

test("Knock Out drops the round's last player each round until one champion remains", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Knock Out", exact: true }).click();
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "More players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Knock Out" }).click();
  for (const left of [6, 5, 4, 3, 2]) {
    await expect(page.getByText(new RegExp(`${left} still playing`))).toBeVisible();
    await page.getByRole("button", { name: "LOST" }).first().click();
  }
  await expect(page.getByText("CHAMPION", { exact: true })).toBeVisible();
  await expect(page.getByText("LOST", { exact: true })).toHaveCount(5);
});

test("One v One is played to a number of games: first to N wins", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "One v One" }).click();
  await expect(page.getByText("Target score")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "First to", exact: true })).toHaveAttribute("aria-pressed", "true");
  await fillVisibleNames(page);
  await page.getByLabel("Games to win").fill("4");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await expect(page.getByText("First to 4 games")).toBeVisible();
  for (let game = 0; game < 3; game += 1) await page.getByRole("button", { name: "Win game" }).first().click();
  for (let game = 0; game < 3; game += 1) await page.getByRole("button", { name: "Win game" }).last().click();
  await expect(page.getByText(/wins the match/)).toHaveCount(0);
  await page.getByRole("button", { name: "Win game" }).first().click();
  await expect(page.getByText("Player 1 wins the match!")).toBeVisible();
  await expect(page.getByText("4 games", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Win game" }).first()).toBeDisabled();
});

test("One v One needs a sensible number of games", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "One v One" }).click();
  await fillVisibleNames(page);
  await page.getByLabel("Games to win").fill("");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await expect(page.getByRole("alert")).toContainText(/how many games/i);
});

test("games scoring rejects bad counts and other formats", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const s = await import("/src/switch/scoring.ts");
    const tryIt = (fn: () => unknown) => { try { fn(); return "ok"; } catch (e) { return (e as Error).message; } };
    return [tryIt(() => s.createSession("head-to-head", ["A", "B"], { firstTo: 0 })), tryIt(() => s.createSession("domino", ["A", "B"], { firstTo: 4 })), s.createSession("head-to-head", ["A", "B"], { firstTo: 4 }).target, s.createSession("head-to-head", ["A", "B"], { bestOf: 9 }).target];
  });
  expect(out[0]).toMatch(/games/);
  expect(out[1]).toMatch(/Only One v One/);
  expect(out[2]).toBe(4);
  expect(out[3]).toBe(5);
});

test("leagues can differ in size: 4, 4 and 3 players, drawn at random", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await page.getByRole("button", { name: "More leagues" }).click();
  await page.getByRole("button", { name: "Fewer players" }).click();
  await expect(page.getByPlaceholder("Enter name")).toHaveCount(11);
  await expect(page.getByRole("region", { name: "League 3 players" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "League 1 players" }).getByRole("listitem")).toHaveCount(4);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Draw leagues at random" }).click();
  await expect(page.getByText("Drawn! Check each league below.")).toBeVisible();
  const drawn: string[] = [];
  const boxes = page.getByPlaceholder("Enter name");
  for (let index = 0; index < await boxes.count(); index += 1) drawn.push(await boxes.nth(index).inputValue());
  expect([...drawn].sort()).toEqual(Array.from({ length: 11 }, (_, index) => `Player ${index + 1}`).sort());
  await page.getByRole("button", { name: "Start Group Play" }).click();
  await expect(page.getByText("Round 1 of 3 · 3 points for 1st down to 1 for last")).toBeVisible();
  await expect(page.getByText("Round 1 of 4 · 4 points for 1st down to 1 for last")).toHaveCount(2);
});

test("a 4, 4 and 3 player league night plays through to playoffs with a plate bye", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await page.getByRole("button", { name: "More leagues" }).click();
  await page.getByRole("button", { name: "Fewer players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  const places = ["1st", "2nd", "3rd"];
  const leagues: [number, number][] = [[1, 4], [5, 4], [9, 3]];
  for (let round = 0; round < 4; round += 1) {
    for (const [first, size] of leagues) {
      if (round >= size) continue;
      for (let place = 0; place < size - 1; place += 1) await page.getByRole("button", { name: `Player ${first + place} finished ${places[place]}` }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
  await expect(page.getByText(/Game 1 of 4/)).toBeVisible();
});

test("the Cup explains the random draw and gives an odd table a bye", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Switch Cup" }).click();
  await expect(page.getByRole("button", { name: "Draw the 1v1s at random" })).toBeVisible();
  await page.getByRole("button", { name: "More players" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Draw the 1v1s at random" }).click();
  await expect(page.getByText("Round 1 draw")).toBeVisible();
  await expect(page.getByText("has a bye")).toBeVisible();
  await page.getByRole("button", { name: "Start Switch Cup" }).click();
  await expect(page.getByText(/has the bye this round/)).toBeVisible();
});

test("One v One can also be played as best of an odd number of games", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "One v One" }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Best of", exact: true }).click();
  await expect(page.getByText("Best of (odd) · first to 4")).toBeVisible();
  await page.getByRole("button", { name: "More games" }).click();
  await expect(page.getByText("Best of (odd) · first to 5")).toBeVisible();
  await page.getByRole("button", { name: "Start One v One" }).click();
  await expect(page.getByText("Best of 9 · first to 5 games")).toBeVisible();
  for (let game = 0; game < 5; game += 1) await page.getByRole("button", { name: "Win game" }).first().click();
  await expect(page.getByText("Player 1 wins the match!")).toBeVisible();
});

async function reopenScorekeeper(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await expect(page.getByRole("heading", { name: "Keep every score straight." })).toBeVisible();
}

test("a saved night stays saved after a reload, and the next match starts at nil", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "One v One" }).click();
  await fillVisibleNames(page);
  await page.getByLabel("Games to win").fill("2");
  await page.getByRole("button", { name: "Start One v One" }).click();
  for (let game = 0; game < 2; game += 1) await page.getByRole("button", { name: "Win game" }).first().click();
  await page.getByRole("button", { name: "Save completed night" }).click();

  await reopenScorekeeper(page);
  // The finished match must not come back to be saved a second time.
  await expect(page.getByRole("button", { name: "Save completed night" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Domino" }).or(page.getByRole("button", { name: "Start One v One" }))).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}").extensions.switchNightHistory)).toHaveLength(1);

  await page.getByRole("button", { name: "One v One", exact: true }).click();
  await page.getByLabel("Games to win").fill("3");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await expect(page.getByText("0 games", { exact: true })).toHaveCount(2);
});

test("changing game type stays changed after a reload", async ({ page }) => {
  await openScorekeeper(page);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Domino" }).click();
  await page.getByLabel("Score for Player 1").fill("30");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByRole("button", { name: "Change game type" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End game" }).click();
  await expect(page.getByRole("button", { name: "Start Domino" })).toBeVisible();

  await reopenScorekeeper(page);
  await expect(page.getByRole("button", { name: "Change game type" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start Domino" }).click();
  await expect(page.getByText("0 points", { exact: true })).toHaveCount(2);
});

test("four leagues of six reach the playoffs without crashing", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  for (let index = 0; index < 2; index += 1) await page.getByRole("button", { name: "More leagues" }).click();
  while (await page.getByRole("button", { name: "More players" }).isEnabled()) await page.getByRole("button", { name: "More players" }).click();
  await expect(page.getByPlaceholder("Enter name")).toHaveCount(24);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  // Each round, tap players in table order; the last place fills itself in.
  for (let guard = 0; guard < 200; guard += 1) {
    const next = page.locator(".league-table button:enabled", { hasText: /^Finished/ }).first();
    if (!await next.count()) break;
    await next.click();
  }
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
  await expect(page.getByText(/Game 1 of 7 · 8 still playing/)).toBeVisible();
  await expect(page.getByText(/Game 1 of 15 · 16 still playing/)).toBeVisible();
});

test("a league night saves only after the playoffs, crediting the champion and plate winner", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  const places = ["1st", "2nd", "3rd"];
  for (let round = 0; round < 4; round += 1) {
    for (const first of [1, 5]) for (let place = 0; place < 3; place += 1) await page.getByRole("button", { name: `Player ${first + place} finished ${places[place]}` }).click();
  }
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save completed night" })).toHaveCount(0);
  await expect(page.getByText(/then the championship and plate knockouts/)).toBeVisible();

  const championship = page.locator(".playoff-group").nth(0);
  const plate = page.locator(".playoff-group").nth(1);
  for (let game = 0; game < 3; game += 1) await championship.getByRole("button", { name: "LOST" }).last().click();
  await expect(page.getByRole("button", { name: "Save completed night" })).toHaveCount(0);
  for (let game = 0; game < 3; game += 1) await plate.getByRole("button", { name: "LOST" }).last().click();

  await expect(page.getByText(/won the championship; .* won the plate/)).toBeVisible();
  await page.getByRole("button", { name: "Save completed night" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") ?? "{}").extensions.switchNightHistory.at(-1));
  expect(saved.winnerIds).toHaveLength(1);
  expect(saved.details.map((section: { heading: string }) => section.heading)).toEqual(["League 1", "League 2", "Championship", "Plate"]);
});

test("a wrong league round can be undone", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  for (const [player, place] of [[1, "1st"], [2, "2nd"], [3, "3rd"]] as const) await page.getByRole("button", { name: `Player ${player} finished ${place}` }).click();
  await expect(page.getByText("Round 2 of 4 · 4 points for 1st down to 1 for last")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo last round" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Undo round" }).click();
  await expect(page.getByText("Round 1 of 4 · 4 points for 1st down to 1 for last")).toHaveCount(2);
  await expect(page.getByText(/^0 points/)).toHaveCount(8);

  // The undo survives a reload.
  await reopenScorekeeper(page);
  await expect(page.getByText("Round 1 of 4 · 4 points for 1st down to 1 for last")).toHaveCount(2);
});

test("the Cup lets you change a result, labels the final and can take back the champion", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Switch Cup" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await expect(page.getByPlaceholder("Enter name")).toHaveCount(4);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Switch Cup" }).click();
  const first = page.locator(".cup-fixture").first();
  await first.getByRole("button").first().click();
  const wrong = await first.locator("button.winner").innerText();
  await first.getByRole("button", { name: /Change the winner of/ }).click();
  await expect(first.locator("button.winner")).toHaveCount(0);
  await first.getByRole("button").nth(1).click();
  await expect(first.locator("button.winner")).not.toHaveText(wrong);

  await page.locator(".cup-fixture").nth(1).getByRole("button").first().click();
  await page.getByRole("button", { name: "Draw next round" }).click();
  await expect(page.locator(".score-status")).toContainText("Final");
  await page.getByRole("button", { name: "Undo the round 2 draw" }).click();
  await expect(page.locator(".score-status")).toContainText("Round 1");
  await page.getByRole("button", { name: "Draw next round" }).click();
  await page.locator(".cup-fixture").first().getByRole("button").first().click();
  await page.getByRole("button", { name: "Crown the champion" }).click();
  await expect(page.getByText(/is champion/)).toBeVisible();
  await page.getByRole("button", { name: "Undo crowning the champion" }).click();
  await expect(page.getByRole("button", { name: "Crown the champion" })).toBeVisible();
});

test("a single league finishes with a final and a plate, and can be saved", async ({ page }) => {
  await openScorekeeper(page);
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await page.getByRole("button", { name: "Fewer leagues" }).click();
  await expect(page.getByPlaceholder("Enter name")).toHaveCount(4);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  const places = ["1st", "2nd", "3rd"];
  for (let round = 0; round < 4; round += 1) for (let place = 0; place < 3; place += 1) await page.getByRole("button", { name: `Player ${place + 1} finished ${places[place]}` }).click();
  await expect(page.getByRole("heading", { name: "Knockout playoffs" })).toBeVisible();
  await expect(page.locator(".playoff-group h3").first()).toHaveText("Final");
  for (const group of [0, 1]) await page.locator(".playoff-group").nth(group).getByRole("button", { name: "LOST" }).last().click();
  await expect(page.getByText("Player 1 won the championship; Player 3 won the plate")).toBeVisible();
  await page.getByRole("button", { name: "Save completed night" }).click();
  await expect(page.getByText("Player 1 won the championship; Player 3 won the plate").first()).toBeVisible();
});

test("starting Group Play without tapping Draw still draws the leagues", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { let seed = 42; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByRole("button", { name: "Group Play", exact: true }).click();
  await fillVisibleNames(page);
  // The draw comes after the names, and nothing is ranked before a round is played.
  const order = await page.locator(".player-fields, .draw-box").evaluateAll((nodes) => nodes.map((node) => node.className));
  expect(order).toEqual(["player-fields", "draw-box"]);
  await page.getByRole("button", { name: "Start Group Play" }).click();
  const leagueOne = await page.locator(".league-table").first().locator(".score-row strong").allInnerTexts();
  expect(leagueOne.some((name) => /^\d\./.test(name))).toBe(false);
  expect(leagueOne).not.toEqual(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const everyone = await page.locator(".league-table .score-row strong").allInnerTexts();
  expect([...everyone].sort()).toEqual(Array.from({ length: 8 }, (_, index) => `Player ${index + 1}`).sort());
});

test("ending a game asks in an in-app sheet, and Cancel keeps the game", async ({ page }) => {
  await openScorekeeper(page);
  await fillVisibleNames(page);
  await page.getByRole("button", { name: "Start Domino" }).click();
  await page.getByRole("button", { name: "Change game type" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("End this game?");
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Score for Player 1")).toBeVisible();
});

test("the back link and the lit bottom tab follow where the scorekeeper was opened from", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start a game night/ }).click();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("button", { name: "Play" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "History", exact: true }).click();
  // Switching sections inside the scorekeeper does not move the bottom tab.
  await expect(nav.getByRole("button", { name: "Play" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page.getByRole("button", { name: /Learn the rules/ })).toBeVisible();

  await nav.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByRole("button", { name: "Back to Play" }).click();
  await expect(page.getByRole("button", { name: "Open the Switch scorekeeper" })).toBeVisible();

  await nav.getByRole("button", { name: "Club" }).click();
  await expect(nav.getByRole("button", { name: "Club" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Club" })).toHaveAttribute("aria-current", "page");
});
