import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

test("the shuffled pack contains all 52 unique card faces", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByRole("region", { name: "52-card game with 52 unique cards" })).toBeVisible();

  const cards = ["S", "H", "D", "C"].flatMap((suit) =>
    ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map((rank) => `${rank}${suit}`),
  );
  const responses = await Promise.all(cards.map((card) => request.get(`/images/cards/${card}.webp`)));
  expect(responses.every((response) => response.ok())).toBe(true);
});

async function startGame(page: Page) {
  await page.goto("/?testDeck=1");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();
  await expect(page.getByRole("region", { name: "52-card game with 52 unique cards" })).toBeVisible();
}

async function play(page: Page, card: string) {
  const ranks: Record<string, string> = { A: "Ace", J: "Jack", Q: "Queen", K: "King", "10": "Ten", "9": "Nine", "8": "Eight", "7": "Seven", "6": "Six", "5": "Five", "4": "Four", "3": "Three", "2": "Two" };
  const suits: Record<string, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
  const rank = card.slice(0, -1);
  const move = page.getByRole("button", { name: `Select ${ranks[rank]} of ${suits[card.slice(-1)]}, legal move` });
  await expect(move).toBeEnabled();
  await move.click();
  await page.getByRole("button", { name: "Play selected" }).click();
}

async function waitForPlayer(page: Page) {
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible({ timeout: 9_000 });
}

test("hints identify legal cards and an illegal move explains the rule", async ({ page }) => {
  await startGame(page);
  await page.getByRole("button", { name: "Show hint" }).click();

  await expect(page.getByText(/You can play 9H, 3C, 7H, KH, AS, JH/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Select Nine of hearts, legal move" })).toHaveClass(/playable/);
  await page.getByRole("button", { name: "Select Two of clubs, not currently playable" }).click();
  await expect(page.getByText(/cannot follow the current card/)).toBeVisible();
});

test("an off-suit ace is playable on an ordinary card and changes suit", async ({ page }) => {
  await startGame(page); // hearts are showing; the hand contains KH and the off-suit AS

  await expect(page.getByRole("button", { name: "Select King of hearts, legal move" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Select Ace of spades, legal move" })).toBeEnabled();
  await page.getByRole("button", { name: "Select Ace of spades, legal move" }).click();
  await page.getByRole("button", { name: "Play selected" }).click();

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
  await expect(page.getByRole("button", { name: "Select King of spades, legal move" })).toBeEnabled();
  await play(page, "KS");

  await expect(page.getByText("The computer picks up 10 cards. Your turn.")).toBeVisible({ timeout: 9_000 });
  await expect(page.getByText("16 cards", { exact: true })).toBeVisible();
});

test("one red king leaves five cards from a ten-card black-king stack", async ({ page }) => {
  await page.goto("/?testDeck=partialKing");
  await page.getByRole("button", { name: "Play against the computer" }).click();

  await play(page, "KS");
  await waitForPlayer(page);
  await play(page, "KH");

  await expect(page.getByText(/The red king cancels five cards. 5 are still at stake for the computer/)).toBeVisible();
  await expect(page.getByText("The computer picks up 5 cards. Your turn.")).toBeVisible({ timeout: 9_000 });
  await expect(page.getByText("11 cards", { exact: true })).toBeVisible();
});

test("leaving during a computer turn cannot move a replacement game", async ({ page }) => {
  await startGame(page);
  await play(page, "9H");
  await expect(page.getByText("GUIDED GAME · COMPUTER TURN")).toBeVisible();
  await page.getByRole("button", { name: "Exit game" }).click();
  await page.getByRole("button", { name: "Play against the computer" }).click();

  await page.waitForTimeout(900);
  await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();
  await expect(page.getByText("7 cards in your hand")).toBeVisible();
});

test("a player may pick up by choice even when legal cards are available", async ({ page }) => {
  await startGame(page);
  const tacticalPickup = page.getByRole("button", { name: "Pick up one card instead of playing" });

  await expect(tacticalPickup).toBeEnabled();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText(/You may also pick up one card instead and save a useful card for later/)).toBeVisible();
  await tacticalPickup.click();

  await expect(page.getByText("8 cards in your hand")).toBeVisible();
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 9_000 });
});

test("a player without an eight can clearly accept the missed turn", async ({ page }) => {
  await startGame(page);
  await play(page, "9H");

  const accept = page.getByRole("button", { name: "Accept missed turn" });
  await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 9_000 });
  await expect(page.getByText(/You have no eight to counter with/)).toBeVisible();
  await expect(accept).toBeEnabled();
  await accept.click();

  await waitForPlayer(page);
  await expect(accept).toHaveCount(0);
});

test("the main rules story teaches the complete game in five interactive steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Know the rules. Own the table." })).toBeVisible();
  await page.getByRole("button", { name: "Learn the rules" }).click();
  await expect(page.getByRole("heading", { name: "Deal everyone in." })).toBeVisible();
  await expect(page.getByText(/When the deck runs out/)).toBeVisible();

  await page.getByRole("button", { name: "02 PLAY" }).click();
  await expect(page.getByRole("heading", { name: "Play it or keep it." })).toBeVisible();
  await expect(page.getByText(/Matching numbers may be played together/)).toBeVisible();
  await expect(page.getByText(/ace is wild on any ordinary card, regardless of suit/)).toBeVisible();
  await expect(page.getByText(/pick up instead even when you can play/)).toBeVisible();

  await page.getByRole("button", { name: "03 POWER" }).click();
  await expect(page.getByText(/Twos add 2 cards to the penalty/)).toBeVisible();
  await expect(page.getByText(/Black kings add 5 each; a red king takes 5 off/)).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Accept missed turn" })).toBeEnabled({ timeout: 9_000 });
  await page.getByRole("button", { name: "Accept missed turn" }).click();
  await waitForPlayer(page);
  await play(page, "7H"); // seven: play again
  await play(page, "9H");
  await expect(page.getByRole("button", { name: "Draw a card" })).toBeEnabled({ timeout: 9_000 });
  await page.getByRole("button", { name: "Draw a card" }).click();
  await waitForPlayer(page);
  await play(page, "AC");
  await page.getByRole("dialog", { name: "Choose a suit" }).getByRole("button", { name: /clubs/i }).click();
  await waitForPlayer(page);
  await play(page, "3C");
  await page.getByRole("button", { name: "Say “Last Card”" }).click();
  await waitForPlayer(page);
  await play(page, "2C");

  await expect(page.getByRole("heading", { name: "You beat the computer." })).toBeVisible();
  await expect(page.getByText("You played your last card legally — you win!")).toBeVisible();

  // The win leads straight from practice to a real table.
  await expect(page.getByText("Play it with real cards")).toBeVisible();
  await page.getByRole("button", { name: /Start tonight/ }).click();
  await expect(page.getByRole("heading", { name: "Who is playing?" })).toBeVisible();
});

async function expectFitsOneScreen(page: Page) {
  const fit = await page.evaluate(() => {
    const hand = document.querySelector(".player-hand")!.getBoundingClientRect();
    const tabs = document.querySelector(".bottom-tabs")!.getBoundingClientRect();
    const scroller = document.querySelector('[data-testid="mobile-scroll"]') as HTMLElement;
    return { handBottom: hand.bottom, tabsTop: tabs.top, unusedSpace: tabs.top - hand.bottom, scrolled: scroller.scrollTop };
  });
  expect(fit.handBottom).toBeLessThanOrEqual(fit.tabsTop);
  expect(fit.unusedSpace).toBeLessThan(130);
  expect(fit.scrolled).toBe(0);
}

for (const device of ["iPhone", "Pixel 10"]) {
  test(`the whole game stays on one ${device} screen and shows whose turn it is`, async ({ page }) => {
    await page.goto("/?testDeck=1");
    if (device !== "iPhone") {
      await page.getByRole("button", { name: /Preview device/ }).click();
      await page.getByText("Pixel 10").click();
    }
    await page.getByRole("button", { name: "Play against the computer" }).click();
    await expect(page.getByText("GUIDED GAME · YOUR TURN")).toBeVisible();
    await expect(page.locator(".turn-banner.you")).toBeVisible();
    await expect(page.getByRole("button", { name: /Why & tactics: / })).toBeVisible();
    await expectFitsOneScreen(page);

    await play(page, "9H");
    await expect(page.locator(".turn-banner.computer")).toBeVisible();
    await expect(page.getByText("The computer played an eight")).toBeVisible({ timeout: 9_000 });

    // The busiest moment (miss-a-turn panel showing) still fits above the tab bar without scrolling.
    await expectFitsOneScreen(page);
  });
}

test("a computer that holds an eight says so and passes the missed turn back", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const ai = await import("/src/switch/ai.ts");
    const base = {
      playerHand: ["8H", "8S", "3C"], computerHand: ["9D", "4C", "QS"], drawPile: ["2C", "3C", "4C"], discardPile: ["9H"],
      currentSuit: "H", turn: "player", pendingPenalty: null, status: "playing", winner: null, move: 0,
    };
    const without = rules.applyAction(base, { type: "play", cards: ["8H", "8S"] });
    const withEight = rules.applyAction({ ...base, computerHand: ["8D", "4C", "QS"] }, { type: "play", cards: ["8H", "8S"] });
    return {
      withoutMoves: rules.legalMoves(without),
      withAction: ai.chooseComputerAction(withEight, () => 0),
    };
  });
  expect(result.withoutMoves).toEqual([{ type: "accept-missed-turn" }]);
  expect(result.withAction).toEqual({ type: "play", cards: ["8D"] });
});
