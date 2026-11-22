import { expect, test, type Page } from "@playwright/test";

/**
 * Real games, played to the end through the real table, must leave a replay in which every frame shows every player's
 * hand face up (owner report, 22 Nov 2026: replays were still only showing the card played).
 */

async function openPlay(page: Page, choice: Record<string, unknown>) {
  await page.addInitScript((saved) => {
    try { window.localStorage.setItem("switchTable", JSON.stringify(saved)); window.localStorage.setItem("switchTableSpeed", "quick"); } catch { /* storage unavailable */ }
  }, choice);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Play", exact: true }).click();
}

async function playOn(page: Page, finished: () => Promise<boolean>) {
  const skip = page.getByRole("button", { name: "Skip to the result" });
  const deadline = Date.now() + 280_000;
  while (Date.now() < deadline) {
    if (await finished()) return;
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
    } else await page.locator(".draw-pile").click();
    await page.waitForTimeout(80);
  }
  throw new Error("the game never finished");
}

/** Every frame of every saved replay: are all hands known, and do they add up to the counts? */
const audit = (page: Page) => page.evaluate(async () => {
  const mod = await import("/src/switch/gameReplay.ts");
  return mod.getReplays().map((replay) => {
    const frames = mod.replayFrames(replay);
    const bad = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => !frame.hands || frame.hands.some((hand, seat) => hand.length !== frame.counts[seat])).map(({ index }) => index);
    return { id: replay.id, players: replay.names.length, startHands: !!replay.start.hands, moves: frames.length - 1, badFrames: bad, seconds: replay.seconds ?? null };
  });
});

for (const scenario of [{ name: "head to head", opponents: 1 }, { name: "a table of four", opponents: 3 }]) {
  test(`a real game against the computer (${scenario.name}) replays with every hand at every move`, async ({ page }) => {
    test.setTimeout(400_000);
    await openPlay(page, { opponents: scenario.opponents, level: "standard" });
    await page.getByRole("button", { name: /Deal me in/ }).click();
    await playOn(page, () => page.getByTestId("watch-replay").isVisible());
    const replays = await audit(page);
    expect(replays).toHaveLength(1);
    expect(replays[0].players).toBe(scenario.opponents + 1);
    expect(replays[0].startHands).toBe(true);
    expect(replays[0].badFrames).toEqual([]);
    expect(replays[0].seconds).toBeGreaterThan(0);
    // And the screen itself: every seat's cards are on show.
    await page.getByTestId("watch-replay").click();
    await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill(String(replays[0].moves));
    await expect(page.getByTestId("replay-hands")).toBeVisible();
    await expect(page.getByTestId("replay-no-hands")).toHaveCount(0);
    await expect(page.locator(".replay-hand")).toHaveCount(scenario.opponents + 1);
  });
}

test("a game where players drop out (Last One Out) also replays with every hand", async ({ page }) => {
  test.setTimeout(400_000);
  await openPlay(page, { mode: "lastout", opponents: 2, level: "standard" });
  await page.getByRole("button", { name: /Start Last One Out/ }).click();
  await page.getByTestId("series-play").click();
  await playOn(page, () => page.getByTestId("series-continue").isVisible());
  const replays = await audit(page);
  expect(replays.length).toBeGreaterThan(0);
  for (const replay of replays) { expect(replay.startHands).toBe(true); expect(replay.badFrames).toEqual([]); }
});
