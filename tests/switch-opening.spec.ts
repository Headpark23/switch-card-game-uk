import { expect, test } from "@playwright/test";

// Ruling 33: now and then the dealer's turned-up card is a power card, and it does what it always does.
test("a power card turned up by the dealer takes effect before anyone plays", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const table = await import("/src/switch/table.ts");
    const rules = await import("/src/switch/rules.ts");
    const e = (card: string, dealer: number, seats: number, hand: string[] = ["3S"]) => table.openingEffect(card as any, dealer, hand as any, seats);
    // A forced start: dealer seat 3 of 4. Seeded random 0.99 never rolls the honest chance, so powerStart forces it.
    const forced = table.createTable(4, () => 0.5, 3, { powerStart: true });
    const ordinary = table.createTable(4, () => 0.99, 3, { powerStartChance: 0.2 });
    const twoPlayer = (card: string, first: "player" | "computer") => {
      // Build the same game through the public function by searching seeds for the wanted starter.
      for (let seed = 1; seed < 4000; seed += 1) {
        let x = seed; const random = () => ((x = (x * 16807) % 2147483647) / 2147483647);
        const peek = rules.createInitialGame(random, first, { powerStartChance: 1 });
        if (peek.discardPile[0] === card) return { turn: peek.turn, penalty: peek.pendingPenalty, suit: peek.currentSuit };
      }
      return null;
    };
    return {
      seven: e("7H", 3, 4), jackFour: e("JH", 3, 4), jackTwo: e("JH", 1, 2), two: e("2H", 3, 4), eight: e("8D", 3, 4),
      blackKing: e("KS", 3, 4), redKing: e("KH", 3, 4), ordinary: e("5H", 3, 4),
      ace: e("AS", 3, 4, ["3H", "9H", "4C", "KH"]),
      forcedValid: forced.discardPile.length === 1 && forced.hands.every((hand) => hand.length === 7),
      ordinaryRank: ordinary.discardPile[0].slice(0, -1),
      guidedSeven: twoPlayer("7H", "player"), guidedTwo: twoPlayer("2D", "player"), guidedJack: twoPlayer("JC", "computer"),
    };
  });
  expect(out.seven).toMatchObject({ turn: 3, pendingPenalty: null });
  expect(out.jackFour).toMatchObject({ turn: 2, direction: -1 });
  expect(out.jackTwo).toMatchObject({ turn: 1, direction: 1 });
  expect(out.two).toMatchObject({ turn: 0, pendingPenalty: { kind: "draw-two", cards: 2 } });
  expect(out.eight).toMatchObject({ turn: 0, pendingPenalty: { kind: "miss-turn" } });
  expect(out.blackKing).toMatchObject({ turn: 0, pendingPenalty: { kind: "black-king", cards: 5 } });
  expect(out.redKing).toMatchObject({ turn: 0, pendingPenalty: null });
  expect(out.ordinary).toMatchObject({ turn: 0, pendingPenalty: null });
  expect(out.ace).toMatchObject({ turn: 0, suit: "S" });
  expect(out.forcedValid).toBe(true);
  expect(["A", "2", "7", "8", "J", "K"]).not.toContain(out.ordinaryRank);
  expect(out.guidedSeven).toMatchObject({ turn: "computer", penalty: null });
  expect(out.guidedTwo).toMatchObject({ turn: "player", penalty: { kind: "draw-two", cards: 2 } });
  expect(out.guidedJack).toMatchObject({ turn: "player" });
});
