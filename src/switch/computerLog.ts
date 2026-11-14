import type { ComputerLevel } from "./ai";
import type { PlayMode } from "./series";
import { ensureProfiles, getProfiles, type LocalProfile } from "./profiles";

type Extensions = Readonly<Record<string, unknown>>;

/** One game played on the phone against the computer, kept so practice shows up in your stats. */
export interface ComputerGame {
  readonly id: string;
  readonly playedAt: string;
  /** The saved player this game counts for. */
  readonly playerId: string;
  /** How many computer opponents sat at the table (1 to 7). */
  readonly opponents: number;
  readonly level: ComputerLevel;
  readonly won: boolean;
  /** Finishing place, 1 for the win. Others are ranked by cards left in hand. */
  readonly place: number;
  readonly moves: number;
  /** Which way of playing this game belonged to. Missing means a single game, as before game types existed. */
  readonly mode?: PlayMode;
  /** How each computer at the table finished in this game. Missing on games played before rivals were tracked. */
  readonly rivals?: readonly RivalPlace[];
  /** Every game of one Knock Out, league, Cup, Darts or Dominoes match shares this id. */
  readonly seriesId?: string;
  /** Set on the last game you played in a series: how the whole series ended for you. */
  readonly series?: SeriesResult;
}

/** One computer's finishing place in a game you played. */
export interface RivalPlace {
  readonly name: string;
  readonly place: number;
}

/** How a whole series (a tournament or match) ended for the player. */
export interface SeriesResult {
  readonly won: boolean;
  readonly place: number;
  /** Players at the start, you included. */
  readonly players: number;
  /** Games played in the series, yours and the computers'. */
  readonly games: number;
}

const GAMES_KEY = "switchComputerGames";
const ME_KEY = "switchMe";
const LEVELS: readonly string[] = ["relaxed", "standard", "sharp"];

function isGame(value: unknown): value is ComputerGame {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const game = value as Record<string, unknown>;
  return typeof game.id === "string" && game.id.length > 0 && typeof game.playedAt === "string" && !Number.isNaN(Date.parse(game.playedAt))
    && typeof game.playerId === "string" && typeof game.opponents === "number" && game.opponents >= 1 && game.opponents <= 7
    && typeof game.level === "string" && LEVELS.includes(game.level) && typeof game.won === "boolean"
    && typeof game.place === "number" && typeof game.moves === "number"
    && (game.mode === undefined || typeof game.mode === "string") && (game.seriesId === undefined || typeof game.seriesId === "string")
    && (game.series === undefined || (game.series !== null && typeof game.series === "object"))
    && (game.rivals === undefined || (Array.isArray(game.rivals) && game.rivals.every((rival) => rival !== null && typeof rival === "object" && typeof (rival as RivalPlace).name === "string" && typeof (rival as RivalPlace).place === "number")));
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

/** Writes how a series ended onto the last game you played in it. */
export function setSeriesResult(extensions: Extensions, gameId: string, result: SeriesResult): Record<string, unknown> {
  const games = getComputerGames(extensions);
  if (!games.some((game) => game.id === gameId)) return { ...extensions };
  return { ...extensions, [GAMES_KEY]: games.map((game) => (game.id === gameId ? { ...game, series: { ...result } } : game)) };
}

export const gameMode = (game: ComputerGame): PlayMode => game.mode ?? "single";

export interface ModeSummary {
  readonly mode: PlayMode;
  /** Every game played in this way. */
  readonly games: number;
  readonly gameWins: number;
  /** Tournaments or matches finished (a single game counts as one each). */
  readonly played: number;
  readonly won: number;
  readonly bestPlace: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
}

/** Stats for each way of playing, from the games you played. Single games count themselves; a series counts once it is finished. */
export function summariseByMode(games: readonly ComputerGame[]): ModeSummary[] {
  const ordered = [...games].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.id.localeCompare(b.id));
  const modes = new Map<PlayMode, { games: number; gameWins: number; results: { won: boolean; place: number }[] }>();
  for (const game of ordered) {
    const mode = gameMode(game);
    const entry = modes.get(mode) ?? { games: 0, gameWins: 0, results: [] };
    entry.games += 1;
    if (game.won) entry.gameWins += 1;
    if (mode === "single") entry.results.push({ won: game.won, place: game.place });
    else if (game.series) entry.results.push({ won: game.series.won, place: game.series.place });
    modes.set(mode, entry);
  }
  return [...modes.entries()].map(([mode, entry]) => {
    let streak = 0;
    let best = 0;
    for (const result of entry.results) { streak = result.won ? streak + 1 : 0; best = Math.max(best, streak); }
    return { mode, games: entry.games, gameWins: entry.gameWins, played: entry.results.length, won: entry.results.filter((result) => result.won).length,
      bestPlace: entry.results.length ? Math.min(...entry.results.map((result) => result.place)) : 0, currentStreak: streak, bestStreak: best };
  });
}

/** Finished series only, oldest first. */
export function seriesGames(games: readonly ComputerGame[]): ComputerGame[] {
  return games.filter((game) => game.series).sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.id.localeCompare(b.id));
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

export interface RivalSummary {
  readonly name: string;
  /** Games you played with this computer at the table (only games where its place was recorded). */
  readonly games: number;
  /** Games it finished ahead of you. */
  readonly ahead: number;
  /** Games you finished ahead of it. */
  readonly behind: number;
  /** Games where you finished level (a game that ends the moment someone is out can leave a tie behind them). */
  readonly level: number;
  /** Games this computer won outright. */
  readonly wins: number;
  /** How often it finished ahead of you; a level finish counts as half. 0 to 1. */
  readonly edge: number;
  readonly averagePlace: number;
}

/** A computer has to share this many games with you before it can be called your toughest rival. */
export const RIVAL_MIN_GAMES = 3;

/** How each computer has fared against you, toughest first. Games saved before rivals were tracked are left out. */
export function summariseRivals(games: readonly ComputerGame[]): RivalSummary[] {
  const table = new Map<string, { games: number; ahead: number; behind: number; level: number; wins: number; places: number }>();
  for (const game of games) {
    for (const rival of game.rivals ?? []) {
      const entry = table.get(rival.name) ?? { games: 0, ahead: 0, behind: 0, level: 0, wins: 0, places: 0 };
      entry.games += 1;
      entry.places += rival.place;
      if (rival.place < game.place) entry.ahead += 1;
      else if (rival.place > game.place) entry.behind += 1;
      else entry.level += 1;
      if (rival.place === 1) entry.wins += 1;
      table.set(rival.name, entry);
    }
  }
  return [...table.entries()].map(([name, entry]) => ({
    name, games: entry.games, ahead: entry.ahead, behind: entry.behind, level: entry.level, wins: entry.wins,
    edge: (entry.ahead + entry.level / 2) / entry.games, averagePlace: entry.places / entry.games,
  })).sort((a, b) => (b.games >= RIVAL_MIN_GAMES ? 1 : 0) - (a.games >= RIVAL_MIN_GAMES ? 1 : 0) || b.edge - a.edge || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name));
}

/** The computer that has beaten you most often, once enough games are in. */
export function toughestRival(rivals: readonly RivalSummary[]): RivalSummary | null {
  return rivals.find((rival) => rival.games >= RIVAL_MIN_GAMES) ?? null;
}

export function newGameId(): string {
  return `cpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
