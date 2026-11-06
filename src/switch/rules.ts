import { createDeck, rankOf, suitOf, SUITS } from "./cards";
import type { CardId, GameAction, GameState, RandomSource, Suit, Turn } from "./types";

function otherTurn(turn: Turn): Turn {
  return turn === "player" ? "computer" : "player";
}

function handFor(state: GameState, turn: Turn): readonly CardId[] {
  return turn === "player" ? state.playerHand : state.computerHand;
}

function isNormallyPlayable(card: CardId, state: GameState): boolean {
  const top = state.discardPile.at(-1);
  if (!top) return true;
  return rankOf(card) === "A" || suitOf(card) === state.currentSuit || rankOf(card) === rankOf(top);
}

function isPlayableDuringPenalty(card: CardId, state: GameState): boolean {
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

function cannotBeFinalPlay(cards: readonly CardId[], hand: readonly CardId[]): boolean {
  if (cards.length !== hand.length) return false;
  const playedRank = rankOf(cards[0]);
  return playedRank === "7" || playedRank === "J";
}

function matchingSubsets(cards: readonly CardId[]): CardId[][] {
  const subsets: CardId[][] = [];
  for (let mask = 1; mask < 2 ** cards.length; mask += 1) {
    const subset = cards.filter((_, index) => (mask & (1 << index)) !== 0);
    if (subset.length >= 2) subsets.push(subset);
  }
  return subsets;
}

export function legalMoves(state: GameState): GameAction[] {
  if (state.status !== "playing") return [];

  const hand = handFor(state, state.turn);
  const playable = hand.filter((card) => isPlayableDuringPenalty(card, state));
  const actions = playable
    .filter((card) => !cannotBeFinalPlay([card], hand))
    .flatMap(playActionsFor);

  for (const rank of new Set(hand.map(rankOf))) {
    const matchingCards = hand.filter((card) => rankOf(card) === rank);
    if (matchingCards.length < 2) continue;

    for (const subset of matchingSubsets(matchingCards)) {
      const firstLegal = subset.find((card) => playable.includes(card));
      if (!firstLegal) continue;

      const cards = [firstLegal, ...subset.filter((card) => card !== firstLegal)];
      if (cannotBeFinalPlay(cards, hand)) continue;
      if (rank === "A") {
        for (const chosenSuit of SUITS) actions.push({ type: "play", cards, chosenSuit });
      } else {
        actions.push({ type: "play", cards });
      }
    }
  }

  if (state.pendingPenalty?.kind === "miss-turn") {
    actions.push({ type: "accept-missed-turn" });
  } else {
    actions.push({ type: "draw" });
  }

  return actions;
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
      drawPile.push(...discardPile.slice(0, -1));
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

export function applyAction(state: GameState, action: GameAction): GameState {
  if (!legalMoves(state).some((legal) => sameAction(legal, action))) {
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
    const previousUnits = state.pendingPenalty?.kind === "black-king" ? state.pendingPenalty.units : 0;
    const blackKings = played.filter((card) => card === "KS" || card === "KC").length;
    const redKings = played.filter((card) => card === "KH" || card === "KD").length;
    const units = Math.max(0, Math.min(2, previousUnits + blackKings - redKings));
    if (units > 0) {
      pendingPenalty = {
        kind: "black-king",
        units: units as 1 | 2,
        cards: (units * 5) as 5 | 10,
      };
    }
  }

  const keepsTurn = playedRank === "7" || (playedRank === "J" && played.length % 2 === 1);

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

export function createInitialGame(random: RandomSource): GameState {
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

  const starter = deck.pop() as CardId;
  return {
    playerHand,
    computerHand,
    drawPile: deck,
    discardPile: [starter],
    currentSuit: suitOf(starter),
    turn: "player",
    pendingPenalty: null,
    status: "playing",
    winner: null,
    move: 0,
  };
}
