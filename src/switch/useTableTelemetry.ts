import { useCallback, useEffect, useRef } from "react";
import type { ComputerLevel } from "./ai";
import type { PlayMode } from "./series";
import { emptyTally, tallyForReport, tallyLastCardMissed, tallyMove, tallyTime, type GameTally } from "./gameTally";
import type { TableState } from "./table";
import { track } from "./telemetry";
import type { GameAction } from "./types";

/**
 * Counts a game against the computer for the owner's anonymous dashboard (see `telemetry.ts`).
 * The screen calls `onMove` for every move the engine decides and `onFinish` once when the game is over; nothing here
 * reads or changes the game. The running tally is kept under its own key so a resumed game carries on counting.
 */
const KEY = "switchStatsTable";

interface Saved { readonly id: string; readonly tally: GameTally }

function load(id: string): GameTally | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Saved | null;
    return raw && raw.id === id && raw.tally && typeof raw.tally.maxStack === "number" ? raw.tally : null;
  } catch { return null; }
}
function save(id: string, tally: GameTally) { try { window.localStorage.setItem(KEY, JSON.stringify({ id, tally })); } catch { /* counting is optional */ } }
function forget() { try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ } }

export function useTableTelemetry(gameId: string, opponents: number, level: ComputerLevel, mode: PlayMode = "single") {
  const state = useRef<{ id: string; tally: GameTally; lastAt: number; yourHand: number | null; resumed: boolean; reported: boolean } | null>(null);
  if (!state.current || state.current.id !== gameId) {
    const saved = load(gameId);
    state.current = { id: gameId, tally: saved ?? emptyTally(), lastAt: Date.now(), yourHand: null, resumed: saved !== null, reported: false };
  }

  useEffect(() => {
    const current = state.current;
    if (current && !current.resumed) track({ e: "game_start", opponents, level, mode });
  }, [gameId, opponents, level, mode]);

  const onMove = useCallback((before: TableState, action: GameAction, after: TableState) => {
    const current = state.current;
    if (!current) return;
    let tally = current.tally;
    // Your hand grew between two moves without you picking up: a computer spotted that you had not called "Last Card".
    if (current.yourHand !== null && before.hands[0].length > current.yourHand) tally = tallyLastCardMissed(tally, before.hands[0].length - current.yourHand);
    tally = tallyTime(tallyMove(tally, before, action, after), Date.now() - current.lastAt);
    current.tally = tally;
    current.lastAt = Date.now();
    current.yourHand = after.hands[0].length;
    if (after.status === "playing") save(current.id, tally);
  }, []);

  const onFinish = useCallback((result: { won: boolean; place: number; moves: number }) => {
    const current = state.current;
    if (!current || current.reported) return;
    current.reported = true;
    track({ e: "game", opponents, level, mode, ...result, seconds: Math.round(current.tally.activeMs / 1000), tally: tallyForReport(current.tally) });
    forget();
  }, [opponents, level, mode]);

  /** The person left the table with the game still going. It can be resumed, so the dashboard also compares started with finished. */
  const onLeave = useCallback((moves: number) => {
    const current = state.current;
    if (!current || current.reported) return;
    track({ e: "game_quit", mode, opponents, moves });
  }, [opponents, mode]);

  return { onMove, onFinish, onLeave };
}
