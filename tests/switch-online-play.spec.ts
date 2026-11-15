import { expect, test, type BrowserContext, type Page } from "@playwright/test";
// @ts-expect-error plain JavaScript modules shared with the Vercel function
import { handleRoom, memoryStore } from "../api/_room.js";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { REACTIONS as SERVER_REACTIONS } from "../api/_room.js";
import { REACTIONS } from "../src/switch/onlineRoom";

/** One shared copy of the server. Both phones talk to it through the real request handler, as they do on Vercel. */
function serve(context: BrowserContext, store: unknown) {
  return context.route("**/api/room**", async (route) => {
    const req = route.request();
    const response: Response = await handleRoom(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }), store);
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
}

const phone = { width: 430, height: 932 };

test("the reactions the app offers are exactly the ones the server accepts", () => {
  expect(REACTIONS.map((entry) => entry.id).sort()).toEqual([...SERVER_REACTIONS].sort());
  expect(REACTIONS).toHaveLength(18);
});

async function openFriends(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "Play", exact: true }).click();
  await page.getByTestId("play-friends").click();
}

test("two phones: one starts a table, the other joins with the link, the host deals and both see the game", async ({ browser }) => {
  test.setTimeout(90_000);
  const store = memoryStore();
  const hostContext = await browser.newContext({ viewport: phone });
  const friendContext = await browser.newContext({ viewport: phone });
  await serve(hostContext, store); await serve(friendContext, store);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();

  // The host sets up a table for four: themself, a friend and two computers.
  await host.goto("/");
  await openFriends(host);
  await host.getByRole("button", { name: /Start a table/ }).click();
  await host.getByLabel("Your name at the table").fill("Mark");
  await host.getByRole("button", { name: "3 seats" }).click();
  await host.getByRole("button", { name: /Set up the table/ }).click();
  const code = (await host.getByTestId("table-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(host.getByTestId("start-online")).toBeDisabled();

  // The friend opens the invitation link: the code is already in, and they only say who they are.
  await friend.goto(`/?table=${code}`);
  await expect(friend.getByLabel("Table code")).toHaveValue(code);
  await expect(friend.getByText(/Mark/).first()).toBeVisible();
  await friend.getByLabel("Your name at the table").fill("Rebecca");
  await friend.getByRole("button", { name: "Take a seat" }).click();
  await expect(friend.getByText("Waiting for Mark to start the game…")).toBeVisible();
  await expect(host.getByText("Rebecca")).toBeVisible({ timeout: 10_000 });

  // The host deals. One empty seat is played by a computer.
  await expect(host.getByTestId("start-online")).toBeEnabled();
  await host.getByTestId("start-online").click();
  await expect(host.getByLabel("Your hand")).toBeVisible();
  await expect(friend.getByLabel("Your hand")).toBeVisible({ timeout: 10_000 });
  await expect(host.locator(".player-hand button")).toHaveCount(7);
  await expect(friend.locator(".player-hand button")).toHaveCount(7);

  // Each phone holds only its own cards: the other's hand never reaches this one.
  const hostCards = await host.locator(".player-hand button").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card")));
  const friendCards = await friend.locator(".player-hand button").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card")));
  const hostMarkup = await host.content();
  for (const card of friendCards) expect(hostMarkup).not.toContain(`data-card="${card}"`);
  expect(new Set([...hostCards, ...friendCards]).size).toBe(14);

  // Whoever has the first move picks a card up; the other phone sees the table move on.
  const mover = (await host.getByTestId("turn-status").textContent())?.includes("YOUR MOVE") ? host : (await friend.getByTestId("turn-status").textContent())?.includes("YOUR MOVE") ? friend : null;
  if (mover) {
    const other = mover === host ? friend : host;
    const before = await mover.locator(".player-hand button").count();
    await mover.locator(".draw-pile").click();
    await expect(mover.locator(".player-hand button")).toHaveCount(before + 1, { timeout: 10_000 });
    await expect(other.getByTestId("turn-status")).not.toHaveText("YOUR MOVE", { timeout: 5_000 });
  }

  // A reaction from the friend appears on the host's phone.
  await friend.getByRole("button", { name: "Send a reaction" }).click();
  await friend.locator('[data-reaction="read-em-and-weep"]').click();
  await expect(host.getByTestId("reaction-bubble")).toBeVisible({ timeout: 10_000 });
  await expect(host.getByTestId("reaction-bubble")).toContainText("Read 'em and weep");
});

test("a table code that does not exist says so", async ({ browser }) => {
  const context = await browser.newContext({ viewport: phone });
  await serve(context, memoryStore());
  const page = await context.newPage();
  await page.goto("/?table=ZZZZ99");
  await expect(page.getByRole("alert")).toContainText(/No table found/);
  await expect(page.getByRole("button", { name: "Take a seat" })).toBeDisabled();
});

// ── Tournaments online ──
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { chooseTableAction } from "../api/_engine.js";

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The server's clock can be moved on, so computer turns and the gap between games pass without waiting. */
function server(seed: number) {
  const store = memoryStore();
  const clock = { offset: 0, random: seeded(seed), now: () => Date.now() + clock.offset };
  const handle = (request: Request) => handleRoom(request, store, clock.now(), clock.random) as Promise<Response>;
  const attach = (context: BrowserContext) => context.route("**/api/room**", async (route) => {
    const req = route.request();
    const response = await handle(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }));
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
  const api = async (code: string, token: string, op?: string, body?: unknown) => {
    const response = await handle(new Request(`https://example.test/api/room?code=${code}${op ? `&op=${op}` : ""}`, { method: op ? "POST" : "GET", headers: { "content-type": "application/json", "x-seat-token": token }, body: op ? JSON.stringify(body ?? {}) : undefined }));
    return response.json();
  };
  /** Plays the current game to its end: people's moves are sent for them, and time passes for the computers. */
  /**
   * Plays games to their end: people's moves are sent for them, and time passes for the computers. `only` limits it to
   * the game that person is in; otherwise every game with a person in it is finished.
   */
  const finishGame = async (code: string, tokens: Record<string, string>, only?: string) => {
    for (let step = 0; step < 4000; step += 1) {
      const room = store.rows.get(code);
      const live = room.tables.filter((table: { game: { status: string }; players: number[] }) => table.game.status === "playing" && table.players.some((index) => (only ? room.seats[index].name === only : room.seats[index].kind === "human")));
      if (!live.length) return;
      const ready = live.find((table: { game: { turn: number }; players: number[] }) => room.seats[table.players[table.game.turn]].kind === "human" && (!only || room.seats[table.players[table.game.turn]].name === only));
      if (ready) { const name = room.seats[ready.players[ready.game.turn]].name; await api(code, tokens[name], "move", { action: chooseTableAction(ready.game, clock.random, "standard"), lastCard: true }); }
      else { clock.offset += 2_100; await api(code, Object.values(tokens)[0]); }
    }
    throw new Error("the game did not end");
  };
  return { store, clock, attach, api, finishGame };
}

async function seat(page: Page): Promise<{ code: string; token: string }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("switchOnlineTable")!));
}

async function setUp(browser: Parameters<Parameters<typeof test>[1]>[0]["browser"], srv: ReturnType<typeof server>, mode: string, seats: number) {
  const hostContext = await browser.newContext({ viewport: phone });
  const friendContext = await browser.newContext({ viewport: phone });
  await srv.attach(hostContext); await srv.attach(friendContext);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();
  await host.goto("/");
  await openFriends(host);
  await host.getByRole("button", { name: /Start a table/ }).click();
  await host.getByLabel("Your name at the table").fill("Mark");
  await host.getByRole("group", { name: "Way to play" }).getByRole("button", { name: mode }).click();
  await host.getByRole("button", { name: `${seats} seats`, exact: true }).click();
  await host.getByRole("button", { name: /Set up the table/ }).click();
  await expect(host.getByTestId("table-mode")).toContainText(mode);
  const code = (await host.getByTestId("table-code").textContent())!.trim();
  await friend.goto(`/?table=${code}`);
  await friend.getByLabel("Your name at the table").fill("Rebecca");
  await friend.getByRole("button", { name: "Take a seat" }).click();
  await expect(friend.getByTestId("table-mode")).toContainText(mode);
  await expect(host.getByText("Rebecca")).toBeVisible({ timeout: 10_000 });
  await host.getByTestId("start-online").click();
  const tokens = { Mark: (await seat(host)).token, Rebecca: (await seat(friend)).token };
  return { host, friend, code, tokens };
}

test("online Darts: both play, the standings show between games, and the host deals the next one", async ({ browser }) => {
  test.setTimeout(120_000);
  const srv = server(7);
  const { host, friend, code, tokens } = await setUp(browser, srv, "Darts scoring", 3);
  for (const page of [host, friend]) await expect(page.getByTestId("series-strip")).toContainText("Darts scoring · Game 1", { timeout: 10_000 });
  await srv.finishGame(code, tokens);
  for (const page of [host, friend]) {
    await expect(page.getByTestId("online-standings")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("online-standings")).toContainText("First to 3 sets");
    await expect(page.getByTestId("next-game")).toContainText("Game 2");
  }
  await expect(friend.getByTestId("deal-next")).toHaveCount(0);
  await host.getByTestId("deal-next").click();
  for (const page of [host, friend]) await expect(page.getByTestId("series-strip")).toContainText("Game 2", { timeout: 10_000 });
  await expect(host.getByLabel("Your hand")).toBeVisible();
  // The game each person played is saved in their history as part of the match.
  const logged = await friend.evaluate(() => localStorage.getItem("switchScoreKeeper") ?? "");
  expect(logged).toContain(`${code}-1`);
});

test("online Cup: matches are played at the same time; a finished player hears the news and can watch another match", async ({ browser }) => {
  test.setTimeout(120_000);
  // A draw where Mark and Rebecca are in different first-round matches (found by trying seeds against the real server code).
  let chosen = 0;
  for (let seed = 1; seed < 200 && !chosen; seed += 1) {
    const trial = server(seed);
    const made = await (await handleRoom(new Request("https://example.test/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Mark", seats: 4, mode: "cup", level: "standard" }) }), trial.store, Date.now(), trial.clock.random)).json();
    await handleRoom(new Request(`https://example.test/api/room?code=${made.code}&op=join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Rebecca" }) }), trial.store, Date.now(), trial.clock.random);
    await trial.api(made.code, made.token, "start");
    const room = trial.store.rows.get(made.code);
    if (room.tables.length === 2 && room.tables.every((table: { players: number[] }) => table.players.filter((index) => room.seats[index].kind === "human").length === 1)) chosen = seed;
  }
  expect(chosen).toBeGreaterThan(0);
  const srv = server(chosen);
  const { host, friend, code, tokens } = await setUp(browser, srv, "Switch Cup", 4);
  // Both matches are dealt at once: both people are playing, nobody is waiting.
  for (const page of [host, friend]) {
    await expect(page.getByTestId("series-strip")).toContainText("Switch Cup", { timeout: 10_000 });
    await expect(page.getByLabel("Your hand")).toBeVisible();
    await expect(page.getByTestId("watching")).toHaveCount(0);
  }
  // Mark's match ends first. Rebecca, still playing, hears about it.
  await srv.finishGame(code, tokens, "Mark");
  await expect(friend.getByTestId("news-toasts")).toContainText("won", { timeout: 15_000 });
  await expect(friend.getByLabel("Your hand")).toBeVisible();
  // Mark sees the standings and Rebecca's match in "Playing now", and watches it with every hand face down.
  await expect(host.getByTestId("live-tables")).toBeVisible({ timeout: 15_000 });
  await host.getByTestId("live-tables").getByRole("button", { name: /Watch/ }).click();
  await expect(host.getByTestId("watching")).toBeVisible({ timeout: 10_000 });
  await expect(host.getByLabel("Your hand")).toHaveCount(0);
  await expect(host.locator(".seat-row .seat")).toHaveCount(2);
  await expect(host.locator(".seat-row")).toContainText("Rebecca");
});
