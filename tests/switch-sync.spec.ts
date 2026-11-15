import { expect, test } from "@playwright/test";

const doc = (profiles: string[], nights: string[] = []) => ({
  schemaVersion: 1,
  extensions: { switchProfiles: profiles.map((id) => ({ id, name: id })), switchNightHistory: nights.map((id) => ({ id })) },
});

test("merging two phones keeps every player and night, and never drops data", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async ([a, b]) => {
    const sync = await import("/src/switch/sync.ts");
    const merged = sync.mergeDocuments(a as never, b as never);
    return {
      profiles: (merged.extensions.switchProfiles as { id: string }[]).map((p) => p.id).sort(),
      nights: (merged.extensions.switchNightHistory as { id: string }[]).map((n) => n.id).sort(),
      same: sync.sameClub(merged, merged),
      differs: sync.sameClub(a as never, b as never),
    };
  }, [doc(["alex", "blair"], ["n1"]), doc(["blair", "casey"], ["n2"])]);
  expect(result.profiles).toEqual(["alex", "blair", "casey"]);
  expect(result.nights).toEqual(["n1", "n2"]);
  expect(result.same).toBe(true);
  expect(result.differs).toBe(false);
});

const profile = (id: string, name: string) => ({ version: 1, id, name, colour: "forest", createdAt: "2026-11-01T10:00:00.000Z", archived: false });
const game = (id: string, playerId: string, won: boolean) => ({ id, playedAt: "2026-11-10T10:00:00.000Z", playerId, opponents: 2, level: "standard", won, place: won ? 1 : 2, moves: 20 });

test("two devices that each made their own 'You' end up as one player, so every device counts every game", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async ([phone, web]) => {
    const sync = await import("/src/switch/sync.ts");
    const log = await import("/src/switch/computerLog.ts");
    const countFor = (doc: { extensions: Record<string, unknown> }) => {
      const me = log.getMeId(doc.extensions);
      return { me, games: log.getComputerGames(doc.extensions).filter((entry) => entry.playerId === me).length, all: log.getComputerGames(doc.extensions).length };
    };
    // The phone syncs against the account's cloud copy, which the browser wrote.
    const merged = sync.mergeDocuments(phone as never, web as never);
    const mergedOtherWay = sync.mergeDocuments(web as never, phone as never);
    // Then the browser syncs again against what the phone uploaded.
    const browserAfter = sync.mergeDocuments(web as never, merged as never);
    return { phone: countFor(merged as never), other: countFor(mergedOtherWay as never), browser: countFor(browserAfter as never), account: merged.extensions.switchAccountMe, sameAccount: browserAfter.extensions.switchAccountMe };
  }, [
    { schemaVersion: 1, extensions: { switchMe: "phone-you", switchProfiles: [profile("phone-you", "You")], switchComputerGames: [game("p1", "phone-you", true), game("p2", "phone-you", false), game("p3", "phone-you", true)] } },
    { schemaVersion: 1, extensions: { switchMe: "web-you", switchProfiles: [profile("web-you", "You")], switchComputerGames: [game("w1", "web-you", true), game("w2", "web-you", false)] } },
  ]);
  expect(result.phone.games).toBe(5);
  expect(result.phone.all).toBe(5);
  expect(result.other.games).toBe(5);
  expect(result.browser.games).toBe(5);
  expect(result.sameAccount).toBe(result.account);
});

test("a real name wins over the automatic You when two devices are joined", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async ([named, anonymous]) => {
    const sync = await import("/src/switch/sync.ts");
    const log = await import("/src/switch/computerLog.ts");
    const profiles = await import("/src/switch/profiles.ts");
    const merged = sync.mergeDocuments(named as never, anonymous as never);
    const me = log.getMeId(merged.extensions);
    return { name: profiles.getProfiles(merged.extensions).find((entry) => entry.id === me)?.name, games: log.getComputerGames(merged.extensions).filter((entry) => entry.playerId === me).length };
  }, [
    { schemaVersion: 1, extensions: { switchMe: "becky", switchProfiles: [profile("becky", "Becky")], switchComputerGames: [game("b1", "becky", true)] } },
    { schemaVersion: 1, extensions: { switchMe: "anon", switchAccountMe: "anon", switchProfiles: [profile("anon", "You")], switchComputerGames: [game("a1", "anon", true), game("a2", "anon", true)] } },
  ]);
  expect(result).toEqual({ name: "Becky", games: 3 });
});

test("signing in trades the Google credential for a session and never stores the token", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const auth = await import("/src/auth.ts");
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body) });
      return new Response(JSON.stringify({ account: { name: "Alex", email: "a@example.com", picture: "" } }));
    }) as unknown as typeof fetch;
    const account = await auth.createSession("google-credential", fake);
    auth.saveAccount(account);
    const rejected = await auth.createSession("bad", (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch).catch((e: Error) => e.message);
    return { account, calls, stored: localStorage.getItem("switchAccount"), rejected };
  });
  expect(result.calls[0].url).toBe("/api/auth/google");
  expect(result.account.name).toBe("Alex");
  expect(result.stored).not.toContain("google-credential");
  expect(result.rejected).toMatch(/not accepted/);
});

test("sync uploads a first club, restores an empty phone, and protects unreadable data", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const auth = await import("/src/auth.ts");
    const account = { name: "A", email: "a@example.com", picture: "" };
    const cloud: { document: unknown } = { document: null };
    const fake = (async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") { cloud.document = JSON.parse(init.body as string).document; return new Response("{}"); }
      return new Response(JSON.stringify({ document: cloud.document }));
    }) as unknown as typeof fetch;

    localStorage.setItem("switchScoreKeeper", JSON.stringify({ schemaVersion: 1, selectedFormat: "domino", players: [], scores: {}, target: 100, extensions: { switchProfiles: [{ id: "alex", name: "Alex" }] } }));
    const first = await auth.syncNow(account, fake);
    const again = await auth.syncNow(account, fake);

    localStorage.removeItem("switchScoreKeeper");
    const second = await auth.syncNow(account, fake);
    const restored = JSON.parse(localStorage.getItem("switchScoreKeeper")!).extensions.switchProfiles[0].name;

    localStorage.setItem("switchScoreKeeper", "{not json");
    let refused = "";
    try { await auth.syncNow(account, fake); } catch (reason) { refused = (reason as Error).message; }
    return { first, again, second, restored, refused, stillThere: localStorage.getItem("switchScoreKeeper") };
  });
  expect(result.first).toBe("uploaded");
  expect(result.again).toBe("up-to-date");
  expect(result.second).toBe("downloaded");
  expect(result.restored).toBe("Alex");
  expect(result.refused).toMatch(/unreadable/);
  expect(result.stillThere).toBe("{not json");
});

test("without a Google client ID the sign-in panel stays hidden", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
  await expect(page.getByText("More time at the table")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button", { name: "Club", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).first().click();
  await expect(page.getByText("Back up your club")).toBeVisible();
  await expect(page.getByText("Cloud backup")).toHaveCount(0);
  await expect(page.getByText(/saved only on this device/i)).toBeVisible();
  await expect(page.getByText(/Signing in with Google also backs it up/i)).toHaveCount(0);
});
