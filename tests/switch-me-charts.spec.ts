import { expect, test } from "@playwright/test";

/**
 * Me (owner request, 18 Nov 2026): the nine numbers on the Me tab are buttons, and each opens a small chart.
 * Table talk no longer takes the main billing there: it lives under Me > Computer.
 */

const NUMBERS = ["played", "won", "lost", "nightWins", "nightRate", "streak", "beat", "vsRate", "countries"] as const;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(async () => {
    const clubStore = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    const day = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString();
    clubStore.updateClub((current: Record<string, unknown>) => {
      const ensured = profiles.ensureProfiles(current, ["Sam", "Ali"]);
      const [sam, ali] = ensured.players;
      const nights = [0, 1, 2, 3].map((index) => ({
        version: 1, id: `n${index}`, completedAt: day(index * 9 + 2), title: `Night ${index}`, format: "darts", formatLabel: "Darts",
        players: [{ id: "p1", name: "Sam", profileId: sam.id }, { id: "p2", name: "Ali", profileId: ali.id }],
        winnerIds: [index === 1 ? "p2" : "p1"], outcome: "x", details: [], place: { name: index < 2 ? "The Crown" : "Cafe Roma", country: index < 2 ? "GB" : "IT" },
      }));
      const levels = ["relaxed", "standard", "sharp"];
      const games = Array.from({ length: 9 }, (_, index) => ({ id: `g${index}`, playedAt: day(index), playerId: sam.id, opponents: 1 + (index % 3), level: levels[index % 3], won: index % 3 !== 2, place: 1, moves: 20 }));
      return { ...ensured.extensions, switchMe: sam.id, switchNightHistory: nights, switchComputerGames: games };
    });
  });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
});

test("every number on Me opens a chart that matches it", async ({ page }) => {
  const tiles = page.locator(".me-tiles button");
  await expect(tiles).toHaveCount(9);
  for (const id of NUMBERS) {
    const shownValue = await page.locator(`.me-tiles [data-stat="${id}"] b`).innerText();
    await page.locator(`.me-tiles [data-stat="${id}"]`).click();
    const sheet = page.locator(`.stat-sheet[data-stat="${id}"]`);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".st-chart, .st-bars")).toBeVisible();
    // The chart's headline restates the number that was tapped.
    const headline = await sheet.locator(".st-headline").innerText();
    if (id === "nightRate" || id === "vsRate") expect(headline).toContain(shownValue);
    else if (id === "played") expect(headline).toContain(shownValue);
    else expect(headline).toMatch(new RegExp(`\\b${shownValue}\\b`));
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
});

test("Me opens on your form, not on table talk; table talk sits under Computer", async ({ page }) => {
  await expect(page.getByRole("region", { name: "Your form" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Table talk" })).toHaveCount(0);
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Table talk" })).toBeVisible();
});
