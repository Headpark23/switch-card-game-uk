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
  await friend.locator('[data-reaction="well-played"]').click();
  await expect(host.getByTestId("reaction-bubble")).toBeVisible({ timeout: 10_000 });
  await expect(host.getByTestId("reaction-bubble")).toContainText("Well played");
});

test("a table code that does not exist says so", async ({ browser }) => {
  const context = await browser.newContext({ viewport: phone });
  await serve(context, memoryStore());
  const page = await context.newPage();
  await page.goto("/?table=ZZZZ99");
  await expect(page.getByRole("alert")).toContainText(/No table found/);
  await expect(page.getByRole("button", { name: "Take a seat" })).toBeDisabled();
});
