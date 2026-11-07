import { createDeck, rankOf, suitOf } from "../switch/cards";
import type { CardId, GameState } from "../switch/types";

/**
 * Fixed decks for the automated browser tests. Only reachable from the dev
 * server (`?testDeck=…`); production builds never include them.
 */
const fullDeck = createDeck().map((card) => card.id);

function shuffled(): CardId[] {
  const cards = [...fullDeck];
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

function stacked(opening: readonly CardId[]): CardId[] {
  return [...opening, ...fullDeck.filter((card) => !opening.includes(card))];
}

const DECKS: Readonly<Record<string, () => CardId[]>> = {
  "1": () => stacked(["9H", "3C", "7H", "2C", "KH", "AS", "JH", "8H", "2D", "KC", "4H", "JS", "7S", "5D", "3H", "AH", "AC", "KS", "8S", "2S", "2H"]),
  blackKingChain: () => stacked(["AS", "KS", "KH", "9H", "3C", "7H", "JH", "KC", "4D", "5D", "6D", "9S", "QH", "10D", "3H"]),
  partialKing: () => stacked(["KS", "KH", "3C", "4D", "5D", "6D", "7D", "KC", "2H", "3H", "4H", "5H", "6H", "7H", "9S"]),
};

export function testDeckRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testDeck") !== null;
}

export function testGameFromUrl(): GameState | null {
  if (typeof window === "undefined") return null;
  const name = new URLSearchParams(window.location.search).get("testDeck");
  if (name === null) return null;

  const deck = (DECKS[name] ?? shuffled)();
  const playerHand = deck.splice(0, 7);
  const computerHand = deck.splice(0, 7);
  const ordinary = deck.findIndex((card) => !["A", "2", "7", "8", "J", "K"].includes(rankOf(card)));
  const [starter] = deck.splice(ordinary < 0 ? 0 : ordinary, 1);

  return {
    playerHand,
    computerHand,
    drawPile: deck.reverse(),
    discardPile: [starter],
    currentSuit: suitOf(starter),
    turn: "player",
    pendingPenalty: null,
    status: "playing",
    winner: null,
    move: 0,
  };
}
