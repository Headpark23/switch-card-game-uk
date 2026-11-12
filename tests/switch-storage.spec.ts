import { expect, test } from "@playwright/test";

test("scorekeeper storage loads empty and legacy data additively", async ({ page, request }) => {
  const fixture = await (await request.get("/tests/fixtures/switch-scorekeeper-live-v4.json")).json();
  await page.goto("/");

  const result = await page.evaluate(async (legacy) => {
    const storage = await import("/src/switch/storage.ts");
    return {
      key: storage.SCOREKEEPER_STORAGE_KEY,
      empty: storage.loadScorekeeper(null),
      loaded: storage.loadScorekeeper(JSON.stringify(legacy)),
    };
  }, fixture);

  expect(result.key).toBe("switchScoreKeeper");
  expect(result.empty.status).toBe("empty");
  expect(result.loaded.status).toBe("loaded");
  expect(result.loaded.state.selectedFormat).toBe("domino");
  expect(result.loaded.state.players.map((player: { name: string }) => player.name)).toEqual(["Player One", "Player Two"]);
  expect(result.loaded.state.scores).toEqual({ "legacy-1": 42, "legacy-2": 18 });
  expect(result.loaded.state.target).toBe(150);
  expect(result.loaded.state.extensions).toMatchObject({ round: 4, tableTheme: "classic" });
});

test("unreadable score data is reported and never overwritten implicitly", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const storage = await import("/src/switch/storage.ts");
    return storage.loadScorekeeper("{not-json");
  });

  expect(result.status).toBe("unreadable");
  expect(result.originalRaw).toBe("{not-json");
  expect(result.state.players).toEqual([]);
});

test("save preserves unknown legacy fields after an explicit edit", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const storage = await import("/src/switch/storage.ts");
    const raw = JSON.stringify({ mode: "domino", players: ["Alex"], target: 100, futureFlag: true });
    const loaded = storage.loadScorekeeper(raw);
    const saved = storage.saveScorekeeper(raw, { ...loaded.state, target: 250 });
    return JSON.parse(saved);
  });

  expect(result.schemaVersion).toBe(1);
  expect(result.target).toBe(250);
  expect(result.extensions.futureFlag).toBe(true);
});
