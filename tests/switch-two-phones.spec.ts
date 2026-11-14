import { expect, test, type BrowserContext } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { handleNight } from "../api/_night.js";

/** One shared copy of the server, as Vercel Blob would be. Both phones talk to it through the real request handler. */
function serve(context: BrowserContext, rows: Map<string, unknown>, flaky = { loseFirstResult: false }) {
  const store = { read: async (code: string) => rows.get(code) ?? null, write: async (code: string, row: unknown) => {
    const copy = JSON.parse(JSON.stringify(row)) as { results?: unknown[] };
    // The real race: a scoreboard update that read the night before the result landed writes it back without the result.
    if (flaky.loseFirstResult && copy.results?.length) { flaky.loseFirstResult = false; copy.results = []; }
    rows.set(code, copy);
  } };
  return context.route("**/api/night**", async (route) => {
    const req = route.request();
    const response: Response = await handleNight(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }), store);
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
}

for (const scenario of [
  { name: "friend is watching", leave: false, lose: false },
  { name: "friend has gone back Home with the app still open", leave: true, lose: false },
  { name: "the server loses the first copy of the result", leave: true, lose: true },
]) test(`two real phones: the host saves a night and the friend's history and stats get it (${scenario.name})`, async ({ browser }) => {
  test.setTimeout(120_000);
  const rows = new Map<string, unknown>();
  const hostContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const friendContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const flaky = { loseFirstResult: scenario.lose };
  await serve(hostContext, rows, flaky); await serve(friendContext, rows, flaky);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();

  // The friend has used the app before (so a "You" profile exists on their phone), as a real friend would have.
  await friend.goto("/");
  await friend.waitForTimeout(500);

  await host.goto("/");
  await host.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await host.getByRole("button", { name: "One v One" }).click();
  const names = host.getByPlaceholder("Enter name");
  await names.nth(0).fill("Mark"); await names.nth(1).fill("Rebecca");
  await host.getByLabel("Games to win").fill("2");
  await host.getByRole("button", { name: "Start One v One" }).click();
  // One tap sends the game to Rebecca. The phone's share sheet (WhatsApp, Messages) is stood in for by a recorder.
  await host.evaluate(() => { (navigator as unknown as { share: (data: { text: string }) => Promise<void> }).share = async (data) => { (window as unknown as { sent: string }).sent = data.text; }; });
  await host.getByRole("button", { name: "Send to Rebecca" }).click();
  const code = (await host.getByText(/^[A-Z2-9]{6}$/).first().textContent())!.trim();
  const link = (await host.evaluate(() => (window as unknown as { sent: string }).sent)).match(/https?:\/\/\S+/)![0];
  expect(link).toContain(`night=${code}`);
  await expect(host.getByText(/Sent at .* waiting for them to open it/)).toBeVisible();

  // Opening the link is all Rebecca does: she is in as herself, with no question to answer.
  await friend.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(friend.getByText(/Playing as/)).toBeVisible();
  await expect(friend.getByText("Which one are you?")).toHaveCount(0);
  // And the host's screen shows she arrived.
  await expect(host.getByText("Joined", { exact: true })).toBeVisible({ timeout: 20_000 });

  if (scenario.leave) await friend.getByRole("navigation").getByRole("button", { name: "Home", exact: true }).click();
  // The host plays and Rebecca wins, then the host saves.
  await host.getByRole("button", { name: "Win game" }).last().click();
  await host.getByRole("button", { name: "Win game" }).last().click();
  await host.getByRole("button", { name: "Save completed night" }).click();

  // Nobody touches the friend's phone: the result must arrive by itself.
  if (!scenario.leave) await expect(friend.getByText(/saved to your history/).first()).toBeVisible({ timeout: 40_000 });
  else { await expect(friend.getByText("A result has come in")).toBeVisible({ timeout: 60_000 }); await friend.getByRole("button", { name: "Close", exact: true }).click(); }
  await friend.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await friend.getByRole("button", { name: "History", exact: true }).click();
  await expect(friend.getByText(/1 game · 1 won · 0 lost/)).toBeVisible();
  await hostContext.close(); await friendContext.close();
});

test("only the person who started the game can change its scores; the friend watches, and the host finds the game from Home", async ({ browser }) => {
  test.setTimeout(90_000);
  const rows = new Map<string, unknown>();
  const hostContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const friendContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  await serve(hostContext, rows); await serve(friendContext, rows);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();

  await host.goto("/");
  await host.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await host.getByRole("button", { name: "One v One" }).click();
  const names = host.getByPlaceholder("Enter name");
  await names.nth(0).fill("Rebecca"); await names.nth(1).fill("Martin");
  await host.getByLabel("Games to win").fill("3");
  await host.getByRole("button", { name: "Start One v One" }).click();
  await host.evaluate(() => { (navigator as unknown as { share: (data: { text: string }) => Promise<void> }).share = async (data) => { (window as unknown as { sent: string }).sent = data.text; }; });
  await host.getByRole("button", { name: "Send to Martin" }).click();
  const link = (await host.evaluate(() => (window as unknown as { sent: string }).sent)).match(/https?:\/\/\S+/)![0];
  const code = new URL(link).searchParams.get("night")!;

  await friend.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(friend.getByText(/Playing as/)).toBeVisible();
  // The friend can see the game, but has nothing to score it with.
  await expect(friend.getByText(/is keeping score/)).toBeVisible();
  await expect(friend.getByRole("button", { name: /Win game|Add|Undo|Change game type/ })).toHaveCount(0);
  await expect(friend.getByRole("textbox")).toHaveCount(0);
  // And the server refuses a score change from anyone without the host's secret.
  const refused = await friend.evaluate(async (night) => (await fetch(`/api/night?code=${night}`, { method: "PUT", headers: { "content-type": "application/json", "x-night-token": "guess" }, body: JSON.stringify({ snapshot: { title: "x", format: "head-to-head", status: "x", lines: [{ label: "Martin", value: "99 games" }] } }) })).status, code);
  expect(refused).toBe(403);

  // The host scores; the friend's screen follows.
  await host.getByRole("button", { name: "Win game" }).first().click();
  await expect(friend.getByRole("list", { name: "Scoreboard" }).getByText("1 games")).toBeVisible({ timeout: 30_000 });

  // The host leaves the scorecard and finds the game again from Home: named, scored, and showing who has joined.
  await host.getByRole("navigation").getByRole("button", { name: "Home", exact: true }).click();
  const card = host.getByRole("button", { name: /Your game: Rebecca v Martin/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("1–0");
  await expect(card).toContainText("Martin joined");
  await card.click();
  await expect(host.getByRole("button", { name: "Win game" }).first()).toBeVisible();
  await hostContext.close(); await friendContext.close();
});
