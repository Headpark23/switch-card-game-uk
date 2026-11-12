import { expect, test } from "@playwright/test";

test("seasons score each real night once with transparent 3 and 1 points", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const seasons = await import("/src/switch/seasons.ts");
    const profiles = [
      { version: 1 as const, id: "a", name: "Alex", colour: "forest" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "b", name: "Blair", colour: "gold" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "c", name: "Casey", colour: "clay" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const first = { version: 1 as const, id: "n1", completedAt: "2026-01-01T00:00:00.000Z", title: "One", format: "domino", formatLabel: "Domino", players: profiles.map(({ id, name }) => ({ id, name })), winnerIds: ["a"], outcome: "Alex won", details: [] };
    const second = { version: 1 as const, id: "n2", completedAt: "2026-02-01T00:00:00.000Z", title: "Two", format: "league", formatLabel: "League", players: profiles.map(({ id, name }) => ({ id, name })), winnerIds: ["b", "c"], outcome: "Blair and Casey topped", details: [] };
    let season = seasons.createSeason("  Winter League  ", ["a", "b", "c"], profiles, { id: "season-1", now: "2026-01-01T00:00:00.000Z" });
    season = seasons.addNightToSeason(season, first, profiles);
    const duplicate = seasons.addNightToSeason(season, first, profiles);
    season = seasons.addNightToSeason(duplicate, second, profiles);
    return { season, duplicate, standings: seasons.seasonStandings(season, [first, second], profiles) };
  });

  expect(result.season.name).toBe("Winter League");
  expect(result.duplicate.nightIds).toEqual(["n1"]);
  expect(result.season.nightIds).toEqual(["n1", "n2"]);
  expect(result.standings).toEqual([
    { rank: 1, profileId: "a", played: 2, wins: 1, points: 4 },
    { rank: 2, profileId: "b", played: 2, wins: 1, points: 4 },
    { rank: 3, profileId: "c", played: 2, wins: 1, points: 4 },
  ]);
});

test("seasons reject bad membership, lock completion and preserve valid saved data", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const seasons = await import("/src/switch/seasons.ts");
    const profiles = [
      { version: 1 as const, id: "a", name: "Alex", colour: "forest" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
      { version: 1 as const, id: "b", name: "Blair", colour: "gold" as const, createdAt: "2026-01-01T00:00:00.000Z", archived: false },
    ];
    const season = seasons.createSeason("League", ["a", "b"], profiles, { id: "season-1", now: "2026-01-01T00:00:00.000Z" });
    const completed = seasons.completeSeason(season);
    const night = { version: 1 as const, id: "n1", completedAt: "2026-01-01T00:00:00.000Z", title: "One", format: "domino", formatLabel: "Domino", players: profiles.map(({ id, name }) => ({ id, name })), winnerIds: ["a"], outcome: "Alex won", details: [] };
    const completionError = (() => { try { seasons.addNightToSeason(completed, night, profiles); return "missing"; } catch (error) { return error instanceof Error ? error.message : "wrong"; } })();
    const membershipErrors = [
      () => seasons.createSeason("Solo", ["a"], profiles),
      () => seasons.createSeason("Duplicate", ["a", "a"], profiles),
      () => seasons.createSeason("Unknown", ["a", "missing"], profiles),
    ].map((action) => { try { action(); return "missing"; } catch (error) { return error instanceof Error ? error.message : "wrong"; } });
    const source = { keepMe: true, switchSeasons: [{ broken: true }, season] };
    const valid = seasons.getSeasons(source);
    const written = seasons.putSeasons(source, valid);
    return { completed, completionError, membershipErrors, valid, written, missing: seasons.seasonStandings(season, [], profiles) };
  });

  expect(result.completed.status).toBe("complete");
  expect(result.completionError).toContain("complete");
  expect(result.membershipErrors.every((message: string) => message !== "missing")).toBe(true);
  expect(result.valid).toHaveLength(1);
  expect(result.written.keepMe).toBe(true);
  expect(result.missing.map((standing: { points: number }) => standing.points)).toEqual([0, 0]);
});
