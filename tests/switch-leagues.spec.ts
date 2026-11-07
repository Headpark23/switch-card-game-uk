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
        points: [10, 9, 4, 3][playerIndex],
      })),
    });
    const configured = [1, 2, 3, 4].map(makeLeague);
    return {
      ranked: leagues.rankLeague(configured[0].results),
      playoffs: leagues.createCrossLeaguePlayoffs(configured, () => 0),
      oneLeague: leagues.createCrossLeaguePlayoffs(configured.slice(0, 1), () => 0),
      shortLeague: leagues.createCrossLeaguePlayoffs([{ ...configured[0], results: configured[0].results.slice(0, 2) }, configured[1]], () => 0),
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

test("level on points, then round wins, then a deciding game", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const leagues = await import("/src/switch/leagues.ts");
    const players = [0, 1, 2, 3].map((index) => ({ id: `p${index}`, name: `P${index}` }));
    const make = (points: number[], wins: number[], playoffOrder: string[] = []) => ({
      id: "l1", name: "L1", playoffOrder,
      results: players.map((player, index) => ({ player, points: points[index], wins: wins[index] })),
    });
    const second = { ...make([8, 8, 5, 3], [2, 2, 1, 0]), id: "l2", name: "L2" };
    const byWins = leagues.rankLeague(make([8, 8, 5, 3], [1, 3, 1, 0]).results).map((entry: { player: { id: string } }) => entry.player.id);
    const level = make([8, 8, 5, 3], [2, 2, 1, 0]);
    const needed = leagues.playoffsNeeded(level).map(([a, b]: { id: string }[]) => `${a.id}v${b.id}`);
    const blocked = leagues.createCrossLeaguePlayoffs([level, second], () => 0);
    const settled = make([8, 8, 5, 3], [2, 2, 1, 0], ["p1", "p0"]);
    const afterPlayoff = leagues.rankLeague(settled.results, settled.playoffOrder).map((entry: { player: { id: string } }) => entry.player.id);
    return { byWins, needed, blocked: blocked.status, afterPlayoff };
  });
  expect(result.byWins.slice(0, 2)).toEqual(["p1", "p0"]);
  expect(result.needed).toEqual(["p0vp1"]);
  expect(result.blocked).toBe("not-ready");
  expect(result.afterPlayoff.slice(0, 2)).toEqual(["p1", "p0"]);
});

test("leagues of 4, 4 and 3 give a two-per-league championship and a plate with a bye", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const leagues = await import("/src/switch/leagues.ts");
    const make = (leagueIndex: number, size: number) => ({
      id: `league-${leagueIndex}`, name: `League ${leagueIndex}`, playoffOrder: [],
      results: Array.from({ length: size }, (_, playerIndex) => ({ player: { id: `l${leagueIndex}p${playerIndex}`, name: `L${leagueIndex}P${playerIndex}` }, points: size - playerIndex })),
    });
    const outcome = leagues.createCrossLeaguePlayoffs([make(1, 4), make(2, 4), make(3, 3)], () => 0);
    const two = leagues.createCrossLeaguePlayoffs([make(1, 4), make(2, 4)], () => 0);
    const names = (bracket: { fixtures: { home: { player: { name: string } }; away: { player: { name: string } } }[] }) => bracket.fixtures.map((fixture) => `${fixture.home.player.name} v ${fixture.away.player.name}`);
    return { status: outcome.status, championship: names(outcome.championship), plate: names(outcome.plate), bye: outcome.plate.bye?.player.name ?? null, plateEntrants: outcome.plate.entrants.length, twoPlate: names(two.plate), twoBye: two.plate.bye ?? null };
  });
  expect(result.status).toBe("ready");
  expect(result.championship).toHaveLength(3);
  expect(result.plateEntrants).toBe(5);
  expect(result.plate).toHaveLength(2);
  expect(result.bye).not.toBeNull();
  // The familiar eight-player shape is unchanged: 3rd of one league v 4th of the other.
  expect(result.twoPlate).toEqual(["L1P2 v L2P3", "L2P2 v L1P3"]);
  expect(result.twoBye).toBeNull();
});
