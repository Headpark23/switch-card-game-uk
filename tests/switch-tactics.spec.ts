import { expect, test } from "@playwright/test";

// Computer tactics and personalities (owner decisions, 14 Nov 2026): Easy none, Medium three, Hard all seven.

const heads = (hand: string[], top = "5H", suit = "H") => ({
  hands: [Array.from({ length: 6 }, () => "3S"), hand], drawPile: ["4C", "6C", "8C", "9C", "10C", "QC", "KC", "2C", "3C", "4S"], discardPile: [top], currentSuit: suit,
  turn: 1, direction: 1, dealer: 0, pendingPenalty: null, status: "playing", winner: null, move: 3,
});

test("levels get tactics by tier and every computer has a personality", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const t = await import("/src/switch/computerTactics.ts");
    const names = await import("/src/switch/presentation.ts");
    const on = (level: string, who: string) => Object.entries(t.tacticWeights(level, who)).filter(([, w]) => (w as number) > 0).map(([id]) => id);
    return {
      easy: on("relaxed", "paul"), medium: on("standard", "paul"), hard: on("sharp", "paul"),
      people: t.PERSONALITIES.map((p: { name: string }) => p.name), computers: [...names.COMPUTER_NAMES],
      unknown: t.personalityFor("Someone Else").id,
    };
  });
  expect(result.easy).toEqual([]);
  expect(result.medium).toEqual(["tempo", "shield", "aces"]);
  expect(result.hard).toHaveLength(7);
  expect(result.people).toEqual(result.computers);
  expect(result.unknown).toBe("balanced");
});

test("medium keeps one two back and plays sevens one at a time; easy and takeovers play plainly", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (states) => {
    const ai = await import("/src/switch/tableAi.ts");
    const pick = (state: any, level: string, options?: any) => (ai.chooseTableAction(state, () => 0, level, options) as any).cards?.join("+") ?? "draw";
    return {
      twosMedium: pick(states.twos, "standard"),
      twosEasy: pick(states.twos, "relaxed"),
      twosTakeover: pick(states.twos, "standard", { tactics: false }),
      sevensMedium: pick(states.sevens, "standard"),
      sevensTakeover: pick(states.sevens, "standard", { tactics: false }),
    };
  }, { twos: heads(["2H", "2S", "9C"]), sevens: heads(["7H", "7S", "3C", "4D"]) });
  expect(result.twosMedium.split("+")).toHaveLength(1);
  expect(result.twosMedium).toMatch(/^2/);
  expect(result.twosTakeover.split("+")).toHaveLength(2);
  expect(result.sevensMedium.split("+")).toHaveLength(1);
  expect(result.sevensTakeover.split("+")).toHaveLength(2);
});

test("a computer holds its ace instead of spending it while it has other plays", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (state) => {
    const ai = await import("/src/switch/tableAi.ts");
    return (["standard", "sharp"] as const).map((level) => (ai.chooseTableAction(state as any, () => 0, level, { personality: "Ziggy" }) as any).cards?.join("+"));
  }, heads(["AS", "9H", "4C", "6D", "QS"]));
  expect(result).toEqual(["9H", "9H"]);
});

test("a computer never picks up by choice on Medium, and always plays when only an ace plays", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (state) => {
    const ai = await import("/src/switch/tableAi.ts");
    return (ai.chooseTableAction(state as any, () => 0, "standard") as any).type;
  }, heads(["AS", "3C", "4D"]));
  expect(result).toBe("play");
});

test("a move with only one legal action is made quickly; a move with choices keeps the full think time", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (states) => {
    const show = await import("/src/switch/presentation.ts");
    const table = await import("/src/switch/table.ts");
    const names = ["You", "John"];
    const timings = show.withThinkingFloor(show.SPEEDS.natural);
    const think = (state: any) => {
      const moves = table.tableLegalMoves(state);
      const action = moves.find((move: any) => move.type === "draw") ?? moves[0];
      const steps = show.planTurn(state, action, table.applyTableAction(state, action), names, { think: true });
      return { steps: moves.length, forced: steps[0].forced, ms: show.stepDuration(steps[0], timings) };
    };
    return { forcedMove: think(states.stuck), choice: think(states.choice), floor: show.MIN_THINK_MS, quick: show.FORCED_THINK_MS };
  }, { stuck: heads(["KD", "9S"]), choice: heads(["5C", "9H", "4S"]) });
  expect(result.forcedMove).toMatchObject({ steps: 1, forced: true });
  expect(result.forcedMove.ms).toBeLessThanOrEqual(result.quick);
  expect(result.choice.forced).toBeFalsy();
  expect(result.choice.ms).toBeGreaterThanOrEqual(800);
});
