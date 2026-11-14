import { expect, test } from "@playwright/test";

test("rival stats rank each computer by how often it finished ahead of you", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const log = await import("/src/switch/computerLog.ts");
    const game = (id: string, place: number, rivals: { name: string; place: number }[]) => ({
      id, playedAt: `2026-11-0${id}T10:00:00.000Z`, playerId: "me", opponents: rivals.length, level: "standard" as const, won: place === 1, place, moves: 20, rivals,
    });
    const games = [
      game("1", 2, [{ name: "John", place: 1 }, { name: "Paul", place: 3 }]),
      game("2", 2, [{ name: "John", place: 1 }, { name: "Paul", place: 3 }]),
      game("3", 1, [{ name: "John", place: 2 }, { name: "Paul", place: 3 }]),
      { id: "4", playedAt: "2026-11-04T10:00:00.000Z", playerId: "me", opponents: 1, level: "standard" as const, won: true, place: 1, moves: 9 },
    ];
    const rivals = log.summariseRivals(games);
    return { rivals, toughest: log.toughestRival(rivals)?.name, kept: log.getComputerGames({ switchComputerGames: games }).length };
  });
  expect(result.kept).toBe(4);
  expect(result.toughest).toBe("John");
  const john = result.rivals.find((rival) => rival.name === "John")!;
  expect(john).toMatchObject({ games: 3, ahead: 2, behind: 1, wins: 2 });
  expect(john.edge).toBeCloseTo(2 / 3);
  expect(result.rivals.find((rival) => rival.name === "Paul")).toMatchObject({ games: 3, ahead: 0, behind: 3 });
});

test("a finished game against the computers records how each one finished, and Me shows the toughest", async ({ page }) => {
  await page.addInitScript(() => {
    const games = [1, 2, 3].map((n) => ({ id: `g${n}`, playedAt: `2026-11-0${n}T10:00:00.000Z`, playerId: "p-me", opponents: 2, level: "standard", won: false, place: 2, moves: 30, rivals: [{ name: "Ringo", place: 1 }, { name: "Ziggy", place: 3 }] }));
    const club = { schemaVersion: 1, extensions: { switchProfiles: [{ version: 1, id: "p-me", name: "Sam", colour: "forest", createdAt: "2026-01-01T00:00:00.000Z", archived: false }], switchMe: "p-me", switchComputerGames: games } };
    if (!localStorage.getItem("switchScoreKeeper")) localStorage.setItem("switchScoreKeeper", JSON.stringify(club));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Me", exact: true }).last().click();
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(page.getByTestId("toughest-rival")).toContainText("Ringo");
  await expect(page.getByLabel("How each computer has played against you").getByRole("listitem")).toHaveCount(2);
});
