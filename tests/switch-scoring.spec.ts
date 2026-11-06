import { expect, test } from "@playwright/test";

test("players keep display names, duplicate names and exact undo history", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const scoring = await import("/src/switch/scoring.ts");
    const session = scoring.createSession("domino", ["  Alex  ", "Alex"], { target: 175 });
    const changed = scoring.applyScoreCommand(session, { type: "add-score", playerId: session.players[0].id, value: 37 });
    const undone = scoring.undoScoreCommand(changed);
    return { session, changed, undone };
  });

  expect(result.session.players.map((player: { name: string }) => player.name)).toEqual(["Alex", "Alex"]);
  expect(result.session.players[0].id).not.toBe(result.session.players[1].id);
  expect(result.changed.scores[result.session.players[0].id]).toBe(37);
  expect(result.undone.scores).toEqual(result.session.scores);
  expect(result.undone.target).toBe(175);
});

test("domino and head-to-head accept flexible safe integers only", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const scoring = await import("/src/switch/scoring.ts");
    const base = scoring.createSession("domino", ["A", "B"], { target: 250 });
    const valid = scoring.applyScoreCommand(base, { type: "add-score", playerId: base.players[1].id, value: "137" });
    const errors = ["", -1, 2.5, Number.MAX_SAFE_INTEGER + 1].map((value) => {
      try {
        scoring.applyScoreCommand(base, { type: "add-score", playerId: base.players[0].id, value });
        return "missing";
      } catch (error) {
        return error instanceof scoring.ScoreValidationError ? error.code : "wrong-error";
      }
    });
    return { valid, errors };
  });

  expect(result.valid.scores[result.valid.players[1].id]).toBe(137);
  expect(result.errors).toEqual(["required", "non-negative", "whole-number", "safe-integer"]);
});

test("darts awards a set only after three legs and a two-leg lead", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const scoring = await import("/src/switch/scoring.ts");
    let session = scoring.createSession("darts", ["A", "B"], { setsToWin: 3 });
    const [a, b] = session.players.map((player: { id: string }) => player.id);
    for (const winner of [a, a, b, b, a, b, a, a]) {
      session = scoring.applyScoreCommand(session, { type: "win-leg", playerId: winner });
    }
    return session;
  });

  expect(result.darts.sets[result.players[0].id]).toBe(1);
  expect(result.darts.legs[result.players[0].id]).toBe(0);
  expect(result.darts.legs[result.players[1].id]).toBe(0);
});
