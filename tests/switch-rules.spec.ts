import { expect, test } from "@playwright/test";

test("deck uses 52 stable, unique card identities", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const cards = await import("/src/switch/cards.ts");
    const first = cards.createDeck();
    const second = cards.createDeck();

    return {
      count: first.length,
      ids: first.map((card) => card.id),
      distinctArrays: first !== second,
      distinctCards: first[0] !== second[0],
    };
  });

  expect(result.count).toBe(52);
  expect(new Set(result.ids).size).toBe(52);
  expect(result.ids).toContain("AS");
  expect(result.ids).toContain("KC");
  expect(result.distinctArrays).toBe(true);
  expect(result.distinctCards).toBe(true);
});

test("card labels and suit colour metadata stay separate", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const cards = await import("/src/switch/cards.ts");
    const deck = cards.createDeck();
    const kingOfSpades = deck.find((card) => card.id === "KS");

    if (!kingOfSpades) throw new Error("KS is missing from the deck");

    return {
      label: cards.cardLabel(kingOfSpades),
      rank: cards.rankOf("KS"),
      suit: cards.suitOf("KS"),
      spades: cards.SUIT_META.S,
      hearts: cards.SUIT_META.H,
    };
  });

  expect(result.label).toBe("King of spades");
  expect(result.rank).toBe("K");
  expect(result.suit).toBe("S");
  expect(result.spades).toMatchObject({ name: "spades", symbol: "♠", colour: "black" });
  expect(result.hearts).toMatchObject({ name: "hearts", symbol: "♥", colour: "red" });
  expect(result.spades.name).not.toBe(result.spades.colour);
});
