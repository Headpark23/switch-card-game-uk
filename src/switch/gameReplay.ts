import { cardIdLabel } from "./cards";
import type { TableState } from "./table";
import type { CardId, Suit } from "./types";
import { reactionOf } from "./reactions";

/**
 * Every game you play is recorded as it happens so it can be replayed at speed: each move (cards played, cards picked
 * up, how many everyone holds) and every reaction sent, in order. A replay shows every player's hand face up (owner
 * decision, 21 Nov 2026), so you can see how each one played. Against the computer the phone knows every hand; at an
 * online table the server reveals them only once the game is over. A replay recorded before this carries counts only.
 * Replays live on this phone only (`switchGameReplays`, the newest 30, plus the record-holders in
 * `switchRecordReplays`), and every reaction is also kept in a lighter log (`switchReactionLog`).
 */

export interface ReplayMove {
  readonly k: "m";
  /** Milliseconds since the replay began. */
  readonly t: number;
  readonly seat: number;
  readonly type: "play" | "draw" | "miss" | "spot";
  readonly cards?: readonly CardId[];
  readonly suit?: Suit;
  /** The cards this seat picked up in the move (a pick-up, a penalty, a missed "Last Card"). Present with `start.hands`. */
  readonly drew?: readonly CardId[];
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
  /** `hands` is every seat's cards at the deal. Missing on replays recorded before hands were kept. */
  readonly start: { readonly counts: readonly number[]; readonly pile: readonly CardId[]; readonly suit: Suit; readonly dealer: number; readonly hands?: readonly (readonly CardId[])[] };
  readonly events: readonly ReplayEvent[];
  readonly winner?: number | null;
  readonly finishedAt?: string;
  /** Moves in the finished game and how long it took to play (see `playSeconds`), for the longest and shortest games on Me. */
  readonly moves?: number;
  readonly seconds?: number;
}

const REPLAYS_KEY = "switchGameReplays";
const RECORDS_KEY = "switchRecordReplays";
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
    start: {
      counts: table.hands.map((hand) => hand.length), pile: table.discardPile.slice(-3), suit: table.currentSuit, dealer: table.dealer,
      // At an online table the other hands arrive face down, so they are filled in from the server when the game ends.
      ...(table.hands.every((hand) => hand.every((card) => (card as string) !== "back")) ? { hands: table.hands.map((hand) => [...hand]) } : {}),
    },
    events: [],
  };
}

export const elapsed = (replay: GameReplay, at = Date.now()) => Math.max(0, at - Date.parse(replay.startedAt));

/** The cards a hand gained between two states of the same game (one deck, so every card is unique). */
export const gained = (before: readonly CardId[], after: readonly CardId[]): CardId[] => after.filter((card) => !before.includes(card));

/** A pause longer than this (the app was closed mid-game) does not count as time spent playing. */
const LONGEST_PAUSE_MS = 120_000;

/** How long a game took to play, in seconds: the gaps between moves, with a long gap (the app closed and reopened) cut short. */
export function playSeconds(replay: GameReplay, endAt: number = replay.finishedAt ? Date.parse(replay.finishedAt) : Date.now()): number {
  let previous = 0;
  let total = 0;
  const marks = [...replay.events.filter((event) => event.k === "m").map((event) => event.t), Math.max(0, endAt - Date.parse(replay.startedAt))].sort((a, b) => a - b);
  for (const mark of marks) { total += Math.min(LONGEST_PAUSE_MS, Math.max(0, mark - previous)); previous = mark; }
  return Math.max(1, Math.round(total / 1000));
}

/** A finished game's playing time, from the record or, for replays saved before it was stored, worked out from the moves. */
export const replaySeconds = (replay: GameReplay): number | null => replay.seconds ?? (replay.finishedAt ? playSeconds(replay) : null);

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
/** The games that hold a record (longest or shortest, by moves or by time) are kept beyond the newest 30. */
function getRecordReplays(): GameReplay[] {
  const list = read<unknown>(RECORDS_KEY, []);
  return Array.isArray(list) ? list.filter(isReplay) : [];
}

/** Every replay on this phone: the newest 30 and the record-holders. */
export function getAllReplays(): GameReplay[] {
  const recent = getReplays();
  return [...recent, ...getRecordReplays().filter((entry) => !recent.some((other) => other.id === entry.id))];
}

export const getReplay = (id: string): GameReplay | null => getReplays().find((replay) => replay.id === id) ?? getRecordReplays().find((replay) => replay.id === id) ?? null;

/** Keeps the replay of every game that is, among those kept, the longest or shortest by moves or by time. A tie goes to the newer game. */
function pinRecords(done: GameReplay): void {
  if (!done.start.hands || done.moves === undefined || done.seconds === undefined) return;
  const pool = [done, ...getRecordReplays().filter((entry) => entry.id !== done.id)];
  const keep = new Set<string>();
  const best = (value: (entry: GameReplay) => number | undefined, better: (a: number, b: number) => boolean) => {
    let top: GameReplay | null = null;
    for (const entry of pool) { const own = value(entry); if (own !== undefined && (!top || better(own, value(top) as number))) top = entry; }
    if (top) keep.add(top.id);
  };
  best((entry) => entry.moves, (a, b) => a > b);
  best((entry) => entry.moves, (a, b) => a < b);
  best((entry) => entry.seconds, (a, b) => a > b);
  best((entry) => entry.seconds, (a, b) => a < b);
  write(RECORDS_KEY, pool.filter((entry) => keep.has(entry.id)));
}

/** A finished game is filed under its id; saving twice only replaces it. `moves` is the game's own move count, which the stats use too. */
export function finishReplay(replay: GameReplay, winner: number | null, at = Date.now(), moves: number | undefined = replay.moves): GameReplay {
  const finished: GameReplay = { ...replay, winner, finishedAt: new Date(at).toISOString(), ...(moves !== undefined ? { moves } : {}) };
  const done: GameReplay = { ...finished, seconds: playSeconds(finished, at) };
  write(REPLAYS_KEY, [done, ...getReplays().filter((entry) => entry.id !== done.id)].slice(0, KEEP_REPLAYS));
  pinRecords(done);
  try { if (readDraft(done.id)) window.localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to tidy */ }
  return done;
}

/**
 * At an online table the server keeps every hand and reveals them once the game is over. This swaps the moves this phone
 * saw for the server's complete log (a phone that joined late, or was closed, may have missed some) and adds the hands,
 * keeping every reaction where it was said.
 */
export function withServerLog(replay: GameReplay, log: { readonly hands: readonly (readonly CardId[])[]; readonly moves: readonly ReplayMove[] }): GameReplay {
  const reactions = replay.events.filter((event): event is ReplayReaction => event.k === "r");
  const events = [...log.moves, ...reactions].sort((a, b) => a.t - b.t || (a.k === "m" ? -1 : 1) - (b.k === "m" ? -1 : 1));
  return { ...replay, start: { ...replay.start, counts: log.hands.map((hand) => hand.length), hands: log.hands.map((hand) => [...hand]) }, events };
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
  /** Every seat's cards at this moment, or null when the replay was recorded without them. */
  readonly hands: readonly (readonly CardId[])[] | null;
  /** The cards the last move picked up, so they can be spotted in the hand. */
  readonly drew: readonly CardId[];
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
  let hands: (readonly (readonly CardId[])[]) | null = replay.start.hands ?? null;
  let frame: ReplayFrame = { event: null, counts: replay.start.counts, pile: replay.start.pile, suit: replay.start.suit, line: `${name(replay.start.dealer)} dealt.`, move: 0, tally, said: [], penaltyBy: null, hands, drew: [] };
  const frames: ReplayFrame[] = [frame];
  for (const event of replay.events) {
    if (event.k === "r") {
      tally = tally.map((seat, index) => (index === event.seat ? { ...seat, reactions: seat.reactions + 1 } : seat));
      frame = { ...frame, event, tally, said: [...frame.said, event], line: `${event.from}: ${reactionOf(event.id)?.text ?? ""}`, drew: [] };
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
    // Every hand after the move: what was played leaves the seat's hand and what was picked up joins it. If the books stop
    // adding up (a replay cut short), the hands are simply not shown from here on.
    const drew = event.drew ?? [];
    if (hands) {
      const next = hands.map((hand, index) => (index === event.seat ? [...hand.filter((card) => !(event.cards ?? []).includes(card)), ...drew] : hand));
      hands = next.every((hand, index) => hand.length === (event.counts[index] ?? hand.length)) ? next : null;
    }
    frame = { event, counts: event.counts, pile, suit, line, move: frame.move + 1, tally, said: frame.said, penaltyBy, hands, drew };
    frames.push(frame);
  }
  return frames;
}
