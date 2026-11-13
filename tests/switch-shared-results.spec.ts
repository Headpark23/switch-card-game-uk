import { expect, test } from "@playwright/test";

const night = {
  version: 1, id: "night-shared-1", completedAt: "2026-11-13T21:00:00.000Z", title: "Friday", format: "head-to-head", formatLabel: "One v One",
  players: [{ id: "host-a", name: "Mark" }, { id: "host-b", name: "Rebecca" }], winnerIds: ["host-b"], outcome: "Rebecca won",
  details: [{ heading: "Final games · first to 3", lines: ["Rebecca — 3 games", "Mark — 1 game"] }, { heading: "Game by game", lines: ["Game 1: Mark won (1–0)", "Game 2: Rebecca won (1–1)"] }],
  place: { name: "The Crown", country: "GB" },
};

test("choosing a name keeps every game already played against the computer", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    localStorage.clear();
    const log = await import("/src/switch/logGame.ts");
    const club = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    const computer = await import("/src/switch/computerLog.ts");
    const identity = await import("/src/switch/identity.ts");
    log.logComputerGame({ opponents: 1, level: "standard", won: true, place: 1, moves: 30 });
    log.logComputerGame({ opponents: 1, level: "standard", won: false, place: 2, moves: 41 });
    club.updateClub((current) => profiles.ensureProfiles(current, ["Dave"]).extensions);
    const dave = profiles.getProfiles(club.readClub()).find((profile) => profile.name === "Dave")!;
    const mine = () => { const now = club.readClub(); return computer.getComputerGames(now).filter((game) => game.playerId === computer.getMeId(now)).length; };
    // The old fault: "me" moved to Dave and the games stayed behind on the automatic "You" player.
    club.updateClub((current) => computer.putMeId(current, dave.id));
    const stranded = mine();
    club.updateClub((current) => identity.recoverMyGames(current) ?? current);
    const repaired = mine();
    const nothingLeftToFix = identity.recoverMyGames(club.readClub()) === null;
    // The new path: saying who you are brings the "You" games along.
    localStorage.clear();
    log.logComputerGame({ opponents: 2, level: "sharp", won: true, place: 1, moves: 22 });
    club.updateClub((current) => { const ensured = profiles.ensureProfiles(current, ["Rebecca"]); return identity.claimMe(ensured.extensions, ensured.players[0].id); });
    const claimed = mine();
    const names = profiles.getProfiles(club.readClub()).filter((profile) => !profile.archived).map((profile) => profile.name);
    return { stranded, repaired, nothingLeftToFix, claimed, names };
  });
  expect(result).toEqual({ stranded: 0, repaired: 2, nothingLeftToFix: true, claimed: 1, names: ["Rebecca"] });
});

test("a friend who joins a code gets the saved night in their own history, once, with wins and losses", async ({ page }) => {
  await page.route("**/api/night**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "ABC234", updatedAt: Date.now(), results: [night], snapshot: { title: "Friday night", format: "head-to-head", status: "Rebecca wins the match", players: ["Mark", "Rebecca"], lines: [{ label: "Mark", value: "1 games" }, { label: "Rebecca", value: "3 games", lead: true }] } }) }));
  await page.goto("/?night=ABC234");
  await expect(page.getByText("Which one are you?")).toBeVisible();
  await page.getByRole("button", { name: "Rebecca", exact: true }).click();
  await expect(page.getByText(/Playing as/)).toBeVisible();
  await expect(page.getByText("Friday: Rebecca won")).toBeVisible();

  const saved = await page.evaluate(async () => {
    const club = await import("/src/switch/clubStore.ts");
    const history = await import("/src/switch/history.ts");
    const computer = await import("/src/switch/computerLog.ts");
    const profiles = await import("/src/switch/profiles.ts");
    const joined = await import("/src/switch/joinedNights.ts");
    const now = club.readClub();
    const nights = history.getHistory(now);
    const meId = computer.getMeId(now);
    return {
      count: nights.length, me: profiles.getProfiles(now).find((profile) => profile.id === meId)?.name,
      iWon: nights[0].winnerIds.includes(meId as string), place: nights[0].place?.name, sections: nights[0].details.map((section) => section.heading),
      // Asking again never doubles a night.
      again: joined.collectResults("Rebecca", nights).length,
    };
  });
  expect(saved).toEqual({ count: 1, me: "Rebecca", iWon: true, place: "The Crown", sections: ["Final games · first to 3", "Game by game"], again: 0 });

  // The loser's phone records the same night as a loss.
  const loser = await page.evaluate(async (record) => {
    localStorage.clear();
    const club = await import("/src/switch/clubStore.ts");
    const history = await import("/src/switch/history.ts");
    const computer = await import("/src/switch/computerLog.ts");
    const joined = await import("/src/switch/joinedNights.ts");
    const added = joined.collectResults("mark", [record as never]).length;
    const now = club.readClub();
    const saved = history.getHistory(now)[0];
    const meId = computer.getMeId(now) as string;
    return { added, played: saved.players.some((player) => player.id === meId), won: saved.winnerIds.includes(meId) };
  }, night);
  expect(loser).toEqual({ added: 1, played: true, won: false });
});

test("my history opens the full record of a night: date, venue and every score", async ({ page }) => {
  await page.route("**/api/night**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  await page.evaluate(async (record) => {
    localStorage.clear();
    const joined = await import("/src/switch/joinedNights.ts");
    joined.collectResults("Mark", [record as never]);
  }, night);
  await page.reload();
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("1 game · 0 won · 1 lost. Tap any game for the full score.")).toBeVisible();
  await page.getByRole("button", { name: /Friday, lost/ }).click();
  await expect(page.getByText("You lost")).toBeVisible();
  await expect(page.getByTestId("bottom-sheet").getByText("The Crown, United Kingdom")).toBeVisible();
  await expect(page.getByText("Game 2: Rebecca won (1–1)")).toBeVisible();
});

test("saving a night while a code is live sends the result to everyone who joined", async ({ page }) => {
  const puts: { result?: { outcome: string; players: unknown[] } }[] = [];
  await page.route("**/api/night**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ code: "ABC234", token: "secret" }) });
    if (req.method() === "PUT") { puts.push(req.postDataJSON()); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open the Switch scorekeeper" }).click();
  await page.getByRole("button", { name: "One v One" }).click();
  const names = page.getByPlaceholder("Enter name");
  for (let i = 0; i < await names.count(); i += 1) await names.nth(i).fill("Player " + (i + 1));
  await page.getByLabel("Games to win").fill("2");
  await page.getByRole("button", { name: "Start One v One" }).click();
  await page.getByRole("button", { name: "Share live scores" }).click();
  await expect(page.getByText("ABC234")).toBeVisible();
  await page.getByRole("button", { name: "Win game" }).first().click();
  await page.getByRole("button", { name: "Win game" }).last().click();
  await page.getByRole("button", { name: "Win game" }).last().click();
  // The save prompt appears by itself and says the result will be shared.
  await expect(page.getByText("Everyone who joined with your code gets this result in their own history too.")).toBeVisible();
  await page.getByRole("button", { name: "Save completed night" }).click();
  await expect.poll(() => puts.some((put) => put.result?.outcome === "Player 2 won")).toBe(true);
  const sent = puts.find((put) => put.result)!.result as { details: { heading: string; lines: string[] }[] };
  expect(sent.details.find((section) => section.heading === "Game by game")?.lines).toEqual(["Game 1: Player 1 won (1–0)", "Game 2: Player 2 won (1–1)", "Game 3: Player 2 won (1–2)"]);
});
