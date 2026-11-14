import { isBlackKing, isRedKing, rankOf } from "./cards";
import type { ComputerLevel } from "./ai";
import type { CardId, PendingPenalty, RandomSource, Suit } from "./types";

/**
 * Tactics for the computer players (owner decisions, 14 Nov 2026).
 *
 * A tactic is a way of choosing between moves that are all legal. Nothing here changes a rule: it only helps the
 * computers choose better among the moves the rules already allow, the way a good card player does.
 *
 *  - Easy (relaxed) uses none.
 *  - Medium (standard) uses three: tempo, shield and aces.
 *  - Hard (sharp) uses all seven.
 *
 * Every computer has a personality: how strongly it leans on each tactic. A personality can only colour tactics the
 * level allows, so John on Easy is still a pushover and Ringo on Hard is still a rock, not a mind reader.
 *
 * The module is game-agnostic in shape (a view of the table, an outcome for each candidate move, a weighted score), and
 * it never looks at another player's hand or the order of the draw pile. It counts only what a person at the table can
 * see: its own hand, the played pile, and how many cards everyone holds.
 */
export type TacticId = "tempo" | "shield" | "aces" | "patience" | "hunter" | "counting" | "planner";
export type TacticWeights = Readonly<Record<TacticId, number>>;

export const TACTICS: Readonly<Record<TacticId, { readonly name: string; readonly line: string }>> = Object.freeze({
  tempo: { name: "Tempo", line: "Plays one seven (or, heads up, one eight or jack) at a time. Several together count once, so playing them singly gets every turn." },
  shield: { name: "Shield", line: "Never throws both twos or both black kings in one go. Keeps one back to answer, and to trap the next player who stacks." },
  aces: { name: "Ace in hand", line: "Holds aces back. An ace plays on anything, so it is the easiest card to go out on." },
  patience: { name: "Patience", line: "Picks up a card instead of wasting a power card, when nobody is close to going out." },
  hunter: { name: "Hunter", line: "Saves attacks for the player nearest going out, and tries not to hand them a free turn." },
  counting: { name: "Counting", line: "Remembers which cards have gone and works out the odds that the next player holds a two or a king." },
  planner: { name: "Planner", line: "When a card lets it play again (a seven), it plans the whole run of cards it can play this turn." },
});

const ALL: readonly TacticId[] = Object.freeze(["tempo", "shield", "aces", "patience", "hunter", "counting", "planner"] as const);

const BY_LEVEL: Readonly<Record<ComputerLevel, readonly TacticId[]>> = Object.freeze({
  relaxed: [],
  standard: ["tempo", "shield", "aces"],
  sharp: ALL,
});

export interface Personality {
  readonly id: string;
  /** The computer player this belongs to (John, Paul...). */
  readonly name: string;
  /** Two or three words. */
  readonly title: string;
  /** One friendly sentence for the player. */
  readonly blurb: string;
  /** How strongly it leans on each tactic: 1 is the ordinary strength, 0.5 half, 1.6 its favourite. */
  readonly weights: TacticWeights;
}

const weights = (w: Partial<Record<TacticId, number>>): TacticWeights => Object.freeze({
  tempo: 1, shield: 1, aces: 1, patience: 1, hunter: 1, counting: 1, planner: 1, ...w,
});

/** Used for anyone who is not one of the named computers, and by default. Everything at ordinary strength. */
export const BALANCED: Personality = Object.freeze({
  id: "balanced", name: "Everyone", title: "All-rounder", blurb: "A bit of everything, nothing too much.", weights: weights({}),
});

export const PERSONALITIES: readonly Personality[] = Object.freeze([
  { id: "john", name: "John", title: "The Closer", blurb: "Hits whoever is nearest going out, and keeps his black kings for the moment they hurt most.", weights: weights({ hunter: 1.7, planner: 1.1, counting: 0.8, shield: 0.7, patience: 0.4 }) },
  { id: "paul", name: "Paul", title: "The Playmaker", blurb: "Chains sevens and eights together to play several cards in one turn.", weights: weights({ tempo: 1.7, planner: 1.7, aces: 0.9, shield: 0.7, hunter: 0.8, patience: 0.4, counting: 0.8 }) },
  { id: "george", name: "George", title: "The Counter", blurb: "Counts every card that has gone and plays the odds, quietly.", weights: weights({ counting: 1.7, patience: 1.2, hunter: 0.9, planner: 0.8, aces: 0.8 }) },
  { id: "ringo", name: "Ringo", title: "The Rock", blurb: "Always has a two up his sleeve, and never throws his pairs together.", weights: weights({ shield: 1.7, patience: 1.1, hunter: 0.6, counting: 0.6, planner: 0.6 }) },
  { id: "ziggy", name: "Ziggy", title: "The Ace Collector", blurb: "Hoards aces and finishes with one, as if he planned it all along.", weights: weights({ aces: 1.8, patience: 1.3, hunter: 0.8, shield: 0.8, counting: 0.7 }) },
  { id: "marley", name: "Marley", title: "The Patient One", blurb: "In no hurry. Will happily pick up a card to keep his power cards for later.", weights: weights({ patience: 1.8, shield: 1.2, aces: 1.1, hunter: 0.6, planner: 0.6, tempo: 0.9 }) },
  { id: "bowie", name: "Bowie", title: "The Chameleon", blurb: "Does a bit of everything and changes his game to suit the table.", weights: weights({ tempo: 1.2, shield: 1.2, aces: 1.2, patience: 1.2, hunter: 1.2, counting: 1.3, planner: 1.2 }) },
] satisfies Personality[]);

/** The personality for a computer's name (case does not matter). Anyone else gets the balanced one. */
export function personalityFor(name: string | undefined): Personality {
  const key = (name ?? "").trim().toLowerCase();
  return PERSONALITIES.find((personality) => personality.id === key) ?? BALANCED;
}

export const NO_TACTICS: TacticWeights = Object.freeze(weights({ tempo: 0, shield: 0, aces: 0, patience: 0, hunter: 0, counting: 0, planner: 0 }));

/** The strength of each tactic for a computer of this level and personality. A tactic the level does not include is 0. */
export function tacticWeights(level: ComputerLevel, personality?: string): TacticWeights {
  const mine = personalityFor(personality).weights;
  const allowed = BY_LEVEL[level] ?? [];
  return Object.freeze(Object.fromEntries(ALL.map((tactic) => [tactic, allowed.includes(tactic) ? mine[tactic] : 0])) as Record<TacticId, number>);
}

/** What the computer can see when it chooses: nothing it could not see at a real table. */
export interface TacticView {
  /** Players still in the game, the computer included. */
  readonly seats: number;
  /** One deck, or two at a table of 7 or 8 (ruling 21). */
  readonly decks: 1 | 2;
  readonly hand: readonly CardId[];
  /** How many cards each other player holds, the one who plays next first. */
  readonly others: readonly number[];
  /** The played pile. Everyone watched those cards go down. */
  readonly discard: readonly CardId[];
  readonly drawLeft: number;
  readonly pending: PendingPenalty | null;
  readonly currentSuit: Suit;
}

/** What a candidate play leads to, worked out by the engine. */
export interface PlayOutcome {
  readonly goesOut: boolean;
  /** The computer plays again straight away (a seven, a jack heads up, an eight heads up, two jacks). */
  readonly keepsTurn: boolean;
  readonly remaining: readonly CardId[];
  /** The play leaves a penalty for the next player, and how many cards that player holds. */
  readonly victimCards?: number;
  /** Fewest cards anyone else holds after the play. */
  readonly leaderCards: number;
  /** The player closest to going out plays next with nothing to stop them. */
  readonly leaderPlaysFree: boolean;
  /** The best run of plays this turn, when the play keeps the turn. */
  readonly chain?: { readonly extraCards: number; readonly canGoOut: boolean };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const isTwo = (card: CardId) => rankOf(card) === "2";
const isKing = (card: CardId) => rankOf(card) === "K";
const isAce = (card: CardId) => rankOf(card) === "A";

/** How many cards of a kind are still unseen: not in the computer's hand and not in the played pile. */
export function unseen(view: TacticView, matches: (card: CardId) => boolean, perDeck: number): number {
  const seen = view.hand.filter(matches).length + view.discard.filter(matches).length;
  return Math.max(0, perDeck * view.decks - seen);
}

/** The chance that someone holding `holding` cards, drawn from everything unseen, has at least one of the `wanted` unseen cards. */
export function chanceHolds(view: TacticView, wanted: number, holding: number): number {
  const pool = view.decks * 52 - view.hand.length - view.discard.length;
  if (wanted <= 0 || holding <= 0 || pool <= 0) return 0;
  if (holding > pool - wanted) return 1;
  let miss = 1;
  for (let index = 0; index < holding; index += 1) miss *= (pool - wanted - index) / (pool - index);
  return clamp(1 - miss, 0, 1);
}

/** How much the computer minds spending a play: aces most, ordinary cards not at all. */
function holdValue(cards: readonly CardId[]): number {
  const first = cards[0];
  switch (rankOf(first)) {
    case "A": return 1;
    case "K": return isBlackKing(first) ? 0.9 : 0.4;
    case "2": return 0.8;
    case "8": return 0.6;
    default: return 0;
  }
}

/**
 * Picks up a card instead of playing, when every play on offer would spend a power card, nobody is close to going out,
 * and the hand is small enough that one more card does no harm. A computer that is hit by a penalty never gets here.
 */
export function shouldPickUp(view: TacticView, w: TacticWeights, plays: readonly (readonly CardId[])[], random: RandomSource): boolean {
  if (w.patience <= 0 || view.pending || plays.length === 0) return false;
  if (view.hand.length > (w.patience >= 1.3 ? 7 : 6) || view.drawLeft < 8) return false;
  if (Math.min(...view.others) <= 3) return false;
  if (plays.some((cards) => cards.length >= view.hand.length)) return false;
  const cheapest = Math.min(...plays.map(holdValue));
  // Measured in self-play (scripts/ai-selfplay.mjs): holding back a lone 2 or 8 by picking up loses more than it gains,
  // so patience is kept for the cards that are worth the extra pick-up: aces and black kings.
  if (cheapest < 0.9) return false;
  return random() < Math.min(0.8, w.patience * cheapest * 0.45);
}

/** Added to a play's score. Positive makes the computer like the play more. Zero when no tactic has anything to say. */
export function tacticScore(view: TacticView, w: TacticWeights, cards: readonly CardId[], out: PlayOutcome): number {
  if (out.goesOut) return 0;
  const rank = rankOf(cards[0]);
  const count = cards.length;
  const headsUp = view.seats === 2;
  const nextCards = view.others[0] ?? 99;
  const answering = view.pending !== null;
  let score = 0;

  // Tempo: several sevens count as one extra turn, and heads up so do several eights and jacks. One at a time is free.
  if (w.tempo > 0 && count >= 2 && (rank === "7" || (headsUp && (rank === "8" || rank === "J")))) {
    score -= w.tempo * ((count - 1) * 100 + 40);
  }

  // Shield: keep one two (or one black king) back instead of throwing the pair.
  if (w.shield > 0) {
    const blackKings = cards.filter(isBlackKing).length;
    const pairOfAttacks = (rank === "2" && count >= 2) || (rank === "K" && blackKings >= 2 && blackKings === count);
    if (pairOfAttacks && nextCards > 2) {
      let factor = headsUp ? 1 : 0.6;
      if (w.counting > 0) {
        const wanted = rank === "2" ? unseen(view, isTwo, 4) : unseen(view, isKing, 4);
        const chance = chanceHolds(view, wanted, nextCards);
        // Nobody can answer: throw them both. A likely answer: hold one back harder.
        factor = chance < 0.1 ? 0 : factor * (0.5 + chance);
      }
      score -= w.shield * factor * ((count - 1) * 100 + 30);
    }
    if (!answering && count === 1) {
      if (isRedKing(cards[0]) && unseen(view, isBlackKing, 2) > 0 && view.hand.filter(isRedKing).length === 1) score -= 30 * w.shield;
      if (rank === "2" && view.hand.filter(isTwo).length === 1) score -= 25 * w.shield;
      if (rank === "8" && view.hand.filter((card) => rankOf(card) === "8").length === 1) score -= 15 * w.shield;
    }
  }

  // Aces: an ace is the easiest card to finish on, so spend one only to finish or when the hand is nearly empty.
  if (w.aces > 0) {
    if (cards.some(isAce)) score += out.remaining.length >= 3 ? -170 * w.aces : 40 * w.aces;
    else if (out.remaining.length === 1 && isAce(out.remaining[0])) score += 90 * w.aces;
  }

  // Hunter: attack the player nearest going out. Hold the attack back from a player with a full hand.
  if (w.hunter > 0) {
    if (out.victimCards !== undefined) {
      if (out.victimCards <= 2) score += 80 * w.hunter;
      else if (out.victimCards >= 6 && !answering) score -= 45 * w.hunter;
      if (out.victimCards === out.leaderCards && out.leaderCards <= 3) score += 60 * w.hunter;
    } else if (out.leaderPlaysFree && out.leaderCards <= 2) {
      score -= 50 * w.hunter;
    }
  }

  // Planner: a play that lets me play again is worth the cards of the run it opens up.
  if (w.planner > 0 && out.keepsTurn && out.chain) {
    score += w.planner * (out.chain.extraCards * 70 + (out.chain.canGoOut ? 500 : 0));
  }
  return score;
}

/** The best run of plays the computer can make while it keeps the turn. Works for any engine through `adapter`. */
export interface ChainAdapter<S, A extends { readonly cards: readonly CardId[] }> {
  plays(state: S): readonly A[];
  apply(state: S, action: A): S;
  wentOut(state: S): boolean;
  /** It is still the computer's turn and the game is still on. */
  mine(state: S): boolean;
}

export function bestChain<S, A extends { readonly cards: readonly CardId[] }>(state: S, adapter: ChainAdapter<S, A>, depth = 2): { extraCards: number; canGoOut: boolean } {
  if (depth <= 0 || !adapter.mine(state)) return { extraCards: 0, canGoOut: false };
  let best = { extraCards: 0, canGoOut: false };
  const options = [...adapter.plays(state)].sort((a, b) => b.cards.length - a.cards.length).slice(0, 10);
  for (const action of options) {
    const next = adapter.apply(state, action);
    if (adapter.wentOut(next)) return { extraCards: action.cards.length, canGoOut: true };
    const rest = adapter.mine(next) ? bestChain(next, adapter, depth - 1) : { extraCards: 0, canGoOut: false };
    const total = { extraCards: action.cards.length + rest.extraCards, canGoOut: rest.canGoOut };
    if ((total.canGoOut && !best.canGoOut) || (total.canGoOut === best.canGoOut && total.extraCards > best.extraCards)) best = total;
  }
  return best;
}
