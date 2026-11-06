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

test("normal turn rules cover matching, wild aces, sets and voluntary pickup", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const state = {
      playerHand: ["9H", "9S", "AS", "3C"],
      computerHand: ["4D"],
      drawPile: ["5C", "6C"],
      discardPile: ["5H"],
      currentSuit: "H",
      turn: "player",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    };

    const actions = rules.legalMoves(state);
    const playedAce = rules.applyAction(state, { type: "play", cards: ["AS"], chosenSuit: "C" });
    const playedSet = rules.applyAction(state, { type: "play", cards: ["9H", "9S"] });
    const pickedUp = rules.applyAction(state, { type: "draw" });

    return {
      actions,
      originalHand: state.playerHand,
      aceSuit: playedAce.currentSuit,
      aceDiscard: playedAce.discardPile,
      setHand: playedSet.playerHand,
      setDiscard: playedSet.discardPile,
      pickedUpHand: pickedUp.playerHand,
      pickedUpTurn: pickedUp.turn,
    };
  });

  expect(result.actions).toContainEqual({ type: "play", cards: ["9H"] });
  expect(result.actions).toContainEqual({ type: "play", cards: ["AS"], chosenSuit: "S" });
  expect(result.actions).toContainEqual({ type: "play", cards: ["9H", "9S"] });
  expect(result.actions).not.toContainEqual({ type: "play", cards: ["3C"] });
  expect(result.actions).toContainEqual({ type: "draw" });
  expect(result.originalHand).toEqual(["9H", "9S", "AS", "3C"]);
  expect(result.aceSuit).toBe("C");
  expect(result.aceDiscard.at(-1)).toBe("AS");
  expect(result.setHand).toEqual(["AS", "3C"]);
  expect(result.setDiscard.slice(-2)).toEqual(["9H", "9S"]);
  expect(result.pickedUpHand).toEqual(["9H", "9S", "AS", "3C", "6C"]);
  expect(result.pickedUpTurn).toBe("computer");
});

test("draw pile turnover preserves the top discard and safely exhausts", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const state = {
      playerHand: ["9H"],
      computerHand: ["4D"],
      drawPile: ["AS"],
      discardPile: ["2C", "3D", "4H"],
      currentSuit: "H",
      turn: "player",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    };

    const after = rules.drawCards(state, 6, "player");
    const allZones = [
      ...after.playerHand,
      ...after.computerHand,
      ...after.drawPile,
      ...after.discardPile,
    ];

    return {
      playerHand: after.playerHand,
      drawPile: after.drawPile,
      discardPile: after.discardPile,
      uniqueCount: new Set(allZones).size,
      zoneCount: allZones.length,
    };
  });

  expect(result.playerHand).toEqual(["9H", "AS", "3D", "2C"]);
  expect(result.drawPile).toEqual([]);
  expect(result.discardPile).toEqual(["4H"]);
  expect(result.uniqueCount).toBe(result.zoneCount);
});
