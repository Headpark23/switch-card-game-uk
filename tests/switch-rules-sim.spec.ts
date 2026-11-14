import { expect, test } from "@playwright/test";
// @ts-expect-error plain ES module used by both scripts and tests
import { buildCases, compareInPage } from "../scripts/engine-vs-rules.mjs";

// The app's rules engine must agree, position by position, with an independent player built only from the written rules.
test("the rules engine agrees with the written rules for 2, 3, 4, 7 and 8 players", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?frame=1");
  const result = await compareInPage(page, buildCases(25));
  expect(result.legality.mismatches, JSON.stringify(result.legality.sample)).toBe(0);
  expect(result.transitions.mismatches, JSON.stringify(result.transitions.sample)).toBe(0);
  expect(result.legality.checked).toBeGreaterThan(3000);
  expect(result.transitions.checked).toBeGreaterThan(3000);
});
