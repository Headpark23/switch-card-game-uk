import { isBlackKing, isRedKing, rankOf, suitOf } from "../engine/cards";
import { isPlayableDuringPenalty } from "../engine/rules";
import type { ComputerLevel } from "./ai";
import { bestChain, COHESION_VALUE, handCohesion, NO_TACTICS, shouldPickUp, tacticScore, tacticWeights, type PlayOutcome, type TacticView, type TacticWeights } from "./computerTactics";
import { applyTableAction, decksFor, liveSeats, nextSeat, tableLegalMoves, wentOut, type TableState } from "../engine/table";
import type { CardId, GameAction, RandomSource } from "../engine/types";

/**
 * The computer players at a bigger table. Same three temperaments as the two-player opponent:
 * relaxed makes friendly mistakes, standard sheds cards, sharp watches who is about to go out.
 * On top of that each level uses tactics (`computerTactics.ts`): none on relaxed, three on standard, all seven on sharp,
 * coloured by the personality of the computer in the seat.
 */

export interface ChooseOptions {
  /** The computer's name (John, Paul...). Its personality says how strongly it leans on each tactic. */
  readonly personality?: string;
  /** False plays without any tactics, for measuring what they are worth. */
  readonly tactics?: boolean;
  /** Exact tactic strengths, for experiments (scripts/ai-selfplay.mjs). Overrides the level and the personality. */
  readonly weights?: TacticWeights;
}

interface Context {
  readonly weights: TacticWeights;
  readonly view: TacticView;
}

function viewFor(state: TableState, seat: number): TacticView {
  const others: number[] = [];
  let at = seat;
  for (let step = 1; step < liveSeats(state); step += 1) {
    at = nextSeat(state, at);
    others.push(state.hands[at].length);
  }
  return {
    seats: liveSeats(state),
    decks: decksFor(state.hands.length),
    hand: state.hands[seat],
    others,
    discard: state.discardPile,
    drawLeft: state.drawPile.length,
    pending: state.pendingPenalty,
    currentSuit: state.currentSuit,
  };
}

function outcomeOf(next: TableState, seat: number, weights: TacticWeights): PlayOutcome {
  const rivals = next.hands.map((hand, index) => ({ index, cards: hand.length })).filter((entry) => entry.index !== seat && !next.out?.includes(entry.index));
  const leaderCards = rivals.length ? Math.min(...rivals.map((entry) => entry.cards)) : 99;
  const keepsTurn = next.turn === seat && next.status === "playing";
  const penaltyOnNext = next.pendingPenalty !== null && next.turn !== seat;
  const chain = weights.planner > 0 && keepsTurn
    ? bestChain<TableState, Extract<GameAction, { type: "play" }>>(next, {
      plays: (s: TableState) => tableLegalMoves(s).filter((a): a is Extract<GameAction, { type: "play" }> => a.type === "play"),
      apply: applyTableAction,
      wentOut: (s: TableState) => wentOut(s, seat),
      mine: (s: TableState) => s.turn === seat && s.status === "playing",
    })
    : undefined;
  return {
    goesOut: wentOut(next, seat),
    keepsTurn,
    remaining: next.hands[seat],
    victimCards: penaltyOnNext ? next.hands[next.turn].length : undefined,
    leaderCards,
    leaderPlaysFree: next.turn !== seat && next.pendingPenalty === null && next.hands[next.turn].length === leaderCards,
    chain,
  };
}

function score(state: TableState, action: GameAction, level: ComputerLevel, context: Context): number {
  const seat = state.turn;
  const { weights, view } = context;
  if (action.type === "accept-missed-turn") return -50;
  // Medium and Easy never pick up by choice (that is the Patience tactic, Hard only), so any play beats a pick-up.
  if (action.type === "draw") return state.pendingPenalty ? -400 : level === "sharp" ? -60 : -5_000;

  const next = applyTableAction(state, action);
  // Going out is the best move there is, in a play-on game too (where the game carries on without you).
  if (wentOut(next, seat)) return 100_000;
  const rank = rankOf(action.cards[0]);
  const remaining = next.hands[seat];
  let total = action.cards.length * 100;
  if (state.pendingPenalty) total += 1_000;
  const tactical = tacticScore(view, weights, action.cards, outcomeOf(next, seat, weights));

  if (level !== "sharp") {
    total += ({ "2": 60, K: 50, "8": 45, "7": 30, J: 30, A: 20 } as Record<string, number>)[rank] ?? 0;
    if (rank === "A" && action.chosenSuit) total += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 10;
    return total + tactical;
  }

  // Sharp: hit the player who is next, hardest when they are nearly out.
  const victim = next.hands[next.turn === seat ? nextSeat(next, seat) : next.turn].length;
  const urgency = victim <= 2 ? 2.5 : 1;
  const penalty = next.pendingPenalty;
  if (penalty?.kind === "draw-two" || penalty?.kind === "black-king") total += penalty.cards * 9 * urgency;
  if (penalty?.kind === "miss-turn") total += 45 * urgency;
  // Anyone at the table close to going out makes holding cards back dangerous.
  const danger = Math.min(...next.hands.filter((_, index) => index !== seat && !next.out?.includes(index)).map((hand) => hand.length));
  if (danger <= 2) total += action.cards.length * 40;

  if (next.turn === seat) {
    const followUps = tableLegalMoves(next).filter((candidate) => candidate.type === "play");
    total += followUps.length > 0 ? 130 : -50;
  }
  // With the "aces" tactic the tactic itself decides when an ace is spent; without it, sharp keeps its own rule of thumb.
  if (rank === "A") {
    if (weights.aces <= 0) total += remaining.length <= 2 ? 80 : -170;
    if (action.chosenSuit) total += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 25;
  } else {
    total += remaining.filter((card) => suitOf(card) === next.currentSuit).length * 12;
  }
  // Hard keeps its hand connected: cards that share a suit or a number can answer each other.
  if (liveSeats(next) === 2) total += handCohesion(remaining) * COHESION_VALUE;
  if (remaining.length === 1 && rankOf(remaining[0]) === "7") total -= 150;
  if (remaining.length === 1 && rankOf(remaining[0]) === "A" && weights.aces <= 0) total += 60;
  return total + tactical;
}

/** Among equal orderings of a set, finish on the suit the rest of the hand holds most. */
function bestOrdering(state: TableState, action: GameAction): GameAction {
  if (action.type !== "play" || action.cards.length < 2) return action;
  const rank = rankOf(action.cards[0]);
  if (rank === "A" || rank === "K") return action;
  const hand = state.hands[state.turn];
  const remaining = hand.filter((card) => !action.cards.includes(card));
  const value = (card: CardId) => remaining.filter((other) => suitOf(other) === suitOf(card)).length;
  let best = action.cards;
  let bestValue = value(best[best.length - 1]);
  for (const last of action.cards) {
    const others = action.cards.filter((card) => card !== last);
    const lead = others.find((card) => isPlayableDuringPenalty(card, state));
    if (!lead) continue;
    if (value(last) > bestValue) {
      best = [lead, ...others.filter((card) => card !== lead), last];
      bestValue = value(last);
    }
  }
  return best === action.cards ? action : { ...action, cards: best };
}

export function chooseTableAction(state: TableState, random: RandomSource, level: ComputerLevel = "standard", options: ChooseOptions = {}): GameAction {
  const all = tableLegalMoves(state);
  if (all.length === 0) throw new Error("There is no legal Switch action.");
  // A black king followed by a red king in one set cancels itself: legal, but a waste.
  const selfCancelling = (action: GameAction) => action.type === "play"
    && action.cards.some((card, index) => isRedKing(card) && action.cards.slice(0, index).some(isBlackKing));
  const sensible = all.filter((action) => !selfCancelling(action));
  const actions = sensible.length > 0 ? sensible : all;

  if (level === "relaxed" && random() < 0.5) {
    return actions[Math.min(actions.length - 1, Math.floor(Math.max(0, random()) * actions.length))];
  }
  const weights = options.weights ?? (options.tactics === false ? NO_TACTICS : tacticWeights(level, options.personality));
  const context: Context = { weights, view: viewFor(state, state.turn) };

  // Patience: sometimes the best move is to pick up a card and keep the power cards for later.
  if (weights.patience > 0 && !state.pendingPenalty) {
    const plays = actions.filter((action): action is Extract<GameAction, { type: "play" }> => action.type === "play");
    const draw = actions.find((action) => action.type === "draw");
    if (draw && shouldPickUp(context.view, weights, plays.map((play) => play.cards), random)) return draw;
  }

  const scored = actions.map((action) => ({ action, score: score(state, action, level, context) }));
  const top = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === top);
  return bestOrdering(state, best[Math.min(best.length - 1, Math.floor(Math.max(0, random()) * best.length))].action);
}
