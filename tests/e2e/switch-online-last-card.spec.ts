import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error plain JavaScript modules shared with the Vercel function
import { handleRoom, memoryStore, TIMING } from "../../api/_room.js";

/**
 * Owner report, 18 Nov 2026: at an online table a player was penalised for not saying "Last Card" when she had.
 * A Last Card pressed on your phone must always reach the table and always beat the clock.
 */

const phone = { width: 430, height: 932 };

type Table = { game: { hands: string[][]; turn: number; discardPile: string[]; currentSuit: string; pendingPenalty: unknown; drawPile: string[]; status: string; winner: number | null }; players: number[]; moves: { type: string }[] };

/** One server with a clock that can be moved on, and a table of Ana (a person on this phone), Ben (a person elsewhere) and a computer. */
async function setUp(page: Page, hand: string[], { failCalls = 0 } = {}) {
  const store = memoryStore();
  const clock = { offset: 0 };
  const now = () => Date.now() + clock.offset;
  const handle = (request: Request) => handleRoom(request, store, now()) as Promise<Response>;
  const post = async (query: string, body: unknown, token = "") => (await handle(new Request(`https://example.test/api/room${query}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-seat-token": token } : {}) }, body: JSON.stringify(body) }))).json();
  const made = await post("", { name: "Ana", seats: 3, level: "standard" });
  const code: string = made.code;
  const joined = await post(`?code=${code}&op=join`, { name: "Ben" });
  await post(`?code=${code}&op=start`, {}, made.token);

  // Ana's turn, holding the cards this test needs. Nobody else is anywhere near going out.
  const row = store.rows.get(code);
  const table: Table = row.tables.at(-1);
  const ana = row.seats.findIndex((seat: { name: string }) => seat.name === "Ana");
  const at = table.players.indexOf(ana);
  const others = [["3D", "4D", "6D", "7D", "9D", "10D", "QD"], ["3H", "4H", "6H", "7H", "9H", "10H", "QH"]];
  table.game.hands = table.game.hands.map((current, index) => (index === at ? hand : others.shift()!));
  table.game.turn = at;
  table.game.discardPile = ["5S"];
  table.game.currentSuit = "S";
  table.game.pendingPenalty = null;
  table.game.drawPile = ["2C", "3C", "4C", "6C", "8C", "10C", "QC", "JC"];

  const calls = { sent: 0 };
  await page.context().route("**/api/room**", async (route) => {
    const req = route.request();
    if (req.url().includes("op=call")) {
      calls.sent += 1;
      // A weak signal or a busy server: the first calls never arrive.
      if (calls.sent <= failCalls) { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The table is busy. Try again." }) }); return; }
    }
    const response = await handle(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }));
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
  await page.addInitScript(({ code, token }) => {
    localStorage.setItem("switchOnlineTable", JSON.stringify({ code, token, name: "Ana", savedAt: Date.now() }));
  }, { code, token: made.token });
  await page.goto(`/?table=${code}`);
  await expect(page.getByLabel("Your hand")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".player-hand button")).toHaveCount(hand.length);

  const live = (): Table => store.rows.get(code).tables.at(-1);
  const mine = () => live().game.hands[live().players.indexOf(ana)];
  const poll = () => handle(new Request(`https://example.test/api/room?code=${code}`, { method: "GET", headers: { "x-seat-token": joined.token } }));
  const seat = (): { called: boolean } => store.rows.get(code).seats[ana];
  return { clock, calls, live, mine, poll, ana, seat };
}

test("one card left: select it, say Last Card, then Play wins online too (ruling 26)", async ({ page }) => {
  const t = await setUp(page, ["5H"]);
  await page.locator('.player-hand button[data-card="5H"]').click();
  await page.getByTestId("last-card-button").click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect.poll(() => t.live().game.status, { timeout: 10_000 }).toBe("won");
  expect(t.live().game.winner).toBe(t.live().players.indexOf(t.ana));
});

test("a Last Card call that fails to reach the table is sent again, and other phones' clocks never beat it", async ({ page }) => {
  const t = await setUp(page, ["5H", "KD"], { failCalls: 2 });
  await page.locator('.player-hand button[data-card="5H"]').click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect(page.locator(".player-hand button")).toHaveCount(1, { timeout: 10_000 });
  await page.getByTestId("last-card-button").click();
  await expect.poll(() => t.calls.sent, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("last-card-button")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => t.seat().called, { timeout: 5_000 }).toBe(true);
  // Long after the five seconds and the table's own backstop, with another phone looking in: still one card.
  t.clock.offset += TIMING.spotBackstopMs + 5_000;
  await t.poll();
  await page.waitForTimeout(6_500);
  await t.poll();
  expect(t.mine()).toHaveLength(1);
  expect(t.live().moves.some((move) => move.type === "spot")).toBe(false);
});

test("not saying Last Card: your own phone tells the table when your five seconds are up, and you pick up two", async ({ page }) => {
  const t = await setUp(page, ["5H", "KD"]);
  await page.locator('.player-hand button[data-card="5H"]').click();
  await page.getByRole("button", { name: "Play selected" }).click();
  await expect.poll(() => t.mine().length, { timeout: 5_000 }).toBe(1);
  // Not before five seconds on this phone...
  await page.waitForTimeout(3_500);
  expect(t.mine()).toHaveLength(1);
  // ...and soon after.
  await expect.poll(() => t.mine().length, { timeout: 6_000 }).toBe(3);
  await expect(page.locator(".player-hand button")).toHaveCount(3, { timeout: 6_000 });
});
