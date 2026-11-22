import { expect, test } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { REACTIONS as SERVER_REACTIONS } from "../api/_room.js";
import { banterFor, reactionOf, REACTIONS, SAYINGS, SPICY_SAYINGS, STICKERS, VOICE_REACTIONS } from "../src/switch/reactions";
import { momentsOf } from "../api/_cardTalk.js";
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
  expect(REACTIONS).toHaveLength(85 + VOICE_REACTIONS.length);
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
  // Every replay shows every player's hand face up (owner decision, 21 Nov 2026).
  await expect(page.getByTestId("replay-hands")).toBeVisible();
  await expect(page.locator(".replay-hand")).toHaveCount(2);
  await expect(page.getByTestId("replay-line")).toContainText(/John plays Nine of clubs|John: /, { timeout: 15_000 });
  await expect(page.locator(".replay-talk")).toContainText("Too easy");
  await page.getByRole("slider", { name: "Jump to a moment in the game" }).fill("2");
  await expect(page.getByTestId("replay-line")).toHaveText("You play Three of clubs.");
  await expect(page.getByRole("table", { name: "Stats so far" })).toContainText("John");

  // The same replay opens from Me > History.
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Table talk" })).toBeVisible();
});

test("every computer has its own voice: short lines, mirrored on the server, aimed at people and at each other", () => {
  const ids = VOICE_REACTIONS.map((line) => line.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const line of VOICE_REACTIONS) {
    expect(line.text.split(/\s+/).length, line.text).toBeLessThanOrEqual(9);
    expect(SERVER_REACTIONS, line.id).toContain(line.id);
  }
  const names = ["You", "John", "Paul", "Ringo"];
  const rolls = (count: number) => { let n = 0; return () => ((n++ * 0.37 + 0.11) % 0.97); void count; };
  let userDigs = 0;
  let exchanges = 0;
  for (let round = 0; round < 400; round += 1) {
    const roll = rolls(round);
    for (let skip = 0; skip < round % 17; skip += 1) roll();
    // A computer makes you pick up: it can needle you.
    const onYou = banterFor({ kind: "penalty", victim: 0, by: 1, cards: 4 }, names, [1, 2, 3], roll, false);
    if (onYou && /^john-user-/.test(onYou.id)) userDigs += 1;
    // A computer makes another computer pick up: it can needle it, and the victim can hit back.
    const onPaul = banterFor({ kind: "penalty", victim: 2, by: 1, cards: 4 }, names, [1, 2, 3], roll, false);
    if (onPaul?.answer) {
      exchanges += 1;
      expect(onPaul.answer.seat).toBe(2);
      expect(onPaul.answer.id.startsWith("paul-")).toBe(true);
    }
  }
  expect(userDigs).toBeGreaterThan(0);
  expect(exchanges).toBeGreaterThan(0);
});

test("what they say is about the cards: plays, hits, mistakes and great shots", () => {
  // What counts as a moment.
  expect(momentsOf({ cards: ["KS"] })).toEqual(["blackKing"]);
  expect(momentsOf({ cards: ["KH"] })).toEqual(["redKing"]);
  expect(momentsOf({ cards: ["7D", "7S"] })).toEqual(["seven"]);
  expect(momentsOf({ cards: ["9D", "9S", "9C"] })).toEqual(["set"]);
  expect(momentsOf({ cards: ["2D"], pendingBefore: { kind: "draw-two", cards: 2 }, pendingAfter: { kind: "draw-two", cards: 4 } })).toEqual(["counter", "two"]);
  expect(momentsOf({ cards: ["2D"], pendingBefore: { kind: "draw-two", cards: 4 }, pendingAfter: { kind: "draw-two", cards: 6 } })).toEqual(["stack", "counter", "two"]);
  expect(momentsOf({ cards: ["AH"], won: true })).toEqual(["finish", "ace"]);
  expect(momentsOf({ cards: ["4D"] })).toEqual([]);

  const names = ["You", "John", "Paul", "George"];
  const always = () => 0;
  // A computer playing a black king talks about the black king, in its own voice.
  const king = banterFor({ kind: "play", seat: 1, cards: ["KS"], pendingBefore: null, pendingAfter: { kind: "black-king", units: 1, cards: 5 } as never, won: false, next: 2 }, names, [1, 2, 3], always, false);
  expect(king?.seat).toBe(1);
  expect(king?.id).toMatch(/^john-play-blackKing-/);
  // And the computer it lands on answers about the card that landed on it.
  expect(king?.answer?.seat).toBe(2);
  expect(king?.answer?.id).toMatch(/^paul-hit-blackKing-/);
  // A card played at a computer by you draws a remark from that computer, about that card.
  const eight = banterFor({ kind: "play", seat: 0, cards: ["8H"], pendingBefore: null, pendingAfter: { kind: "miss-turn" }, won: false, next: 1 }, names, [1, 2, 3], always, false);
  expect(eight?.id).toMatch(/^john-hit-eight-/);
  // A great shot by you gets a grudging word from another computer.
  const great = banterFor({ kind: "play", seat: 0, cards: ["9D", "9S", "9C"], pendingBefore: null, pendingAfter: null, won: false }, names, [1, 2, 3], always, false);
  expect(great?.id).toMatch(/^john-great-/);
  // Plain cards say nothing.
  expect(banterFor({ kind: "play", seat: 1, cards: ["4D"], pendingBefore: null, pendingAfter: null, won: false }, names, [1, 2, 3], always, false)).toBeNull();
  // A mistake is mocked, and a computer's own mistake is its own embarrassment.
  expect(banterFor({ kind: "mistake", seat: 0, what: "illegal" }, names, [1, 2, 3], always, false)?.id).toMatch(/^john-caught-illegal-/);
  const forgot = banterFor({ kind: "mistake", seat: 2, what: "lastCard" }, names, [1, 2, 3], always, false);
  expect(forgot?.seat).toBe(2);
  expect(forgot?.id).toMatch(/^paul-mistake-/);
  // A missed Last Card is mocked with a line about exactly that.
  expect(banterFor({ kind: "spotted", victim: 0, by: 3 }, names, [1, 2, 3], always, false)?.id).toMatch(/^george-caught-lastCard-/);
});

test("the game ends on the table: who went out, with what, why you lost and everyone's cards, before the results", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("switchTableSpeed", "quick");
    localStorage.setItem("switchShowEnding", "1");
    localStorage.setItem("switchTableGame", JSON.stringify({
      version: 1, id: "cpu-ending-game", opponents: 1, level: "standard", awaitingLastCard: false, savedAt: new Date().toISOString(),
      game: { hands: [["3C", "4D", "6S"], ["9C"]], drawPile: ["5D", "8C", "JD", "QS", "KD", "7C", "9S", "10H"], discardPile: ["5C"], currentSuit: "C", turn: 0, direction: 1, dealer: 1, pendingPenalty: null, status: "playing", winner: null, move: 3 },
    }));
  });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Resume your game/ }).click();
  await page.locator('[data-card="3C"]').click();
  await page.getByRole("button", { name: "Play selected" }).click();
  // The ending comes first: the winner, the winning card, why you lost, and every hand face up.
  const ending = page.getByTestId("game-ending");
  await expect(ending).toBeVisible({ timeout: 15_000 });
  await expect(ending.getByRole("heading", { name: /John won/ })).toBeVisible();
  await expect(page.getByTestId("end-why")).toContainText("still holding 2 cards");
  await expect(ending.getByRole("list", { name: "Cards left in each hand" })).toContainText("You");
  // Only the ending says it so far: the results screen has not opened yet.
  await expect(page.getByRole("heading", { name: /John won/ })).toHaveCount(1);
  // Then the results, when you ask for them.
  await page.getByTestId("end-continue").click();
  await expect(page.getByRole("heading", { name: /John won/ })).toBeVisible();
});

test("depth: every computer has plenty to say, and nobody repeats a line while they have another", () => {
  const names = ["You", "John", "Paul", "George", "Ringo", "Ziggy", "Bowie", "Marley"];
  for (const name of names.slice(1)) {
    const lines = VOICE_REACTIONS.filter((line) => line.id.startsWith(`${name.toLowerCase()}-`));
    expect(lines.length, name).toBeGreaterThanOrEqual(120);
  }
  // A long run of the same kind of event: the same computer almost never says the same thing twice running.
  let n = 0;
  const random = () => ((n++ * 0.6180339887) % 1);
  let repeats = 0;
  let last = "";
  let said = 0;
  for (let round = 0; round < 300; round += 1) {
    const remark = banterFor({ kind: "win", winner: 1 }, names.slice(0, 4), [1, 2, 3], random, false);
    if (remark?.seat === 1) { said += 1; if (remark.id === last) repeats += 1; last = remark.id; }
  }
  expect(said).toBeGreaterThan(50);
  expect(repeats).toBe(0);
});
