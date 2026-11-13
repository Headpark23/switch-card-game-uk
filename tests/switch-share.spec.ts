import { expect, test } from "@playwright/test";

test("a host shares live scores and updates reach the shared code", async ({ page }) => {
  const puts: unknown[] = [];
  await page.route("**/api/night**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ code: "ABC234", token: "secret" }) });
    if (req.method() === "PUT") { puts.push({ token: req.headers()["x-night-token"], body: req.postDataJSON() }); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    return route.fulfill({ status: 404, body: "{}" });
  });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Score", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keep every score straight." })).toBeVisible();
  const names = page.getByPlaceholder("Enter name");
  for (let i = 0; i < await names.count(); i += 1) await names.nth(i).fill("Player " + (i + 1));
  await page.getByLabel("Target score").fill("250");
  await page.getByRole("button", { name: "Start Domino" }).click();
  await expect(page.getByLabel("Score for Player 1")).toBeVisible();
  await page.getByRole("button", { name: "Share live scores" }).click();
  await expect(page.getByText("ABC234")).toBeVisible();
  await page.getByLabel("Score for Player 1").fill("40");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect.poll(() => puts.length).toBeGreaterThan(0);
  const last = puts[puts.length - 1] as { token: string; body: { snapshot: { lines: { label: string; value: string }[] } } };
  expect(last.token).toBe("secret");
  expect(last.body.snapshot.lines[0]).toMatchObject({ label: "Player 1", value: "40 points" });
  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("button", { name: "Share live scores" })).toBeVisible();
});

test("a friend opens a night link and sees the scoreboard", async ({ page }) => {
  await page.route("**/api/night**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "ABC234", updatedAt: Date.now(), snapshot: { title: "Friday night", format: "domino", status: "Domino · first to 250", lines: [{ label: "Alex", value: "120 points", lead: true }, { label: "Blair", value: "80 points" }] } }) }));
  await page.goto("/?night=abc234");
  await expect(page.getByRole("heading", { name: "Friday night" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "first to 250" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Scoreboard" }).locator("li")).toHaveCount(2);
});

test("joining by code shows a friendly message for an unknown night", async ({ page }) => {
  await page.route("**/api/night**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No night found with that code. Ask the host to check it." }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "Join a night" }).click();
  await page.getByLabel("Night code").fill("zzzzzz");
  await page.getByRole("button", { name: "Watch" }).click();
  await expect(page.getByRole("alert")).toContainText("No night found");
});
