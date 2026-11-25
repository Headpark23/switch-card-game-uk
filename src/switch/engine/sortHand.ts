import { faceOf } from "./cards";
import type { CardId } from "./types";

const RANKS = "A23456789TJQK";
const SUITS = "SHDC";
const split = (card: CardId): [string, string] => {
  const text = faceOf(card);
  const suit = text.slice(-1);
  const rank = text.slice(0, -1) === "10" ? "T" : text.slice(0, -1);
  return [rank, suit];
};

/** Cards of the same number sit together (biggest sets first); the rest follow in suit order. */
export function sortHand(hand: readonly CardId[]): CardId[] {
  const counts = new Map<string, number>();
  for (const card of hand) counts.set(split(card)[0], (counts.get(split(card)[0]) ?? 0) + 1);
  const key = (card: CardId): [number, number, number] => {
    const [rank, suit] = split(card);
    const sets = (counts.get(rank) ?? 1) > 1;
    return sets
      ? [0, RANKS.indexOf(rank), SUITS.indexOf(suit)]
      : [1, SUITS.indexOf(suit), RANKS.indexOf(rank)];
  };
  return [...hand].sort((a, b) => {
    const x = key(a), y = key(b);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}
