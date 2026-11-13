import { rankOf, suitOf } from "./cards";
import type { TableState } from "./table";
import type { CardId, GameAction, Suit } from "./types";

/**
 * How a turn at the table is *shown*, worked out from the engine's result.
 *
 * The engine (`table.ts`) decides a move once and returns the new state straight away. This file never calls the
 * engine: it reads the state before and after, plus the action, and lists what the player should see, in order:
 * the computer pausing, each card travelling to the pile one after another, then what the power card did.
 * The screen walks through these steps on a timer and only then shows the authoritative state, so the pile can
 * never show the final card early and cards never reorder after they land.
 */
export type Step =
  | { readonly kind: "think"; readonly seat: number }
  | { readonly kind: "card"; readonly seat: number; readonly card: CardId; readonly index: number; readonly count: number }
  | { readonly kind: "draw"; readonly seat: number; readonly count: number }
  | { readonly kind: "announce"; readonly seat: number; readonly text: string; readonly tone: "power" | "last" | "info" };

export type Speed = "quick" | "natural" | "relaxed";

export interface Timings {
  /** The highlight moving to the next seat. */
  readonly highlight: number;
  /** The pause before a computer player's move is shown. Purely a pause, not real thinking time. */
  readonly think: number;
  /** One card travelling from a seat to the pile. */
  readonly flight: number;
  /** The rest after a card lands, before the next card of a set leaves the hand. */
  readonly gap: number;
  /** A power card's effect, written on the table. */
  readonly announce: number;
  /** Picking up. */
  readonly draw: number;
}

export const SPEEDS: Readonly<Record<Speed, Timings>> = {
  quick: { highlight: 150, think: 350, flight: 230, gap: 140, announce: 550, draw: 450 },
  natural: { highlight: 200, think: 800, flight: 350, gap: 250, announce: 800, draw: 650 },
  relaxed: { highlight: 250, think: 1300, flight: 500, gap: 400, announce: 1200, draw: 900 },
};

/** Reduced motion: nothing travels, but the cards still land one at a time so the order stays readable. */
export const REDUCED: Timings = { highlight: 0, think: 400, flight: 0, gap: 320, announce: 800, draw: 450 };

export const SPEED_NAMES: Readonly<Record<Speed, string>> = { quick: "Quick", natural: "Natural", relaxed: "Relaxed" };

export function stepDuration(step: Step, timings: Timings): number {
  switch (step.kind) {
    case "think": return timings.think;
    case "card": return timings.flight + timings.gap;
    case "draw": return timings.draw;
    case "announce": return timings.announce;
  }
}

const SUIT_NAMES: Readonly<Record<Suit, string>> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** What a power card did, in a few words, read from the engine's result rather than assumed. */
export function effectText(before: TableState, after: TableState, cards: readonly CardId[], names: readonly string[], chosenSuit?: Suit): string | null {
  const rank = rankOf(cards[cards.length - 1]);
  const actor = before.turn;
  if (after.status === "won") return null;
  const pending = after.pendingPenalty;
  if (rank === "2" && pending?.kind === "draw-two") return `Twos: ${names[after.turn]} faces ${plural(pending.cards, "card")}`;
  if (rank === "K") {
    if (pending?.kind === "black-king") return `Black king: ${names[after.turn]} faces ${plural(pending.cards, "card")}`;
    if (before.pendingPenalty?.kind === "black-king") return "Red king cancels the penalty";
    return null;
  }
  if (rank === "8" && pending?.kind === "miss-turn") return `Eight: ${names[after.turn]} misses a turn unless they hold an eight`;
  if (rank === "7") return `Seven: ${names[actor]} play${actor === 0 ? "" : "s"} again`;
  // Ruling 18: two or four jacks never reverse; the same player plays again.
  if (rank === "J" && cards.length % 2 === 0) return `${cards.length === 4 ? "Four" : "Two"} jacks: ${names[actor]} play${actor === 0 ? "" : "s"} again`;
  if (rank === "J") {
    if (before.hands.length === 2) return `Jack: back to ${names[actor]}`;
    return `Jack: play reverses, now ${after.direction === 1 ? "clockwise" : "anticlockwise"}`;
  }
  if (rank === "A") return `Ace: the suit is now ${SUIT_NAMES[chosenSuit ?? after.currentSuit ?? suitOf(cards[cards.length - 1])]}`;
  return null;
}

/**
 * Lists the steps for one turn. `before` is the state the move was chosen in, `after` the engine's result.
 * The seat that moved is always `before.turn`, so a card can never fly from the wrong seat.
 */
export function planTurn(before: TableState, action: GameAction, after: TableState, names: readonly string[], options: { think: boolean }): Step[] {
  const seat = before.turn;
  const steps: Step[] = [];
  if (options.think) steps.push({ kind: "think", seat });
  if (action.type === "accept-missed-turn") {
    steps.push({ kind: "announce", seat, text: `${names[seat]} miss${seat === 0 ? "" : "es"} a turn`, tone: "info" });
    return steps;
  }
  if (action.type === "draw") {
    const count = after.hands[seat].length - before.hands[seat].length;
    steps.push({ kind: "draw", seat, count });
    // The deck ran out mid-pickup: the played pile was turned over to make a new one.
    if (after.discardPile.length < before.discardPile.length) {
      steps.push({ kind: "announce", seat, text: "Deck empty: the played pile is turned over to make a new deck", tone: "info" });
    }
    return steps;
  }
  action.cards.forEach((card, index) => steps.push({ kind: "card", seat, card, index, count: action.cards.length }));
  const effect = effectText(before, after, action.cards, names, action.chosenSuit);
  if (effect) steps.push({ kind: "announce", seat, text: effect, tone: "power" });
  if (after.status === "playing" && seat !== 0 && after.hands[seat].length === 1) {
    steps.push({ kind: "announce", seat, text: `${names[seat]}: "Last Card!"`, tone: "last" });
  }
  return steps;
}

/** What the table looks like part-way through the steps: cards that have landed so far, and nothing more. */
export interface Visible {
  readonly discardPile: readonly CardId[];
  readonly handCounts: readonly number[];
  /** The seat highlighted as playing now. */
  readonly active: number;
  /** A card in the air, if any. */
  readonly flying: Extract<Step, { kind: "card" }> | null;
  readonly thinking: boolean;
  readonly announce: Extract<Step, { kind: "announce" }> | null;
  readonly drawing: Extract<Step, { kind: "draw" }> | null;
  readonly currentSuit: Suit;
  readonly direction: 1 | -1;
}

/** `at` is the index of the step now playing. At `steps.length` the turn is over and the engine's state shows. */
export function visibleAt(before: TableState, after: TableState, steps: readonly Step[], at: number): Visible {
  if (at >= steps.length) {
    return {
      discardPile: after.discardPile, handCounts: after.hands.map((hand) => hand.length), active: after.status === "playing" ? after.turn : (after.winner ?? after.turn),
      flying: null, thinking: false, announce: null, drawing: null, currentSuit: after.currentSuit, direction: after.direction,
    };
  }
  const seat = before.turn;
  const landed = steps.slice(0, at).filter((step): step is Extract<Step, { kind: "card" }> => step.kind === "card").map((step) => step.card);
  const current = steps[at];
  const allLanded = !steps.slice(at).some((step) => step.kind === "card");
  const drawsDone = steps.slice(0, at).some((step) => step.kind === "draw");
  const handCounts = (drawsDone ? after : before).hands.map((hand, index) => {
    if (index !== seat) return hand.length;
    // Cards leave the hand as they are thrown, the one in the air included.
    return before.hands[seat].length - landed.length - (current.kind === "card" ? 1 : 0) + (drawsDone ? after.hands[seat].length - before.hands[seat].length : 0);
  });
  return {
    discardPile: drawsDone ? after.discardPile : [...before.discardPile, ...landed],
    handCounts,
    active: seat,
    flying: current.kind === "card" ? current : null,
    thinking: current.kind === "think",
    announce: current.kind === "announce" ? current : null,
    drawing: current.kind === "draw" ? current : null,
    // The suit and direction change once the last card is down, never before.
    currentSuit: allLanded && landed.length ? after.currentSuit : before.currentSuit,
    direction: allLanded ? after.direction : before.direction,
  };
}

/** The computer players, in seat order. */
export const COMPUTER_NAMES: readonly string[] = ["John", "Paul", "George", "Ringo"];
