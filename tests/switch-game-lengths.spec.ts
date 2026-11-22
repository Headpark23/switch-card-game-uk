import { expect, test } from "@playwright/test";
import { gameLengths, formatDuration } from "../src/switch/gameLengths";
import { replayFrames, withServerLog, type GameReplay } from "../src/switch/gameReplay";
import type { ComputerGame } from "../src/switch/computerLog";

/**
 * Longest and shortest games (owner request, 21 Nov 2026): Me shows the longest and shortest game by moves and by time,
 * and every replay shows every player's hand face up so you can see how each one played.
 */

const game = (id: string, moves: number, seconds: number | undefined, daysAgo = 1): ComputerGame => ({
  id, playedAt: new Date(Date.now() - daysAgo * 864e5).toISOString(), playerId: "me", opponents: 2, level: "standard", won: true, place: 1, moves, ...(seconds !== undefined ? { seconds } : {}),
});

test("the four records: longest and shortest by moves and by time, a tie going to the newer game", () => {
  const lengths = gameLengths([game("a", 40, 300), game("b", 80, 600, 5), game("c", 12, 45, 3), game("d", 12, 900, 2), game("e", 50, 1500, 4), game("f", 30, 20, 6)]);
  expect(lengths.longestMoves?.game.id).toBe("b");
  expect(lengths.shortestMoves?.game.id).toBe("d");
  expect(lengths.longestTime?.game.id).toBe("e");
  expect(lengths.shortestTime?.game.id).toBe("f");
  expect(lengths.counted).toBe(6);
  // Games with no time still count for moves.
  const partial = gameLengths([game("x", 10, undefined), game("y", 20, undefined)]);
  expect(partial.longestMoves?.game.id).toBe("y");
  expect(partial.longestTime).toBeNull();
  expect(gameLengths([]).longestMoves).toBeNull();
  // Time can be looked up from a replay for older games.
  expect(gameLengths([game("x", 10, undefined)], () => 77).shortestTime?.seconds).toBe(77);
  expect(formatDuration(20)).toBe("20 seconds");
  expect(formatDuration(1500)).toBe("25 min");
  expect(formatDuration(65)).toBe("1 min 5 s");
  expect(formatDuration(3900)).toBe("1 h 05 min");
});

const replay = (id: string, hands: boolean): GameReplay => ({
  id, startedAt: new Date(Date.now() - 864e5).toISOString(), names: ["You", "John"], computers: [1], online: false,
  start: { counts: [3, 3], pile: ["7C"], suit: "C", dealer: 1, ...(hands ? { hands: [["3C", "4C", "9H"], ["5D", "6S", "KH"]] } : {}) },
  events: [
    { k: "m", t: 1000, seat: 0, type: "play", cards: ["3C"], suit: "C", counts: [2, 3] },
    { k: "m", t: 2000, seat: 1, type: "draw", drew: ["QD"], counts: [2, 4] },
    { k: "m", t: 3000, seat: 0, type: "play", cards: ["4C"], suit: "C", counts: [1, 4] },
    { k: "m", t: 4000, seat: 1, type: "play", cards: ["KH"], suit: "H", counts: [1, 3] },
    { k: "m", t: 5000, seat: 0, type: "play", cards: ["9H"], suit: "H", counts: [0, 3] },
  ],
  winner: 0, finishedAt: new Date(Date.now() - 864e5 + 6000).toISOString(),
});

test("a replay rebuilds every hand, move by move", () => {
  const frames = replayFrames(replay("r", true));
  expect(frames[0].hands).toEqual([["3C", "4C", "9H"], ["5D", "6S", "KH"]]);
  expect(frames[1].hands?.[0]).toEqual(["4C", "9H"]);
  expect(frames[2].hands?.[1]).toEqual(["5D", "6S", "KH", "QD"]);
  expect(frames[2].drew).toEqual(["QD"]);
  const end = frames[frames.length - 1];
  expect(end.hands).toEqual([[], ["5D", "6S", "QD"]]);
  // A replay recorded before hands were kept simply has none.
  expect(replayFrames(replay("old", false))[3].hands).toBeNull();
  // A replay whose books do not add up stops showing hands instead of showing wrong ones.
  const broken = replay("bad", true);
  const wrong: GameReplay = { ...broken, events: broken.events.map((event, index) => (index === 1 && event.k === "m" ? { ...event, drew: [] } : event)) };
  expect(replayFrames(wrong)[2].hands).toBeNull();
});

test("an online replay takes the server's complete log, with every hand, and keeps the reactions where they were said", () => {
  // This phone only saw the last two moves (it joined late) and one remark; it never held the other hands.
  const seen: GameReplay = {
    ...replay("online", false), online: true,
    start: { counts: [3, 3], pile: ["7C"], suit: "C", dealer: 1 },
    events: [{ k: "m", t: 4000, seat: 1, type: "play", cards: ["KH"], suit: "H", counts: [1, 3] }, { k: "r", t: 4500, seat: 0, from: "You", id: "pick-up-sunshine" }, { k: "m", t: 5000, seat: 0, type: "play", cards: ["9H"], suit: "H", counts: [0, 3] }],
  };
  const full = replay("online", true);
  const merged = withServerLog(seen, { hands: full.start.hands!, moves: full.events.filter((event): event is Extract<typeof event, { k: "m" }> => event.k === "m") });
  expect(merged.events.filter((event) => event.k === "m")).toHaveLength(5);
  expect(merged.events.map((event) => event.k).join("")).toBe("mmmmrm");
  const frames = replayFrames(merged);
  expect(frames[0].hands).toEqual([["3C", "4C", "9H"], ["5D", "6S", "KH"]]);
  expect(frames[frames.length - 1].hands).toEqual([[], ["5D", "6S", "QD"]]);
  expect(frames[frames.length - 1].said.map((entry) => entry.id)).toEqual(["pick-up-sunshine"]);
});

test("Me lists the four records and each opens a replay with every hand face up", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(async ({ replays }) => {
    const clubStore = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    const day = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString();
    clubStore.updateClub((current: Record<string, unknown>) => {
      const ensured = profiles.ensureProfiles(current, ["Sam"]);
      const sam = ensured.players[0];
      const make = (id: string, moves: number, seconds: number | undefined, daysAgo: number) => ({ id, playedAt: day(daysAgo), playerId: sam.id, opponents: 1, level: "standard", won: true, place: 1, moves, ...(seconds !== undefined ? { seconds } : {}) });
      const games = [make("long", 80, 600, 5), make("short", 12, 45, 3), make("slow", 50, 1500, 4), make("fast", 30, 20, 6), make("mid", 40, 300, 2)];
      return { ...ensured.extensions, switchMe: sam.id, switchComputerGames: games };
    });
    window.localStorage.setItem("switchGameReplays", JSON.stringify(replays));
  }, { replays: [replay("short", true), replay("slow", false), replay("long", true)] });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();

  const card = page.getByTestId("game-lengths");
  await expect(card).toBeVisible();
  await expect(card.locator('[data-length="longestMoves"]')).toContainText("80 moves");
  await expect(card.locator('[data-length="shortestMoves"]')).toContainText("12 moves");
  await expect(card.locator('[data-length="longestTime"]')).toContainText("25 min");
  await expect(card.locator('[data-length="shortestTime"]')).toContainText("20 seconds");
  // The shortest-time game has no replay on the phone; the card says so rather than offering a dead button.
  await expect(card.locator('[data-length="shortestTime"]')).toContainText("No replay kept");

  await page.getByTestId("watch-shortestMoves").click();
  await expect(page.getByTestId("replay-hands")).toBeVisible();
  await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill("0");
  await expect(page.locator(".replay-hand .rh-card")).toHaveCount(6);
  await expect(page.locator('.replay-hand[data-seat="1"] [data-card="KH"]')).toBeVisible();
  await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill("2");
  await expect(page.locator('.replay-hand[data-seat="1"] [data-card="QD"]')).toHaveClass(/fresh/);
  await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill("5");
  await expect(page.locator('.replay-hand[data-seat="0"]')).toContainText("Out");
  await expect(page.locator('.replay-hand[data-seat="1"] .rh-card')).toHaveCount(3);
});

test("a replay saved before hands were kept says so", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(async ({ replays }) => {
    const clubStore = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    clubStore.updateClub((current: Record<string, unknown>) => {
      const ensured = profiles.ensureProfiles(current, ["Sam"]);
      const sam = ensured.players[0];
      return { ...ensured.extensions, switchMe: sam.id, switchComputerGames: [{ id: "slow", playedAt: new Date().toISOString(), playerId: sam.id, opponents: 1, level: "standard", won: true, place: 1, moves: 50, seconds: 1500 }] };
    });
    window.localStorage.setItem("switchGameReplays", JSON.stringify(replays));
  }, { replays: [replay("slow", false)] });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await page.getByTestId("watch-longestTime").click();
  await expect(page.getByTestId("replay-no-hands")).toBeVisible();
});

test("the games that hold a record keep their replay beyond the newest 30", async ({ page }) => {
  await page.goto("/");
  const kept = await page.evaluate(async () => {
    const mod = await import("/src/switch/gameReplay.ts");
    const make = (id: string, count: number, gap: number) => ({
      id, startedAt: new Date(Date.now() - 864e5).toISOString(), names: ["You", "John"], computers: [1], online: false,
      start: { counts: [3, 3], pile: ["7C"], suit: "C", dealer: 1, hands: [["3C", "4C", "9H"], ["5D", "6S", "KH"]] },
      events: Array.from({ length: count }, (_, index) => ({ k: "m", t: index * gap, seat: index % 2, type: "draw", counts: [3, 3] })),
    });
    const finish = (id: string, count: number, gap: number) => mod.finishReplay(make(id, count, gap) as never, 0, Date.now() - 864e5 + count * gap, count);
    finish("middling", 40, 2000); finish("long", 90, 5000); finish("short", 5, 1000); finish("other", 20, 3000);
    // Thirty more ordinary games push the record-holders out of the newest 30.
    for (let index = 0; index < 31; index += 1) finish(`filler-${index}`, 30, 3000);
    return { pinned: JSON.parse(window.localStorage.getItem("switchRecordReplays") ?? "[]").map((entry: { id: string }) => entry.id).sort(), recent: mod.getReplays().length, longSeconds: mod.getReplay("long")?.seconds, shortSeconds: mod.getReplay("short")?.seconds, stillThere: mod.getReplay("long") !== null && mod.getReplay("short") !== null && mod.getReplay("middling") === null };
  });
  expect(kept.recent).toBe(30);
  expect(kept.pinned).toEqual(["long", "short"]);
  expect(kept.longSeconds).toBe(450);
  expect(kept.shortSeconds).toBe(5);
  expect(kept.stillThere).toBe(true);
});
