import { expect, test } from "@playwright/test";

// Every computer game type is played end to end through the real series module, with the engine playing your seat too.
test.setTimeout(120_000);

test("every game type finishes for every table size it allows, with a clean finishing order", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const series = await import("/src/switch/series.ts");
    const problems: string[] = [];
    const runs: Record<string, number> = {};
    for (const info of series.MODES.filter((mode) => mode.id !== "single")) {
      for (let players = info.minPlayers; players <= info.maxPlayers; players += 1) {
        const setup = { mode: info.id, opponents: players - 1, level: "standard", setsToWin: 3, limit: 60 };
        let state = series.startSeries(setup, Math.random);
        let guard = 0;
        while (!series.isSeriesOver(state) && guard < 400) {
          guard += 1;
          const waiting = series.pendingGames(state)[0];
          if (!waiting) { problems.push(`${info.id}/${players}: stuck with nothing to play`); break; }
          const result = series.simulateGame(waiting.playerIds, "standard", Math.random);
          if (new Set(result.order).size !== waiting.playerIds.length) problems.push(`${info.id}/${players}: result order is not everyone once`);
          state = series.submitGame(state, waiting.key, result);
        }
        const outcome = series.seriesOutcome(state);
        if (!outcome) { problems.push(`${info.id}/${players}: did not finish`); continue; }
        if (new Set(outcome.order).size !== players) problems.push(`${info.id}/${players}: finishing order is not everyone once (${outcome.order.join(",")})`);
        if (outcome.order[0] !== outcome.winnerId) problems.push(`${info.id}/${players}: winner is not first`);
        runs[`${info.id}/${players}`] = state.base.games;
      }
    }
    return { problems, runs };
  });
  expect(report.problems).toEqual([]);
  expect(Object.keys(report.runs).length).toBeGreaterThan(20);
});

test("dominoes: cards left add up (ace 1 to king 13) and the first to the number loses", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const series = await import("/src/switch/series.ts");
    const values = ["AS", "5H", "10D", "JC", "QS", "KH", "KH'"].map((card) => series.cardValue(card));
    let state = series.startSeries({ mode: "dominoes", opponents: 2, level: "standard", limit: 20 }, () => 0.5);
    const ids = state.base.players.map((player) => player.id);
    const play = (winner: string, points: Record<string, number>) => {
      const order = [winner, ...ids.filter((id) => id !== winner)];
      state = series.submitGame(state, series.pendingGames(state)[0].key, { order, winnerId: winner, points: { ...points, [winner]: 0 }, moves: 30 });
    };
    play("me", { [ids[1]]: 12, [ids[2]]: 6 });
    const afterOne = { ...state.totals, over: state.loserId };
    play(ids[1], { me: 5, [ids[2]]: 14 });
    const afterTwo = { ...state.totals, over: state.loserId };
    return { values, afterOne, afterTwo, outcome: series.seriesOutcome(state), ids };
  });
  expect(out.values).toEqual([1, 5, 10, 11, 12, 13, 13]);
  expect(out.afterOne.over).toBeNull();
  // The third player reached 20 (6 + 14) and loses; the lowest total, 'me' on 5, wins.
  expect(out.afterTwo.over).toBe(out.ids[2]);
  expect(out.outcome?.winnerId).toBe("me");
  expect(out.outcome?.order.at(-1)).toBe(out.ids[2]);
});

test("darts: three legs make a set and the sets decide the match", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const series = await import("/src/switch/series.ts");
    let state = series.startSeries({ mode: "darts", opponents: 1, level: "standard", setsToWin: 3 }, () => 0.5);
    const [me, cpu] = state.base.players.map((player) => player.id);
    const win = (id: string) => { state = series.submitGame(state, series.pendingGames(state)[0].key, { order: [id, id === me ? cpu : me], winnerId: id, points: { [me]: 0, [cpu]: 0 }, moves: 20 }); };
    win(me); win(cpu); win(me); win(me);
    const afterSet = { sets: { ...state.sets }, legs: { ...state.legs } };
    for (let index = 0; index < 6; index += 1) win(me);
    return { afterSet, over: series.isSeriesOver(state), winner: series.seriesOutcome(state)?.winnerId, me };
  });
  expect(out.afterSet.sets.me).toBe(1);
  expect(out.afterSet.legs.me).toBe(0);
  expect(out.over).toBe(true);
  expect(out.winner).toBe(out.me);
});

test("two decks at 7 and 8 players: 104 cards, seven each, no duplicate card ids", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    return [6, 7, 8].map((seats) => {
      const game = table.createTable(seats, Math.random, 0);
      const all = [...game.hands.flat(), ...game.drawPile, ...game.discardPile];
      return { seats, total: all.length, unique: new Set(all).size, hand: game.hands[0].length };
    });
  });
  expect(out).toEqual([
    { seats: 6, total: 52, unique: 52, hand: 7 },
    { seats: 7, total: 104, unique: 104, hand: 7 },
    { seats: 8, total: 104, unique: 104, hand: 7 },
  ]);
});
