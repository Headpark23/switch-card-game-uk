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

  // Ruling 9: turning the played pile face down means the oldest card is drawn first.
  expect(result.playerHand).toEqual(["9H", "AS", "2C", "3D"]);
  expect(result.drawPile).toEqual([]);
  expect(result.discardPile).toEqual(["4H"]);
  expect(result.uniqueCount).toBe(result.zoneCount);
});

test("power cards stack, pass turns and cannot finish illegally", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const twoState = {
      playerHand: ["2H", "2S", "3C"],
      computerHand: ["2C", "2D", "4D"],
      drawPile: ["5C", "6C", "7C", "8C", "9C", "10C", "QC", "AC"],
      discardPile: ["9H"],
      currentSuit: "H",
      turn: "player",
      pendingPenalty: null,
      status: "playing",
      winner: null,
      move: 0,
    };
    const afterTwo = rules.applyAction(twoState, { type: "play", cards: ["2H"] });
    const afterFour = rules.applyAction(afterTwo, { type: "play", cards: ["2C"] });
    const afterSix = rules.applyAction(afterFour, { type: "play", cards: ["2S"] });
    const afterEight = rules.applyAction(afterSix, { type: "play", cards: ["2D"] });

    const eightState = {
      ...twoState,
      playerHand: ["8H", "3C"],
      computerHand: ["8S", "4D"],
      discardPile: ["9H"],
    };
    const firstEight = rules.applyAction(eightState, { type: "play", cards: ["8H"] });
    const secondEight = rules.applyAction(firstEight, { type: "play", cards: ["8S"] });
    const acceptedEight = rules.applyAction(secondEight, { type: "accept-missed-turn" });

    const sevenState = { ...twoState, playerHand: ["7H", "3C"], computerHand: ["4D"] };
    const jackState = { ...twoState, playerHand: ["JH", "3C"], computerHand: ["4D"] };
    const sevenAgain = rules.applyAction(sevenState, { type: "play", cards: ["7H"] });
    const jackAgain = rules.applyAction(jackState, { type: "play", cards: ["JH"] });
    const twoJacks = rules.applyAction(
      { ...twoState, playerHand: ["JH", "JS", "3C"], computerHand: ["4D"] },
      { type: "play", cards: ["JH", "JS"] },
    );

    const finalSeven = rules.legalMoves({ ...sevenState, playerHand: ["7H"] });
    const finalJack = rules.legalMoves({ ...jackState, playerHand: ["JH"] });
    const penaltyMoves = rules.legalMoves({
      ...twoState,
      playerHand: ["AS", "2H", "3C"],
      pendingPenalty: { kind: "draw-two", cards: 2 },
    });

    return {
      stackedPenalty: afterEight.pendingPenalty,
      firstEight: { pending: firstEight.pendingPenalty, turn: firstEight.turn },
      secondEight: { pending: secondEight.pendingPenalty, turn: secondEight.turn },
      acceptedEight: { pending: acceptedEight.pendingPenalty, turn: acceptedEight.turn },
      sevenTurn: sevenAgain.turn,
      jackTurn: jackAgain.turn,
      twoJacksTurn: twoJacks.turn,
      finalSeven,
      finalJack,
      penaltyMoves,
    };
  });

  expect(result.stackedPenalty).toEqual({ kind: "draw-two", cards: 8 });
  expect(result.firstEight).toEqual({ pending: { kind: "miss-turn" }, turn: "computer" });
  expect(result.secondEight).toEqual({ pending: { kind: "miss-turn" }, turn: "player" });
  expect(result.acceptedEight).toEqual({ pending: null, turn: "computer" });
  expect(result.sevenTurn).toBe("player");
  expect(result.jackTurn).toBe("player");
  expect(result.twoJacksTurn).toBe("computer");
  expect(result.finalSeven).not.toContainEqual({ type: "play", cards: ["7H"] });
  expect(result.finalJack).not.toContainEqual({ type: "play", cards: ["JH"] });
  expect(result.penaltyMoves).toContainEqual({ type: "play", cards: ["2H"] });
  expect(result.penaltyMoves).not.toContainEqual({ type: "play", cards: ["AS"], chosenSuit: "S" });
});

test("king penalties cancel one five-card unit per red king", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const rules = await import("/src/switch/rules.ts");
    const base = {
      playerHand: ["KH", "3C"],
      computerHand: ["4D"],
      drawPile: ["2H", "3H", "4H", "5H", "6H", "7H", "8H"],
      discardPile: ["KS"],
      currentSuit: "S",
      turn: "player",
      pendingPenalty: { kind: "black-king", units: 1, cards: 5 },
      status: "playing",
      winner: null,
      move: 0,
    };

    const oneAgainstOne = rules.applyAction(base, { type: "play", cards: ["KH"] });
    const oneAgainstTwo = rules.applyAction(
      { ...base, pendingPenalty: { kind: "black-king", units: 2, cards: 10 } },
      { type: "play", cards: ["KH"] },
    );
    const twoAgainstTwoState = {
      ...base,
      playerHand: ["KH", "KD", "3C"],
      pendingPenalty: { kind: "black-king", units: 2, cards: 10 },
    };
    const pairIsLegal = rules.legalMoves(twoAgainstTwoState);
    const twoAgainstTwo = rules.applyAction(twoAgainstTwoState, { type: "play", cards: ["KH", "KD"] });
    const drewFive = rules.applyAction(base, { type: "draw" });

    const stackStart = {
      ...base,
      playerHand: ["KS", "3C"],
      computerHand: ["KC", "4D"],
      discardPile: ["9S"],
      pendingPenalty: null,
    };
    const oneBlack = rules.applyAction(stackStart, { type: "play", cards: ["KS"] });
    const twoBlack = rules.applyAction(oneBlack, { type: "play", cards: ["KC"] });

    return {
      oneAgainstOne: oneAgainstOne.pendingPenalty,
      oneAgainstTwo: oneAgainstTwo.pendingPenalty,
      pairIsLegal,
      twoAgainstTwo: twoAgainstTwo.pendingPenalty,
      drewFiveCount: drewFive.playerHand.length,
      drewFiveTurn: drewFive.turn,
      oneBlack: oneBlack.pendingPenalty,
      twoBlack: twoBlack.pendingPenalty,
    };
  });

  expect(result.oneAgainstOne).toBeNull();
  expect(result.oneAgainstTwo).toEqual({ kind: "black-king", units: 1, cards: 5 });
  expect(result.pairIsLegal).toContainEqual({ type: "play", cards: ["KH", "KD"] });
  expect(result.twoAgainstTwo).toBeNull();
  expect(result.drewFiveCount).toBe(7);
  expect(result.drewFiveTurn).toBe("computer");
  expect(result.oneBlack).toEqual({ kind: "black-king", units: 1, cards: 5 });
  expect(result.twoBlack).toEqual({ kind: "black-king", units: 2, cards: 10 });
});
