import { rankOf, suitOf } from "./cards";
import { legalMoves } from "./rules";
import type { GameAction, GameState, RandomSource } from "./types";

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

export function chooseComputerAction(state: GameState, random: RandomSource): GameAction {
  if (state.turn !== "computer") {
    throw new Error("The computer can choose only during its own turn.");
  }

  const actions = legalMoves(state);
  if (actions.length === 0) {
    throw new Error("The computer has no legal Switch action.");
  }

  const scored = actions.map((action) => ({ action, score: scoreAction(state, action) }));
  const bestScore = Math.max(...scored.map((candidate) => candidate.score));
  const best = scored.filter((candidate) => candidate.score === bestScore);
  const index = Math.min(best.length - 1, Math.floor(Math.max(0, random()) * best.length));
  return best[index].action;
}
