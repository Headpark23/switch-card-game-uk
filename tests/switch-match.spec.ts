import { expect, test } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { createRoom, joinRoom, startRoom, tick } from "../api/_room.js";

/** Online "Games": first to N wins or best of N, in place of a single game. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4_294_967_296; };
}

test("first to N and best of N end at the right moment, and level games play on", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const series = await import("/src/switch/series.ts");
    const play = (setup: object, winners: string[], opponents = 1) => {
      let state = series.startSeries({ mode: "match", opponents, level: "standard", ...setup } as never, () => 0.5, "m", Array.from({ length: opponents + 1 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })));
      const log: boolean[] = [];
      for (const winner of winners) {
        const game = series.pendingGames(state)[0];
        const order = [winner, ...game.playerIds.filter((id: string) => id !== winner)];
        state = series.submitGame(state, game.key, { order, winnerId: winner, points: {}, moves: 1 });
        log.push(series.isSeriesOver(state));
      }
      return { log, outcome: series.seriesOutcome(state)?.winnerId ?? null, next: series.pendingGames(state)[0]?.title ?? null };
    };
    return {
      first3: play({ matchType: "first", games: 3 }, ["p0", "p1", "p0", "p1", "p0"]),
      best5early: play({ matchType: "best", games: 5 }, ["p0", "p0", "p0"]),
      best3: play({ matchType: "best", games: 3 }, ["p0", "p1", "p1"]),
      bestLevel: play({ matchType: "best", games: 3 }, ["p0", "p1", "p2"], 2),
      bestLevelThenLead: play({ matchType: "best", games: 3 }, ["p0", "p1", "p2", "p1"], 2),
      bad: [series.validateSetup({ mode: "match", opponents: 1, level: "standard", matchType: "best", games: 4 } as never, 8), series.validateSetup({ mode: "match", opponents: 1, level: "standard", matchType: "first", games: 3 } as never, 8)],
    };
  });
  expect(report.first3.log).toEqual([false, false, false, false, true]);
  expect(report.first3.outcome).toBe("p0");
  expect(report.best5early.log).toEqual([false, false, true]);
  expect(report.best5early.outcome).toBe("p0");
  expect(report.best3.log).toEqual([false, false, true]);
  expect(report.best3.outcome).toBe("p1");
  // Three players, one win each after three games: nobody is ahead, so a deciding game is dealt.
  expect(report.bestLevel.log).toEqual([false, false, false]);
  expect(report.bestLevel.next).toBe("Deciding game");
  expect(report.bestLevelThenLead.outcome).toBe("p1");
  expect(report.bad[0]).toMatch(/odd/);
  expect(report.bad[1]).toBeNull();
});

test("a table can be set up as best of or first to; one game is just a single game", () => {
  const first = createRoom({ seats: 4, level: "standard", name: "Mark", mode: "match", matchType: "first", games: 3 }, "t", 1);
  expect(first.setup).toMatchObject({ mode: "match", matchType: "first", games: 3 });
  const best = createRoom({ seats: 4, level: "standard", name: "Mark", mode: "match", matchType: "best", games: 5 }, "t", 1);
  expect(best.setup).toMatchObject({ mode: "match", matchType: "best", games: 5 });
  expect(createRoom({ seats: 4, level: "standard", name: "Mark", mode: "match", matchType: "first", games: 1 }, "t", 1).setup).toEqual({ mode: "single" });
  expect(createRoom({ seats: 4, level: "standard", name: "Mark" }, "t", 1).setup).toEqual({ mode: "single" });
  expect(() => createRoom({ seats: 4, level: "standard", name: "Mark", mode: "match", matchType: "best", games: 4 }, "t", 1)).toThrow(/odd/);
  expect(() => createRoom({ seats: 12, level: "standard", name: "Mark", mode: "match", matchType: "best", games: 3 }, "t", 1)).toThrow(/up to 6/);
});

test("a best of 3 table plays several games and announces the winner", () => {
  const random = seeded(7);
  const start = 1_000_000;
  const room = createRoom({ seats: 3, level: "standard", name: "Mark", mode: "match", matchType: "best", games: 3 }, "t", start);
  joinRoom(room, "Rebecca", "t2", start);
  startRoom(room, 0, start, random);
  expect(room.series.kind).toBe("match");
  for (const seat of room.seats) seat.kind = "computer";
  for (let step = 1; step <= 3000 && room.status !== "finished"; step += 1) tick(room, start + step * 25_000, random);
  expect(room.status).toBe("finished");
  expect(room.series.base.games).toBeGreaterThanOrEqual(2);
  expect(room.news.some((entry: { text: string }) => /wins the match/.test(entry.text))).toBe(true);
});

test("the lobby offers First to and Best of instead of a single game, and the table shows the choice", async ({ browser }) => {
  const store = (await import("../api/_room.js") as { memoryStore: () => unknown }).memoryStore();
  const { handleRoom } = await import("../api/_room.js") as { handleRoom: (req: Request, store: unknown) => Promise<Response> };
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await context.route("**/api/room**", async (route) => {
    const req = route.request();
    const response = await handleRoom(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }), store);
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByTestId("play-friends").click();
  await page.getByRole("button", { name: /Start a table/ }).click();
  await expect(page.getByRole("button", { name: "Single game" })).toHaveCount(0);
  await page.getByLabel("Your name at the table").fill("Mark");
  await page.getByRole("button", { name: "Best of", exact: true }).click();
  await page.getByRole("button", { name: "Best of 5" }).click();
  await expect(page.getByTestId("match-note")).toContainText("Best of 5 games");
  await page.getByRole("button", { name: /Set up the table/ }).click();
  await expect(page.getByTestId("table-mode")).toContainText("Best of 5 games");
  await context.close();
});
