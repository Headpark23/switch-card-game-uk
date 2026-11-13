import type { ComputerLevel } from "./ai";
import { ensureProfiles, getProfiles, type LocalProfile } from "./profiles";

type Extensions = Readonly<Record<string, unknown>>;

/** One game played on the phone against the computer, kept so practice shows up in your stats. */
export interface ComputerGame {
  readonly id: string;
  readonly playedAt: string;
  /** The saved player this game counts for. */
  readonly playerId: string;
  /** How many computer opponents sat at the table (1 to 4). */
  readonly opponents: number;
  readonly level: ComputerLevel;
  readonly won: boolean;
  /** Finishing place, 1 for the win. Others are ranked by cards left in hand. */
  readonly place: number;
  readonly moves: number;
}

const GAMES_KEY = "switchComputerGames";
const ME_KEY = "switchMe";
const LEVELS: readonly string[] = ["relaxed", "standard", "sharp"];

function isGame(value: unknown): value is ComputerGame {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const game = value as Record<string, unknown>;
  return typeof game.id === "string" && game.id.length > 0 && typeof game.playedAt === "string" && !Number.isNaN(Date.parse(game.playedAt))
    && typeof game.playerId === "string" && typeof game.opponents === "number" && game.opponents >= 1 && game.opponents <= 5
    && typeof game.level === "string" && LEVELS.includes(game.level) && typeof game.won === "boolean"
    && typeof game.place === "number" && typeof game.moves === "number";
}

export function getComputerGames(extensions: Extensions): ComputerGame[] {
  const source = extensions[GAMES_KEY];
  return Array.isArray(source) ? source.filter(isGame).map((game) => ({ ...game })) : [];
}

export function addComputerGame(extensions: Extensions, game: ComputerGame): Record<string, unknown> {
  const rest = getComputerGames(extensions).filter((entry) => entry.id !== game.id);
  return { ...extensions, [GAMES_KEY]: [{ ...game }, ...rest].slice(0, 2000) };
}

export function deleteComputerGame(extensions: Extensions, id: string): Record<string, unknown> {
  return { ...extensions, [GAMES_KEY]: getComputerGames(extensions).filter((entry) => entry.id !== id) };
}

/** Which saved player is the person holding this phone. */
export function getMeId(extensions: Extensions): string | null {
  const id = extensions[ME_KEY];
  return typeof id === "string" && getProfiles(extensions).some((profile) => profile.id === id && !profile.archived) ? id : null;
}

export function putMeId(extensions: Extensions, id: string): Record<string, unknown> {
  return { ...extensions, [ME_KEY]: id };
}

/** Makes sure there is a "me". The first game ever played creates a player called You, which can be renamed later. */
export function ensureMe(extensions: Extensions): { readonly extensions: Record<string, unknown>; readonly me: LocalProfile } {
  const existing = getMeId(extensions);
  if (existing) return { extensions: { ...extensions }, me: getProfiles(extensions).find((profile) => profile.id === existing) as LocalProfile };
  const named = getProfiles(extensions).find((profile) => !profile.archived && profile.name.toLowerCase() === "you");
  if (named) return { extensions: putMeId(extensions, named.id), me: named };
  const ensured = ensureProfiles(extensions, ["You"]);
  return { extensions: putMeId(ensured.extensions, ensured.players[0].id), me: ensured.profiles.find((profile) => profile.id === ensured.players[0].id) as LocalProfile };
}

export interface ComputerSummary {
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly form: readonly ("W" | "L")[];
  readonly byLevel: Readonly<Record<string, { games: number; wins: number }>>;
  readonly byOpponents: Readonly<Record<number, { games: number; wins: number }>>;
  readonly averageMoves: number;
}

export function summariseComputerGames(games: readonly ComputerGame[]): ComputerSummary {
  const ordered = [...games].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.id.localeCompare(b.id));
  const byLevel: Record<string, { games: number; wins: number }> = {};
  const byOpponents: Record<number, { games: number; wins: number }> = {};
  let streak = 0;
  let best = 0;
  let wins = 0;
  let moves = 0;
  for (const game of ordered) {
    byLevel[game.level] ??= { games: 0, wins: 0 };
    byOpponents[game.opponents] ??= { games: 0, wins: 0 };
    byLevel[game.level].games += 1;
    byOpponents[game.opponents].games += 1;
    moves += game.moves;
    if (game.won) {
      wins += 1;
      streak += 1;
      best = Math.max(best, streak);
      byLevel[game.level].wins += 1;
      byOpponents[game.opponents].wins += 1;
    } else streak = 0;
  }
  return {
    games: ordered.length, wins, losses: ordered.length - wins, winRate: ordered.length ? wins / ordered.length : 0,
    currentStreak: streak, bestStreak: best, form: ordered.slice(-10).map((game) => (game.won ? "W" : "L")),
    byLevel, byOpponents, averageMoves: ordered.length ? Math.round(moves / ordered.length) : 0,
  };
}

export function newGameId(): string {
  return `cpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
