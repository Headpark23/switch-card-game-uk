import { expect, test, type Page } from "@playwright/test";

/** Collects what the app posts to the anonymous counter, answering like the server would. */
async function listen(page: Page) {
  const bodies: { events: Record<string, unknown>[] }[] = [];
  await page.route("**/api/stat", async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return { events: () => bodies.flatMap((body) => body.events) };
}

test("the tally says who dealt each penalty card and who picked it up", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createTable, applyTableAction } = await import("/src/switch/table.ts");
    const { emptyTally, tallyMove, tallyForReport } = await import("/src/switch/gameTally.ts");
    const base = createTable(3, () => 0.4, 0);
    const start = { ...base, hands: [["3H", "4H"], ["2H", "9C", "5D"], ["2S", "KD", "6C"]], discardPile: ["5H"], currentSuit: "H" as const, turn: 1, direction: 1 as const, pendingPenalty: null };
    const step = (tally: ReturnType<typeof emptyTally>, state: typeof start, action: unknown) => { const after = applyTableAction(state, action as never); return { tally: tallyMove(tally, state, action as never, after), state: after }; };
    // Computer 1 plays a two, computer 2 stacks another, and you pick up four.
    let run = step(emptyTally(), start, { type: "play", cards: ["2H"] });
    run = step(run.tally, run.state, { type: "play", cards: ["2S"] });
    const stack = run.tally.maxStack;
    run = step(run.tally, run.state, { type: "draw" });
    const afterYou = tallyForReport(run.tally);
    // Now you (with one card) play a two on computer 1, who picks up two.
    const second = { ...start, hands: [["2H", "4H"], ["9C", "5D"], ["6C"]], currentSuit: "H" as const, turn: 0, pendingPenalty: null };
    let run2 = step(emptyTally(), second, { type: "play", cards: ["2H"] });
    run2 = step(run2.tally, run2.state, { type: "draw" });
    return { afterYou, stack, you: tallyForReport(run2.tally), turnAfter: run.state.turn, pending: run.state.pendingPenalty };
  });
  expect(result.stack).toBe(4);
  expect(result.pending).toBeNull();
  // Seat 2 (a computer) played the last two, so the four cards are the computers'. All of them landed on you.
  expect(result.afterYou).toMatchObject({ dealtByCpu: 4, dealtByYou: 0, landedOnYou: 4, landedOnCpu: 0, maxStack: 4 });
  expect(result.afterYou.plays.c).toEqual({ 2: 2 });
  expect(result.you).toMatchObject({ dealtByYou: 2, dealtByCpu: 0, landedOnCpu: 2, landedOnYou: 0 });
  expect(result.you.plays.y).toEqual({ 2: 1 });
});

test("a penalty that hits a player on one card is an Ouch, and a pick-up with nothing pending is an ordinary draw", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createTable, applyTableAction } = await import("/src/switch/table.ts");
    const { emptyTally, tallyMove } = await import("/src/switch/gameTally.ts");
    const base = createTable(2, () => 0.4, 0);
    const state = { ...base, hands: [["3H"], ["2H", "9C"]], discardPile: ["5H"], currentSuit: "H" as const, turn: 1, direction: 1 as const, pendingPenalty: null };
    const afterTwo = applyTableAction(state, { type: "play", cards: ["2H"] } as never);
    const t1 = tallyMove(emptyTally(), state, { type: "play", cards: ["2H"] } as never, afterTwo);
    const afterDraw = applyTableAction(afterTwo, { type: "draw" } as never);
    const t2 = tallyMove(t1, afterTwo, { type: "draw" } as never, afterDraw);
    const quiet = { ...state, turn: 0, hands: [["3H", "9S"], ["4D"]] };
    const afterQuiet = applyTableAction(quiet, { type: "draw" } as never);
    const t3 = tallyMove(emptyTally(), quiet, { type: "draw" } as never, afterQuiet);
    return { ouch: t2.ouches, dealtByCpu: t2.dealtByCpu, landedOnYou: t2.landedOnYou, draws: t3.drawsYou, penalty: t3.landedOnYou };
  });
  expect(result).toEqual({ ouch: 1, dealtByCpu: 2, landedOnYou: 2, draws: 1, penalty: 0 });
});

test("a new phone sends one anonymous open, and a return visit the same day adds nothing identifying", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("switchStatsTest", "1"); } });
  const seen = await listen(page);
  await page.goto("/");
  await expect.poll(() => seen.events().length, { timeout: 6000 }).toBeGreaterThan(0);
  const first = seen.events().find((event) => event.e === "open");
  expect(first).toMatchObject({ e: "open", device: "new", today: true });
  expect(Object.keys(first ?? {}).sort()).toEqual(["device", "e", "installed", "platform", "today"]);
  await page.reload();
  await expect.poll(() => seen.events().filter((event) => event.e === "open").length, { timeout: 6000 }).toBe(2);
  const second = seen.events().filter((event) => event.e === "open")[1];
  expect(second.device).toBeUndefined();
  expect(second.today).toBe(false);
  // Screens are counted by name only.
  expect(seen.events().some((event) => event.e === "view" && event.page === "Learn")).toBe(true);
});

test("turning counting off sends nothing, and an automated browser is never counted by default", async ({ page, browser }) => {
  await page.addInitScript(() => { localStorage.setItem("switchStatsTest", "1"); localStorage.setItem("switchStatsOptOut", "1"); });
  const optedOut = await listen(page);
  await page.goto("/");
  await page.waitForTimeout(2500);
  expect(optedOut.events()).toEqual([]);

  const context = await browser.newContext();
  const robot = await context.newPage();
  const quiet = await listen(robot);
  await robot.goto("/");
  await robot.waitForTimeout(2500);
  expect(quiet.events()).toEqual([]);
  await context.close();
});

test("a phone that already has Switch data is counted as an existing device, not a new one", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("switchStatsTest", "1"); localStorage.setItem("switchWelcome", "1"); } });
  const seen = await listen(page);
  await page.goto("/");
  await expect.poll(() => seen.events().length, { timeout: 6000 }).toBeGreaterThan(0);
  expect(seen.events().find((event) => event.e === "open")).toMatchObject({ device: "existing" });
});

test("a finished game at the table reports its penalty counts once, carrying on from a resumed game", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchStatsTest", "1");
    localStorage.setItem("switchTableSpeed", "quick");
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-stats-game", opponents: 1, level: "sharp", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: [["9C"], ["3D", "4D", "6D"]], drawPile: ["5D", "8C", "JD", "QS", "KD", "7C", "9S", "10H"], discardPile: ["4H", "9H"], currentSuit: "H", turn: 0, direction: 1, dealer: 0, pendingPenalty: null, status: "playing", winner: null, move: 12 },
    }));
    // Counted earlier in the same game, before the app was closed.
    localStorage.setItem("switchStatsTable", JSON.stringify({ id: "cpu-stats-game", tally: { dealtByCpu: 6, dealtByYou: 0, landedOnYou: 6, landedOnCpu: 0, lastCardMissed: 0, ouches: 1, missedYou: 0, missedCpu: 0, drawsYou: 2, drawsCpu: 3, cardsYou: 5, cardsCpu: 6, maxStack: 6, plays: { c: { 2: 3 }, y: {} }, raiser: null, activeMs: 200000 } }));
  });
  const seen = await listen(page);
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await page.getByTestId("last-card-button").click();
  await page.getByRole("button", { name: /Select Nine of clubs/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByRole("heading", { name: /You won the/ })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => seen.events().filter((event) => event.e === "game").length, { timeout: 6000 }).toBe(1);
  const game = seen.events().find((event) => event.e === "game") as Record<string, unknown> & { tally: Record<string, unknown> };
  expect(game).toMatchObject({ opponents: 1, level: "sharp", won: true, place: 1, moves: 13 });
  expect(game.tally).toMatchObject({ dealtByCpu: 6, landedOnYou: 6, ouches: 1, maxStack: 6, cardsYou: 6 });
  expect(game.tally.raiser).toBeUndefined();
  expect(Number(game.seconds)).toBeGreaterThanOrEqual(200);
  // A resumed game is not a new start, and the running tally is put away once the game is over.
  expect(seen.events().some((event) => event.e === "game_start")).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("switchStatsTable"))).toBeNull();
});
