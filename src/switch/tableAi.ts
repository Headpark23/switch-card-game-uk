import { rankOf, suitOf } from "./cards";
import { isPlayableDuringPenalty } from "./rules";
import type { ComputerLevel } from "./ai";
import { applyTableAction, nextSeat, tableLegalMoves, type TableState } from "./table";
import type { CardId, GameAction, RandomSource } from "./types";

/**
 * The computer players at a bigger table. Same three temperaments as the two-player opponent:
 * relaxed makes friendly mistakes, standard sheds cards, sharp watches who is about to go out.
 */
function isBlackKing(card: CardId): boolean {
  return card === "KS" || card === "KC";
}

function score(state: TableState, action: GameAction, level: ComputerLevel): number {
  const seat = state.turn;
  if (action.type === "accept-missed-turn") return -50;
  if (action.type === "draw") return state.pendingPenalty ? -400 : level === "sharp" ? -60 : 0;

  const next = applyTableAction(state, action);
  if (next.status === "won") return 100_000;
  const rank = rankOf(action.cards[0]);
  const remaining = next.hands[seat];
  let total = action.cards.length * 100;
  if (state.pendingPenalty) total += 1_000;

  if (level !== "sharp") {
    total += ({ "2": 60, K: 50, "8": 45, "7": 30, J: 30, A: 20 } as Record<string, number>)[rank] ?? 0;
    if (rank === "A" && action.chosenSuit) total += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 10;
    return total;
  }

  // Sharp: hit the player who is next, hardest when they are nearly out.
  const victim = next.hands[next.turn === seat ? nextSeat(next, seat) : next.turn].length;
  const urgency = victim <= 2 ? 2.5 : 1;
  const penalty = next.pendingPenalty;
  if (penalty?.kind === "draw-two" || penalty?.kind === "black-king") total += penalty.cards * 9 * urgency;
  if (penalty?.kind === "miss-turn") total += 45 * urgency;
  // Anyone at the table close to going out makes holding cards back dangerous.
  const danger = Math.min(...next.hands.filter((_, index) => index !== seat).map((hand) => hand.length));
  if (danger <= 2) total += action.cards.length * 40;

  if (next.turn === seat) {
    const followUps = tableLegalMoves(next).filter((candidate) => candidate.type === "play");
    total += followUps.length > 0 ? 130 : -50;
  }
  if (rank === "A") {
    total += remaining.length <= 2 ? 80 : -170;
    if (action.chosenSuit) total += remaining.filter((card) => suitOf(card) === action.chosenSuit).length * 25;
  } else {
    total += remaining.filter((card) => suitOf(card) === next.currentSuit).length * 12;
  }
  if (remaining.length === 1 && rankOf(remaining[0]) === "7") total -= 150;
  if (remaining.length === 1 && rankOf(remaining[0]) === "A") total += 60;
  return total;
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

export function chooseTableAction(state: TableState, random: RandomSource, level: ComputerLevel = "standard"): GameAction {
  const all = tableLegalMoves(state);
  if (all.length === 0) throw new Error("There is no legal Switch action.");
  // A black king followed by a red king in one set cancels itself: legal, but a waste.
  const selfCancelling = (action: GameAction) => action.type === "play"
    && action.cards.some((card, index) => (card === "KH" || card === "KD") && action.cards.slice(0, index).some(isBlackKing));
  const sensible = all.filter((action) => !selfCancelling(action));
  const actions = sensible.length > 0 ? sensible : all;

  if (level === "relaxed" && random() < 0.5) {
    return actions[Math.min(actions.length - 1, Math.floor(Math.max(0, random()) * actions.length))];
  }
  const scored = actions.map((action) => ({ action, score: score(state, action, level) }));
  const top = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === top);
  return bestOrdering(state, best[Math.min(best.length - 1, Math.floor(Math.max(0, random()) * best.length))].action);
}
