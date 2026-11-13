import { expect, test, type BrowserContext, type Page } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { handleClub } from "../api/_club.js";

/** One shared copy of the server, as Vercel Blob would be, reached by both phones through the real request handler. */
function serve(context: BrowserContext, rows: Map<string, unknown>) {
  const store = { read: async (code: string) => rows.get(code) ?? null, write: async (code: string, row: unknown) => { rows.set(code, JSON.parse(JSON.stringify(row))); } };
  return context.route("**/api/club**", async (route) => {
    const req = route.request();
    const response: Response = await handleClub(new Request(req.url(), { method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : (req.postData() ?? undefined) }), store);
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
}

async function playNight(page: Page, first: string, second: string, winner: "first" | "second") {
  await page.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await page.getByRole("button", { name: "One v One", exact: true }).click();
  const names = page.getByPlaceholder("Enter name");
  await names.nth(0).fill(first); await names.nth(1).fill(second);
  await page.getByLabel("Games to win").fill("1");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await page.getByRole("button", { name: "Win game" }).nth(winner === "first" ? 0 : 1).click();
  await page.getByRole("button", { name: "Save completed night" }).click();
  await expect(page.getByRole("button", { name: "Save completed night" })).toBeHidden();
}

const playersOn = (page: Page) => page.evaluate(async () => {
  const club = await import("/src/switch/clubStore.ts"); const profiles = await import("/src/switch/profiles.ts");
  return profiles.getProfiles(club.readClub()).filter((profile) => !profile.archived).map((profile) => profile.name).sort();
});

test("a shared club: players, nights and stats reach every phone, in both directions", async ({ browser }) => {
  test.setTimeout(240_000);
  const rows = new Map<string, unknown>();
  const hostContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const friendContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  await serve(hostContext, rows); await serve(friendContext, rows);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();

  // The host adds Rebecca to their club by playing her, and shares the club.
  await host.goto("/");
  await playNight(host, "Mark", "Rebecca", "second");
  await host.getByRole("navigation").getByRole("button", { name: "Club", exact: true }).click();
  await host.getByRole("button", { name: "Share this club" }).click();
  const code = (await host.locator(".club-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);

  // Rebecca has used the app before, opens the club on her own phone and says who she is.
  await friend.goto("/");
  await friend.waitForTimeout(400);
  await friend.getByRole("navigation").getByRole("button", { name: "Club", exact: true }).click();
  await friend.getByRole("button", { name: "Join a club" }).click();
  await friend.getByLabel("Club code").fill(code);
  await friend.getByRole("button", { name: "Find club" }).click();
  await expect(friend.getByText("Which one are you?")).toBeVisible();
  await friend.getByRole("button", { name: "Rebecca", exact: true }).click();
  await expect(friend.getByText("Shared club")).toBeVisible();
  expect(await playersOn(friend)).toEqual(["Mark", "Rebecca"]);

  // The night played before she joined is in her history, as a win.
  await friend.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await friend.getByRole("button", { name: "History", exact: true }).click();
  await expect(friend.getByText(/1 game · 1 won · 0 lost/)).toBeVisible();

  // The host plays and saves another night. Nobody touches Rebecca's phone.
  await playNight(host, "Mark", "Rebecca", "first");
  await expect(friend.getByText(/2 games · 1 won · 1 lost/)).toBeVisible({ timeout: 60_000 });

  // And the other way: a player and a night added on Rebecca's phone reach the host.
  await playNight(friend, "Rebecca", "Dave", "first");
  await expect.poll(() => playersOn(host), { timeout: 60_000 }).toEqual(["Dave", "Mark", "Rebecca"]);
  await host.getByRole("navigation").getByRole("button", { name: "Club", exact: true }).click();
  await host.getByRole("button", { name: "History", exact: true }).click();
  await expect(host.getByText("Rebecca · Dave")).toBeAttached({ timeout: 30_000 });
  await hostContext.close(); await friendContext.close();
});

test("a club link opens straight to 'Which one are you?'", async ({ browser }) => {
  const rows = new Map<string, unknown>();
  const hostContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const friendContext = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  await serve(hostContext, rows); await serve(friendContext, rows);
  const host = await hostContext.newPage(); const friend = await friendContext.newPage();
  await host.goto("/");
  await playNight(host, "Mark", "Rebecca", "second");
  await host.getByRole("navigation").getByRole("button", { name: "Club", exact: true }).click();
  await host.getByRole("button", { name: "Share this club" }).click();
  const code = (await host.locator(".club-code").textContent())!.trim();
  await friend.goto(`/?club=${code}`);
  await expect(friend.getByText("Which one are you?")).toBeVisible();
  await friend.getByRole("button", { name: "Rebecca", exact: true }).click();
  await expect(friend.getByText("Shared club")).toBeVisible();
  await hostContext.close(); await friendContext.close();
});

test("sharing is easy to find: Home offers it, and the saved-night screen offers it right after saving", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Playing with friends? Share your club")).toBeVisible();
  await page.getByRole("button", { name: "Join a club" }).click();
  await expect(page.getByLabel("Club code")).toBeVisible();
  await page.goto("/");
  await playNight(page, "Mark", "Rebecca", "second");
  // Saving lands on the history screen, with the invitation at the top.
  await expect(page.getByText("Play with friends? Share this club")).toBeVisible();
});

test("the join-a-night screen also takes a club code", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Join a night" }).click();
  await page.getByLabel("Night code").fill("K7M2QXH4");
  await expect(page.getByRole("button", { name: "Join club" })).toBeEnabled();
});

test("on an iPhone browser tab, joining says to join in the Home Screen app instead, with the code", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport: { width: 1000, height: 1100 } });
  const page = await context.newPage();
  await page.goto("/?club=K7M2QXH4");
  await expect(page.getByText("Using the Switch app on your iPhone?")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("K7M2QXH4");
  await context.close();
});
