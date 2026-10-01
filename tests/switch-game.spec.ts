import { expect, test, type Page } from "@playwright/test";

test("the shuffled pack contains all 52 unique card faces", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByRole("region", { name: "52-card game with 52 unique cards" })).toBeVisible();

  const cards = ["S", "H", "D", "C"].flatMap((suit) =>
    ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map((rank) => `${rank}${suit}`),
  );
  const responses = await Promise.all(cards.map((card) => request.get(`/images/cards/${card}.png`)));
  expect(responses.every((response) => response.ok())).toBe(true);
});

async function startGame(page: Page) {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();
  await expect(page.getByRole("region", { name: "52-card game with 52 unique cards" })).toBeVisible();
}

async function play(page: Page, card: string) {
  const move = page.getByRole("button", { name: `Play ${card}, legal move` });
  await expect(move).toBeEnabled();
  await move.click();
}

async function waitForPlayer(page: Page) {
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible({ timeout: 4_000 });
}

test("hints identify legal cards and an illegal move explains the rule", async ({ page }) => {
  await startGame(page);
  await page.getByRole("button", { name: "Show hint" }).click();

  await expect(page.getByText(/You can play 9H, 3C, 7H, KH, AS, JH/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play 9H, legal move" })).toHaveClass(/playable/);
  await page.getByRole("button", { name: "Play 2C, not currently playable" }).click();
  await expect(page.getByText(/cannot follow the current card/)).toBeVisible();
});

test("an off-suit ace is playable on an ordinary card and changes suit", async ({ page }) => {
  await startGame(page); // hearts are showing; the hand contains KH and the off-suit AS

  await expect(page.getByRole("button", { name: "Play KH, legal move" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Play AS, legal move" })).toBeEnabled();
  await page.getByRole("button", { name: "Play AS, legal move" }).click();

  const chooser = page.getByRole("dialog", { name: "Choose a suit" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: /clubs/i }).click();
  await expect(page.getByText("♣ clubs")).toBeVisible();
});

test("black kings stack and the computer picks up the full penalty", async ({ page }) => {
  await page.goto("/?testDeck=blackKingChain");
  await page.getByRole("button", { name: "Play against the computer" }).click();

  await play(page, "AS");
  await page.getByRole("dialog", { name: "Choose a suit" }).getByRole("button", { name: /clubs/i }).click();
  await expect(page.getByText("GUIDED GAME · COMPUTER TURN")).toBeVisible();
  await waitForPlayer(page);
  await expect(page.getByRole("button", { name: "Play KS, legal move" })).toBeEnabled();
  await play(page, "KS");

  await expect(page.getByText("The computer picks up 10 cards. Your turn.")).toBeVisible({ timeout: 4_000 });
  await expect(page.getByText("16 cards", { exact: true })).toBeVisible();
});

test("a player may pick up by choice even when legal cards are available", async ({ page }) => {
  await startGame(page);
  const tacticalPickup = page.getByRole("button", { name: "Pick up one card instead of playing" });

  await expect(tacticalPickup).toBeEnabled();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText(/You may also pick up one card instead and save a useful card for later/)).toBeVisible();
  await tacticalPickup.click();

  await expect(page.getByText("8 cards in your hand")).toBeVisible();
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 4_000 });
});

test("a player without an eight can clearly accept the missed turn", async ({ page }) => {
  await startGame(page);
  await play(page, "9H");

  const accept = page.getByRole("button", { name: "Accept missed turn" });
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 4_000 });
  await expect(page.getByText(/You have no eight to counter with/)).toBeVisible();
  await expect(accept).toBeEnabled();
  await accept.click();

  await waitForPlayer(page);
  await expect(accept).toHaveCount(0);
});

test("the main rules story teaches the complete game in five interactive steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Know the rules. Own the table." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deal everyone in." })).toBeVisible();

  await page.getByRole("button", { name: "02 PLAY" }).click();
  await expect(page.getByRole("heading", { name: "Play it or keep it." })).toBeVisible();
  await expect(page.getByText(/Matching numbers may be played together/)).toBeVisible();
  await expect(page.getByText(/ace is wild on any ordinary card, regardless of suit/)).toBeVisible();
  await expect(page.getByText(/pick up instead even when you can play/)).toBeVisible();

  await page.getByRole("button", { name: "03 POWER" }).click();
  await expect(page.getByText(/Twos add 2 cards to the penalty/)).toBeVisible();
  await expect(page.getByText(/Black kings stack 5 at a time/)).toBeVisible();
  await page.getByRole("button", { name: "04 CALL" }).click();
  await expect(page.getByText(/Forget to announce it and you pick up 2 penalty cards/)).toBeVisible();
  await page.getByRole("button", { name: "05 WIN" }).click();
  await expect(page.getByText(/cannot finish on a seven/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play the guided game" })).toBeVisible();
});

test("a guided match follows power-card and last-card rules through a win", async ({ page }) => {
  await startGame(page);

  await play(page, "JH"); // reverse in a two-player game: play again
  await play(page, "AS");
  await page.getByRole("dialog", { name: "Choose a suit" }).getByRole("button", { name: /clubs/i }).click();
  await play(page, "KH"); // red king cancels the computer's black king
  await expect(page.getByRole("button", { name: "Accept missed turn" })).toBeEnabled({ timeout: 4_000 });
  await page.getByRole("button", { name: "Accept missed turn" }).click();
  await waitForPlayer(page);
  await play(page, "7H"); // seven: play again
  await play(page, "9H");
  await expect(page.getByRole("button", { name: "Draw a card" })).toBeEnabled({ timeout: 4_000 });
  await page.getByRole("button", { name: "Draw a card" }).click();
  await waitForPlayer(page);
  await play(page, "2C");
  await waitForPlayer(page);
  await play(page, "3C");
  await page.getByRole("button", { name: "Say “Last Card”" }).click();
  await waitForPlayer(page);
  await play(page, "AC");
  await page.getByRole("dialog", { name: "Choose a suit" }).getByRole("button", { name: /clubs/i }).click();

  await expect(page.getByRole("heading", { name: "You beat the computer." })).toBeVisible();
  await expect(page.getByText("You played your last card legally — you win!")).toBeVisible();
});
