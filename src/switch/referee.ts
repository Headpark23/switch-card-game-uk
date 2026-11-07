import { isNormallyPlayable, isPlayableDuringPenalty } from "./rules";
import { cardIdLabel, rankOf, suitOf } from "./cards";
import type { CardId, PendingPenalty, Suit } from "./types";

export type Situation = "nothing" | "draw-two" | "black-king" | "miss-turn";
export interface Ruling { readonly legal: boolean; readonly verdict: string; readonly why: string }

const SUIT_WORD: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

/** Answers "can I play this?" from the same rules the engine uses, and says which rule applies. */
export function refereeRuling(top: CardId, suit: Suit, situation: Situation, card: CardId): Ruling {
  const penalty: PendingPenalty | null = situation === "draw-two" ? { kind: "draw-two", cards: 2 }
    : situation === "black-king" ? { kind: "black-king", units: 1, cards: 5 }
    : situation === "miss-turn" ? { kind: "miss-turn" } : null;
  const state = { discardPile: [top], currentSuit: suit, pendingPenalty: penalty };
  const legal = penalty ? isPlayableDuringPenalty(card, state) : isNormallyPlayable(card, state);
  const name = cardIdLabel(card);
  const rank = rankOf(card);
  if (situation === "draw-two") return legal
    ? { legal, verdict: `Yes, play the ${name}.`, why: "A 2 on top of a 2 stacks the penalty: the next player picks up 2 more, or answers with a 2 of their own." }
    : { legal, verdict: `No, not the ${name}.`, why: "When a 2 is on the table you may only play another 2. Otherwise you pick up the penalty cards and your turn ends." };
  if (situation === "black-king") return legal
    ? { legal, verdict: `Yes, play the ${name}.`, why: rank === "K" && "SC".includes(suitOf(card)) ? "Another black king adds 5 to the pile to pick up." : "A red king takes 5 off the pile to pick up. Order matters when you lay several kings: black adds 5, red takes 5 off." }
    : { legal, verdict: `No, not the ${name}.`, why: "Against a black king only a king can answer. Otherwise you pick up the 5 (or 10) cards." };
  if (situation === "miss-turn") return legal
    ? { legal, verdict: `Yes, play the ${name}.`, why: "An eight passes the missed turn on to the next player." }
    : { legal, verdict: `No, not the ${name}.`, why: "Against an eight you can only play an eight to pass it on, or accept the missed turn." };
  if (legal) return { legal, verdict: `Yes, play the ${name}.`, why: rank === "A" ? "An ace is wild on any ordinary card: you choose the suit that comes next." : suitOf(card) === suit ? `It matches the suit, ${SUIT_WORD[suit]}.` : `It matches the number, ${rankOf(top)}.` };
  return { legal, verdict: `No, not the ${name}.`, why: `It must match the suit (${SUIT_WORD[suit]}) or the number (${rankOf(top)}), unless you play an ace. If you cannot play, pick up one card and your turn ends.` };
}
