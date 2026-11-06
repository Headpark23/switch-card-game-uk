import { expect, test } from "@playwright/test";

test("league standings are stable and cross-league playoffs use four leagues", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const leagues = await import("/src/switch/leagues.ts");
    const makeLeague = (leagueIndex: number) => ({
      id: `league-${leagueIndex}`,
      name: `League ${leagueIndex}`,
      results: [0, 1, 2, 3].map((playerIndex) => ({
        player: { id: `l${leagueIndex}p${playerIndex}`, name: `Player ${leagueIndex}-${playerIndex}` },
        points: playerIndex < 2 ? 10 : 4,
      })),
    });
    const configured = [1, 2, 3, 4].map(makeLeague);
    return {
      ranked: leagues.rankLeague(configured[0].results),
      playoffs: leagues.createCrossLeaguePlayoffs(configured, () => 0),
      oneLeague: leagues.createCrossLeaguePlayoffs(configured.slice(0, 1), () => 0),
      shortLeague: leagues.createCrossLeaguePlayoffs([{ ...configured[0], results: configured[0].results.slice(0, 3) }, configured[1]], () => 0),
    };
  });

  expect(result.ranked.map((entry: { player: { id: string } }) => entry.player.id)).toEqual(["l1p0", "l1p1", "l1p2", "l1p3"]);
  expect(result.playoffs.status).toBe("ready");
  expect(new Set(result.playoffs.championship.entrants.map((entry: { player: { id: string } }) => entry.player.id)).size).toBe(8);
  expect(new Set(result.playoffs.plate.entrants.map((entry: { player: { id: string } }) => entry.player.id)).size).toBe(8);
  expect(result.playoffs.championship.fixtures.every((fixture: { home: { leagueId: string }; away: { leagueId: string } }) => fixture.home.leagueId !== fixture.away.leagueId)).toBe(true);
  expect(result.oneLeague.status).toBe("not-ready");
  expect(result.shortLeague.status).toBe("not-ready");
});
