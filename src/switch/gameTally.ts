import { rankOf } from "./cards";
import type { TableState } from "./table";
import type { CardId, GameAction } from "./types";

/**
 * What happened at one game against the computer, counted move by move: who dealt out penalty cards and who got them.
 * It only reads the engine's before and after (the same way `presentation.ts` does), so it can never change a rule.
 * Seat 0 is you; every other seat is a computer. The numbers go to the owner's anonymous dashboard (`telemetry.ts`).
 */
export interface GameTally {
  /** Penalty cards (twos and black kings) picked up because a computer played the last card that added to the pile. */
  readonly dealtByCpu: number;
  /** The same, but because you did. */
  readonly dealtByYou: number;
  readonly landedOnYou: number;
  readonly landedOnCpu: number;
  /** Times you forgot "Last Card" and picked up two. */
  readonly lastCardMissed: number;
  /** A penalty landing on someone with one card left ("Ouch!"). */
  readonly ouches: number;
  readonly missedYou: number;
  readonly missedCpu: number;
  /** Ordinary pick-ups: one card taken instead of playing, or after a seven or jacks that could not win. */
  readonly drawsYou: number;
  readonly drawsCpu: number;
  readonly cardsYou: number;
  readonly cardsCpu: number;
  /** The biggest pick-up the table ever faced in this game. */
  readonly maxStack: number;
  /** Power cards played, by rank: `c` for computers, `y` for you. */
  readonly plays: { readonly c: Readonly<Record<string, number>>; readonly y: Readonly<Record<string, number>> };
  /** Who last added to the pick-up now facing the table (internal: needed to say who dealt it). */
  readonly raiser: number | null;
  /** Time spent actually playing, in milliseconds. Gaps over two minutes count as two minutes. */
  readonly activeMs: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const POWER = new Set(["2", "7", "8", "J", "K", "A"]);

export function emptyTally(): GameTally {
  return {
    dealtByCpu: 0, dealtByYou: 0, landedOnYou: 0, landedOnCpu: 0, lastCardMissed: 0, ouches: 0, missedYou: 0, missedCpu: 0,
    drawsYou: 0, drawsCpu: 0, cardsYou: 0, cardsCpu: 0, maxStack: 0, plays: { c: {}, y: {} }, raiser: null, activeMs: 0,
  };
}

const isStack = (state: TableState) => state.pendingPenalty !== null && state.pendingPenalty.kind !== "miss-turn";

/** Folds one engine move into the tally. `before` and `after` are the engine's states either side of `action`. */
export function tallyMove(tally: GameTally, before: TableState, action: GameAction, after: TableState): GameTally {
  const actor = before.turn;
  const you = actor === 0;
  const next: Mutable<GameTally> = { ...tally, plays: { c: { ...tally.plays.c }, y: { ...tally.plays.y } } };

  if (action.type === "accept-missed-turn") {
    if (you) next.missedYou += 1; else next.missedCpu += 1;
    next.raiser = null;
    return next;
  }

  if (action.type === "draw") {
    const count = Math.max(0, after.hands[actor].length - before.hands[actor].length);
    if (isStack(before)) {
      if (you) next.landedOnYou += count; else next.landedOnCpu += count;
      if (tally.raiser !== null && tally.raiser !== actor) { if (tally.raiser === 0) next.dealtByYou += count; else next.dealtByCpu += count; }
      if (before.hands[actor].length === 1) next.ouches += 1;
    } else if (you) next.drawsYou += count; else next.drawsCpu += count;
    next.raiser = null;
    return next;
  }

  const cards = action.cards as readonly CardId[];
  if (you) next.cardsYou += cards.length; else next.cardsCpu += cards.length;
  const rank = rankOf(cards[cards.length - 1]);
  if (POWER.has(rank)) {
    const bag = (you ? next.plays.y : next.plays.c) as Record<string, number>;
    bag[rank] = (bag[rank] ?? 0) + cards.length;
  }
  // A black king or any two adds to the pile, so whoever played it is who dealt it. A red king only cancels.
  const adds = cards.some((card) => rankOf(card) === "2" || card === "KS" || card === "KC");
  if (isStack(after)) {
    if (adds) next.raiser = actor;
    next.maxStack = Math.max(next.maxStack, (after.pendingPenalty as { cards: number }).cards);
  } else next.raiser = null;
  // Playing out the whole hand without winning: a seven or jacks as the last cards cannot win (ruling 19), so one card is
  // picked up. If you had not called "Last Card" the table also adds two (the engine hands them over in the same move),
  // so anything beyond the one card is a missed call.
  if (cards.length === before.hands[actor].length && after.status === "playing") {
    const gained = after.hands[actor].length;
    const penalty = you && gained >= 2 ? 2 : 0;
    if (penalty) { next.lastCardMissed += 1; next.landedOnYou += penalty; }
    if (you) next.drawsYou += gained - penalty; else next.drawsCpu += gained;
  }
  return next;
}

/** You did not say "Last Card" and were caught: penalty cards that no power card dealt. */
export function tallyLastCardMissed(tally: GameTally, cards = 2): GameTally {
  return { ...tally, lastCardMissed: tally.lastCardMissed + 1, landedOnYou: tally.landedOnYou + cards };
}

/** Adds time spent playing since the last move, never counting more than two minutes for one gap. */
export function tallyTime(tally: GameTally, gapMs: number): GameTally {
  return { ...tally, activeMs: tally.activeMs + Math.max(0, Math.min(120_000, gapMs)) };
}

/** The part of the tally that is sent: only totals, nothing that says who or when. */
export function tallyForReport(tally: GameTally) {
  const { raiser: _raiser, activeMs: _activeMs, ...totals } = tally;
  return totals;
}
