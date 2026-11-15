import { expect, test } from "@playwright/test";

const summary = (code: string) => ({ code, status: "lobby", capacity: 4, level: "standard", mode: "dominoes", open: true, seats: [{ name: "Mark", kind: "human" }] });
const night = { code: "NIGHT2", snapshot: { title: "Friday night", format: "domino", status: "Dominoes · first to 100", lines: [{ label: "Mark", value: "0 points" }, { label: "Becky", value: "0 points" }], players: ["Mark", "Becky"], host: "Mark" }, results: [], joined: [], updatedAt: Date.now() };

test("readCode finds the code in whatever was typed or pasted", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const { readCode } = await import("/src/switch/joinCode.ts");
    return [readCode("abc 234"), readCode("ABC-234"), readCode("Mark has set up a game. Open https://switchcardgame.co.uk/?table=k7m2qx please"), readCode("https://switchcardgame.co.uk/?night=ab3cd4&as=Becky%20J"), readCode("https://switchcardgame.co.uk/?club=k7m2qxh4")];
  });
  expect(out[0]).toEqual({ code: "ABC234" });
  expect(out[1]).toEqual({ code: "ABC234" });
  expect(out[2]).toEqual({ code: "K7M2QX", kind: "table" });
  expect(out[3]).toEqual({ code: "AB3CD4", kind: "night", as: "Becky J" });
  expect(out[4]).toEqual({ code: "K7M2QXH4", kind: "club" });
});

test("a table code typed on Join a night opens the table instead of failing", async ({ page }) => {
  await page.route("**/api/night**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No night found" }) }));
  await page.route("**/api/room**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary("DOM234")) }));
  await page.goto("/");
  await page.getByRole("button", { name: "Join a night" }).click();
  await page.getByLabel("Night code").fill("dom-234");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByLabel("Table code")).toHaveValue("DOM234");
  await expect(page.getByRole("status").filter({ hasText: "Mark" })).toBeVisible();
});

test("a night code typed on Play with friends opens the night instead of failing", async ({ page }) => {
  await page.route("**/api/room**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No table found with that code." }) }));
  await page.route("**/api/night**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(night) }));
  await page.goto("/?table=NIGHT2");
  await expect(page.getByRole("heading", { name: "Friday night" })).toBeVisible();
});

test("opening your own invitation again returns you to your seat instead of saying the name is taken", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("switchOnlineTable", JSON.stringify({ code: "DOM234", token: "t", name: "Becky", savedAt: Date.now() })));
  await page.route("**/api/room**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }));
  await page.goto("/?table=DOM234");
  await expect(page.getByLabel("Table code")).toHaveCount(0);
});

test("a pasted invitation message works in the code box", async ({ page }) => {
  await page.route("**/api/room**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary("DOM234")) }));
  await page.route("**/api/night**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  await page.getByRole("button", { name: "Join a night" }).click();
  await page.getByLabel("Night code").fill("Mark has set up a game. Open https://switchcardgame.co.uk/?table=DOM234");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByLabel("Table code")).toHaveValue("DOM234");
});
