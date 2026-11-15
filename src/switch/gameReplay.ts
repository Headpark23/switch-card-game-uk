import { cardIdLabel } from "./cards";
import type { TableState } from "./table";
import type { CardId, Suit } from "./types";
import { reactionOf } from "./reactions";

/**
 * Every game you play is recorded as it happens so it can be replayed at speed: each move as the table saw it
 * (cards played, how many everyone holds) and every reaction sent, in order. Only what was public at the table is
 * kept, so a replay never shows another player's hand. Replays live on this phone only (`switchGameReplays`, the
 * newest 30), and every reaction is also kept in a lighter log (`switchReactionLog`) that stats are worked out from.
 */

export interface ReplayMove {
  readonly k: "m";
  /** Milliseconds since the replay began. */
  readonly t: number;
  readonly seat: number;
  readonly type: "play" | "draw" | "miss" | "spot";
  readonly cards?: readonly CardId[];
  readonly suit?: Suit;
  /** How many cards each seat holds after the move. */
  readonly counts: readonly number[];
  /** The computer played this for a person whose clock ran out. */
  readonly auto?: boolean;
}

export interface ReplayReaction {
  readonly k: "r";
  readonly t: number;
  /** Where the sender sat, or null for someone watching. */
  readonly seat: number | null;
  readonly from: string;
  readonly id: string;
}

export type ReplayEvent = ReplayMove | ReplayReaction;

export interface GameReplay {
  /** The same id the game is logged under in your history. */
  readonly id: string;
  readonly startedAt: string;
  readonly names: readonly string[];
  /** Which seats a computer played. */
  readonly computers: readonly number[];
  readonly online: boolean;
  readonly start: { readonly counts: readonly number[]; readonly pile: readonly CardId[]; readonly suit: Suit; readonly dealer: number };
  readonly events: readonly ReplayEvent[];
  readonly winner?: number | null;
  readonly finishedAt?: string;
}

const REPLAYS_KEY = "switchGameReplays";
const DRAFT_KEY = "switchReplayDraft";
const LOG_KEY = "switchReactionLog";
const KEEP_REPLAYS = 30;
const KEEP_REACTIONS = 3000;

function read<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable: the game carries on */ }
}

const isReplay = (value: unknown): value is GameReplay => !!value && typeof value === "object" && typeof (value as GameReplay).id === "string"
  && Array.isArray((value as GameReplay).names) && Array.isArray((value as GameReplay).events) && !!(value as GameReplay).start;

/** A new replay, starting from the table as it is now. */
export function beginReplay(id: string, table: TableState, names: readonly string[], computers: readonly number[], online: boolean, at = Date.now()): GameReplay {
  return {
    id, startedAt: new Date(at).toISOString(), names: [...names], computers: [...computers], online,
    start: { counts: table.hands.map((hand) => hand.length), pile: table.discardPile.slice(-3), suit: table.currentSuit, dealer: table.dealer },
    events: [],
  };
}

export const elapsed = (replay: GameReplay, at = Date.now()) => Math.max(0, at - Date.parse(replay.startedAt));

export function withEvent(replay: GameReplay, event: ReplayEvent): GameReplay {
  return { ...replay, events: [...replay.events, event] };
}

/** The game in progress is kept as it goes, so closing the app mid-game loses nothing. */
export function saveDraft(replay: GameReplay): void { write(DRAFT_KEY, replay); }
export function readDraft(id: string): GameReplay | null {
  const draft = read<unknown>(DRAFT_KEY, null);
  return isReplay(draft) && draft.id === id ? draft : null;
}

export function getReplays(): GameReplay[] {
  const list = read<unknown>(REPLAYS_KEY, []);
  return Array.isArray(list) ? list.filter(isReplay) : [];
}
export const getReplay = (id: string): GameReplay | null => getReplays().find((replay) => replay.id === id) ?? null;

/** A finished game is filed under its id; saving twice only replaces it. */
export function finishReplay(replay: GameReplay, winner: number | null, at = Date.now()): GameReplay {
  const done: GameReplay = { ...replay, winner, finishedAt: new Date(at).toISOString() };
  write(REPLAYS_KEY, [done, ...getReplays().filter((entry) => entry.id !== done.id)].slice(0, KEEP_REPLAYS));
  try { if (readDraft(done.id)) window.localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to tidy */ }
  return done;
}

/* ── The reaction log, for stats ── */

export interface ReactionRecord {
  readonly gameId: string;
  readonly at: string;
  /** How many moves into the game it was sent. */
  readonly move: number;
  readonly from: string;
  /** Sent by the person holding this phone. */
  readonly mine: boolean;
  readonly computer: boolean;
  readonly online: boolean;
  readonly id: string;
}

export function getReactionLog(): ReactionRecord[] {
  const list = read<unknown>(LOG_KEY, []);
  return Array.isArray(list) ? list.filter((entry): entry is ReactionRecord => !!entry && typeof entry === "object" && typeof (entry as ReactionRecord).id === "string" && typeof (entry as ReactionRecord).gameId === "string") : [];
}

export function logReaction(record: ReactionRecord): void {
  write(LOG_KEY, [record, ...getReactionLog()].slice(0, KEEP_REACTIONS));
}

export interface ReactionSummary {
  readonly sent: number;
  readonly received: number;
  readonly games: number;
  /** Your most-sent reaction. */
  readonly favourite: { readonly id: string; readonly count: number } | null;
  /** Who sends the most reactions at your table, you aside. */
  readonly chattiest: { readonly name: string; readonly count: number } | null;
  /** Every reaction by how often it has been sent, by anyone. */
  readonly byId: readonly { readonly id: string; readonly mine: number; readonly theirs: number }[];
}

export function summariseReactions(log: readonly ReactionRecord[]): ReactionSummary {
  const mine = log.filter((entry) => entry.mine);
  const theirs = log.filter((entry) => !entry.mine);
  const counts = new Map<string, { mine: number; theirs: number }>();
  for (const entry of log) {
    const count = counts.get(entry.id) ?? { mine: 0, theirs: 0 };
    if (entry.mine) count.mine += 1; else count.theirs += 1;
    counts.set(entry.id, count);
  }
  const byId = [...counts.entries()].map(([id, count]) => ({ id, ...count })).filter((entry) => reactionOf(entry.id)).sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs) || a.id.localeCompare(b.id));
  const top = [...byId].filter((entry) => entry.mine > 0).sort((a, b) => b.mine - a.mine)[0];
  const senders = new Map<string, number>();
  theirs.forEach((entry) => senders.set(entry.from, (senders.get(entry.from) ?? 0) + 1));
  const chatty = [...senders.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    sent: mine.length, received: theirs.length, games: new Set(log.map((entry) => entry.gameId)).size,
    favourite: top ? { id: top.id, count: top.mine } : null,
    chattiest: chatty ? { name: chatty[0], count: chatty[1] } : null,
    byId,
  };
}

/* ── Playing a replay back ── */

export interface SeatTally { readonly cards: number; readonly played: number; readonly pickedUp: number; readonly penaltiesDealt: number; readonly reactions: number }

export interface ReplayFrame {
  readonly event: ReplayEvent | null;
  readonly counts: readonly number[];
  readonly pile: readonly CardId[];
  readonly suit: Suit;
  readonly line: string;
  /** Moves made so far. */
  readonly move: number;
  readonly tally: readonly SeatTally[];
  /** Reactions so far, oldest first. */
  readonly said: readonly ReplayReaction[];
  /** Who played the last penalty card still waiting to be picked up. */
  readonly penaltyBy: number | null;
}

/** Twos and kings make the next player pick up (a red king takes five off a chain, but still keeps it going). */
const PENALTY = (card: CardId) => card[0] === "2" || card[0] === "K";
const suitOf = (card: CardId) => card[card.length - 1] as Suit;

/** Every step of the game, from the deal to the last card, with the running stats at each one. Frame 0 is the deal. */
export function replayFrames(replay: GameReplay): ReplayFrame[] {
  const seats = replay.names.length;
  const name = (seat: number | null) => (seat === null ? "Someone watching" : replay.names[seat] ?? "Someone");
  const plural = (who: string, verb: string) => (who === "You" ? verb : `${verb}s`);
  let tally: SeatTally[] = Array.from({ length: seats }, (_, seat) => ({ cards: replay.start.counts[seat] ?? 0, played: 0, pickedUp: 0, penaltiesDealt: 0, reactions: 0 }));
  let frame: ReplayFrame = { event: null, counts: replay.start.counts, pile: replay.start.pile, suit: replay.start.suit, line: `${name(replay.start.dealer)} dealt.`, move: 0, tally, said: [], penaltyBy: null };
  const frames: ReplayFrame[] = [frame];
  for (const event of replay.events) {
    if (event.k === "r") {
      tally = tally.map((seat, index) => (index === event.seat ? { ...seat, reactions: seat.reactions + 1 } : seat));
      frame = { ...frame, event, tally, said: [...frame.said, event], line: `${event.from}: ${reactionOf(event.id)?.text ?? ""}` };
      frames.push(frame);
      continue;
    }
    const who = name(event.seat);
    const before = frame.counts[event.seat] ?? 0;
    const after = event.counts[event.seat] ?? before;
    const played = event.cards?.length ?? 0;
    const pickedUp = Math.max(0, after - (before - played));
    let penaltyBy = frame.penaltyBy;
    let dealt: number | null = null;
    let line: string;
    let pile = frame.pile;
    let suit = frame.suit;
    if (event.type === "play" && event.cards?.length) {
      pile = [...frame.pile, ...event.cards].slice(-3);
      suit = event.suit ?? suitOf(event.cards[event.cards.length - 1]);
      penaltyBy = PENALTY(event.cards[event.cards.length - 1]) ? event.seat : null;
      line = `${who} ${plural(who, "play")} ${event.cards.map(cardIdLabel).join(", then ")}${event.cards[0][0] === "A" ? `, calling ${({ S: "spades", H: "hearts", D: "diamonds", C: "clubs" } as const)[suit]}` : ""}.`;
      if (pickedUp) line += ` ${who === "You" ? "You pick" : `${who} picks`} up ${pickedUp}.`;
    } else if (event.type === "draw") {
      if (pickedUp > 1 && penaltyBy !== null && penaltyBy !== event.seat) dealt = penaltyBy;
      penaltyBy = null;
      line = `${who} ${plural(who, "pick")} up ${pickedUp} card${pickedUp === 1 ? "" : "s"}.`;
    } else if (event.type === "miss") {
      penaltyBy = null;
      line = `${who} ${who === "You" ? "miss" : "misses"} a turn.`;
    } else {
      line = `${who} did not say "Last Card" and ${plural(who, "pick")} up ${pickedUp}.`;
    }
    if (event.auto) line += " (The computer played it for them.)";
    if (after === 1 && before !== 1) line += ` ${who === "You" ? "You are" : `${who} is`} on Last Card.`;
    tally = tally.map((seat, index) => ({
      ...seat,
      cards: event.counts[index] ?? seat.cards,
      ...(index === event.seat ? { played: seat.played + played, pickedUp: seat.pickedUp + pickedUp } : {}),
      ...(index === dealt ? { penaltiesDealt: seat.penaltiesDealt + 1 } : {}),
    }));
    frame = { event, counts: event.counts, pile, suit, line, move: frame.move + 1, tally, said: frame.said, penaltyBy };
    frames.push(frame);
  }
  return frames;
}
