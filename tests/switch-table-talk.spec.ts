import { expect, test } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { REACTIONS as SERVER_REACTIONS } from "../api/_room.js";
import { banterFor, reactionOf, REACTIONS, SAYINGS, SPICY_SAYINGS, STICKERS } from "../src/switch/reactions";
import { replayFrames, summariseReactions, type GameReplay } from "../src/switch/gameReplay";

/**
 * Table talk (owner decisions, 14 and 15 Nov 2026): cheeky banter, optional spicy swearing with clean stand-ins for
 * phones that have it off, our own stickers in place of emoji, computers that answer back, every reaction kept for
 * stats, and every game replayable at speed.
 */

test("spicy talk: swearing only on phones that asked for it, a clean stand-in everywhere else", () => {
  expect(SPICY_SAYINGS).toHaveLength(37);
  // Every swear word is always masked (F#~k, b@stard, w8nkr, pr1k, r's-hole) so even spicy talk stays family friendly.
  const UNMASKED = /bollocks|bugger|bloody|\bsod|bastard|\barse|shite|shit|piss|fuck|wanker|prick|dick|twat|tosser|bellend|bullshit|\bdamn|\bhell|\bcrap|\bgit\b|\bknob/i;
  for (const entry of SPICY_SAYINGS) {
    expect(entry.id.startsWith("spicy-")).toBe(true);
    expect(entry.clean && entry.clean !== entry.text).toBe(true);
    expect(reactionOf(entry.id, true)?.text).toBe(entry.text);
    expect(reactionOf(entry.id, false)?.text).toBe(entry.clean);
    expect(entry.text, entry.id).not.toMatch(UNMASKED);
    expect(entry.text, entry.id).toMatch(/[#@*~!$0-9']/);
    // Nothing that swears survives in the clean version, masked or not.
    expect(entry.clean, entry.id).not.toMatch(UNMASKED);
    expect(entry.clean, entry.id).not.toMatch(/[#@*~$]/);
  }
  // Clean sayings read the same either way.
  expect(reactionOf("behave", false)?.text).toBe("Behave!");
  // Computers only swear for someone who turned Spicy on.
  const names = ["You", "John", "Paul"];
  const clean = new Set<string>();
  const spicy = new Set<string>();
  for (let n = 0; n < 200; n += 1) {
    const roll = () => (n % 100) / 100;
    const a = banterFor({ kind: "win", winner: 0 }, names, [1, 2], () => 0, false);
    const b = banterFor({ kind: "win", winner: 0 }, names, [1, 2], () => roll() * 0.999, true);
    if (a) clean.add(a.id);
    if (b) spicy.add(b.id);
  }
  expect([...clean].some((id) => id.startsWith("spicy-"))).toBe(false);
  expect([...spicy].some((id) => id.startsWith("spicy-"))).toBe(true);
});

test("eighty-five reactions: ten sayings, eight of our own stickers, thirty-seven masked spicy ones and thirty favourites the computers send, the same ids the server accepts, no emoji", () => {
  expect(SAYINGS).toHaveLength(10);
  expect(STICKERS).toHaveLength(8);
  expect(REACTIONS).toHaveLength(85);
  expect(REACTIONS.map((entry) => entry.id).sort()).toEqual([...SERVER_REACTIONS].sort());
  expect(STICKERS.every((entry) => entry.sticker === entry.id)).toBe(true);
  for (const entry of REACTIONS) expect(entry.text).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("only computers banter, and only as often as their personality allows", () => {
  const names = ["You", "John", "Paul"];
  const always = () => 0;
  const never = () => 0.999;
  // A penalty dealt by John to you: John gloats.
  expect(banterFor({ kind: "penalty", victim: 0, by: 1, cards: 4 }, names, [1, 2], always)?.seat).toBe(1);
  // You never speak for yourself, even when you win.
  const win = banterFor({ kind: "win", winner: 0 }, names, [1, 2], always);
  expect(win && win.seat).not.toBe(0);
  expect(banterFor({ kind: "penalty", victim: 0, by: 1, cards: 2 }, names, [1, 2], never)).toBeNull();
  // Someone always has something to say when you win.
  expect(banterFor({ kind: "win", winner: 0 }, names, [1, 2], () => 0.9)).not.toBeNull();
  // Online, people are not computers: nobody banters for them.
  expect(banterFor({ kind: "reply", to: 0 }, names, [], always)).toBeNull();
  const remark = banterFor({ kind: "reply", to: 0 }, names, [1, 2], always);
  expect(REACTIONS.some((entry) => entry.id === remark?.id)).toBe(true);
});

test("a replay rebuilds the running stats from public moves only", () => {
  const replay: GameReplay = {
    id: "g1", startedAt: new Date(0).toISOString(), names: ["You", "John"], computers: [1], online: false,
    start: { counts: [3, 3], pile: ["5C"], suit: "C", dealer: 1 },
    events: [
      { k: "m", t: 10, seat: 0, type: "play", cards: ["2C"], counts: [2, 3] },
      { k: "r", t: 20, seat: 0, from: "You", id: "pick-up-sunshine" },
      { k: "m", t: 30, seat: 1, type: "draw", counts: [2, 5] },
      { k: "r", t: 40, seat: 1, from: "John", id: "salty" },
      { k: "m", t: 50, seat: 0, type: "play", cards: ["3C"], counts: [1, 5] },
    ],
    winner: null,
  };
  const frames = replayFrames(replay);
  expect(frames).toHaveLength(6);
  const end = frames[frames.length - 1];
  expect(end.move).toBe(3);
  expect(end.tally[0]).toMatchObject({ cards: 1, played: 2, pickedUp: 0, penaltiesDealt: 1, reactions: 1 });
  expect(end.tally[1]).toMatchObject({ cards: 5, played: 0, pickedUp: 2, reactions: 1 });
  expect(end.said.map((entry) => entry.id)).toEqual(["pick-up-sunshine", "salty"]);
  expect(end.pile.at(-1)).toBe("3C");
  expect(frames[3].line).toBe("John picks up 2 cards.");
  expect(end.line).toContain("You are on Last Card");

  const summary = summariseReactions([
    { gameId: "g1", at: "", move: 1, from: "You", mine: true, computer: false, online: false, id: "pick-up-sunshine" },
    { gameId: "g1", at: "", move: 2, from: "John", mine: false, computer: true, online: false, id: "salty" },
    { gameId: "g2", at: "", move: 4, from: "John", mine: false, computer: true, online: false, id: "behave" },
  ]);
  expect(summary).toMatchObject({ sent: 1, received: 2, games: 2, favourite: { id: "pick-up-sunshine", count: 1 }, chattiest: { name: "John", count: 2 } });
});

test("react at the computer table, finish the game, then watch it back with the talk and the stats", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchTableSpeed", "quick");
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-talk-game", opponents: 1, level: "standard", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: [["3C", "4D", "6S"], ["9C"]], drawPile: ["5D", "8C", "JD", "QS", "KD", "7C", "9S", "10H"], discardPile: ["5C"], currentSuit: "C", turn: 0, direction: 1, dealer: 1, pendingPenalty: null, status: "playing", winner: null, move: 3 },
    }));
  });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await expect(page.locator(".table-game")).toBeVisible();

  // A sticker, sent by you, shows beside your seat.
  await page.getByTestId("react-button").click();
  await page.locator('[data-reaction="smug-king"]').click();
  await expect(page.locator('.your-seat [data-testid="reaction-bubble"]')).toContainText("You: Too easy");

  // Play the three; John goes out with his last card.
  await page.locator('[data-card="3C"]').click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.getByRole("heading", { name: /John won/ })).toBeVisible({ timeout: 15_000 });

  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("switchReactionLog") ?? "[]"));
  expect(log.some((entry: { gameId: string; id: string; mine: boolean }) => entry.gameId === "cpu-talk-game" && entry.id === "smug-king" && entry.mine)).toBe(true);

  await page.getByTestId("watch-replay").click();
  await expect(page.getByTestId("replay-table")).toBeVisible();
  await expect(page.getByTestId("replay-line")).toContainText(/John plays Nine of clubs|John: /, { timeout: 15_000 });
  await expect(page.locator(".replay-talk")).toContainText("Too easy");
  await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill("2");
  await expect(page.getByTestId("replay-line")).toHaveText("You play Three of clubs.");
  await expect(page.getByRole("table", { name: "Stats so far" })).toContainText("John");

  // The same replay opens from Me > History.
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Table talk" })).toBeVisible();
});
