import { createDeck, rankOf, suitOf } from "./cards";
import { isLegalPlayFor, legalActionsFor, type TableOptions } from "./rules";
import type { CardId, GameAction, PendingPenalty, RandomSource, Suit } from "./types";

/**
 * Switch for two to six people sharing one pack. Seats are numbered from 0 and
 * play moves clockwise (+1) until an odd number of jacks reverses it.
 * Two-player games keep the original rule: a jack means play again.
 */
export const MIN_SEATS = 2;
export const MAX_SEATS = 6;
const HAND_SIZE = 7;
const POWER_RANKS = new Set(["A", "2", "7", "8", "J", "K"]);

export interface TableState {
  readonly hands: readonly (readonly CardId[])[];
  readonly drawPile: readonly CardId[];
  readonly discardPile: readonly CardId[];
  readonly currentSuit: Suit;
  readonly turn: number;
  readonly direction: 1 | -1;
  readonly pendingPenalty: PendingPenalty | null;
  readonly status: "playing" | "won";
  readonly winner: number | null;
  readonly move: number;
}

function optionsFor(seats: number): TableOptions {
  return { jackMayFinish: seats > 2 };
}

export function seatAfter(state: Pick<TableState, "hands" | "direction">, seat: number, steps = 1): number {
  const seats = state.hands.length;
  return (((seat + state.direction * steps) % seats) + seats) % seats;
}

export function createTable(seats: number, random: RandomSource, firstSeat = 0): TableState {
  if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`Switch is played by ${MIN_SEATS} to ${MAX_SEATS} people.`);
  }

  const deck = createDeck().map((card) => card.id);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }

  const hands: CardId[][] = Array.from({ length: seats }, () => []);
  for (let round = 0; round < HAND_SIZE; round += 1) {
    for (const hand of hands) hand.push(deck.pop() as CardId);
  }

  let starterIndex = deck.length - 1;
  for (let index = deck.length - 1; index >= 0; index -= 1) {
    if (!POWER_RANKS.has(rankOf(deck[index]))) {
      starterIndex = index;
      break;
    }
  }
  [deck[starterIndex], deck[deck.length - 1]] = [deck[deck.length - 1], deck[starterIndex]];
  const starter = deck.pop() as CardId;

  return {
    hands,
    drawPile: deck,
    discardPile: [starter],
    currentSuit: suitOf(starter),
    turn: ((firstSeat % seats) + seats) % seats,
    direction: 1,
    pendingPenalty: null,
    status: "playing",
    winner: null,
    move: 0,
  };
}

export function tableLegalMoves(state: TableState): GameAction[] {
  if (state.status !== "playing") return [];
  return legalActionsFor(state.hands[state.turn], state, optionsFor(state.hands.length));
}

export function drawForSeat(state: TableState, seat: number, count: number): TableState {
  const drawPile = [...state.drawPile];
  const discardPile = [...state.discardPile];
  const drawn: CardId[] = [];

  while (drawn.length < count) {
    if (drawPile.length === 0) {
      if (discardPile.length <= 1) break;
      const top = discardPile.at(-1) as CardId;
      drawPile.push(...discardPile.slice(0, -1));
      discardPile.splice(0, discardPile.length, top);
    }
    const card = drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }

  return {
    ...state,
    hands: state.hands.map((hand, index) => (index === seat ? [...hand, ...drawn] : [...hand])),
    drawPile,
    discardPile,
  };
}

export function applyTableAction(state: TableState, action: GameAction): TableState {
  const seats = state.hands.length;
  const options = optionsFor(seats);
  const hand = state.hands[state.turn];
  const legal = state.status === "playing" && (action.type === "play"
    ? isLegalPlayFor(hand, state, action, options)
    : tableLegalMoves(state).some((candidate) => candidate.type === action.type));
  if (!legal) throw new Error("That action is not legal in the current Switch state.");

  const actor = state.turn;
  const next = seatAfter(state, actor);

  if (action.type === "accept-missed-turn") {
    return { ...state, turn: next, pendingPenalty: null, move: state.move + 1 };
  }

  if (action.type === "draw") {
    const count = state.pendingPenalty && state.pendingPenalty.kind !== "miss-turn" ? state.pendingPenalty.cards : 1;
    const drawn = drawForSeat(state, actor, count);
    return { ...drawn, turn: next, pendingPenalty: null, move: state.move + 1 };
  }

  const played = [...action.cards];
  const playedSet = new Set(played);
  const remaining = hand.filter((card) => !playedSet.has(card));
  const lastCard = played.at(-1) as CardId;
  const playedRank = rankOf(lastCard);
  let pendingPenalty: PendingPenalty | null = null;

  if (playedRank === "2") {
    const previous = state.pendingPenalty?.kind === "draw-two" ? state.pendingPenalty.cards : 0;
    pendingPenalty = { kind: "draw-two", cards: (previous + played.length * 2) as 2 | 4 | 6 | 8 };
  } else if (playedRank === "8") {
    pendingPenalty = { kind: "miss-turn" };
  } else if (playedRank === "K") {
    const previousUnits = state.pendingPenalty?.kind === "black-king" ? state.pendingPenalty.units : 0;
    const black = played.filter((card) => card === "KS" || card === "KC").length;
    const red = played.filter((card) => card === "KH" || card === "KD").length;
    const units = Math.max(0, Math.min(2, previousUnits + black - red));
    if (units > 0) pendingPenalty = { kind: "black-king", units: units as 1 | 2, cards: (units * 5) as 5 | 10 };
  }

  const jackCount = playedRank === "J" ? played.length : 0;
  const reverses = seats > 2 && jackCount % 2 === 1;
  const direction = reverses ? (state.direction === 1 ? -1 : 1) : state.direction;
  const keepsTurn = playedRank === "7" || (seats === 2 && jackCount % 2 === 1);
  const winner = remaining.length === 0 ? actor : null;
  const afterPlay = { hands: state.hands, direction } as const;

  return {
    ...state,
    hands: state.hands.map((current, index) => (index === actor ? remaining : [...current])),
    discardPile: [...state.discardPile, ...played],
    currentSuit: playedRank === "A" ? (action.chosenSuit as Suit) : suitOf(lastCard),
    turn: keepsTurn ? actor : seatAfter(afterPlay, actor),
    direction,
    pendingPenalty,
    status: winner === null ? "playing" : "won",
    winner,
    move: state.move + 1,
  };
}
