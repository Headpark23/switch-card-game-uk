import { createShoe, isBlackKing, isRedKing, rankOf, suitOf } from "./cards";
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
  /**
   * Play-on games (league rounds, ruling 24): players who have gone out, first out first. Everyone else carries on,
   * skipped players keep no cards, and the game is over when one player is left holding cards. Absent in an ordinary
   * game, which ends the moment the first player is out.
   */
  readonly out?: readonly number[];
  readonly playOn?: boolean;
}

/** Ruling 33: about one deal in five turns the starter honestly, so a power card sometimes opens the game. */
export const POWER_START_CHANCE = 0.2;

export interface TableSetup {
  /** Turn the starter honestly, whatever it is (ruling 33). Used by tests. */
  readonly powerStart?: boolean;
  /** Chance (0 to 1) that this deal turns the starter honestly. The games pass `POWER_START_CHANCE`. */
  readonly powerStartChance?: number;
  /** Keep playing after the first player is out until every place is decided. */
  readonly playOn?: boolean;
}

/** One deck only (ruling 38): six players take 42 cards and leave a pile of nine to pick up from. You plus five computers. */
export const MAX_SEATS = 6;

/** Always one deck for a new table (ruling 38). Two decks only for a 7 or 8 seat game saved before that ruling, so it can still be finished and counted. */
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

/** Seats still in the game: everyone, less those who have already gone out in a play-on game. */
export function liveSeats(state: Pick<TableState, "hands" | "out">): number {
  return state.hands.length - (state.out?.length ?? 0);
}

/** The next seat from `seat` in `direction` that has not gone out. */
function stepFrom(hands: number, out: readonly number[] | undefined, seat: number, direction: 1 | -1): number {
  let next = wrap(seat + direction, hands);
  for (let guard = 0; guard < hands && out?.includes(next); guard += 1) next = wrap(next + direction, hands);
  return next;
}

/** The seat that plays after `seat`, the way play is going now. Seats that are out are skipped. */
export function nextSeat(state: Pick<TableState, "hands" | "direction" | "out">, seat: number): number {
  return stepFrom(state.hands.length, state.out, seat, state.direction);
}

/** True when `seat` emptied its hand with the move that took `before` to `after` (and so is out, or has won). */
export function wentOut(after: TableState, seat: number): boolean {
  return (after.out?.includes(seat) ?? false) || (after.status === "won" && after.winner === seat);
}

/**
 * Ruling 33: the card the dealer turns up counts as the dealer's own play, so every power card does what it always does.
 * Seven: the dealer plays again. Jack: play reverses (with two players the dealer plays again). Two, black king, eight:
 * the next player faces the penalty. Red king and ordinary cards do nothing. An ace is not played by anyone, so play starts in the ace's own suit.
 */
export function openingEffect(starter: CardId, dealerSeat: number, _dealerHand: readonly CardId[], seats: number):
  { suit: Suit; turn: number; direction: 1 | -1; pendingPenalty: PendingPenalty | null } {
  const rank = rankOf(starter);
  const suit = suitOf(starter);
  let turn = wrap(dealerSeat + 1, seats);
  let direction: 1 | -1 = 1;
  let pendingPenalty: PendingPenalty | null = null;
  if (rank === "2") pendingPenalty = { kind: "draw-two", cards: 2 };
  else if (rank === "8") pendingPenalty = { kind: "miss-turn" };
  else if (rank === "K" && isBlackKing(starter)) pendingPenalty = { kind: "black-king", units: 1, cards: 5 };
  else if (rank === "7") turn = dealerSeat;
  else if (rank === "J") {
    if (seats === 2) turn = dealerSeat;
    else { direction = -1; turn = wrap(dealerSeat - 1, seats); }
  }
  return { suit, turn, direction, pendingPenalty };
}

/** What the dealer's turned-up card did before anyone played, said out loud. Null for an ordinary starter. */
export function openingNote(state: Pick<TableState, "move" | "discardPile" | "dealer" | "currentSuit" | "turn">, names: readonly string[]): string | null {
  if (state.move !== 0 || state.discardPile.length !== 1) return null;
  const starter = state.discardPile[0];
  const dealer = names[state.dealer] ?? "The dealer";
  const first = names[state.turn] ?? "The next player";
  const you = first === "You";
  const SUIT_NAMES: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
  switch (rankOf(starter)) {
    case "2": return `${dealer} turned up a 2: ${first} ${you ? "pick up 2 unless you play" : "picks up 2 unless they play"} a 2.`;
    case "8": return `${dealer} turned up an 8: ${first} ${you ? "miss a turn unless you play" : "misses a turn unless they play"} an 8.`;
    case "K": return isBlackKing(starter)
      ? `${dealer} turned up a black king: ${first} ${you ? "pick up 5 unless you play" : "picks up 5 unless they play"} a king.` : null;
    case "7": return `${dealer} turned up a 7, so ${dealer} plays again.`;
    case "J": return state.turn === state.dealer
      ? `${dealer} turned up a jack, so play comes straight back to ${dealer}.`
      : `${dealer} turned up a jack: play reverses and ${first} goes first.`;
    case "A": return `${dealer} turned up an ace, so play starts in ${SUIT_NAMES[state.currentSuit]}.`;
    default: return null;
  }
}

/** Shuffles, deals seven each one card at a time, and turns a starter (an ordinary card, or now and then a power card). */
export function createTable(seats: number, random: RandomSource, dealer = 0, setup: TableSetup = {}): TableState {
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
  // Usually a power card turned up at the start is tucked back and the next ordinary card is turned instead.
  // Now and then (ruling 33) the starter is turned honestly and counts as the dealer's own play.
  const honest = setup.powerStart === true || (setup.powerStartChance !== undefined && random() < setup.powerStartChance);
  let starterIndex = deck.length - 1;
  if (!honest) while (starterIndex > 0 && POWER_RANKS.has(rankOf(deck[starterIndex]))) starterIndex -= 1;
  const starter = deck.splice(starterIndex, 1)[0];
  const dealerSeat = wrap(dealer, seats);
  const open = openingEffect(starter, dealerSeat, hands[dealerSeat], seats);
  return {
    hands,
    drawPile: deck,
    discardPile: [starter],
    currentSuit: open.suit,
    turn: open.turn,
    direction: open.direction,
    dealer: dealerSeat,
    pendingPenalty: open.pendingPenalty,
    status: "playing",
    winner: null,
    move: 0,
    ...(setup.playOn ? { playOn: true, out: [] } : {}),
  };
}

export function tableLegalMoves(state: TableState, seat = state.turn): GameAction[] {
  if (state.status !== "playing") return [];
  return legalActionsFor(state.hands[seat], state, tableOptions(liveSeats(state)));
}

export function isLegalTablePlay(state: TableState, action: Extract<GameAction, { type: "play" }>): boolean {
  return state.status === "playing" && isLegalPlayFor(state.hands[state.turn], state, action, tableOptions(liveSeats(state)));
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
  // The rules (a jack finishing, a jack bouncing play back) follow the players still in, so three left is a three-player game.
  const seats = liveSeats(state);
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
  let selfPickup = 0;

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
    // Revised 15 Nov 2026: a red king only reduces the pile-up. Whoever lays it picks up what is left themselves.
    if (units > 0 && isRedKing(lastCard)) selfPickup = units * 5;
    else if (units > 0) pendingPenalty = { kind: "black-king", units: units as 1 | 2, cards: (units * 5) as 5 | 10 };
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
      turn = stepFrom(state.hands.length, state.out, actor, direction);
    }
  } else {
    turn = stepFrom(state.hands.length, state.out, actor, direction);
  }

  // Ruling 19: a seven, or jacks that cannot win, may be played as the last cards. They do not win: the player picks
  // up one card from the deck, says "Last Card" again, and the turn passes on. The direction is left as it was.
  const pickupInstead = remaining.length === 0 && forcesPickup(played, state.hands[actor], tableOptions(seats));
  const emptied = remaining.length === 0 && !pickupInstead;
  const hands = state.hands.map((hand, index) => (index === actor ? remaining : hand));
  const base: TableState = {
    ...state,
    hands,
    discardPile: [...state.discardPile, ...played],
    // Ruling 34: an ace played as the last card keeps its own suit.
    currentSuit: playedRank === "A" && remaining.length > 0 ? (action.chosenSuit as Suit) : suitOf(lastCard),
    turn: pickupInstead ? stepFrom(state.hands.length, state.out, actor, state.direction) : turn,
    direction: pickupInstead ? state.direction : direction,
    pendingPenalty,
    move: state.move + 1,
  };
  if (pickupInstead) return dealTo({ ...base, status: "playing", winner: null }, actor, 1);
  if (!emptied) {
    const playing: TableState = { ...base, status: "playing", winner: null };
    return selfPickup > 0 ? dealTo(playing, actor, selfPickup) : playing;
  }
  if (!state.playOn) return { ...base, status: "won", winner: actor };

  // A play-on game: this player is out. If at least two others still hold cards, they carry on without them.
  const out = [...(state.out ?? []), actor];
  const stillIn = hands.length - out.length;
  if (stillIn >= 2) return { ...base, out, status: "playing", winner: null };
  // One player is left holding cards: every place is decided.
  return { ...base, out, status: "won", winner: out[0] };
}

/**
 * A player who put down their last cards (a set such as two tens, or a seven or jacks that cannot win) without having
 * said "Last Card" does not win on it. The play stands, but they pick up two cards and the game goes on.
 * In a play-on game the same applies to going out: they are back in, and no place is given to them.
 */
export function penaliseMissedLastCard(after: TableState, seat: number): TableState {
  let reopened: TableState = after;
  if (after.playOn) {
    if (after.out?.includes(seat)) reopened = { ...after, out: after.out.filter((entry) => entry !== seat), status: "playing", winner: null };
  } else if (after.status === "won") {
    reopened = { ...after, status: "playing", winner: null };
  }
  return dealTo(reopened, seat, 2);
}

/**
 * Everyone from first to last. In a play-on game that is the order they went out, with the one player left holding
 * cards last; in an ordinary game it is the winner, then fewest cards left.
 */
export function finishingOrder(state: TableState): number[] {
  if (state.playOn) {
    const out = state.out ?? [];
    const left = state.hands.map((_, seat) => seat).filter((seat) => !out.includes(seat))
      .sort((a, b) => state.hands[a].length - state.hands[b].length || a - b);
    return [...out, ...left];
  }
  return state.hands.map((_, seat) => seat)
    .sort((a, b) => (a === state.winner ? -1 : b === state.winner ? 1 : 0) || state.hands[a].length - state.hands[b].length || a - b);
}

/** Finishing places once someone is out: the winner, then fewest cards left in hand. Ties share the better place. A play-on game has no ties. */
export function tablePlaces(state: TableState): number[] {
  if (state.playOn) {
    const order = finishingOrder(state);
    return state.hands.map((_, seat) => order.indexOf(seat) + 1);
  }
  const counts = state.hands.map((hand) => hand.length);
  return counts.map((count) => 1 + counts.filter((other) => other < count).length);
}
