import { useCallback, useEffect, useRef, useState } from "react";
import type { ComputerLevel } from "./ai";
import type { TableState } from "./table";
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

export interface RoomView {
  readonly code: string;
  readonly rev: number;
  readonly status: "lobby" | "playing" | "finished";
  readonly level: ComputerLevel;
  readonly capacity: number;
  readonly gameNo: number;
  readonly seq: number;
  readonly serverNow: number;
  readonly seats: readonly RoomSeat[];
  readonly you: { readonly seat: 0; readonly host: boolean };
  readonly canStart?: boolean;
  /** Your own cards are real; every other hand and the draw pile are backs of the right length. */
  readonly game?: TableState;
  readonly clock?: RoomClock | null;
  readonly moves?: readonly RoomMove[];
  readonly reactions?: readonly { readonly n: number; readonly seat: number; readonly id: string; readonly at: number }[];
  readonly result?: RoomResult | null;
}

/** What anyone holding the code can see before they sit down. */
export interface RoomSummary {
  readonly code: string;
  readonly status: "lobby" | "playing" | "finished";
  readonly capacity: number;
  readonly level: ComputerLevel;
  readonly seats: readonly { readonly name: string; readonly kind: "human" | "computer" }[];
  readonly open: boolean;
}

/** The 18 reactions. The ids match api/_room.js, which only ever stores the id. */
export const REACTIONS: readonly { readonly id: string; readonly text: string; readonly emoji?: string }[] = [
  { id: "good-game", text: "Good game!" }, { id: "nice-one", text: "Nice one!" }, { id: "well-played", text: "Well played" },
  { id: "ouch", text: "Ouch!" }, { id: "bad-luck", text: "Bad luck" }, { id: "phew", text: "Phew!" },
  { id: "your-turn", text: "Your turn!" }, { id: "take-your-time", text: "Take your time" }, { id: "rematch", text: "Rematch?" },
  { id: "cheers", text: "Cheers!" },
  { id: "clap", text: "Clap", emoji: "👏" }, { id: "laugh", text: "Laughing", emoji: "😂" }, { id: "wow", text: "Wow", emoji: "😮" },
  { id: "grimace", text: "Yikes", emoji: "😬" }, { id: "sad", text: "Sad", emoji: "😢" }, { id: "fire", text: "On fire", emoji: "🔥" },
  { id: "party", text: "Party", emoji: "🎉" }, { id: "cool", text: "Cool", emoji: "😎" },
];
export const reactionOf = (id: string) => REACTIONS.find((entry) => entry.id === id);

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

export const cleanTableCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const tableLink = (code: string) => `${window.location.origin}/?table=${code}`;
export const tableInvite = (code: string, host: string) => `${host} has set up a game of Switch. Open the Switch app, tap Play, then "Join with a code" and enter ${code}. Or open ${tableLink(code)}`;

export async function createTable(name: string, seats: number, level: ComputerLevel): Promise<{ code: string; token: string; view: RoomView }> {
  return request("POST", {}, null, { name, seats, level });
}
export async function lookupTable(code: string): Promise<RoomSummary> {
  return request("GET", { code }, null);
}
export async function joinTable(code: string, name: string): Promise<{ code: string; token: string; view: RoomView }> {
  return request("POST", { code, op: "join" }, null, { name });
}
export async function sendToTable(seat: SavedSeat, op: "start" | "move" | "call" | "react" | "again", body?: unknown): Promise<RoomView> {
  return request("POST", { code: seat.code, op }, seat.token, body);
}

const POLL_MS = 1500;
const ERROR_POLL_MS = 4000;

/**
 * Keeps one table's view fresh: it asks the server every second or two while the app is showing, and a reply to one of
 * your own moves is used straight away. A view older than the one already held is ignored, so nothing ever goes backwards.
 * `gone` is true when the table has ended or this seat is no longer valid.
 */
export function useRoom(seat: SavedSeat | null) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const revRef = useRef(-1);
  /** How far the server's clock is ahead of this phone's, so the countdown is the server's even if the phone's clock is wrong. */
  const skew = useRef(0);

  const accept = useCallback((next: RoomView) => {
    skew.current = next.serverNow - Date.now();
    if (next.rev < revRef.current) return;
    revRef.current = next.rev;
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
      let wait = POLL_MS;
      if (document.visibilityState === "visible") {
        try { accept(await request<RoomView>("GET", { code: seat.code }, seat.token)); }
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
    const onVisible = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [seat?.code, seat?.token, accept]);

  const send = useCallback(async (op: "start" | "move" | "call" | "react" | "again", body?: unknown) => {
    if (!seat) throw new RoomApiError("No table.", 0);
    const next = await sendToTable(seat, op, body);
    accept(next);
    return next;
  }, [seat, accept]);

  /** The server's time now, as best this phone can tell. */
  const serverNow = useCallback(() => Date.now() + skew.current, []);
  return { view, error, gone, send, serverNow };
}
