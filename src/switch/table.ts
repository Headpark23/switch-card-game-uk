import { createShoe, isBlackKing, rankOf, suitOf } from "./cards";
import { forcesPickup, isLegalPlayFor, legalActionsFor, type TableOptions } from "./rules";
import type { CardId, GameAction, PendingPenalty, RandomSource, Suit } from "./types";

/**
 * Switch for a whole table: two to six seats, played in turn.
 *
 * This is the same game as `rules.ts`, which stays the engine for the two-player guided game. Which cards may be
 * played is decided by the very same functions (`legalActionsFor`, `isLegalPlayFor`); this file only adds what a
 * bigger table needs: seats, the direction of play, and jacks that reverse it. Nothing here changes a rule.
 * `tests/switch-table.spec.ts` plays it move for move against the written-rules simulator.
 */
export interface TableState {
  /** One hand per seat. Seat 0 is the person holding the phone. */
  readonly hands: readonly (readonly CardId[])[];
  readonly drawPile: readonly CardId[];
  readonly discardPile: readonly CardId[];
  readonly currentSuit: Suit;
  /** The seat whose turn it is. */
  readonly turn: number;
  /** 1 is clockwise (seat 0, 1, 2...), -1 is anticlockwise. */
  readonly direction: 1 | -1;
  /** The seat that dealt. The seat after the dealer played first. */
  readonly dealer: number;
  readonly pendingPenalty: PendingPenalty | null;
  readonly status: "playing" | "won";
  readonly winner: number | null;
  readonly move: number;
}

/** You plus seven computers. */
export const MAX_SEATS = 8;

/** Ruling 21: one deck deals seven each to six players; seven or eight players play with two decks. */
export function decksFor(seats: number): 1 | 2 {
  return seats > 6 ? 2 : 1;
}

const POWER_RANKS = new Set(["A", "2", "7", "8", "J", "K"]);

export function tableOptions(seats: number): TableOptions {
  return { jackMayFinish: seats > 2 };
}

function wrap(seat: number, seats: number): number {
  return ((seat % seats) + seats) % seats;
}

/** The seat that plays after `seat`, the way play is going now. */
export function nextSeat(state: Pick<TableState, "hands" | "direction">, seat: number): number {
  return wrap(seat + state.direction, state.hands.length);
}

/** Shuffles, deals seven each one card at a time, and turns an ordinary starter. The seat after the dealer plays first. */
export function createTable(seats: number, random: RandomSource, dealer = 0): TableState {
  if (!Number.isInteger(seats) || seats < 2 || seats > MAX_SEATS) throw new Error(`Switch is for 2 to ${MAX_SEATS} players.`);
  const deck = createShoe(decksFor(seats));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  const hands: CardId[][] = Array.from({ length: seats }, () => []);
  for (let round = 0; round < 7; round += 1) {
    for (let seat = 0; seat < seats; seat += 1) hands[seat].push(deck.pop() as CardId);
  }
  // A power card turned up at the start is tucked back and the next ordinary card is turned instead.
  let starterIndex = deck.length - 1;
  while (starterIndex > 0 && POWER_RANKS.has(rankOf(deck[starterIndex]))) starterIndex -= 1;
  const starter = deck.splice(starterIndex, 1)[0];
  const dealerSeat = wrap(dealer, seats);
  return {
    hands,
    drawPile: deck,
    discardPile: [starter],
    currentSuit: suitOf(starter),
    turn: wrap(dealerSeat + 1, seats),
    direction: 1,
    dealer: dealerSeat,
    pendingPenalty: null,
    status: "playing",
    winner: null,
    move: 0,
  };
}

export function tableLegalMoves(state: TableState, seat = state.turn): GameAction[] {
  if (state.status !== "playing") return [];
  return legalActionsFor(state.hands[seat], state, tableOptions(state.hands.length));
}

export function isLegalTablePlay(state: TableState, action: Extract<GameAction, { type: "play" }>): boolean {
  return state.status === "playing" && isLegalPlayFor(state.hands[state.turn], state, action, tableOptions(state.hands.length));
}

/** Gives `count` cards to a seat. When the deck runs out the played pile is turned over, oldest card first, unshuffled. */
export function dealTo(state: TableState, seat: number, count: number): TableState {
  const drawPile = [...state.drawPile];
  const discardPile = [...state.discardPile];
  const drawn: CardId[] = [];
  while (drawn.length < count) {
    if (drawPile.length === 0) {
      if (discardPile.length <= 1) break;
      const top = discardPile.at(-1) as CardId;
      drawPile.push(...discardPile.slice(0, -1).reverse());
      discardPile.splice(0, discardPile.length, top);
    }
    const card = drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }
  return {
    ...state,
    hands: state.hands.map((hand, index) => (index === seat ? [...hand, ...drawn] : hand)),
    drawPile,
    discardPile,
  };
}

export function applyTableAction(state: TableState, action: GameAction): TableState {
  if (state.status !== "playing") throw new Error("This game of Switch is over.");
  const seats = state.hands.length;
  const actor = state.turn;

  if (action.type === "accept-missed-turn") {
    if (state.pendingPenalty?.kind !== "miss-turn") throw new Error("There is no missed turn to accept.");
    return { ...state, turn: nextSeat(state, actor), pendingPenalty: null, move: state.move + 1 };
  }

  if (action.type === "draw") {
    if (state.pendingPenalty?.kind === "miss-turn") throw new Error("An eight is in play: counter it or miss the turn.");
    const count = state.pendingPenalty ? state.pendingPenalty.cards : 1;
    const drawn = dealTo(state, actor, count);
    return { ...drawn, turn: nextSeat(state, actor), pendingPenalty: null, move: state.move + 1 };
  }

  if (!isLegalTablePlay(state, action)) throw new Error("That action is not legal in the current Switch state.");

  const played = [...action.cards];
  const playedSet = new Set(played);
  const remaining = state.hands[actor].filter((card) => !playedSet.has(card));
  const lastCard = played.at(-1) as CardId;
  const playedRank = rankOf(lastCard);
  let pendingPenalty: PendingPenalty | null = null;

  if (playedRank === "2") {
    const previous = state.pendingPenalty?.kind === "draw-two" ? state.pendingPenalty.cards : 0;
    pendingPenalty = { kind: "draw-two", cards: (previous + played.length * 2)  };
  } else if (playedRank === "8") {
    pendingPenalty = { kind: "miss-turn" };
  } else if (playedRank === "K") {
    // Ruling 14: kings count card by card, in the order laid down.
    let units = state.pendingPenalty?.kind === "black-king" ? state.pendingPenalty.units : 0;
    for (const card of played) {
      if (isBlackKing(card)) units = Math.min(2, units + 1);
      else units = Math.max(0, units - 1);
    }
    if (units > 0) pendingPenalty = { kind: "black-king", units: units as 1 | 2, cards: (units * 5) as 5 | 10 };
  }

  let direction = state.direction;
  let turn: number;
  if (playedRank === "7") {
    turn = actor;
  } else if (playedRank === "J" && played.length % 2 === 0) {
    // Ruling 18: two or four jacks never reverse. The same player plays again.
    turn = actor;
  } else if (playedRank === "J") {
    // One or three jacks reverse. With two players that brings play straight back.
    if (seats === 2) turn = actor;
    else {
      direction = (direction * -1) as 1 | -1;
      turn = wrap(actor + direction, seats);
    }
  } else {
    turn = wrap(actor + direction, seats);
  }

  // Ruling 19: a seven, or jacks that cannot win, may be played as the last cards. They do not win: the player picks
  // up one card from the deck, says "Last Card" again, and the turn passes on. The direction is left as it was.
  const pickupInstead = remaining.length === 0 && forcesPickup(played, state.hands[actor], tableOptions(seats));
  const won = remaining.length === 0 && !pickupInstead;
  const afterPlay: TableState = {
    ...state,
    hands: state.hands.map((hand, index) => (index === actor ? remaining : hand)),
    discardPile: [...state.discardPile, ...played],
    currentSuit: playedRank === "A" ? (action.chosenSuit as Suit) : suitOf(lastCard),
    turn: pickupInstead ? wrap(actor + state.direction, seats) : turn,
    direction: pickupInstead ? state.direction : direction,
    pendingPenalty,
    status: won ? "won" : "playing",
    winner: won ? actor : null,
    move: state.move + 1,
  };
  return pickupInstead ? dealTo(afterPlay, actor, 1) : afterPlay;
}

/**
 * A player who put down their last cards (a set such as two tens, or a seven or jacks that cannot win) without having
 * said "Last Card" does not win on it. The play stands, but they pick up two cards and the game goes on.
 */
export function penaliseMissedLastCard(after: TableState, seat: number): TableState {
  const reopened: TableState = after.status === "won" ? { ...after, status: "playing", winner: null } : after;
  return dealTo(reopened, seat, 2);
}

/** Finishing places once someone is out: the winner, then fewest cards left in hand. Ties share the better place. */
export function tablePlaces(state: TableState): number[] {
  const counts = state.hands.map((hand) => hand.length);
  return counts.map((count) => 1 + counts.filter((other) => other < count).length);
}
