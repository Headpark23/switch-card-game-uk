import { expect, test } from "@playwright/test";

test("player statistics use real appearances, wins, streaks, formats and six calendar months", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const analytics = await import("/src/switch/analytics.ts");
    const profiles = [
      { version: 1 as const, id: "alex", name: "Alex", colour: "forest" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "blair", name: "Blair", colour: "gold" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "casey", name: "Casey", colour: "clay" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const night = (id: string, month: number, format: string, playerIds: string[], winnerIds: string[]) => ({
      version: 1 as const,
      id,
      completedAt: `2026-${String(month).padStart(2, "0")}-06T20:00:00.000Z`,
      title: `Night ${id}`,
      format,
      formatLabel: format,
      players: playerIds.map((playerId) => ({ id: playerId, name: profiles.find((profile) => profile.id === playerId)?.name ?? playerId })),
      winnerIds,
      outcome: "complete",
      details: [],
    });
    const nights = [
      night("1", 1, "domino", ["alex", "blair"], ["alex"]),
      night("2", 2, "cup", ["alex", "blair"], ["blair"]),
      night("3", 3, "head-to-head", ["alex", "blair"], ["alex"]),
      night("4", 4, "knockout", ["alex", "blair", "casey"], ["casey"]),
      night("5", 5, "cup", ["alex", "blair"], ["alex"]),
      night("6", 6, "darts", ["alex", "blair"], ["alex"]),
      night("7", 7, "league", ["alex", "blair"], ["alex"]),
    ];
    return {
      alex: analytics.derivePlayerStats(profiles[0], nights, profiles),
      blair: analytics.derivePlayerStats(profiles[1], nights, profiles),
      casey: analytics.derivePlayerStats(profiles[2], nights, profiles),
      summary: analytics.deriveClubhouseSummary(nights, profiles),
      rivalries: analytics.deriveRivalries(nights, profiles),
    };
  });

  expect(result.alex.appearances).toBe(7);
  expect(result.alex.wins).toBe(5);
  expect(result.alex.winRate).toBeCloseTo(5 / 7);
  expect(result.alex.currentWinStreak).toBe(3);
  expect(result.alex.bestWinStreak).toBe(3);
  expect(result.alex.recentForm).toEqual(["W", "W", "W", "L", "W", "L", "W"]);
  expect(result.alex.formatWins).toEqual({ domino: 1, cup: 1, "head-to-head": 1, darts: 1, league: 1 });
  expect(result.alex.monthlyWins.map((month: { wins: number }) => month.wins)).toEqual([0, 1, 0, 1, 1, 1]);
  expect(result.alex.milestones).toEqual(expect.arrayContaining(["first-night", "first-win", "five-nights", "three-win-streak", "three-formats", "cup-champion"]));
  expect(result.blair.wins).toBe(1);
  expect(result.casey.winRate).toBe(1);
  expect(result.summary.totalNights).toBe(7);
  expect(result.summary.mostWinsProfileId).toBe("alex");
  expect(result.summary.bestWinRateProfileId).toBe("alex");
  expect(result.rivalries[0]).toMatchObject({ profileAId: "alex", profileBId: "blair", meetings: 7, winsA: 5, winsB: 1, otherWins: 1 });
});

test("legacy names resolve only when unambiguous and short records do not win rate honours", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const analytics = await import("/src/switch/analytics.ts");
    const profiles = [
      { version: 1 as const, id: "alex", name: "Alex", colour: "forest" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "regular", name: "Regular", colour: "gold" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const nights = [
      { version: 1 as const, id: "legacy", completedAt: "2026-01-01T00:00:00.000Z", title: "Legacy", format: "domino", formatLabel: "Domino", players: [{ id: "old", name: " ALEX " }, { id: "r1", name: "Regular" }], winnerIds: ["old"], outcome: "Alex won", details: [] },
      { version: 1 as const, id: "2", completedAt: "2026-02-01T00:00:00.000Z", title: "Two", format: "domino", formatLabel: "Domino", players: [{ id: "regular", name: "Regular" }, { id: "alex", name: "Alex" }], winnerIds: ["regular"], outcome: "Regular won", details: [] },
      { version: 1 as const, id: "3", completedAt: "2026-03-01T00:00:00.000Z", title: "Three", format: "domino", formatLabel: "Domino", players: [{ id: "regular", name: "Regular" }], winnerIds: ["regular"], outcome: "Regular won", details: [] },
      { version: 1 as const, id: "4", completedAt: "2026-04-01T00:00:00.000Z", title: "Four", format: "domino", formatLabel: "Domino", players: [{ id: "regular", name: "Regular" }], winnerIds: [], outcome: "No win", details: [] },
    ];
    return {
      alex: analytics.derivePlayerStats(profiles[0], nights, profiles),
      summary: analytics.deriveClubhouseSummary(nights, profiles),
    };
  });

  expect(result.alex.appearances).toBe(2);
  expect(result.alex.wins).toBe(1);
  expect(result.summary.bestWinRateProfileId).toBe("regular");
});
