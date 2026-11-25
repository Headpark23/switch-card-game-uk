export type Moment = "two" | "blackKing" | "redKing" | "eight" | "seven" | "jack" | "ace" | "set" | "counter" | "stack" | "finish";
export type Pending = { kind: "draw-two" | "black-king" | "miss-turn"; cards?: number } | null;
export type CardEvent =
  | { kind: "play"; seat: number; cards: readonly string[]; pendingBefore: Pending; pendingAfter: Pending; won: boolean; next?: number }
  | { kind: "mistake"; seat: number; what: "lastCard" | "illegal" };
export interface CardCandidate { seat: number; ids: string[]; odds: number; answer?: { seat: number; ids: string[]; odds: number } }
export const PLAY_MOMENTS: readonly Moment[];
export const HIT_KINDS: readonly string[];
export const CAUGHT_KINDS: readonly string[];
export function cardEntries(): { id: string; text: string }[];
export function playPool(name: string, moment: Moment): string[];
export function hitPool(name: string, kind: string): string[];
export function mistakePool(name: string): string[];
export function caughtPool(name: string, what: string): string[];
export function greatPool(name: string): string[];
export function momentsOf(play: { cards?: readonly string[]; pendingBefore?: Pending; pendingAfter?: Pending; won?: boolean }): Moment[];
export function attackOf(moments: readonly Moment[], pendingAfter: Pending): string | null;
export function cardCandidates(event: CardEvent, ctx: { seats: readonly number[]; isComputer(seat: number): boolean; nameOf(seat: number): string }): CardCandidate[];
