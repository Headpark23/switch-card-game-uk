import { rankOf, suitOf } from "./cards";
import { applyAction, legalMoves } from "./rules";
import type { CardId, GameAction, GameState, Suit } from "./types";

/**
 * The tutorial's tactics coach. It looks at the player's real hand and every legal move,
 * recommends one, and gives the reasons in plain English. It only reads game state and the
 * rules engine, so another game can reuse the shape: pick, reasons, tactics, one note per card.
 */
export interface CardNote {
  readonly card: CardId;
  readonly legal: boolean;
  readonly text: string;
}

export interface Advice {
  readonly kind: "play" | "pickup" | "accept";
  /** Cards to play, in the order to play them. Empty when the pick is to pick up. */
  readonly cards: readonly CardId[];
  readonly chosenSuit?: Suit;
  /** One line, e.g. "Play the 10 of hearts". */
  readonly headline: string;
  /** Why, most important first. */
  readonly reasons: readonly string[];
  /** Situational tactics for this exact position. */
  readonly tactics: readonly string[];
  /** One line for every card in the hand. */
  readonly notes: readonly CardNote[];
}

type Play = Extract<GameAction, { type: "play" }>;

const SUITS: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RANKS: Record<string, string> = {
  A: "ace", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
  "8": "eight", "9": "nine", "10": "ten", J: "jack", Q: "queen", K: "king",
};
const VALUE: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const value = (card: CardId) => VALUE[rankOf(card)] ?? Number(rankOf(card));
const name = (card: CardId) => `${rankOf(card) === "A" || rankOf(card) === "8" ? "an" : "a"} ${RANKS[rankOf(card)]} of ${SUITS[suitOf(card)]}`;
const the = (card: CardId) => `the ${rankOf(card)} of ${SUITS[suitOf(card)]}`;
const isBlackKing = (card: CardId) => card === "KS" || card === "KC";
const isAttack = (card: CardId) => rankOf(card) === "2" || rankOf(card) === "8" || isBlackKing(card);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function effectHint(card: CardId): string {
  switch (rankOf(card)) {
    case "2": return "A two: the computer must pick up 2, unless it stacks another two.";
    case "8": return "An eight: the computer misses a turn, unless it has an eight too.";
    case "7": return "A seven: you play again straight away.";
    case "J": return "A jack: play reverses, so with two players you go again.";
    case "K": return isBlackKing(card)
      ? "A black king: the computer must pick up 5."
      : "A red king: only useful against a black king, where it cancels the 5.";
    case "A": return "Wild: plays on anything, then you choose the next suit.";
    default: return "An ordinary card with no special effect.";
  }
}

function penaltyCount(state: GameState): number {
  const penalty = state.pendingPenalty;
  return penalty && penalty.kind !== "miss-turn" ? penalty.cards : 0;
}

function scorePlay(state: GameState, action: Play): number {
  const after = applyAction(state, action);
  const remaining = after.playerHand;
  const first = action.cards[0];
  const opponent = state.computerHand.length;
  let score = action.cards.length * 100;

  if (after.status === "won") score += 10_000;
  if (state.pendingPenalty) score += 1_000;
  else {
    if (isAttack(first)) score += opponent <= 2 ? 150 : -30;
    if (rankOf(first) === "A") score -= remaining.length <= 1 ? 0 : 35;
    if (rankOf(first) === "K" && !isBlackKing(first)) score -= 20;
  }
  if (rankOf(first) === "7" || rankOf(first) === "J") {
    const again = after.turn === "player" && legalMoves(after).some((move) => move.type === "play");
    score += again ? 40 : -40;
  }
  score += remaining.filter((card) => suitOf(card) === after.currentSuit).length * 12;
  if (remaining.length === 1 && (rankOf(remaining[0]) === "7" || rankOf(remaining[0]) === "J")) score -= 80;
  if (!isAttack(first) && rankOf(first) !== "A") score += action.cards.reduce((sum, card) => sum + (value(card) >= 10 ? value(card) : 0), 0) * 1.5;
  return score;
}

function reasonsFor(state: GameState, action: Play): string[] {
  const after = applyAction(state, action);
  const remaining = after.playerHand;
  const first = action.cards[0];
  const opponent = state.computerHand.length;
  const reasons: string[] = [];

  if (after.status === "won") return ["It is your last card, so it wins the game."];
  if (action.cards.length === state.playerHand.length) {
    return ["This is your last card, but a seven or a jack cannot win the game. You pick up one card, say \"Last Card\" again, and play passes to the computer."];
  }
  if (state.pendingPenalty) {
    const label = state.pendingPenalty.kind === "miss-turn" ? "the missed turn" : `the ${state.pendingPenalty.cards} cards`;
    reasons.push(`It answers the penalty, so you avoid ${state.pendingPenalty.kind === "miss-turn" ? "missing a turn" : "picking them up"} and pass ${label} back.`);
  }
  if (!state.pendingPenalty && isAttack(first) && opponent <= 2) {
    reasons.push(`The computer is down to ${plural(opponent, "card")}. ${effectHint(first)} That slows it down while you catch up.`);
  }
  if (action.cards.length > 1) reasons.push(`It gets rid of ${action.cards.length} cards in one turn, so your hand shrinks faster than the computer's.`);
  if ((rankOf(first) === "7" || rankOf(first) === "J") && after.turn === "player") reasons.push("It lets you play again straight away, so you shed two cards this turn.");
  if (rankOf(first) === "A" && action.chosenSuit) reasons.push(`You choose ${SUITS[action.chosenSuit]} because you hold ${plural(remaining.filter((card) => suitOf(card) === action.chosenSuit).length, "card")} of that suit.`);
  else {
    const same = remaining.filter((card) => suitOf(card) === after.currentSuit).length;
    if (same >= 2) reasons.push(`It leaves the pile on ${SUITS[after.currentSuit]}, and you still hold ${plural(same, "card")} of that suit, so your next turn is easy.`);
  }
  const savedPower = state.playerHand.filter((card) => !action.cards.includes(card) && (rankOf(card) === "A" || isAttack(card)));
  if (!state.pendingPenalty && !isAttack(first) && rankOf(first) !== "A" && savedPower.length) {
    reasons.push(`It saves ${name(savedPower[0])} for when you really need it.`);
  }
  if (!isAttack(first) && rankOf(first) !== "A" && value(first) >= 10) reasons.push("It gets a high card out of your hand early. In a scored game, cards left in your hand count against you.");
  if (!reasons.length) reasons.push("It is a safe, ordinary play that keeps your good cards back.");
  return reasons.slice(0, 3);
}

/** Tactics for the hand left after `playing`, so a tip never contradicts the move the coach picked. */
function situationalTactics(state: GameState, playing: readonly CardId[] = []): string[] {
  const hand = state.playerHand.filter((card) => !playing.includes(card));
  const opponent = state.computerHand.length;
  const tactics: string[] = [];
  const counts = (Object.keys(SUITS) as Suit[]).map((suit) => ({ suit, n: hand.filter((card) => suitOf(card) === suit).length })).sort((a, b) => b.n - a.n);

  if (counts[0].n >= 3) tactics.push(`Your longest suit is ${SUITS[counts[0].suit]} (${counts[0].n} cards). Steer the game onto it and you will rarely get stuck.`);
  const aces = hand.filter((card) => rankOf(card) === "A");
  if (aces.length) tactics.push(`Keep ${aces.length > 1 ? "your aces" : "your ace"} as a rescue. It is the only card that plays on anything, and it lets you choose the suit.`);
  const twos = hand.filter((card) => rankOf(card) === "2");
  if (twos.length) tactics.push(`Your ${twos.length > 1 ? "twos are" : "two is"} also a shield: while you hold one, a computer two cannot hurt you, because you can stack it back.`);
  if (hand.some((card) => rankOf(card) === "K" && !isBlackKing(card))) tactics.push("Red kings are your answer to black kings. Keep one in hand if you can.");
  if (opponent <= 2) tactics.push(`The computer is nearly out (${plural(opponent, "card")}). Hit it with a two, a black king or an eight, or race to finish first.`);
  else if (opponent >= 7) tactics.push("The computer has plenty of cards, so there is no rush. Play sensibly and keep your power cards back.");
  if (hand.length <= 3) tactics.push("Do not let a seven or a jack be your last card. In a two-player game neither can win the game: you would have to pick up a card and say Last Card again, so get rid of them early.");
  tactics.push("Matching cards of one number can be played together. Look for pairs: the last one you pick sets the suit.");
  return tactics.slice(0, 3);
}

function cardNotes(state: GameState, legalCards: ReadonlySet<CardId>): CardNote[] {
  const penalty = state.pendingPenalty;
  const top = state.discardPile[state.discardPile.length - 1];
  return state.playerHand.map((card) => {
    if (legalCards.has(card)) {
      if (state.playerHand.length === 1 && (rankOf(card) === "7" || rankOf(card) === "J")) return { card, legal: true, text: "Legal, but it cannot win the game. You would pick up one card, say Last Card again, and your turn would end." };
      if (penalty) return { card, legal: true, text: `Legal. It answers the penalty. ${effectHint(card)}` };
      const bySuit = rankOf(card) !== "A" && suitOf(card) === state.currentSuit;
      const lead = rankOf(card) === "A" ? "Legal, and wild." : bySuit ? `Legal: it matches the suit (${SUITS[state.currentSuit]}).` : `Legal: it matches the ${RANKS[rankOf(top)]}, and switches the suit to ${SUITS[suitOf(card)]}.`;
      return { card, legal: true, text: `${lead} ${effectHint(card)}` };
    }
    if (penalty?.kind === "draw-two") return { card, legal: false, text: "Not legal. Only a two can answer a two." };
    if (penalty?.kind === "black-king") return { card, legal: false, text: "Not legal. Only a king can answer a black king." };
    if (penalty?.kind === "miss-turn") return { card, legal: false, text: "Not legal. Only an eight can answer an eight." };
    return { card, legal: false, text: `Not legal. The pile needs ${SUITS[state.currentSuit]} or a ${RANKS[rankOf(top)]}.` };
  });
}

/** Recommends one move for the player, with reasons, tactics and a note for each card in their hand. */
export function adviseMove(input: GameState): Advice {
  const state: GameState = { ...input, turn: "player" };
  const moves = legalMoves(state);
  const plays = moves.filter((move): move is Play => move.type === "play");
  const legalCards = new Set<CardId>(plays.flatMap((move) => move.cards));
  const notes = cardNotes(state, legalCards);
  const tactics = situationalTactics(state);
  const penalty = state.pendingPenalty;

  if (!plays.length) {
    if (penalty?.kind === "miss-turn") {
      return { kind: "accept", cards: [], headline: "Accept the missed turn", reasons: ["You have no eight to pass it on, so you cannot do anything else. The computer plays next."], tactics, notes };
    }
    const count = penaltyCount(state) || 1;
    const why = penalty ? `You have no ${penalty.kind === "draw-two" ? "two" : "king"} to answer with, so you must take the cards.` : "Nothing in your hand matches the suit or the number, so picking up is your only move.";
    return { kind: "pickup", cards: [], headline: `Pick up ${plural(count, "card")}`, reasons: [why, "Look at what you pick up: it may give you a card to play next turn."], tactics, notes };
  }

  let best = plays[0];
  let bestScore = -Infinity;
  for (const play of plays) {
    const score = scorePlay(state, play);
    if (score > bestScore) { best = play; bestScore = score; }
  }

  const pickUpScore = penalty ? -100 : plays.every((play) => isAttack(play.cards[0]) || rankOf(play.cards[0]) === "A") && state.computerHand.length > 3 ? 20 : -100;
  if (pickUpScore > bestScore) {
    return { kind: "pickup", cards: [], headline: "Pick up one card instead", reasons: ["Your only plays are power cards. Picking up keeps them for a moment when they hurt the computer or rescue you.", "This is allowed on any normal turn."], tactics, notes };
  }

  const cards = best.cards;
  const pickTactics = situationalTactics(state, cards);
  const headline = cards.length === 1
    ? `Play ${the(cards[0])}${best.chosenSuit ? ` and choose ${SUITS[best.chosenSuit]}` : ""}`
    : `Play ${cards.map((card) => the(card)).join(", then ")}${best.chosenSuit ? ` and choose ${SUITS[best.chosenSuit]}` : ""}`;
  return { kind: "play", cards, chosenSuit: best.chosenSuit, headline, reasons: reasonsFor(state, best), tactics: pickTactics, notes };
}
