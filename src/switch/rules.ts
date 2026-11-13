import { createDeck, rankOf, suitOf, SUITS } from "./cards";
import type { CardId, GameAction, GameState, RandomSource, Suit, Turn } from "./types";

function otherTurn(turn: Turn): Turn {
  return turn === "player" ? "computer" : "player";
}

function handFor(state: GameState, turn: Turn): readonly CardId[] {
  return turn === "player" ? state.playerHand : state.computerHand;
}

/** The parts of a game that decide whether a single card may be played. */
export type PlayContext = Pick<GameState, "discardPile" | "currentSuit" | "pendingPenalty">;

export function isNormallyPlayable(card: CardId, state: PlayContext): boolean {
  const top = state.discardPile.at(-1);
  if (!top) return true;
  return rankOf(card) === "A" || suitOf(card) === state.currentSuit || rankOf(card) === rankOf(top);
}

export function isPlayableDuringPenalty(card: CardId, state: PlayContext): boolean {
  switch (state.pendingPenalty?.kind) {
    case "draw-two":
      return rankOf(card) === "2";
    case "black-king":
      return card === "KS" || card === "KC" || card === "KH" || card === "KD";
    case "miss-turn":
      return rankOf(card) === "8";
    default:
      return isNormallyPlayable(card, state);
  }
}

function playActionsFor(card: CardId): GameAction[] {
  if (rankOf(card) !== "A") return [{ type: "play", cards: [card] }];
  return SUITS.map((chosenSuit) => ({ type: "play", cards: [card], chosenSuit }));
}

/** Table variations that depend on how many people are playing. */
export interface TableOptions {
  /** With three or more players one or three jacks reverse direction, so they may be the winning play. Two or four jacks always mean play again (ruling 18), so they never are. */
  readonly jackMayFinish: boolean;
}

const TWO_PLAYER_OPTIONS: TableOptions = Object.freeze({ jackMayFinish: false });

function cannotBeFinalPlay(cards: readonly CardId[], hand: readonly CardId[], options: TableOptions): boolean {
  if (cards.length !== hand.length) return false;
  const playedRank = rankOf(cards[0]);
  return playedRank === "7" || (playedRank === "J" && (!options.jackMayFinish || cards.length % 2 === 0));
}

function matchingSubsets(cards: readonly CardId[]): CardId[][] {
  const subsets: CardId[][] = [];
  for (let mask = 1; mask < 2 ** cards.length; mask += 1) {
    const subset = cards.filter((_, index) => (mask & (1 << index)) !== 0);
    if (subset.length >= 2) subsets.push(subset);
  }
  return subsets;
}

function orderings(cards: readonly CardId[]): CardId[][] {
  if (cards.length <= 1) return [[...cards]];
  return cards.flatMap((card, index) => orderings([...cards.slice(0, index), ...cards.slice(index + 1)]).map((rest) => [card, ...rest]));
}

/** Every legal action for one hand. A set of matching cards is listed once, in a canonical order. */
export function legalActionsFor(
  hand: readonly CardId[],
  context: PlayContext,
  options: TableOptions = TWO_PLAYER_OPTIONS,
): GameAction[] {
  const playable = hand.filter((card) => isPlayableDuringPenalty(card, context));
  const actions = playable
    .filter((card) => !cannotBeFinalPlay([card], hand, options))
    .flatMap(playActionsFor);

  for (const rank of new Set(hand.map(rankOf))) {
    const matchingCards = hand.filter((card) => rankOf(card) === rank);
    if (matchingCards.length < 2) continue;

    for (const subset of matchingSubsets(matchingCards)) {
      const firstLegal = subset.find((card) => playable.includes(card));
      if (!firstLegal) continue;

      if (rank === "K") {
        for (const cards of orderings(subset)) {
          if (!playable.includes(cards[0])) continue;
          if (cannotBeFinalPlay(cards, hand, options)) continue;
          actions.push({ type: "play", cards });
        }
        continue;
      }
      const cards = [firstLegal, ...subset.filter((card) => card !== firstLegal)];
      if (cannotBeFinalPlay(cards, hand, options)) continue;
      if (rank === "A") {
        for (const chosenSuit of SUITS) actions.push({ type: "play", cards, chosenSuit });
      } else {
        actions.push({ type: "play", cards });
      }
    }
  }

  if (context.pendingPenalty?.kind === "miss-turn") {
    actions.push({ type: "accept-missed-turn" });
  } else {
    actions.push({ type: "draw" });
  }

  return actions;
}

export function legalMoves(state: GameState): GameAction[] {
  if (state.status !== "playing") return [];
  return legalActionsFor(handFor(state, state.turn), state);
}

function sameAction(left: GameAction, right: GameAction): boolean {
  if (left.type !== right.type) return false;
  if (left.type !== "play" || right.type !== "play") return true;
  return left.chosenSuit === right.chosenSuit &&
    left.cards.length === right.cards.length &&
    left.cards.every((card, index) => card === right.cards[index]);
}

export function drawCards(state: GameState, count: number, recipient: Turn): GameState {
  const drawPile = [...state.drawPile];
  const discardPile = [...state.discardPile];
  const drawn: CardId[] = [];

  while (drawn.length < count) {
    if (drawPile.length === 0) {
      if (discardPile.length <= 1) break;
      const topDiscard = discardPile.at(-1) as CardId;
      // Turning the played pile face down flips it, so the oldest card ends up on top. No shuffling.
      drawPile.push(...discardPile.slice(0, -1).reverse());
      discardPile.splice(0, discardPile.length, topDiscard);
    }

    const card = drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }

  return {
    ...state,
    playerHand: recipient === "player" ? [...state.playerHand, ...drawn] : [...state.playerHand],
    computerHand: recipient === "computer" ? [...state.computerHand, ...drawn] : [...state.computerHand],
    drawPile,
    discardPile,
  };
}

/**
 * A play is legal when every card is in the hand, all share one rank, the first
 * card may legally be played, and the play does not finish on a seven or jack.
 * The order matters: the last card played decides the new suit, so any order
 * that starts with a playable card is accepted.
 */
export function isLegalPlayFor(
  hand: readonly CardId[],
  context: PlayContext,
  action: Extract<GameAction, { type: "play" }>,
  options: TableOptions = TWO_PLAYER_OPTIONS,
): boolean {
  const cards = action.cards;
  if (cards.length === 0 || new Set(cards).size !== cards.length) return false;
  if (!cards.every((card) => hand.includes(card))) return false;
  const rank = rankOf(cards[0]);
  if (!cards.every((card) => rankOf(card) === rank)) return false;
  if (!isPlayableDuringPenalty(cards[0], context)) return false;
  if (cannotBeFinalPlay(cards, hand, options)) return false;
  if (rank === "A") return action.chosenSuit !== undefined && SUITS.includes(action.chosenSuit);
  return action.chosenSuit === undefined;
}

export function isLegalPlay(state: GameState, action: Extract<GameAction, { type: "play" }>): boolean {
  return state.status === "playing" && isLegalPlayFor(handFor(state, state.turn), state, action);
}

export function applyAction(state: GameState, action: GameAction): GameState {
  const legal = action.type === "play"
    ? isLegalPlay(state, action)
    : legalMoves(state).some((candidate) => sameAction(candidate, action));
  if (!legal) {
    throw new Error("That action is not legal in the current Switch state.");
  }

  if (action.type === "accept-missed-turn") {
    return {
      ...state,
      turn: otherTurn(state.turn),
      pendingPenalty: null,
      move: state.move + 1,
    };
  }

  if (action.type === "draw") {
    const count = state.pendingPenalty && state.pendingPenalty.kind !== "miss-turn"
      ? state.pendingPenalty.cards
      : 1;
    const drawn = drawCards(state, count, state.turn);
    return {
      ...drawn,
      turn: otherTurn(state.turn),
      pendingPenalty: null,
      move: state.move + 1,
    };
  }

  const actor = state.turn;
  const played = [...action.cards];
  const playedSet = new Set(played);
  const remaining = handFor(state, actor).filter((card) => !playedSet.has(card));
  const lastCard = played.at(-1) as CardId;
  const playedRank = rankOf(lastCard);
  const winner = remaining.length === 0 ? actor : null;
  let pendingPenalty: GameState["pendingPenalty"] = null;

  if (playedRank === "2") {
    const previousCards = state.pendingPenalty?.kind === "draw-two" ? state.pendingPenalty.cards : 0;
    pendingPenalty = {
      kind: "draw-two",
      cards: (previousCards + played.length * 2) as 2 | 4 | 6 | 8,
    };
  } else if (playedRank === "8") {
    pendingPenalty = { kind: "miss-turn" };
  } else if (playedRank === "K") {
    // Ruling 14: kings count card by card, in the order laid down. A black king adds 5, a red king takes 5 off
    // (never below nothing), so the card on top decides: black then red cancels, red then black leaves 5.
    let units = state.pendingPenalty?.kind === "black-king" ? state.pendingPenalty.units : 0;
    for (const card of played) {
      if (card === "KS" || card === "KC") units = Math.min(2, units + 1);
      else units = Math.max(0, units - 1);
    }
    if (units > 0) {
      pendingPenalty = {
        kind: "black-king",
        units: units as 1 | 2,
        cards: (units * 5) as 5 | 10,
      };
    }
  }

  // Ruling 18: two or four jacks mean play again. One or three reverse, which with two players is also play again.
  const keepsTurn = playedRank === "7" || playedRank === "J";

  return {
    ...state,
    playerHand: actor === "player" ? remaining : [...state.playerHand],
    computerHand: actor === "computer" ? remaining : [...state.computerHand],
    discardPile: [...state.discardPile, ...played],
    currentSuit: playedRank === "A" ? (action.chosenSuit as Suit) : suitOf(lastCard),
    turn: keepsTurn ? actor : otherTurn(actor),
    pendingPenalty,
    status: winner ? "won" : "playing",
    winner,
    move: state.move + 1,
  };
}

const POWER_RANKS = new Set(["A", "2", "7", "8", "J", "K"]);

/**
 * The first discard is always an ordinary card, so no game opens with a hidden
 * penalty or a suit change. Power cards turned up at the start are tucked back
 * into the deck instead.
 */
function ordinaryStarterIndex(deck: readonly CardId[]): number {
  for (let index = deck.length - 1; index >= 0; index -= 1) {
    if (!POWER_RANKS.has(rankOf(deck[index]))) return index;
  }
  return deck.length - 1;
}

export function createInitialGame(random: RandomSource, firstTurn: Turn = "player"): GameState {
  const deck = createDeck().map((card) => card.id);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  const playerHand: CardId[] = [];
  const computerHand: CardId[] = [];
  for (let index = 0; index < 7; index += 1) {
    playerHand.push(deck.pop() as CardId);
    computerHand.push(deck.pop() as CardId);
  }

  const starterIndex = ordinaryStarterIndex(deck);
  [deck[starterIndex], deck[deck.length - 1]] = [deck[deck.length - 1], deck[starterIndex]];
  const starter = deck.pop() as CardId;
  return {
    playerHand,
    computerHand,
    drawPile: deck,
    discardPile: [starter],
    currentSuit: suitOf(starter),
    turn: firstTurn,
    pendingPenalty: null,
    status: "playing",
    winner: null,
    move: 0,
  };
}
