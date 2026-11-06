import { rankOf, suitOf } from "./cards";
import { applyAction, isPlayableDuringPenalty, legalMoves } from "./rules";
import type { CardId, GameAction, GameState, RandomSource } from "./types";

/**
 * relaxed  – makes friendly mistakes and may forget to say "Last Card".
 * standard – the original greedy opponent: empties its hand as fast as it can.
 * sharp    – saves wild aces, attacks when you are close to winning and
 *            avoids leaving itself stuck on a seven or jack.
 */
export type ComputerLevel = "relaxed" | "standard" | "sharp";

export const COMPUTER_LEVELS: Readonly<Record<ComputerLevel, { readonly label: string; readonly summary: string; readonly forgetsLastCard: number }>> =
  Object.freeze({
    relaxed: Object.freeze({ label: "Relaxed", summary: "Friendly play. Sometimes forgets “Last Card”.", forgetsLastCard: 0.35 }),
    standard: Object.freeze({ label: "Standard", summary: "Plays quickly and never wastes a turn.", forgetsLastCard: 0.1 }),
    sharp: Object.freeze({ label: "Sharp", summary: "Saves aces, attacks near the finish.", forgetsLastCard: 0 }),
  });

const POWER_CARD_SCORE: Readonly<Record<string, number>> = Object.freeze({
  "2": 60,
  K: 50,
  "8": 45,
  "7": 30,
  J: 30,
  A: 20,
});

function scoreAction(state: GameState, action: GameAction): number {
  if (action.type === "draw") return state.pendingPenalty ? -100 : 0;
  if (action.type === "accept-missed-turn") return -50;

  const rank = rankOf(action.cards[0]);
  const remaining = state.computerHand.filter((card) => !action.cards.includes(card));
  let score = action.cards.length * 100;

  if (remaining.length === 0) score += 10_000;
  if (state.pendingPenalty) score += 1_000;
  score += POWER_CARD_SCORE[rank] ?? 0;

  if (rank === "A" && action.chosenSuit) {
    score += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 10;
  }

  return score;
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

function scoreSharp(state: GameState, action: GameAction): number {
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
    score += remaining.length <= 2 ? 80 : -170;
    if (action.type === "play" && action.chosenSuit) {
      score += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 25;
    }
  } else {
    score += remaining.filter((card) => suitOf(card) === next.currentSuit).length * 12;
  }

  if (remaining.length === 1 && (rankOf(remaining[0]) === "7" || rankOf(remaining[0]) === "J")) score -= 150;
  if (remaining.length === 1 && rankOf(remaining[0]) === "A") score += 60;

  return score;
}

export function chooseComputerAction(
  state: GameState,
  random: RandomSource,
  level: ComputerLevel = "standard",
): GameAction {
  if (state.turn !== "computer") {
    throw new Error("The computer can choose only during its own turn.");
  }

  const actions = legalMoves(state);
  if (actions.length === 0) {
    throw new Error("The computer has no legal Switch action.");
  }

  if (level === "relaxed" && random() < 0.5) {
    const index = Math.min(actions.length - 1, Math.floor(Math.max(0, random()) * actions.length));
    return actions[index];
  }

  const scorer = level === "sharp" ? scoreSharp : scoreAction;
  const scored = actions.map((action) => ({ action, score: scorer(state, action) }));
  return bestOrdering(state, pickBest(scored, random));
}
