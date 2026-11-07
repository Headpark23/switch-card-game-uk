import { expect, test } from "@playwright/test";

test("the footer shows the copyright, the visit count, and the three feedback buttons", async ({ page }) => {
  await page.route("**/api/hit", (route) => route.fulfill({ json: { hits: 1234 } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  const footer = page.locator(".app-footer");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText("© M. White 2026")).toBeVisible();
  await expect(footer.getByLabel("1,234 visits so far")).toBeVisible();
  for (const name of ["Feedback", "Report a bug", "Suggest an idea"]) await expect(footer.getByRole("button", { name })).toBeVisible();
});

test("the counter hides itself when the count is unavailable", async ({ page }) => {
  await page.route("**/api/hit", (route) => route.fulfill({ status: 503, json: { error: "x" } }));
  await page.goto("/");
  await expect(page.locator(".app-footer").getByText("© M. White 2026")).toBeAttached();
  await expect(page.locator(".hit-counter")).toHaveCount(0);
});

test("a bug report builds an email to the owner, with details only if ticked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Report a bug" }).click();
  const send = page.getByRole("link", { name: "Open my email app to send" });
  await expect(page.getByRole("button", { name: "Open my email app to send" })).toBeDisabled();
  await page.getByLabel("Your message").fill("The hand is hidden");
  let href = (await send.getAttribute("href")) ?? "";
  expect(href).toContain("mailto:martinwhite228@gmail.com");
  expect(decodeURIComponent(href)).toContain("The hand is hidden");
  expect(decodeURIComponent(href)).not.toContain("Viewport");
  await page.getByLabel("Add screen and browser details").check();
  href = (await send.getAttribute("href")) ?? "";
  expect(decodeURIComponent(href)).toContain("Viewport");
  expect(decodeURIComponent(href)).toContain("subject=Switch bug report");
});

test("privacy page: export, then erase everything on this device", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.setItem("switchScoreKeeper", JSON.stringify({ hello: "world" })); localStorage.setItem("other", "keep"); });
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: /Privacy: what stays on your phone/ }).click();
  await expect(page.getByRole("heading", { name: /Your club is/ })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
  expect(download.suggestedFilename()).toBe("my-switch-data.json");
  await page.getByRole("button", { name: "Delete data on this device" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await page.waitForURL("**/", { timeout: 5000 });
  await expect(page.getByRole("heading", { name: /Know the rules/ })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("switchScoreKeeper"), localStorage.getItem("other")])).toEqual([null, "keep"]);
});

test("export keeps club data and leaves the sign-in out; erase removes only switch keys", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const p = await import("/src/switch/privacy.ts");
    const store = new Map<string, string>([["switchAccount", "{\"email\":\"a@b.c\"}"], ["switchClub", "{\"a\":1}"], ["unrelated", "x"]]);
    const fake = { get length() { return store.size; }, key: (i: number) => [...store.keys()][i] ?? null, getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => { store.delete(k); } } as unknown as Storage;
    const exported = JSON.parse(p.exportDeviceData(fake));
    const removed = p.eraseDeviceData(fake);
    return { keys: Object.keys(exported.data), removed, left: [...store.keys()] };
  });
  expect(out).toEqual({ keys: ["switchClub"], removed: 2, left: ["unrelated"] });
});
