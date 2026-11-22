import type { ComputerGame } from "./computerLog";

/**
 * Your longest and shortest games, by moves and by time (owner request, 21 Nov 2026). Every game you finished counts,
 * against the computer or online. A tie goes to the more recent game. Games saved before playing time was kept have
 * no time unless their replay is still on the phone (`secondsOf` looks it up).
 */
export type LengthKind = "longest-moves" | "shortest-moves" | "longest-time" | "shortest-time";

export interface LengthRecord {
  readonly kind: LengthKind;
  readonly game: ComputerGame;
  readonly moves: number;
  /** Playing time in seconds, when known. */
  readonly seconds: number | null;
}

export interface GameLengths {
  readonly longestMoves: LengthRecord | null;
  readonly shortestMoves: LengthRecord | null;
  readonly longestTime: LengthRecord | null;
  readonly shortestTime: LengthRecord | null;
  /** Games that count towards a record by moves, and by time. */
  readonly counted: number;
  readonly timed: number;
}

const newest = (a: ComputerGame, b: ComputerGame) => Date.parse(b.playedAt) - Date.parse(a.playedAt) || b.id.localeCompare(a.id);

export function gameLengths(games: readonly ComputerGame[], secondsOf: (game: ComputerGame) => number | null = (game) => game.seconds ?? null): GameLengths {
  const rows = [...games].filter((game) => game.moves > 0).sort(newest).map((game) => ({ game, moves: game.moves, seconds: secondsOf(game) }));
  const timed = rows.filter((row) => row.seconds !== null && row.seconds > 0);
  const pick = (kind: LengthKind, pool: typeof rows, value: (row: (typeof rows)[number]) => number, better: (a: number, b: number) => boolean): LengthRecord | null => {
    let top: (typeof rows)[number] | null = null;
    // Rows run newest first, so a strict comparison leaves a tie with the newer game.
    for (const row of pool) if (!top || better(value(row), value(top))) top = row;
    return top ? { kind, game: top.game, moves: top.moves, seconds: top.seconds } : null;
  };
  return {
    longestMoves: pick("longest-moves", rows, (row) => row.moves, (a, b) => a > b),
    shortestMoves: pick("shortest-moves", rows, (row) => row.moves, (a, b) => a < b),
    longestTime: pick("longest-time", timed, (row) => row.seconds as number, (a, b) => a > b),
    shortestTime: pick("shortest-time", timed, (row) => row.seconds as number, (a, b) => a < b),
    counted: rows.length, timed: timed.length,
  };
}

/** "45 seconds", "3 min 20 s", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { const rest = seconds % 60; return rest ? `${minutes} min ${rest} s` : `${minutes} min`; }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
