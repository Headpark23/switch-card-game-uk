import { expect, test } from "@playwright/test";

// Ruling 24: a league round is played on until every place is decided. With four players the first out gets 4 points,
// the other three keep playing, the next out gets 3, and the last two play for 2 and 1.
test.setTimeout(120_000);

test("a four-player league round plays on: 1st out, then the rest carry on, skipping those who are out", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const start = table.createTable(4, () => 0.3, 3, { playOn: true });
    // Top card 3 of hearts, hearts called. Seat 0 and 1 have one card, seat 2 two, seat 3 two.
    const base = { ...start, hands: [["4H"], ["5H"], ["6H", "9S"], ["9H", "4S"]], discardPile: ["3H"], currentSuit: "H", turn: 0, direction: 1, pendingPenalty: null };
    const play = (state: any, card: string) => table.applyTableAction(state, { type: "play", cards: [card] });
    const afterFirst = play(base, "4H");
    const afterSecond = play(afterFirst, "5H");
    const afterThird = play(afterSecond, "6H");
    const afterFourth = play(afterThird, "9H");
    const last = play(afterFourth, "9S");
    const brief = (state: any) => ({ status: state.status, turn: state.turn, out: state.out, winner: state.winner });
    return {
      first: brief(afterFirst), second: brief(afterSecond), third: brief(afterThird), fourth: brief(afterFourth), last: brief(last),
      order: table.finishingOrder(last), places: table.tablePlaces(last),
      legalForOutSeat: table.tableLegalMoves(afterFirst, 0).length,
    };
  });
  // Seat 0 goes out first and the other three play on; seat 1 is out second and the last two play on.
  expect(out.first).toEqual({ status: "playing", turn: 1, out: [0], winner: null });
  expect(out.second).toEqual({ status: "playing", turn: 2, out: [0, 1], winner: null });
  expect(out.third.turn).toBe(3);
  // Seat 3 plays but is not out: play skips seats 0 and 1, who are out, and goes to seat 2.
  expect(out.fourth).toEqual({ status: "playing", turn: 2, out: [0, 1], winner: null });
  // Seat 2 goes out third, so seat 3, the only one still holding cards, is last. The round is over.
  expect(out.last).toEqual({ status: "won", turn: out.last.turn, out: [0, 1, 2], winner: 0 });
  expect(out.order).toEqual([0, 1, 2, 3]);
  expect(out.places).toEqual([1, 2, 3, 4]);
});

test("a league game scores 4, 3, 2 and 1 in the order players went out, and the game of one table is still one game", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const series = await import("/src/switch/series.ts");
    const table = await import("/src/switch/table.ts");
    const ai = await import("/src/switch/tableAi.ts");
    let state = series.startSeries({ mode: "group", opponents: 7, level: "standard" }, Math.random);
    const waiting = series.pendingGames(state);
    const kinds = { league: waiting.map((game: any) => game.playOn === true) };
    const knockout = series.pendingGames(series.startSeries({ mode: "knockout", opponents: 3, level: "standard" }, Math.random)).map((game: any) => game.playOn === true);
    // Play league A's first game for real, instantly, through the same engine and the same result conversion the table screen uses.
    const game = waiting[0];
    let play = table.createTable(game.playerIds.length, Math.random, 0, { playOn: game.playOn });
    let guard = 0;
    const seenOutTurns: number[] = [];
    while (play.status === "playing" && guard++ < 3000) {
      if ((play.out ?? []).includes(play.turn)) seenOutTurns.push(play.turn);
      play = table.applyTableAction(play, ai.chooseTableAction(play, Math.random, "standard"));
    }
    const result = series.resultOf(play, game.playerIds);
    const before = { ...state.leagues[0].points };
    state = series.submitGame(state, game.key, result);
    const gained = game.playerIds.map((id: string) => state.leagues[0].points[id] - before[id]);
    return { kinds, knockout, order: result.order, ids: game.playerIds, gained, finished: play.status, wins: state.leagues[0].wins, winner: result.winnerId, seenOutTurns, emptyHands: play.hands.filter((hand: string[]) => hand.length === 0).length, size: game.playerIds.length };
  });
  expect(out.kinds.league).toEqual([true, true]);
  expect(out.knockout).toEqual([false]);
  expect(out.finished).toBe("won");
  expect(out.seenOutTurns).toEqual([]);
  // Everyone but the last place went out holding no cards; the last holds cards.
  expect(out.emptyHands).toBe(out.size - 1);
  // 4 players: the player who went out first scores 4, then 3, 2 and 1, whatever cards anyone was left holding.
  expect(out.gained).toEqual(out.ids.map((id: string) => out.size - out.order.indexOf(id)));
  expect([...out.gained].sort()).toEqual(["1", "2", "3", "4"].map(Number).slice(0, out.size).sort());
  expect(out.wins[out.winner]).toBe(1);
});

test("play-on games finish with every place given once at every table size, with all cards accounted for", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const ai = await import("/src/switch/tableAi.ts");
    const problems: string[] = [];
    for (let seats = 2; seats <= 8; seats += 1) {
      for (let round = 0; round < 8; round += 1) {
        let state = table.createTable(seats, Math.random, round % seats, { playOn: true });
        const total = state.hands.flat().length + state.drawPile.length + state.discardPile.length;
        let guard = 0;
        while (state.status === "playing" && guard++ < 6000) {
          if ((state.out ?? []).includes(state.turn)) { problems.push(`${seats}: play reached a player who is out`); break; }
          state = table.applyTableAction(state, ai.chooseTableAction(state, Math.random, round % 2 ? "sharp" : "standard"));
        }
        if (state.status !== "won") { problems.push(`${seats}: did not finish`); continue; }
        const order = table.finishingOrder(state);
        if (new Set(order).size !== seats) problems.push(`${seats}: places are not everyone once`);
        if (state.out.length !== seats - 1) problems.push(`${seats}: ${state.out.length} players out, expected ${seats - 1}`);
        if (state.hands.filter((hand: string[]) => hand.length === 0).length !== seats - 1) problems.push(`${seats}: wrong number of empty hands`);
        if (state.hands.flat().length + state.drawPile.length + state.discardPile.length !== total) problems.push(`${seats}: cards were lost or made`);
        if (state.winner !== order[0]) problems.push(`${seats}: winner is not first out`);
      }
    }
    return problems;
  });
  expect(report).toEqual([]);
});

test("an ordinary game still ends the moment the first player is out", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const start = table.createTable(4, () => 0.3, 3);
    const base = { ...start, hands: [["4H"], ["5H", "2S"], ["6H"], ["9H"]], discardPile: ["3H"], currentSuit: "H", turn: 0, direction: 1, pendingPenalty: null };
    const after = table.applyTableAction(base, { type: "play", cards: ["4H"] });
    return { status: after.status, winner: after.winner, out: after.out ?? null };
  });
  expect(out).toEqual({ status: "won", winner: 0, out: null });
});

test("going out without calling Last Card puts you back in with two cards, and no place is given", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const start = table.createTable(4, () => 0.3, 3, { playOn: true });
    const base = { ...start, hands: [["4H"], ["5H", "2S"], ["6H", "9S"], ["9H", "4S"]], discardPile: ["3H"], currentSuit: "H", turn: 0, direction: 1, pendingPenalty: null };
    const after = table.applyTableAction(base, { type: "play", cards: ["4H"] });
    const penalised = table.penaliseMissedLastCard(after, 0);
    return { out: after.out, backIn: penalised.out, status: penalised.status, cards: penalised.hands[0].length, turn: penalised.turn };
  });
  expect(out.out).toEqual([0]);
  expect(out.backIn).toEqual([]);
  expect(out.status).toBe("playing");
  expect(out.cards).toBe(2);
  expect(out.turn).toBe(1);
});
