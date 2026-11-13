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
