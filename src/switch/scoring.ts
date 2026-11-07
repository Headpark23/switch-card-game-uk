import type { Player } from "./types";

export type ScoreFormat = "head-to-head" | "domino" | "darts" | "league" | "knockout" | "cup";

export interface DartsState {
  readonly legs: Readonly<Record<string, number>>;
  readonly sets: Readonly<Record<string, number>>;
  readonly setsToWin: number;
}

interface ScoreSnapshot {
  readonly scores: Readonly<Record<string, number>>;
  readonly darts: DartsState | null;
}

export interface ScoreSession {
  readonly format: ScoreFormat;
  readonly players: readonly Player[];
  readonly scores: Readonly<Record<string, number>>;
  readonly target: number;
  /** One v One played as legs: an odd number of legs, first to a majority wins. Scores then count legs won. */
  readonly bestOf?: number;
  readonly darts: DartsState | null;
  readonly history: readonly ScoreSnapshot[];
}

export type ScoreCommand =
  | { readonly type: "add-score"; readonly playerId: string; readonly value: unknown }
  | { readonly type: "win-leg"; readonly playerId: string };

export class ScoreValidationError extends Error {
  constructor(public readonly code: "required" | "non-negative" | "whole-number" | "safe-integer" | "unknown-player" | "wrong-format" | "finished", message: string) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

function parseScore(value: unknown): number {
  if (value === "" || value === null || value === undefined) throw new ScoreValidationError("required", "Enter a score.");
  const numeric = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) throw new ScoreValidationError("whole-number", "Use a whole number.");
  if (numeric < 0) throw new ScoreValidationError("non-negative", "Scores cannot be negative.");
  if (!Number.isInteger(numeric)) throw new ScoreValidationError("whole-number", "Use a whole number.");
  if (!Number.isSafeInteger(numeric)) throw new ScoreValidationError("safe-integer", "That score is too large.");
  return numeric;
}

function playerBounds(format: ScoreFormat): readonly [number, number] {
  if (format === "knockout") return [3, 6];
  if (format === "cup") return [2, 10];
  if (format === "league") return [4, 10];
  return [2, 2];
}

export function createSession(format: ScoreFormat, names: readonly (string | Player)[], options: { target?: number; setsToWin?: number; bestOf?: number } = {}): ScoreSession {
  const [minimum, maximum] = playerBounds(format);
  if (names.length < minimum || names.length > maximum) throw new Error(`${format} supports ${minimum}–${maximum} players.`);
  const players = names.map((entry, index) => {
    const name = (typeof entry === "string" ? entry : entry.name).trim();
    if (!name) throw new Error("Player names cannot be blank.");
    return { id: typeof entry === "string" ? `player-${index + 1}` : entry.id, name };
  });
  const scores = Object.fromEntries(players.map((player) => [player.id, 0]));
  const bestOf = options.bestOf;
  if (bestOf !== undefined) {
    if (format !== "head-to-head") throw new Error("Only One v One can be played as legs.");
    if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf > 99 || bestOf % 2 === 0) throw new ScoreValidationError("whole-number", "The number of legs must be odd, such as 3, 5 or 9.");
    return { format, players, scores, target: (bestOf + 1) / 2, bestOf, darts: null, history: [] };
  }
  const target = parseScore(options.target ?? 100);
  if (target === 0) throw new ScoreValidationError("non-negative", "The target must be greater than zero.");
  const setsToWin = parseScore(options.setsToWin ?? 3);
  const darts = format === "darts" ? { legs: { ...scores }, sets: { ...scores }, setsToWin } : null;
  return { format, players, scores, target, darts, history: [] };
}

function remember(session: ScoreSession): ScoreSnapshot[] {
  return [...session.history, { scores: { ...session.scores }, darts: session.darts ? { legs: { ...session.darts.legs }, sets: { ...session.darts.sets }, setsToWin: session.darts.setsToWin } : null }].slice(-100);
}

function requirePlayer(session: ScoreSession, playerId: string): void {
  if (!session.players.some((player) => player.id === playerId)) throw new ScoreValidationError("unknown-player", "Choose a current player.");
}

/** The match winner once someone reaches the target (domino, one v one) or wins enough sets (darts). */
export function scoreWinnerId(session: ScoreSession): string | null {
  if (session.format === "darts" && session.darts) {
    return session.players.find((player) => (session.darts as DartsState).sets[player.id] >= (session.darts as DartsState).setsToWin)?.id ?? null;
  }
  if (session.format === "domino" || session.format === "head-to-head") {
    const reached = session.players.filter((player) => session.scores[player.id] >= session.target);
    if (reached.length === 0) return null;
    return [...reached].sort((left, right) => session.scores[right.id] - session.scores[left.id])[0].id;
  }
  return null;
}

export function applyScoreCommand(session: ScoreSession, command: ScoreCommand): ScoreSession {
  requirePlayer(session, command.playerId);
  if (scoreWinnerId(session)) throw new ScoreValidationError("finished", "The match is over. Undo the last score to carry on.");
  const history = remember(session);
  if (command.type === "add-score") {
    if ((session.format !== "domino" && session.format !== "head-to-head") || session.bestOf !== undefined) throw new ScoreValidationError("wrong-format", "This format does not use round scores.");
    const value = parseScore(command.value);
    return { ...session, scores: { ...session.scores, [command.playerId]: session.scores[command.playerId] + value }, history };
  }
  if (session.bestOf !== undefined) {
    return { ...session, scores: { ...session.scores, [command.playerId]: session.scores[command.playerId] + 1 }, history };
  }
  if (session.format !== "darts" || !session.darts) throw new ScoreValidationError("wrong-format", "Only darts uses legs.");
  const legs = { ...session.darts.legs, [command.playerId]: session.darts.legs[command.playerId] + 1 };
  const sets = { ...session.darts.sets };
  // Ruling: first to three legs takes the set.
  if (legs[command.playerId] >= 3) {
    sets[command.playerId] += 1;
    for (const player of session.players) legs[player.id] = 0;
  }
  return { ...session, darts: { ...session.darts, legs, sets }, history };
}

export function undoScoreCommand(session: ScoreSession): ScoreSession {
  const previous = session.history.at(-1);
  if (!previous) return session;
  return { ...session, scores: { ...previous.scores }, darts: previous.darts, history: session.history.slice(0, -1) };
}
