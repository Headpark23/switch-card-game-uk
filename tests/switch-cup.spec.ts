import { expect, test } from "@playwright/test";

test("Switch Cup draws two to ten entrants with correct byes and unique fixtures", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const cup = await import("/src/switch/cup.ts");
    return Array.from({ length: 9 }, (_, offset) => offset + 2).map((count) => {
      const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Player ${index}` }));
      const state = cup.createCup(players, () => 0);
      const round = state.rounds[0];
      const ids = [...round.fixtures.flatMap((fixture: { playerIds: string[] }) => fixture.playerIds), ...(round.byePlayerId ? [round.byePlayerId] : [])];
      return { count, round, unique: new Set(ids).size, total: ids.length };
    });
  });

  for (const entry of result) {
    expect(entry.unique).toBe(entry.count);
    expect(entry.total).toBe(entry.count);
    expect(Boolean(entry.round.byePlayerId)).toBe(entry.count % 2 === 1);
  }
});

test("Cup winners and a bye advance exactly once to a champion", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const cup = await import("/src/switch/cup.ts");
    const players = Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}` }));
    let state = cup.createCup(players, () => 0);
    let earlyError = "";
    try { cup.drawNextCupRound(state, () => 0); } catch (error) { earlyError = (error as Error).message; }
    while (!state.championId) {
      const round = state.rounds.at(-1)!;
      for (const fixture of round.fixtures) state = cup.selectCupWinner(state, fixture.id, fixture.playerIds[0]);
      state = cup.drawNextCupRound(state, () => 0);
    }
    return { state, earlyError };
  });

  expect(result.earlyError).toMatch(/all fixtures/i);
  expect(result.state.championId).toBeTruthy();
  expect(result.state.rounds.length).toBeGreaterThan(1);
});
