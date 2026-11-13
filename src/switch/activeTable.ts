import type { ComputerLevel } from "./ai";
import type { TableState } from "./table";
import type { Speed } from "./presentation";

/**
 * The game against the computer that is still in progress, so it can be resumed after leaving the screen.
 * A new key of its own: nothing else in storage is read or changed. It is removed once the game is logged.
 */
const KEY = "switchTableGame";
const SPEED_KEY = "switchTableSpeed";
const LEVELS: readonly string[] = ["relaxed", "standard", "sharp"];

export interface ActiveTable {
  readonly version: 1;
  /** Also the id the finished game is logged under, so logging twice can only ever replace, never duplicate. */
  readonly id: string;
  readonly opponents: number;
  readonly level: ComputerLevel;
  readonly game: TableState;
  readonly awaitingLastCard: boolean;
  readonly savedAt: string;
}

function validState(value: unknown): value is TableState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  const cardList = (list: unknown) => Array.isArray(list) && list.every((card) => typeof card === "string");
  return Array.isArray(s.hands) && s.hands.length >= 2 && s.hands.length <= 5 && s.hands.every(cardList)
    && cardList(s.drawPile) && cardList(s.discardPile) && (s.discardPile as unknown[]).length > 0
    && typeof s.currentSuit === "string" && Number.isInteger(s.turn) && (s.direction === 1 || s.direction === -1)
    && Number.isInteger(s.dealer) && s.status === "playing" && Number.isInteger(s.move);
}

export function readActiveTable(storage: Storage | null = safeStorage()): ActiveTable | null {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null") as Record<string, unknown> | null;
    if (!raw || raw.version !== 1 || typeof raw.id !== "string" || !Number.isInteger(raw.opponents) || !LEVELS.includes(String(raw.level))) return null;
    if (!validState(raw.game) || (raw.game as TableState).hands.length !== Number(raw.opponents) + 1) return null;
    return raw as unknown as ActiveTable;
  } catch { return null; }
}

export function saveActiveTable(table: Omit<ActiveTable, "version" | "savedAt">, storage: Storage | null = safeStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), ...table })); } catch { /* the game lasts for this visit */ }
}

export function clearActiveTable(storage: Storage | null = safeStorage()): void {
  try { storage?.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function readSpeed(storage: Storage | null = safeStorage()): Speed {
  try { const value = storage?.getItem(SPEED_KEY); return value === "quick" || value === "relaxed" ? value : "natural"; } catch { return "natural"; }
}

export function saveSpeed(speed: Speed, storage: Storage | null = safeStorage()): void {
  try { storage?.setItem(SPEED_KEY, speed); } catch { /* lasts for this visit */ }
}

export function newTableGameId(): string {
  return `cpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
