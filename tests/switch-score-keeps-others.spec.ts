import { expect, test } from "@playwright/test";

// Nobody loses a score: while the scorecard is open, anything else saved on the phone (a game against the computer
// finished in another tab, a night arriving from a shared club) must survive the next tap on the scorecard.

const KEY = "switchScoreKeeper";

test("a scorecard tap never wipes a game saved elsewhere while the scorecard was open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await page.getByRole("button", { name: "One v One", exact: true }).click();
  const names = page.getByPlaceholder("Enter name");
  await names.nth(0).fill("Rebecca"); await names.nth(1).fill("Martin");
  await page.getByLabel("Games to win").fill("3");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await page.getByRole("button", { name: "Win game" }).first().click();

  // Another tab finishes a game against the computer and saves it, straight into storage, as that tab would.
  // The storage event a real second tab would raise is deliberately not sent: the save itself must be safe.
  await page.evaluate((key) => {
    const doc = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    doc.extensions = doc.extensions ?? {};
    const games = Array.isArray(doc.extensions.switchComputerGames) ? doc.extensions.switchComputerGames : [];
    doc.extensions.switchComputerGames = [{ id: "other-tab-game", playedAt: new Date().toISOString(), playerId: "me", opponents: 2, level: "standard", won: true, place: 1, moves: 30 }, ...games];
    window.localStorage.setItem(key, JSON.stringify(doc));
  }, KEY);

  await page.getByRole("button", { name: "Win game" }).first().click();
  await page.getByRole("button", { name: "Undo last game" }).click();

  const kept = await page.evaluate((key) => {
    const doc = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return (doc.extensions?.switchComputerGames ?? []).map((game: { id: string }) => game.id);
  }, KEY);
  expect(kept).toContain("other-tab-game");
});

test("the scorecard's own changes still win: a removed key stays removed and a changed key is written", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const store = await import("/src/switch/clubStore.ts");
    const base = { a: 1, b: [1], gone: true, same: "x" };
    const intended = { a: 2, b: [1], same: "x" };
    const current = { a: 1, b: [1, 2], gone: true, same: "x", fromElsewhere: "kept" };
    return store.applyOwnChanges(base, intended, current);
  });
  expect(out).toEqual({ a: 2, b: [1, 2], same: "x", fromElsewhere: "kept" });
});
