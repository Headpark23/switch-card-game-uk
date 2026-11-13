import type { RandomSource } from "./types";

/**
 * The dealer is the thing people forget and argue about. The rule is simple and lives here in one place:
 * the dealer is picked once at the start, the person on their left (the next seat, clockwise) plays first,
 * and after every deal the job passes one seat clockwise. Seats follow the order the names were entered,
 * so enter players in the order they sit, going clockwise.
 */
export interface DealerState {
  /** Seat order, clockwise. */
  readonly seats: readonly string[];
  readonly dealerId: string;
  /** How many deals have been made, counting the current one. */
  readonly deal: number;
}

type Extensions = Readonly<Record<string, unknown>>;
const KEY = "switchDealers";

/** Picks the first dealer at random. */
export function pickDealer(seats: readonly string[], random: RandomSource = Math.random): DealerState {
  if (seats.length < 1) throw new Error("Add players before choosing a dealer.");
  const index = Math.min(seats.length - 1, Math.floor(Math.max(0, random()) * seats.length));
  return { seats: [...seats], dealerId: seats[index], deal: 1 };
}

export function nextClockwise(seats: readonly string[], id: string): string {
  const index = seats.indexOf(id);
  return seats[(index + 1) % seats.length] ?? seats[0];
}

/** Who plays first this deal: the seat after the dealer. */
export function firstToPlay(state: DealerState): string {
  return nextClockwise(state.seats, state.dealerId);
}

/** Passes the deal one seat clockwise. */
export function passDeal(state: DealerState): DealerState {
  return { ...state, dealerId: nextClockwise(state.seats, state.dealerId), deal: state.deal + 1 };
}

/** The same table with someone knocked out or removed: keeps the deal moving if the dealer has gone. */
export function withSeats(state: DealerState, seats: readonly string[]): DealerState {
  if (seats.includes(state.dealerId)) return { ...state, seats: [...seats] };
  // The dealer has gone: the deal moves on to whoever was next in the old order who is still in.
  const old = state.seats;
  const start = old.indexOf(state.dealerId);
  for (let step = 1; step <= old.length; step += 1) {
    const candidate = old[(start + step) % old.length];
    if (seats.includes(candidate)) return { ...state, seats: [...seats], dealerId: candidate };
  }
  return { ...state, seats: [...seats], dealerId: seats[0] };
}

export function setDealer(state: DealerState, id: string): DealerState {
  if (!state.seats.includes(id)) throw new Error("That player is not at this table.");
  return { ...state, dealerId: id };
}

function isDealer(value: unknown): value is DealerState {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.seats) && item.seats.every((seat) => typeof seat === "string") && typeof item.dealerId === "string" && typeof item.deal === "number";
}

/** Dealers are stored per group: "main" for a single table, or a league id for each league. */
export function getDealers(extensions: Extensions): Record<string, DealerState> {
  const source = extensions[KEY];
  if (source === null || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source as Record<string, unknown>).filter(([, value]) => isDealer(value))) as Record<string, DealerState>;
}

export function putDealers(extensions: Extensions, dealers: Record<string, DealerState>): Record<string, unknown> {
  return { ...extensions, [KEY]: dealers };
}

export function clearDealers(extensions: Extensions): Record<string, unknown> {
  const next = { ...extensions };
  delete next[KEY];
  return next;
}

/** Steps the deal back one seat, for when a result is undone. */
export function undoDeal(state: DealerState): DealerState {
  const index = state.seats.indexOf(state.dealerId);
  return { ...state, dealerId: state.seats[(index - 1 + state.seats.length) % state.seats.length] ?? state.dealerId, deal: Math.max(1, state.deal - 1) };
}
