import { useCallback, useEffect, useRef, useState } from "react";
import type { ComputerLevel } from "./ai";
import type { TableState } from "./table";
import { matchLabel, type MatchType, type PlayMode, type SeriesOutcome, type SeriesState } from "./series";
import type { CardId, Suit } from "./types";

/**
 * Playing Switch with friends and family over the internet. The server (api/_room.js) owns the game and sends each seat
 * a view of the table with only that seat's own hand in it. The seats are turned so you are always seat 0, which is
 * how the table screen already thinks. Nothing here changes a rule.
 */
export interface RoomSeat {
  readonly name: string;
  readonly kind: "human" | "computer";
  readonly you: boolean;
  readonly host: boolean;
  readonly away: boolean;
  readonly lastCardCalled: boolean;
  readonly cards?: number;
}

export interface RoomMove {
  readonly n: number;
  readonly seat: number;
  readonly type: "play" | "draw" | "accept-missed-turn" | "spot";
  readonly cards: readonly CardId[];
  readonly chosenSuit?: Suit;
  readonly auto: boolean;
  readonly computer: boolean;
  readonly missedLastCard: boolean;
  readonly counts: readonly number[];
  readonly at: number;
}

export interface RoomClock {
  readonly seat: number;
  readonly computer: boolean;
  readonly away?: boolean;
  readonly nudgeAt?: number;
  readonly autoAt?: number;
  readonly now: number;
}

export interface RoomResult {
  readonly gameId: string;
  readonly finishedAt: number;
  readonly winner: number | null;
  readonly seats: readonly { readonly name: string; readonly kind: "human" | "computer"; readonly place: number; readonly cardsLeft: number; readonly autoMoves: number }[];
}

/** What the host chose: the way to play and its settings (Darts sets, Dominoes number). */
export interface RoomSetup { readonly mode: PlayMode; readonly setsToWin?: number; readonly limit?: number; readonly matchType?: MatchType; readonly games?: number; /** Computers the host asked for, by name; other empty seats are drawn at random. */ readonly computers?: readonly string[] }

/** A tournament or match at the table. Player ids are "p0", "p1"…; `me` is yours. Its games run side by side. */
export interface RoomSeries {
  readonly setup: RoomSetup;
  readonly state: SeriesState;
  readonly over: boolean;
  readonly outcome: SeriesOutcome | null;
  readonly me: string;
  /** Your next game, once you are between games: who is in it and when it is dealt. */
  readonly next: { readonly title: string; readonly players: readonly string[]; readonly readyAt: number | null } | null;
  /** Games drawn and waiting to be dealt (the host can deal them at once). */
  readonly waiting: number;
  /** Games being played right now. */
  readonly live: number;
}

/** One game in the room, for the list of games being played. No cards: who is there and how many each holds. */
export interface RoomTableSummary {
  readonly id: string;
  readonly title: string | null;
  readonly playing: boolean;
  readonly you: boolean;
  readonly players: readonly { readonly name: string; readonly kind: "human" | "computer"; readonly cards: number; readonly out: boolean }[];
  readonly turn: string | null;
  readonly winner: string | null;
}

/** A game you played, as the server keeps it, turned so you are first. Used to save every one of your games. */
export interface RoomHistoryEntry {
  readonly gameId: string;
  readonly title: string | null;
  readonly finishedAt: number;
  readonly moves: number;
  readonly seriesId: string | null;
  readonly winner: number;
  readonly seats: RoomResult["seats"];
}

export interface RoomView {
  readonly code: string;
  readonly rev: number;
  /** "between": a tournament with no game being played this moment. */
  readonly status: "lobby" | "playing" | "between" | "finished";
  readonly level: ComputerLevel;
  readonly mode: PlayMode;
  readonly setup: RoomSetup;
  readonly capacity: number;
  /** The game being shown: yours while you play, else the one you chose to watch, else your last. */
  readonly table: { readonly id: string; readonly title: string | null; readonly gameId: string; readonly playing: boolean } | null;
  /** That game's number; `${code}-${gameNo}` is the id it is saved under. */
  readonly gameNo?: number;
  readonly seq?: number;
  readonly tables: readonly RoomTableSummary[];
  /** Announcements to everyone: games won, players knocked out, the winner. */
  readonly news: readonly { readonly n: number; readonly at: number; readonly text: string }[];
  readonly history: readonly RoomHistoryEntry[];
  readonly serverNow: number;
  /** The players in the game being played, turned so you are first if you are in it. Before the first deal, everyone. */
  readonly seats: readonly RoomSeat[];
  /** Everyone at the table, whether or not they are in this game. */
  readonly players: readonly { readonly name: string; readonly kind: "human" | "computer"; readonly you: boolean; readonly host: boolean; readonly playing: boolean }[];
  readonly series: RoomSeries | null;
  /** `watching`: you are not in this game of the tournament, so you see every hand face down. */
  readonly you: { readonly seat: 0 | null; readonly host: boolean; readonly watching: boolean; readonly id: string };
  readonly canStart?: boolean;
  /** Your own cards are real; every other hand and the draw pile are backs of the right length. */
  readonly game?: TableState;
  readonly clock?: RoomClock | null;
  readonly moves?: readonly RoomMove[];
  /** `seat` is where the sender sits in this game, or null if they are watching. */
  readonly reactions?: readonly { readonly n: number; readonly seat: number | null; readonly name: string; readonly id: string; readonly at: number }[];
  readonly result?: RoomResult | null;
}

/** What anyone holding the code can see before they sit down. */
export interface RoomSummary {
  readonly code: string;
  readonly status: "lobby" | "playing" | "finished";
  readonly capacity: number;
  readonly level: ComputerLevel;
  readonly mode: PlayMode;
  readonly seats: readonly { readonly name: string; readonly kind: "human" | "computer" }[];
  readonly open: boolean;
}

/** The 18 reactions live in `reactions.ts`; the ids match api/_room.js, which only ever stores the id. */
export { REACTIONS, reactionOf } from "./reactions";

export class RoomApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(method: "GET" | "POST", query: Record<string, string>, token: string | null, body?: unknown): Promise<T> {
  const search = new URLSearchParams(query).toString();
  let response: Response;
  try {
    response = await fetch(`/api/room${search ? `?${search}` : ""}`, {
      method, cache: "no-store",
      headers: { "content-type": "application/json", ...(token ? { "x-seat-token": token } : {}) },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch { throw new RoomApiError("Could not reach the table. Check your connection.", 0); }
  const parsed = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new RoomApiError(parsed.error || "Playing with friends is unavailable right now.", response.status);
  return parsed;
}

/** Your place at a table, kept on this phone so closing the app and coming back drops you straight back in. */
export interface SavedSeat { readonly code: string; readonly token: string; readonly name: string; readonly savedAt: number }
const SEAT_KEY = "switchOnlineTable";
const SEAT_KEEP_MS = 26 * 3_600_000;

export function loadSeat(now = Date.now()): SavedSeat | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEAT_KEY) || "null") as Partial<SavedSeat> | null;
    return raw && typeof raw.code === "string" && /^[A-Z2-9]{6}$/.test(raw.code) && typeof raw.token === "string" && typeof raw.name === "string" && typeof raw.savedAt === "number" && now - raw.savedAt < SEAT_KEEP_MS ? raw as SavedSeat : null;
  } catch { return null; }
}
export function saveSeat(seat: Omit<SavedSeat, "savedAt">): void {
  try { window.localStorage.setItem(SEAT_KEY, JSON.stringify({ ...seat, savedAt: Date.now() })); } catch { /* the table lasts for this visit */ }
}
export function clearSeat(): void {
  try { window.localStorage.removeItem(SEAT_KEY); } catch { /* storage unavailable */ }
}

/** Each way to play is shown by its own little hand of cards, as in the Play lobby. */
export const ONLINE_MODE_CARDS: Record<PlayMode, string[]> = { single: ["AS", "KH"], match: ["AS", "AH", "AD"], lastout: ["KS", "KH", "KD"], knockout: ["KS", "KC"], group: ["QH", "QD", "JS"], cup: ["10H", "10S"], darts: ["7S", "7H"], dominoes: ["6C", "6D", "6S"] };

/** What each way to play means at a table of friends. Knock Out here is the game-night version (ruling 11). */
export function onlineModeBlurb(mode: PlayMode, setup?: RoomSetup): string {
  switch (mode) {
    case "single": return "One game of Switch. First out wins.";
    case "match": return setup?.matchType === "best"
      ? `Best of ${setup.games ?? 3} games: most wins takes it, and it ends as soon as nobody can catch the leader. Level at the end? Play on until someone is ahead.`
      : `First to ${setup?.games ?? 3} wins takes the match. Every game is ordinary Switch.`;
    case "lastout": return "Everyone plays the same game. Whoever is left holding cards drops out, until one player is left. More than eight are split across tables.";
    case "knockout": return "Everyone plays each round; more than eight are split across tables. Whoever is left holding cards at a table is out, until one player is left.";
    case "cup": return "Head-to-head matches, drawn at random, all played at the same time. Win yours to go through.";
    case "group": return "Two leagues playing side by side, then the championship and plate play-offs. For 6 to 16 players.";
    case "darts": return "Each game is a leg. Three legs win a set; first to the sets wins the match.";
    case "dominoes": return "Cards left in hand add up after every game. First to the number loses.";
  }
}

/** What a table is called on screen: "Best of 5 games", "First to 3 wins", or the way to play. */
export function tableName(mode: PlayMode, setup: RoomSetup | undefined, fallback: string): string {
  return mode === "match" ? matchLabel(setup?.matchType, setup?.games) : fallback;
}

export const cleanTableCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const tableLink = (code: string) => `${window.location.origin}/?table=${code}`;
export const tableInvite = (code: string, host: string, what = "a game of Switch") => `${host} has set up ${what}. Tap to join:
${tableLink(code)}
Or open Switch, tap Play, then "Join with a code" and enter ${code}.`;

export async function createTable(name: string, seats: number, level: ComputerLevel, setup: RoomSetup = { mode: "single" }): Promise<{ code: string; token: string; view: RoomView }> {
  return request("POST", {}, null, { name, seats, level, ...setup });
}
export async function lookupTable(code: string): Promise<RoomSummary> {
  return request("GET", { code }, null);
}
export async function joinTable(code: string, name: string): Promise<{ code: string; token: string; view: RoomView }> {
  return request("POST", { code, op: "join" }, null, { name });
}
export async function sendToTable(seat: SavedSeat, op: "start" | "move" | "call" | "react" | "again", body?: unknown, watch: string | null = null): Promise<RoomView> {
  return request("POST", { code: seat.code, op, ...(watch ? { watch } : {}) }, seat.token, body);
}

const POLL_MS = 1500;
/** Between your games, or watching, the table is looked at less often: a big night must not run up the server. */
const IDLE_POLL_MS = 3000;
const ERROR_POLL_MS = 4000;

/**
 * Keeps one table's view fresh: it asks the server every second or two while the app is showing, and a reply to one of
 * your own moves is used straight away. A view older than the one already held is ignored, so nothing ever goes backwards.
 * `gone` is true when the table has ended or this seat is no longer valid.
 */
export function useRoom(seat: SavedSeat | null, watch: string | null = null) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const revRef = useRef(-1);
  /** How far the server's clock is ahead of this phone's, so the countdown is the server's even if the phone's clock is wrong. */
  const skew = useRef(0);
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const playingRef = useRef(false);
  const pollNow = useRef<() => void>(() => {});

  const accept = useCallback((next: RoomView) => {
    skew.current = next.serverNow - Date.now();
    if (next.rev < revRef.current) return;
    revRef.current = next.rev;
    playingRef.current = Boolean(next.table?.playing && !next.you.watching);
    setView(next);
    setError("");
  }, []);

  useEffect(() => {
    if (!seat) return;
    let alive = true;
    let timer = 0;
    revRef.current = -1;
    setView(null); setGone(false);
    const poll = async () => {
      let wait = playingRef.current ? POLL_MS : IDLE_POLL_MS;
      if (document.visibilityState === "visible") {
        try { accept(await request<RoomView>("GET", { code: seat.code, ...(watchRef.current ? { watch: watchRef.current } : {}) }, seat.token)); }
        catch (reason) {
          const status = reason instanceof RoomApiError ? reason.status : 0;
          if (status === 404 || status === 403) { if (alive) setGone(true); return; }
          if (alive) setError(reason instanceof Error ? reason.message : "Lost touch with the table.");
          wait = ERROR_POLL_MS;
        }
      }
      if (alive) timer = window.setTimeout(poll, wait);
    };
    void poll();
    pollNow.current = () => { window.clearTimeout(timer); void poll(); };
    const onVisible = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [seat?.code, seat?.token, accept]);

  // Choosing another game to watch shows it straight away.
  useEffect(() => { pollNow.current(); }, [watch]);

  const send = useCallback(async (op: "start" | "move" | "call" | "react" | "again", body?: unknown) => {
    if (!seat) throw new RoomApiError("No table.", 0);
    const next = await sendToTable(seat, op, body, watchRef.current);
    accept(next);
    return next;
  }, [seat, accept]);

  /** The server's time now, as best this phone can tell. */
  const serverNow = useCallback(() => Date.now() + skew.current, []);
  return { view, error, gone, send, serverNow };
}
