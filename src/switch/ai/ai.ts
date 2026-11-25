import { rankOf, suitOf } from "../engine/cards";
import { applyAction, forcesPickup, isPlayableDuringPenalty, legalMoves } from "../engine/rules";
import { bestChain, COHESION_VALUE, handCohesion, NO_TACTICS, shouldPickUp, tacticScore, tacticWeights, type PlayOutcome, type TacticView, type TacticWeights } from "./computerTactics";
import type { CardId, GameAction, GameState, RandomSource } from "../engine/types";

/**
 * relaxed  – makes friendly mistakes.
 * standard – the original greedy opponent: empties its hand as fast as it can.
 * sharp    – saves wild aces, attacks when you are close to winning and
 *            avoids leaving itself stuck on a seven or jack.
 * On top of that each level uses tactics (`computerTactics.ts`): none on relaxed, three on standard, all seven on sharp.
 */
export type ComputerLevel = "relaxed" | "standard" | "sharp";

/** What the app calls the levels (owner decision, 14 Nov 2026). The stored ids stay relaxed, standard and sharp. */
export const LEVEL_NAMES: Readonly<Record<ComputerLevel, string>> = Object.freeze({ relaxed: "Easy", standard: "Medium", sharp: "Hard" });
export const LEVEL_NOTES: Readonly<Record<ComputerLevel, string>> = Object.freeze({
  relaxed: "Friendly mistakes, no tactics",
  standard: "Plays sensibly, with a few tactics",
  sharp: "Plays to beat you, with every tactic",
});

const POWER_CARD_SCORE: Readonly<Record<string, number>> = Object.freeze({
  "2": 60,
  K: 50,
  "8": 45,
  "7": 30,
  J: 30,
  A: 20,
});

export interface ComputerOptions {
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

function viewFor(state: GameState): TacticView {
  return {
    seats: 2,
    decks: 1,
    hand: state.computerHand,
    others: [state.playerHand.length],
    discard: state.discardPile,
    drawLeft: state.drawPile.length,
    pending: state.pendingPenalty,
    currentSuit: state.currentSuit,
  };
}

function tacticalScore(action: Extract<GameAction, { type: "play" }>, next: GameState, context: Context): number {
  const { weights, view } = context;
  if (weights.tempo + weights.shield + weights.aces + weights.hunter + weights.planner <= 0) return 0;
  const keepsTurn = next.turn === "computer" && next.status === "playing";
  const penaltyOnPlayer = next.pendingPenalty !== null && next.turn === "player";
  const chain = weights.planner > 0 && keepsTurn
    ? bestChain<GameState, Extract<GameAction, { type: "play" }>>(next, {
      plays: (s: GameState) => legalMoves(s).filter((a): a is Extract<GameAction, { type: "play" }> => a.type === "play"),
      apply: applyAction,
      wentOut: (s: GameState) => s.status === "won" && s.winner === "computer",
      mine: (s: GameState) => s.turn === "computer" && s.status === "playing",
    })
    : undefined;
  const outcome: PlayOutcome = {
    goesOut: next.status === "won" && next.winner === "computer",
    keepsTurn,
    remaining: next.computerHand,
    victimCards: penaltyOnPlayer ? next.playerHand.length : undefined,
    leaderCards: next.playerHand.length,
    leaderPlaysFree: next.turn === "player" && next.pendingPenalty === null,
    chain,
  };
  return tacticScore(view, weights, action.cards, outcome);
}

function scoreAction(state: GameState, action: GameAction, context: Context): number {
  // Medium never picks up by choice (that is the Patience tactic, Hard only), so any play beats a pick-up.
  if (action.type === "draw") return state.pendingPenalty ? -100 : -5_000;
  if (action.type === "accept-missed-turn") return -50;

  const rank = rankOf(action.cards[0]);
  const remaining = state.computerHand.filter((card) => !action.cards.includes(card));
  let score = action.cards.length * 100;

  if (remaining.length === 0 && !forcesPickup(action.cards, state.computerHand)) score += 10_000;
  if (state.pendingPenalty) score += 1_000;
  score += POWER_CARD_SCORE[rank] ?? 0;

  if (rank === "A" && action.chosenSuit) {
    score += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 10;
  }

  return score + tacticalScore(action, applyAction(state, action), context);
}

/** Among equal orderings of a set, finish on the suit the rest of the hand holds most. */
function bestOrdering(state: GameState, action: GameAction): GameAction {
  if (action.type !== "play" || action.cards.length < 2 || action.cards.some((card) => rankOf(card) === "A")) return action;

  const remaining = state.computerHand.filter((card) => !action.cards.includes(card));
  const suitValue = (card: CardId) => remaining.filter((other) => suitOf(other) === suitOf(card)).length;
  let best = action.cards;
  let bestValue = suitValue(best[best.length - 1]);

  for (const last of action.cards) {
    const others = action.cards.filter((card) => card !== last);
    const lead = others.find((card) => isPlayableDuringPenalty(card, state));
    if (!lead) continue;
    const ordered = [lead, ...others.filter((card) => card !== lead), last];
    if (suitValue(last) > bestValue) {
      best = ordered;
      bestValue = suitValue(last);
    }
  }

  return best === action.cards ? action : { ...action, cards: best };
}

function pickBest(scored: readonly { action: GameAction; score: number }[], random: RandomSource): GameAction {
  const bestScore = Math.max(...scored.map((candidate) => candidate.score));
  const best = scored.filter((candidate) => candidate.score === bestScore);
  const index = Math.min(best.length - 1, Math.floor(Math.max(0, random()) * best.length));
  return best[index].action;
}

function scoreSharp(state: GameState, action: GameAction, context: Context): number {
  if (action.type === "accept-missed-turn") return -50;
  if (action.type === "draw") {
    // Picking up is a real option when the only plays would waste an ace.
    return state.pendingPenalty ? -400 : -60;
  }

  const rank = rankOf(action.cards[0]);
  const next = applyAction(state, action);
  const remaining = next.computerHand;
  const opponentCards = next.playerHand.length;
  let score = action.cards.length * 100;

  if (next.status === "won") return 100_000;
  if (state.pendingPenalty) score += 1_000;

  const penalty = next.pendingPenalty;
  const urgency = opponentCards <= 2 ? 2 : 1;
  if (penalty?.kind === "draw-two" || penalty?.kind === "black-king") score += penalty.cards * 9 * urgency;
  if (penalty?.kind === "miss-turn") score += 45 * urgency;

  if (next.turn === "computer") {
    // Seven or jack: only worth it when there is a good follow-up.
    const followUps = legalMoves(next).filter((candidate) => candidate.type === "play");
    score += followUps.length > 0 ? 130 : -50;
  }

  if (rank === "A") {
    // A wild ace is the best card to hold. Spend it to finish, or when nothing else works.
    // (With the "aces" tactic, the tactic decides when.)
    if (context.weights.aces <= 0) score += remaining.length <= 2 ? 80 : -170;
    if (action.type === "play" && action.chosenSuit) {
      score += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 25;
    }
  } else {
    score += remaining.filter((card) => suitOf(card) === next.currentSuit).length * 12;
  }

  // Hard keeps its hand connected: cards that share a suit or a number can answer each other.
  score += handCohesion(remaining) * COHESION_VALUE;
  if (remaining.length === 1 && (rankOf(remaining[0]) === "7" || rankOf(remaining[0]) === "J")) score -= 150;
  if (remaining.length === 1 && rankOf(remaining[0]) === "A" && context.weights.aces <= 0) score += 60;

  return score + tacticalScore(action, next, context);
}

export function chooseComputerAction(
  state: GameState,
  random: RandomSource,
  level: ComputerLevel = "standard",
  options: ComputerOptions = {},
): GameAction {
  if (state.turn !== "computer") {
    throw new Error("The computer can choose only during its own turn.");
  }

  const allActions = legalMoves(state);
  if (allActions.length === 0) {
    throw new Error("The computer has no legal Switch action.");
  }
  // A black king played with a red king in one set cancels itself. That is legal, but it wastes the penalty,
  // so the computer only does it when it has nothing else to play.
  const selfCancelling = (action: GameAction) => action.type === "play"
    && action.cards.some((card, index) => (card === "KH" || card === "KD") && action.cards.slice(0, index).some((earlier) => earlier === "KS" || earlier === "KC"));
  const sensible = allActions.filter((action) => !selfCancelling(action));
  const actions = sensible.length > 0 ? sensible : allActions;

  if (level === "relaxed" && random() < 0.5) {
    const index = Math.min(actions.length - 1, Math.floor(Math.max(0, random()) * actions.length));
    return actions[index];
  }

  const weights = options.weights ?? (options.tactics === false ? NO_TACTICS : tacticWeights(level, options.personality));
  const context: Context = { weights, view: viewFor(state) };

  // Patience: sometimes the best move is to pick up a card and keep the power cards for later.
  if (weights.patience > 0 && !state.pendingPenalty) {
    const plays = actions.filter((action): action is Extract<GameAction, { type: "play" }> => action.type === "play");
    const draw = actions.find((action) => action.type === "draw");
    if (draw && shouldPickUp(context.view, weights, plays.map((play) => play.cards), random)) return draw;
  }

  const scorer = level === "sharp" ? scoreSharp : scoreAction;
  const scored = actions.map((action) => ({ action, score: scorer(state, action, context) }));
  return bestOrdering(state, pickBest(scored, random));
}
