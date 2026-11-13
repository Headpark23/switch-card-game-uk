import { expect, test } from "@playwright/test";

test("the dealer is picked once and the deal passes clockwise, with undo", async ({ page }) => {
  await page.goto("/?frame=1");
  const result = await page.evaluate(async () => {
    const d = await import("/src/switch/dealer.ts");
    const seats = ["ann", "bob", "cy"];
    const start = d.pickDealer(seats, () => 0.5);
    const second = d.passDeal(start);
    const wrapped = d.passDeal(d.passDeal(second));
    return {
      start: start.dealerId, first: d.firstToPlay(start), second: second.dealerId, wrapped: wrapped.dealerId, deal: wrapped.deal,
      undone: d.undoDeal(second).dealerId,
      gone: d.withSeats(start, ["ann", "cy"]).dealerId,
    };
  });
  expect(result).toEqual({ start: "bob", first: "cy", second: "cy", wrapped: "bob", deal: 4, undone: "bob", gone: "cy" });
});

test("games against the computer are summarised and earn badges and the passport", async ({ page }) => {
  await page.goto("/?frame=1");
  const out = await page.evaluate(async () => {
    const log = await import("/src/switch/computerLog.ts");
    const badges = await import("/src/switch/badges.ts");
    const mk = (i: number, won: boolean) => ({ id: `g${i}`, playedAt: new Date(2026, 0, i + 1).toISOString(), playerId: "me", opponents: 1, level: "sharp" as const, won, place: won ? 1 : 2, moves: 20 });
    const games = [mk(0, false), mk(1, true), mk(2, true), mk(3, true)];
    const summary = log.summariseComputerGames(games);
    const me = { version: 1 as const, id: "me", name: "You", colour: "green" as never, createdAt: "2026-01-01T00:00:00Z", archived: false };
    const night = (id: string, country: string, name: string) => ({
      version: 1, id, completedAt: "2026-02-01T00:00:00Z", title: "t", format: "one-v-one", formatLabel: "One v One",
      players: [{ id: "me", name: "You" }], winnerIds: ["me"], outcome: "won", details: [], place: { name, country },
    });
    const nights = [night("n1", "GB", "Home"), night("n2", "FR", "Chalet"), night("n3", "FR", "Cafe")] as never;
    const stamps = badges.derivePassport(me, nights, [me]);
    const earned = badges.deriveBadges(me, nights, [me], games).filter((b: { earned: boolean }) => b.earned).length;
    return { summary: { games: summary.games, wins: summary.wins, streak: summary.currentStreak, best: summary.bestStreak }, stamps: stamps.map((s: { country: string; nights: number; venues: string[] }) => [s.country, s.nights, s.venues.length]), manyBadges: badges.BADGES.length >= 40, earnedSome: earned > 0 };
  });
  expect(out.summary).toEqual({ games: 4, wins: 3, streak: 3, best: 3 });
  expect(out.stamps).toEqual([["GB", 1, 1], ["FR", 2, 2]]);
  expect(out.manyBadges).toBe(true);
  expect(out.earnedSome).toBe(true);
});

test("Play deals straight into a table game, the tab bar has five tabs, and a finished game can be logged", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button");
  await expect(tabs).toHaveCount(5);
  await tabs.nth(1).click();
  await expect(page.getByRole("heading", { name: "Take a seat." })).toBeVisible();
  await page.getByRole("button", { name: /^3\s*opponents/ }).click();
  await page.getByRole("button", { name: /Deal me in/ }).click();
  await expect(page.getByTestId("turn-status")).toHaveText(/YOUR MOVE|IS CHOOSING|TO PLAY/);
  await expect(page.locator(".dealer-chip").first()).toBeVisible();
  const logged = await page.evaluate(async () => {
    const log = await import("/src/switch/logGame.ts");
    const store = await import("/src/switch/clubStore.ts");
    const cl = await import("/src/switch/computerLog.ts");
    log.logComputerGame({ opponents: 3, level: "standard", won: true, place: 1, moves: 30 });
    const club = store.readClub();
    return cl.getComputerGames(club).length;
  });
  expect(logged).toBe(1);
});
