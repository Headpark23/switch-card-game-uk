import { expect, test } from "@playwright/test";

test("all six formats create trustworthy completion snapshots", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const history = await import("/src/switch/history.ts");
    const scoring = await import("/src/switch/scoring.ts");
    const knockoutModule = await import("/src/switch/knockout.ts");
    const cupModule = await import("/src/switch/cup.ts");
    const leagueModule = await import("/src/switch/leagues.ts");
    const players = [
      { id: "a", name: "Alex" },
      { id: "b", name: "Blair" },
    ];

    let domino = scoring.createSession("domino", players, { target: 100 });
    domino = scoring.applyScoreCommand(domino, { type: "add-score", playerId: "a", value: 110 });
    let tied = scoring.applyScoreCommand(domino, { type: "add-score", playerId: "b", value: 110 });

    let darts = scoring.createSession("darts", players, { setsToWin: 1 });
    for (let index = 0; index < 3; index += 1) darts = scoring.applyScoreCommand(darts, { type: "win-leg", playerId: "a" });

    let knockout = knockoutModule.createKnockout([...players, { id: "c", name: "Casey" }]);
    knockout = knockoutModule.markLost(knockout, "c");
    knockout = knockoutModule.markLost(knockout, "b");

    let cup = cupModule.createCup([...players, { id: "c", name: "Casey" }], () => 0.9);
    const fixture = cup.rounds[0].fixtures[0];
    cup = cupModule.selectCupWinner(cup, fixture.id, fixture.playerIds[0]);
    cup = cupModule.drawNextCupRound(cup, () => 0.9);
    const finalFixture = cup.rounds[1].fixtures[0];
    cup = cupModule.selectCupWinner(cup, finalFixture.id, finalFixture.playerIds[0]);
    cup = cupModule.drawNextCupRound(cup, () => 0.9);

    const leaguePlayers = Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, name: `Player ${index + 1}` }));
    const leagues = [0, 1].map((leagueIndex) => ({
      id: `league-${leagueIndex + 1}`,
      name: `League ${leagueIndex + 1}`,
      results: leaguePlayers.slice(leagueIndex * 4, leagueIndex * 4 + 4).map((player, index) => ({ player, points: 4 - index })),
    }));
    const playoffs = leagueModule.createCrossLeaguePlayoffs(leagues, () => 0.5);

    return {
      domino: history.completionFromSession(domino),
      tied: history.completionFromSession(tied),
      darts: history.completionFromSession(darts),
      knockout: history.completionFromKnockout(knockout),
      cup: history.completionFromCup(cup),
      league: history.completionFromLeagues(leagues, playoffs),
    };
  });

  expect(result.domino?.winnerIds).toEqual(["a"]);
  expect(result.domino?.details[0].lines).toContain("Alex — 110 points");
  expect(result.tied).toBeNull();
  expect(result.darts?.outcome).toBe("Alex won");
  expect(result.knockout?.details[0].lines).toEqual(["Casey — LOST", "Blair — LOST", "Alex — CHAMPION"]);
  expect(result.cup?.details.some((section: { heading: string }) => section.heading === "Round 1")).toBe(true);
  expect(result.league?.winnerIds).toEqual(["p0", "p4"]);
});

test("history is defensive, immutable, additive, deletable and portable", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const history = await import("/src/switch/history.ts");
    const completion = {
      format: "domino" as const,
      formatLabel: "Domino",
      players: [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }],
      winnerIds: ["a"],
      outcome: "Alex won",
      details: [{ heading: "Final scores", lines: ["Alex — 120 points", "Blair — 80 points"] }],
    };
    const record = history.createNightRecord("  Friday Final  ", completion, "2026-11-06T20:30:00.000Z", "night-1");
    completion.players[0].name = "Changed later";
    const extensions = { futureField: { keep: true }, switchNightHistory: [{ broken: true }, record] };
    const valid = history.getHistory(extensions);
    const added = history.addNight(extensions, record);
    const second = history.createNightRecord("Saturday", { ...record, outcome: "Blair won", winnerIds: ["b"] }, "2026-11-07T20:30:00.000Z", "night-2");
    const withSecond = history.addNight(added, second);
    const deleted = history.deleteNight(withSecond, "night-1");
    const exported = JSON.parse(history.exportHistory(history.getHistory(withSecond), "2026-11-08T10:00:00.000Z"));
    return { record, valid, added, deleted, exported };
  });

  expect(result.record.title).toBe("Friday Final");
  expect(result.record.players[0].name).toBe("Alex");
  expect(result.valid).toHaveLength(1);
  expect(result.added.futureField).toEqual({ keep: true });
  expect(result.added.switchNightHistory).toHaveLength(1);
  expect(result.deleted.switchNightHistory).toHaveLength(1);
  expect(result.deleted.switchNightHistory[0].id).toBe("night-2");
  expect(result.exported.exportedAt).toBe("2026-11-08T10:00:00.000Z");
  expect(result.exported.nights).toHaveLength(2);
});
