import { expect, test } from "@playwright/test";

test("LOST eliminates one player at a time for three to six entrants and supports undo", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const knockout = await import("/src/switch/knockout.ts");
    return [3, 4, 5, 6].map((count) => {
      const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Player ${index}` }));
      let state = knockout.createKnockout(players);
      for (let index = count - 1; index > 0; index -= 1) state = knockout.markLost(state, `p${index}`);
      const champion = state.championId;
      const undone = knockout.undoKnockout(state);
      let duplicateError = "";
      try { knockout.markLost(state, `p${count - 1}`); } catch (error) { duplicateError = (error as Error).message; }
      return { count, state, champion, undone, duplicateError };
    });
  });

  for (const entry of result) {
    expect(entry.champion).toBe("p0");
    expect(entry.state.eliminatedIds).toHaveLength(entry.count - 1);
    expect(entry.undone.championId).toBeNull();
    expect(entry.duplicateError).toMatch(/already lost/i);
  }
});

test("league playoff knockout: four players take three games, last place out each game", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const knockout = await import("/src/switch/knockout.ts");
    const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
    let state = knockout.createPlayoffKnockout(players);
    const left: number[] = [];
    for (const id of ["d", "c", "b"]) { state = knockout.markLost(state, id); left.push(state.players.length - state.eliminatedIds.length); }
    return { left, champion: state.championId, pair: knockout.createPlayoffKnockout(players.slice(0, 2)).players.length };
  });
  expect(result.left).toEqual([3, 2, 1]);
  expect(result.champion).toBe("a");
  expect(result.pair).toBe(2);
});
