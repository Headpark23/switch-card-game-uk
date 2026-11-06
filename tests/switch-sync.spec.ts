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

test("a Google token yields display details, and bad tokens are ignored", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const auth = await import("/src/auth.ts");
    const part = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `${part({ alg: "RS256" })}.${part({ email: "a@example.com", name: "Alex Smith", picture: "https://example.com/a.png", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
    const expired = `${part({})}.${part({ email: "a@example.com", exp: 1 })}.sig`;
    const account = auth.accountFromToken(token);
    return { name: account?.name, picture: account?.picture, expired: auth.tokenExpired(auth.accountFromToken(expired)!), bad: auth.accountFromToken("nonsense") };
  });
  expect(result).toEqual({ name: "Alex Smith", picture: "https://example.com/a.png", expired: true, bad: null });
});

test("sync uploads a first club, restores an empty phone, and protects unreadable data", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const auth = await import("/src/auth.ts");
    const account = { token: "t", name: "A", email: "a@example.com", picture: "", exp: Math.floor(Date.now() / 1000) + 3600 };
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
