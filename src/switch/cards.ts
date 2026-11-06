import type { Card, CardColour, CardId, Rank, Suit } from "./types";

export const SUITS = ["S", "H", "D", "C"] as const satisfies readonly Suit[];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const satisfies readonly Rank[];

export const SUIT_META: Readonly<Record<Suit, { readonly name: string; readonly symbol: string; readonly colour: CardColour }>> =
  Object.freeze({
    S: Object.freeze({ name: "spades", symbol: "♠", colour: "black" }),
    H: Object.freeze({ name: "hearts", symbol: "♥", colour: "red" }),
    D: Object.freeze({ name: "diamonds", symbol: "♦", colour: "red" }),
    C: Object.freeze({ name: "clubs", symbol: "♣", colour: "black" }),
  });

const RANK_NAMES: Readonly<Record<Rank, string>> = Object.freeze({
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
});

const FULL_DECK: readonly Readonly<Card>[] = Object.freeze(
  SUITS.flatMap((suit) =>
    RANKS.map((rank) =>
      Object.freeze({
        id: `${rank}${suit}` as CardId,
        rank,
        suit,
        colour: SUIT_META[suit].colour,
      }),
    ),
  ),
);

export function createDeck(): Card[] {
  return FULL_DECK.map((card) => ({ ...card }));
}

export function rankOf(id: CardId): Rank {
  return id.slice(0, -1) as Rank;
}

export function suitOf(id: CardId): Suit {
  return id.slice(-1) as Suit;
}

export function cardLabel(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_META[card.suit].name}`;
}
