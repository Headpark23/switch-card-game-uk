import { expect, test, type Page } from "@playwright/test";

/**
 * Switch 2.0: the competitive table shows every turn in order, highlights whose move it is,
 * keeps practice unranked and logs each finished game exactly once.
 */

type Seed = { hands: string[][]; discard: string[]; suit: string; turn: number; draw?: string[]; direction?: 1 | -1; pending?: unknown };

const FILLER = ["3C", "4C", "6C", "9C", "10C", "3D", "4D", "6D", "9D", "10D", "QD", "QC", "4S", "6S", "10S"];

async function seedTable(page: Page, seed: Seed, extra: Record<string, string> = {}) {
  await page.addInitScript(({ seed, extra }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchTableSpeed", "quick");
    for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-test-game", opponents: seed.hands.length - 1, level: "standard", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: seed.hands, drawPile: seed.draw ?? ["5D", "8C", "JD", "QS", "KD", "7C", "9S", "10H"], discardPile: seed.discard, currentSuit: seed.suit, turn: seed.turn, direction: seed.direction ?? 1, dealer: 0, pendingPenalty: seed.pending ?? null, status: "playing", winner: null, move: 3 },
    }));
  }, { seed, extra });
}

/** Records every change to the top of the discard pile and to the turn label. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { tops: string[]; statuses: string[]; orders: string[] };
    w.tops = []; w.statuses = []; w.orders = [];
    const record = () => {
      const pile = document.querySelector<HTMLElement>('[data-testid="discard-pile"]');
      const status = document.querySelector('[data-testid="turn-status"]')?.textContent ?? "";
      if (pile && pile.dataset.top !== w.tops.at(-1)) { w.tops.push(pile.dataset.top ?? ""); w.orders.push(pile.dataset.order ?? ""); }
      if (status && status !== w.statuses.at(-1)) w.statuses.push(status);
    };
    record();
    new MutationObserver(record).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

const read = (page: Page) => page.evaluate(() => { const w = window as unknown as { tops: string[]; statuses: string[]; orders: string[] }; return { tops: w.tops, statuses: w.statuses, orders: w.orders }; });

async function resume(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await expect(page.locator(".table-game")).toBeVisible();
}

test("the presentation plan lands cards one at a time from the seat that played them", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const show = await import("/src/switch/presentation.ts");
    const names = ["You", "John", "Paul", "George"];
    const base = { hands: [["3C", "4C"], ["5S", "5C", "9D"], ["QD", "QC"], ["6D", "6S"]], drawPile: ["8D", "9S"], discardPile: ["4D", "5H"], currentSuit: "H", turn: 1, direction: 1, dealer: 0, pendingPenalty: null, status: "playing", winner: null, move: 0 };
    const action = { type: "play", cards: ["5S", "5C"] };
    const after = table.applyTableAction(base as never, action as never);
    const steps = show.planTurn(base as never, action as never, after, names, { think: true });
    const frames = steps.map((_, at) => show.visibleAt(base as never, after, steps, at)).concat(show.visibleAt(base as never, after, steps, steps.length));
    // A jack reversal at a table of four: the cards still come from the seat that played them, and the direction flips only after the last card lands.
    const jackBase = { ...base, hands: [["3C"], ["JS", "JC", "JH", "9D"], ["QD"], ["6D"]], discardPile: ["4D", "JD"], currentSuit: "D" };
    const jack = { type: "play", cards: ["JS", "JC", "JH"] };
    const jackAfter = table.applyTableAction(jackBase as never, jack as never);
    const jackSteps = show.planTurn(jackBase as never, jack as never, jackAfter, names, { think: true });
    return {
      kinds: steps.map((step) => step.kind),
      seats: steps.map((step) => step.seat),
      tops: frames.map((frame) => frame.discardPile.at(-1)),
      counts: frames.map((frame) => frame.handCounts[1]),
      active: frames.map((frame) => frame.active),
      finalTop: after.discardPile.at(-1),
      jackFlights: jackSteps.filter((step) => step.kind === "card").map((step) => step.seat),
      jackDirections: jackSteps.map((_, at) => show.visibleAt(jackBase as never, jackAfter, jackSteps, at).direction),
      jackAfterTurn: jackAfter.turn,
      jackAnnounce: jackSteps.find((step) => step.kind === "announce")?.text,
    };
  });
  // John is left with one card, so the engine's result also brings a "Last Card" call.
  expect(result.kinds).toEqual(["think", "card", "card", "announce"]);
  expect(result.seats).toEqual([1, 1, 1, 1]);
  // Thinking: old top. First card in the air: still old top. Second in the air: first card on top. Then the second card on top.
  expect(result.tops).toEqual(["5H", "5H", "5S", result.finalTop, result.finalTop]);
  expect(result.counts).toEqual([3, 2, 1, 1, 1]);
  expect(result.active).toEqual([1, 1, 1, 1, 2]);
  expect(result.jackFlights).toEqual([1, 1, 1]);
  // Think, three jacks in the air, then the reversal (and John's Last Card) once the last jack is down.
  expect(result.jackDirections).toEqual([1, 1, 1, 1, -1, -1]);
  expect(result.jackAfterTurn).toBe(0);
  expect(result.jackAnnounce).toContain("anticlockwise");
});

test("a computer's multi-card play lands card by card, in order, and never reorders", async ({ page }) => {
  // John holds two fives and plays them both; the pile must show 5H, then his first five, then his second.
  await seedTable(page, { hands: [["3C", "4C", "6C"], ["5S", "5C", "9D"], ["QD", "QC", "4S"]], discard: ["4D", "5H"], suit: "H", turn: 1 });
  await resume(page);
  await watch(page);
  await expect(page.getByTestId("turn-status")).toHaveText("YOUR MOVE", { timeout: 15_000 });
  const { tops, orders, statuses } = await read(page);
  const fives = tops.filter((card) => card === "5S" || card === "5C");
  expect(fives).toHaveLength(2);
  expect(tops.indexOf(fives[1]) - tops.indexOf(fives[0])).toBe(1);
  // Each pile change only ever adds cards on top: nothing that landed moves again.
  for (let index = 1; index < orders.length; index += 1) {
    const previous = orders[index - 1].split(" ");
    expect(orders[index].split(" ").slice(0, -1).join(" ")).toBe(previous.slice(-(orders[index].split(" ").length - 1)).join(" "));
  }
  // The highlight sat on John while he chose, then moved on.
  expect(statuses).toContain("JOHN IS CHOOSING");
  expect(statuses.at(-1)).toBe("YOUR MOVE");
});

test("your own set lands in the order you tapped, and a double tap plays it once", async ({ page }) => {
  await seedTable(page, { hands: [["6H", "6S", "6D", "9C"], ["3C", "4C", "8C"]], discard: ["4D", "6C"], suit: "C", turn: 0 });
  await resume(page);
  await expect(page.getByTestId("turn-status")).toHaveText("YOUR MOVE");
  await expect(page.locator(".your-move-tag")).toBeVisible();
  await page.getByRole("button", { name: /Select Six of spades/ }).click();
  await page.getByRole("button", { name: /Select Six of diamonds/ }).click();
  await page.getByRole("button", { name: /Select Six of hearts/ }).click();
  await watch(page);
  await page.getByRole("button", { name: "Play selected" }).dblclick();
  await expect(page.getByTestId("turn-status")).toHaveText("YOU PLAY");
  await expect(page.getByTestId("discard-pile")).toHaveAttribute("data-top", "6H", { timeout: 10_000 });
  const { tops } = await read(page);
  const sixes = tops.filter((card) => card.startsWith("6") && card !== "6C");
  expect(sixes).toEqual(["6S", "6D", "6H"]);
  // One play only: three sixes left the hand and the nine stayed, so it is time to call "Last Card".
  await expect(page.getByText("One card remaining")).toBeVisible();
  await expect(page.getByTestId("turn-status")).toHaveText("YOUR CALL");
  await expect(page.locator(".seat").first()).toHaveText(/John3 cards/);
  await page.getByRole("button", { name: 'Say "Last Card"' }).click();
  await expect(page.getByTestId("turn-status")).toHaveText(/JOHN/);
});

test("an eight makes the next player miss a turn, and the highlight follows the engine", async ({ page }) => {
  await seedTable(page, { hands: [["8H", "9C", "3S"], ["3C", "4C", "6C"], ["QD", "QC", "4S"]], discard: ["4D", "8C"], suit: "C", turn: 0 });
  await resume(page);
  await watch(page);
  await page.getByRole("button", { name: /Select Eight of hearts/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByTestId("table-announce")).toContainText("John misses a turn");
  await expect.poll(async () => (await read(page)).statuses.at(-1), { timeout: 15_000 }).toBe("YOUR MOVE");
  const { statuses } = await read(page);
  // John misses: the move passes through him (accepting), then Paul, then back to you.
  const john = statuses.findIndex((s) => s.startsWith("JOHN"));
  const paul = statuses.findIndex((s) => s.startsWith("PAUL"));
  expect(john).toBeGreaterThan(-1);
  expect(paul).toBeGreaterThan(john);
});

test("a finished game is logged exactly once and the saved game is cleared", async ({ page }) => {
  await seedTable(page, { hands: [["9C"], ["3D", "4D", "6D"]], discard: ["4H", "9H"], suit: "H", turn: 0 });
  await resume(page);
  await page.getByRole("button", { name: /Select Nine of clubs/ }).click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByRole("heading", { name: /You won the/ })).toBeVisible({ timeout: 10_000 });
  const read = () => page.evaluate(() => {
    const club = JSON.parse(localStorage.getItem("switchScoreKeeper") || "{}");
    const games = (club.extensions?.switchComputerGames ?? []) as { id: string; won: boolean }[];
    return { count: games.filter((game) => game.id === "cpu-test-game").length, won: games[0]?.won, active: localStorage.getItem("switchTableGame") };
  });
  expect(await read()).toEqual({ count: 1, won: true, active: null });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  expect((await read()).count).toBe(1);
});

test("leaving mid-animation stops the timers, and the game resumes in a consistent state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedTable(page, { hands: [["3C", "4C", "6C"], ["5S", "5C", "9D"], ["QD", "QC", "4S"]], discard: ["4D", "5H"], suit: "H", turn: 1 }, { switchTableSpeed: "relaxed" });
  await page.addInitScript(() => localStorage.setItem("switchTableSpeed", "relaxed"));
  await resume(page);
  await expect(page.getByTestId("turn-status")).toHaveText("JOHN IS CHOOSING");
  await page.getByRole("button", { name: "Exit" }).click();
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
  // The saved game already holds the engine's result: John's move happened exactly once.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("switchTableGame") || "null"));
  expect(saved.game.hands[1].length).toBeLessThan(3);
  const discard = saved.game.discardPile as string[];
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await expect(page.getByTestId("discard-pile")).toHaveAttribute("data-top", discard.at(-1) ?? "");
});

test("with reduced motion nothing flies, but the cards still land one at a time", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedTable(page, { hands: [["3C", "4C", "6C"], ["5S", "5C", "9D"], ["QD", "QC", "4S"]], discard: ["4D", "5H"], suit: "H", turn: 1 });
  await resume(page);
  await watch(page);
  await expect(page.getByTestId("turn-status")).toHaveText("YOUR MOVE", { timeout: 15_000 });
  const { tops } = await read(page);
  const fives = tops.filter((card) => card === "5S" || card === "5C");
  expect(fives).toHaveLength(2);
  const animations = await page.evaluate(() => document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect | null)?.target instanceof HTMLElement && ((animation.effect as KeyframeEffect).target as HTMLElement).dataset.testid === "flying-card").length);
  expect(animations).toBe(0);
});

test("guided practice is unranked: it never writes a competitive result", async ({ page, request }) => {
  const source = await (await request.get("/src/screens/GuidedGame.tsx")).text();
  expect(source).not.toContain("logComputerGame(");
  await page.goto("/");
  await page.getByRole("button", { name: "Learn rules" }).click();
  await page.getByRole("button", { name: /Guided practice game/ }).click();
  await expect(page.getByText(/GUIDED GAME/)).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  const games = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") || "{}").extensions?.switchComputerGames ?? []);
  expect(games).toEqual([]);
});

test("five destinations, and the lit tab always matches the section on screen", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("button")).toHaveText([/Home$/, /Play$/, /Score$/, /Club$/, /Me$/]);
  const lit = () => nav.locator('[aria-current="page"]');
  await expect(lit()).toHaveText(/Home$/);
  await nav.getByRole("button", { name: "Play", exact: true }).click();
  await expect(lit()).toHaveText(/Play$/);
  await page.getByRole("button", { name: /Deal me in/ }).click();
  await expect(page.locator(".table-game")).toBeVisible();
  await expect(lit()).toHaveText(/Play$/);
  await nav.getByRole("button", { name: "Score", exact: true }).click();
  await expect(lit()).toHaveText(/Score$/);
  await page.getByRole("button", { name: /Quick night/ }).click();
  await expect(lit()).toHaveText(/Score$/);
  await nav.getByRole("button", { name: "Club", exact: true }).click();
  await expect(lit()).toHaveText(/Club$/);
  await expect(page.getByRole("group", { name: "Club sections" }).or(page.locator(".club-tabs.tabs-club"))).toBeVisible();
  await nav.getByRole("button", { name: "Me", exact: true }).click();
  await expect(lit()).toHaveText(/Me$/);
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Achievements" }).click();
  await expect(lit()).toHaveText(/Me$/);
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Questions" }).click();
  await expect(lit()).toHaveText(/Home$/);
});

test("moving around every section leaves saved records untouched", async ({ page }) => {
  const legacy = JSON.stringify({ schemaVersion: 1, players: [], extensions: { switchClub: { name: "The Thursday Table" }, switchComputerGames: [{ id: "old-1", playedAt: "2026-10-01T20:00:00.000Z", playerId: "p-1", opponents: 2, level: "sharp", won: true, place: 1, moves: 40 }], switchProfiles: [{ version: 1, id: "p-1", name: "Martha", colour: "forest", createdAt: "2026-09-01T00:00:00.000Z", archived: false }], switchMe: "p-1", futureField: { keep: true } } });
  await page.addInitScript((raw) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("switchScoreKeeper", raw); } }, legacy);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Martha/ })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const tab of ["Play", "Score", "Club", "Me", "Home"]) await nav.getByRole("button", { name: tab, exact: true }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("switchScoreKeeper") || "{}"));
  const before = JSON.parse(legacy);
  expect(after.extensions.switchComputerGames).toEqual(before.extensions.switchComputerGames);
  expect(after.extensions.switchProfiles).toEqual(before.extensions.switchProfiles);
  expect(after.extensions.futureField).toEqual({ keep: true });
});
