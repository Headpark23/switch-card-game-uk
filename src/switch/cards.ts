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

/** Marks a card from the second deck (ruling 21). It plays exactly like its twin. */
export const COPY_MARK = "'";

/** The card as the rules see it: a copy from the second deck is the same card as its twin. */
export function faceOf(id: CardId): CardId {
  return (id.endsWith(COPY_MARK) ? id.slice(0, -1) : id) as CardId;
}

export function rankOf(id: CardId): Rank {
  return faceOf(id).slice(0, -1) as Rank;
}

export function suitOf(id: CardId): Suit {
  return faceOf(id).slice(-1) as Suit;
}

export function isBlackKing(id: CardId): boolean {
  const face = faceOf(id);
  return face === "KS" || face === "KC";
}

export function isRedKing(id: CardId): boolean {
  const face = faceOf(id);
  return face === "KH" || face === "KD";
}

/** One deck is 52 cards; two decks (7 or 8 players) are 104, the second deck's cards carrying the copy mark. */
export function createShoe(decks: 1 | 2): CardId[] {
  const ids = FULL_DECK.map((card) => card.id);
  return decks === 1 ? ids : [...ids, ...ids.map((id) => `${id}${COPY_MARK}` as CardId)];
}

export function cardLabel(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_META[card.suit].name}`;
}

/** A screen-reader friendly name for a compact card id such as "9H". */
export function cardIdLabel(id: CardId): string {
  return `${RANK_NAMES[rankOf(id)]} of ${SUIT_META[suitOf(id)].name}`;
}
