import { expect, test } from "@playwright/test";

test("naming yourself after a registered player says the name is taken, and another name works", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    const club = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    club.updateClub((current) => profiles.ensureProfiles(current, ["Martin"]).extensions);
  });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByText("Who are you?")).toBeVisible();

  // Typing a registered player's name, in any case, does not make you them.
  await page.getByLabel("Your name").fill(" martin ");
  await page.getByRole("button", { name: /This is me/ }).click();
  await expect(page.getByRole("alert")).toHaveText("martin is taken. Pick another name.");
  await expect(page.getByText("Who are you?")).toBeVisible();

  // A free name is fine, and Martin is untouched.
  await page.getByLabel("Your name").fill("Marty");
  await page.getByRole("button", { name: /This is me/ }).click();
  await expect(page.getByRole("heading", { name: "Marty" })).toBeVisible();
  const names = await page.evaluate(async () => {
    const club = await import("/src/switch/clubStore.ts");
    const profiles = await import("/src/switch/profiles.ts");
    return profiles.getProfiles(club.readClub()).filter((profile: { archived: boolean }) => !profile.archived).map((profile: { name: string }) => profile.name).sort();
  });
  expect(names).toEqual(["Marty", "Martin"].sort());
});

test("joining a club: a typed name already on the club's list is taken, but tapping it is how its owner joins", async ({ page }) => {
  const doc = { name: "Friday club", nameAt: 1, nights: [], seasons: [], removed: [], profiles: [{ version: 1, id: "martin-1", name: "Martin", colour: "forest", createdAt: "2026-11-01T10:00:00.000Z", archived: false }] };
  await page.route("**/api/club**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "K7M2QXH4", doc, updatedAt: 1 }) }));
  await page.goto("/?club=K7M2QXH4");
  await expect(page.getByText(/which one are you/i)).toBeVisible();
  await page.getByLabel("Your name").fill("MARTIN");
  await page.getByRole("button", { name: "Add me and join" }).click();
  await expect(page.getByRole("alert")).toContainText("MARTIN is taken. Pick another name.");
  await expect(page.getByText("You're in!")).toBeHidden();
  // His own phone picks the name from the list instead.
  await page.getByRole("button", { name: "Martin", exact: true }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
});
