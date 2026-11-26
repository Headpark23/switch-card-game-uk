import { expect, test, type Page } from "@playwright/test";

// The website layout (owner decision, 15 Nov 2026). `?web=1` forces it even though the rest of the suite runs the framed phone preview.
const open = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await page.goto("/?web=1");
  await expect(page.getByTestId("device-screen")).toHaveAttribute("data-device", "native");
};
const noSideScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test("on a laptop the app fills the window: no phone frame, a full sidebar, and four tiles in a row", async ({ page }) => {
  await open(page, 1440, 900);
  await expect(page.getByTestId("phone-frame")).toHaveCount(0);
  const screen = await page.getByTestId("device-screen").boundingBox();
  expect(screen!.width).toBeGreaterThan(1400);

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const box = await nav.boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.width).toBeGreaterThan(240);
  expect(box!.height).toBeGreaterThan(800); // a sidebar, not a bottom bar
  await expect(nav.getByText("Your game-night club")).toBeVisible();
  await expect(nav.getByRole("button", { name: "Learn the rules" })).toBeVisible();

  const tiles = await page.locator(".home-tiles.v2 .home-tile").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tiles).size).toBe(1);
  await noSideScroll(page);
});

test("on a tablet the navigation is a slim rail down the left", async ({ page }) => {
  await open(page, 820, 1180);
  const box = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.width).toBeLessThan(130);
  expect(box!.height).toBeGreaterThan(1000);
  await noSideScroll(page);
});

test("on a phone the bottom tab bar is unchanged", async ({ page }) => {
  await open(page, 390, 844);
  const box = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
  expect(box!.width).toBeGreaterThan(380);
  expect(box!.y).toBeGreaterThan(700);
  await expect(page.locator(".side-brand")).toBeHidden();
  await noSideScroll(page);
});

test("every main destination opens from the sidebar and fits the window", async ({ page }) => {
  await open(page, 1440, 900);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const tab of ["Play", "Score", "Club", "Me", "Home"]) {
    await nav.getByRole("button", { name: tab, exact: true }).click();
    await expect(nav.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
    await noSideScroll(page);
  }
});

test("typing never raises the simulated keyboard on a laptop, and the navigation stays", async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Score", exact: true }).click();
  await page.getByPlaceholder("Enter name").first().click();
  await page.keyboard.type("Sam");
  await expect(page.getByPlaceholder("Enter name").first()).toHaveValue("Sam");
  await expect(page.getByTestId("keyboard-dock")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("the Play lobby puts the deal button beside the setup on a laptop", async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Play", exact: true }).click();
  const deal = await page.getByRole("button", { name: /Deal me in/ }).boundingBox();
  const modes = await page.locator(".mode-grid").boundingBox();
  expect(deal!.x).toBeGreaterThan(modes!.x + modes!.width);
  expect(deal!.y).toBeLessThan(900);
});

test("the card table uses big cards on a laptop and the hand fits without scrolling", async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Deal me in/ }).click();
  const hand = page.locator(".table-game .player-hand button");
  await expect(hand.first()).toBeVisible();
  const card = await hand.first().boundingBox();
  expect(card!.width).toBeGreaterThan(90);
  const last = await hand.last().boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(900);
});

test("sheets open as a centred dialog on a laptop", async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole("button", { name: "Plan a night" }).first().click();
  const sheet = await page.getByTestId("bottom-sheet").boundingBox();
  const centre = sheet!.x + sheet!.width / 2;
  expect(Math.abs(centre - 720)).toBeLessThan(40);
  expect(sheet!.width).toBeLessThan(700);
});

test("Today's Daily Hand sits at the top of the lower Home section with readable light text", async ({ page }) => {
  for (const [width, height] of [[390, 844], [1440, 900]] as const) {
    await open(page, width, height);
    const daily = page.getByTestId("home-daily-hand");
    await expect(daily).toBeVisible();
    const dailyBox = await daily.boundingBox();
    const clubBox = await page.locator(".home-club-card").boundingBox();
    expect(dailyBox!.y).toBeLessThan(clubBox!.y);
    const colors = await daily.evaluate((el) => ({
      title: getComputedStyle(el.querySelector("strong")!).color,
      sub: getComputedStyle(el.querySelector("em")!).color,
    }));
    expect(colors.title).toBe("rgb(255, 253, 247)");
    expect(colors.sub).toBe("rgb(232, 225, 206)");
  }
});
