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
  await page.getByRole("button", { name: "History", exact: true }).first().click();
  await expect(page.getByText("Back up your club")).toBeVisible();
  await expect(page.getByText("Cloud backup")).toHaveCount(0);
});
