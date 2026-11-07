import { rankOf, suitOf } from "./cards";
import { legalMoves } from "./rules";
import type { CardId, GameState, Suit } from "./types";

/**
 * The tutorial's "coach": plain-English answers to the two questions a learner
 * keeps asking: "what did that do?" and "what can I do now?". It only reads game
 * state, so the same shape works for any game whose rules can list legal moves.
 */
export interface CoachOption {
  readonly kind: "play" | "counter" | "pickup" | "miss";
  /** Short heading, e.g. "Match the suit (hearts)". */
  readonly label: string;
  /** The cards involved, if any. */
  readonly cards: readonly CardId[];
  /** One sentence on what choosing it does. */
  readonly detail: string;
}

const SUIT_NAMES: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RANK_WORDS: Record<string, string> = {
  A: "ace", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
  "8": "eight", "9": "nine", "10": "ten", J: "jack", Q: "queen", K: "king",
};

export type Side = "you" | "computer";

function subject(side: Side) {
  return side === "you" ? "You" : "The computer";
}
function other(side: Side) {
  return side === "you" ? "the computer" : "you";
}
function isBlackKing(card: CardId) {
  return card === "KS" || card === "KC";
}

/** Why the card just played matters, in one or two sentences. */
export function explainEffect(before: GameState, after: GameState, cards: readonly CardId[], side: Side, aceSuit?: Suit): string {
  const rank = rankOf(cards[0]);
  const next = other(side);
  const penalty = after.pendingPenalty;
  const wasBlackKingStack = before.pendingPenalty?.kind === "black-king";

  if (penalty?.kind === "draw-two") {
    return `${subject(side)} played a two, so ${next} must pick up ${penalty.cards} cards unless ${next === "you" ? "you stack" : "they stack"} another two.`;
  }
  if (penalty?.kind === "black-king") {
    return wasBlackKingStack && cards.some((card) => !isBlackKing(card))
      ? `The red king cancels five cards. ${penalty.cards} are still at stake for ${next}.`
      : `Black king: ${next} must pick up ${penalty.cards} cards, unless ${next === "you" ? "you add" : "they add"} another black king or cancel it with a red king.`;
  }
  if (penalty?.kind === "miss-turn") {
    return `Eight: ${next === "you" ? "you miss" : "the computer misses"} a turn unless ${next === "you" ? "you play" : "it plays"} an eight to pass it on.`;
  }
  if (wasBlackKingStack && rank === "K") return "The red king cancels the whole penalty. Play carries on as normal.";
  if (rank === "7") return `Seven: ${side === "you" ? "you play" : "the computer plays"} again.`;
  if (rank === "J") {
    return cards.length % 2
      ? `Jack: play reverses, which in a two-player game means ${side === "you" ? "you play" : "the computer plays"} again.`
      : "Two jacks cancel each other out, so play moves on as normal.";
  }
  if (rank === "A") return `Ace: wild. The suit is now ${SUIT_NAMES[aceSuit ?? suitOf(cards[cards.length - 1])]}, so ${next === "you" ? "you need" : "the computer needs"} that suit or another ace.`;
  const top = after.discardPile[after.discardPile.length - 1];
  return `Ordinary card. The next card must match ${SUIT_NAMES[after.currentSuit]} or be a ${RANK_WORDS[rankOf(top)]}.`;
}

/** Why the computer (or you) picked up instead of playing. */
export function explainPickup(before: GameState, side: Side, count: number): string {
  const penalty = before.pendingPenalty;
  const who = subject(side);
  if (penalty?.kind === "draw-two") return `${who} had no two to stack, so ${side === "you" ? "you take" : "it takes"} the ${count} cards.`;
  if (penalty?.kind === "black-king") return `${who} had no king to answer with, so ${side === "you" ? "you take" : "it takes"} the ${count} cards.`;
  const couldPlay = legalMoves(before).some((action) => action.type === "play");
  return couldPlay
    ? `${who} chose to pick up one card even though a play was available. That is allowed, and it can save a strong card for later.`
    : `${who} had nothing that matched ${SUIT_NAMES[before.currentSuit]} or the top number, so ${side === "you" ? "you pick" : "it picks"} up one card.`;
}

/** A short list of what the player can do right now, grouped so it is easy to scan. */
export function explainOptions(state: GameState): CoachOption[] {
  const hand = state.playerHand;
  const penalty = state.pendingPenalty;
  const moves = legalMoves({ ...state, turn: "player" });
  const singles = moves.filter((move): move is Extract<typeof move, { type: "play" }> => move.type === "play" && move.cards.length === 1);
  const playable = [...new Set(singles.map((move) => move.cards[0]))];
  const options: CoachOption[] = [];

  if (penalty?.kind === "draw-two") {
    const twos = playable.filter((card) => rankOf(card) === "2");
    if (twos.length) options.push({ kind: "counter", label: "Stack a two", cards: twos, detail: `Passes the penalty on, now ${penalty.cards + 2} cards.` });
    options.push({ kind: "pickup", label: `Pick up ${penalty.cards}`, cards: [], detail: "Takes the penalty and ends your turn." });
    return options;
  }
  if (penalty?.kind === "black-king") {
    const black = playable.filter(isBlackKing);
    const red = playable.filter((card) => rankOf(card) === "K" && !isBlackKing(card));
    if (black.length) options.push({ kind: "counter", label: "Play a black king", cards: black, detail: `Adds 5 and passes it on, now ${penalty.cards + 5}.` });
    if (red.length) options.push({ kind: "counter", label: "Play a red king", cards: red, detail: "Cancels 5 cards of the penalty." });
    options.push({ kind: "pickup", label: `Pick up ${penalty.cards}`, cards: [], detail: "Takes the penalty and ends your turn." });
    return options;
  }
  if (penalty?.kind === "miss-turn") {
    const eights = playable.filter((card) => rankOf(card) === "8");
    if (eights.length) options.push({ kind: "counter", label: "Play an eight", cards: eights, detail: "Passes the missed turn back to the computer." });
    options.push({ kind: "miss", label: "Miss your turn", cards: [], detail: eights.length ? "Or accept it and let the computer play." : "You have no eight, so this is your only move." });
    return options;
  }

  const top = state.discardPile[state.discardPile.length - 1];
  const suitMatches = playable.filter((card) => rankOf(card) !== "A" && suitOf(card) === state.currentSuit);
  const rankMatches = playable.filter((card) => rankOf(card) !== "A" && suitOf(card) !== state.currentSuit);
  const aces = playable.filter((card) => rankOf(card) === "A");
  if (suitMatches.length) options.push({ kind: "play", label: `Match the suit (${SUIT_NAMES[state.currentSuit]})`, cards: suitMatches, detail: "Any of these can go on the pile." });
  if (rankMatches.length) options.push({ kind: "play", label: `Match the number (${RANK_WORDS[rankOf(top)]})`, cards: rankMatches, detail: "Changes the suit to the card you play." });
  if (aces.length) options.push({ kind: "play", label: "Play a wild ace", cards: aces, detail: "Works on any ordinary card, and you choose the next suit." });

  const sets = [...new Set(hand.map(rankOf))].filter((rank) => hand.filter((card) => rankOf(card) === rank).length > 1 && playable.some((card) => rankOf(card) === rank));
  if (sets.length) options.push({ kind: "play", label: "Play a matching set", cards: sets.flatMap((rank) => hand.filter((card) => rankOf(card) === rank)), detail: "Select two or more of the same number. The last one you pick sets the suit." });
  if (!playable.length) options.push({ kind: "pickup", label: "Pick up one card", cards: [], detail: `Nothing matches ${SUIT_NAMES[state.currentSuit]} or the ${RANK_WORDS[rankOf(top)]}, so you must pick up.` });
  else options.push({ kind: "pickup", label: "Or pick up one card", cards: [], detail: "Allowed even when you can play. Handy for saving an ace or a king." });
  return options;
}

/** The reason a tapped card cannot be played. */
export function explainUnplayable(card: CardId, state: GameState): string {
  const rank = rankOf(card);
  const penalty = state.pendingPenalty;
  const top = state.discardPile[state.discardPile.length - 1];
  if (rank === "A" && penalty) return "An ace is wild on ordinary cards, but cannot interrupt a black king, two or eight.";
  if (penalty?.kind === "draw-two") return `Twos are stacking, so only another two can answer. ${card} cannot follow the current card.`;
  if (penalty?.kind === "black-king") return `A black king is active, so only a king can answer. ${card} cannot follow the current card.`;
  if (penalty?.kind === "miss-turn") return `An eight is active, so only another eight can answer. ${card} cannot follow the current card.`;
  if (rank === "7" || rank === "J") {
    if (state.playerHand.length === 1) return "You cannot finish on a seven or a jack in this two-player game.";
  }
  const topRank = RANK_WORDS[rankOf(top)];
  const article = /^[aeiou]/i.test(topRank) ? "an" : "a";
  return `That card cannot follow the current card. ${card} is a ${RANK_WORDS[rank]} of ${SUIT_NAMES[suitOf(card)]}, and the pile needs ${SUIT_NAMES[state.currentSuit]} or ${article} ${topRank}.`;
}
