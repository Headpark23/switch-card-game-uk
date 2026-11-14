import type { ComputerLevel } from "./ai";
import { rankOf } from "./cards";
import { createCup, drawNextCupRound, selectCupWinner, type CupState } from "./cup";
import { rankLeague, tiedGroups, type League } from "./leagues";
import { applyTableAction, createTable, finishingOrder, type TableState } from "./table";
import { chooseTableAction } from "./tableAi";
import type { CardId, Player, RandomSource } from "./types";

/**
 * Every way to play Switch against the computer. A "series" is a run of ordinary table games (real Switch, every
 * rule unchanged) that a game type turns into a tournament or a match. Everything here is pure: the screen asks
 * which games are waiting, plays the ones you are in, and `simulateGame` plays the rest in a blink.
 * Rules for each type: docs/RULES-RULINGS.md items 10-12, 16, 17 and 22.
 */
export type PlayMode = "single" | "knockout" | "group" | "cup" | "darts" | "dominoes";

export const COMPUTER_NAMES_IN_ORDER = ["John", "Paul", "George", "Ringo", "Ziggy", "Marley", "Bowie"] as const;
export const ME_ID = "me";
export const MAX_COMPUTERS = 7;

export interface ModeInfo {
  readonly id: PlayMode;
  readonly name: string;
  readonly blurb: string;
  /** Total players at the start, you included. */
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly short: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: "single", name: "Single game", short: "Single", blurb: "One game of Switch. First out wins.", minPlayers: 2, maxPlayers: 8 },
  { id: "knockout", name: "Knock Out", short: "Knock Out", blurb: "1 v 1 games. Win yours to go through to the next round, until one is left.", minPlayers: 3, maxPlayers: 8 },
  { id: "group", name: "Group Play", short: "Group Play", blurb: "Two leagues, then the championship and plate knockouts.", minPlayers: 6, maxPlayers: 8 },
  { id: "cup", name: "Switch Cup", short: "Switch Cup", blurb: "Head-to-head knockout rounds. Win your match to go through.", minPlayers: 2, maxPlayers: 8 },
  { id: "darts", name: "Darts scoring", short: "Darts", blurb: "Each game is a leg. Three legs win a set; win the sets to win the match.", minPlayers: 2, maxPlayers: 8 },
  { id: "dominoes", name: "Dominoes scoring", short: "Dominoes", blurb: "Cards left in hand add up. First to your number loses.", minPlayers: 2, maxPlayers: 8 },
];

export const modeInfo = (mode: PlayMode): ModeInfo => MODES.find((entry) => entry.id === mode) as ModeInfo;

export interface SeriesSetup {
  readonly mode: Exclude<PlayMode, "single">;
  readonly opponents: number;
  readonly level: ComputerLevel;
  /** Darts: sets to win the match (3 or 5). */
  readonly setsToWin?: number;
  /** Dominoes: the first player to reach this total loses. */
  readonly limit?: number;
}

export function validateSetup(setup: SeriesSetup): string | null {
  const info = modeInfo(setup.mode);
  const players = setup.opponents + 1;
  if (!Number.isInteger(setup.opponents) || setup.opponents < 1 || setup.opponents > MAX_COMPUTERS) return "Choose 1 to 7 computers.";
  if (players < info.minPlayers) return `${info.name} needs at least ${info.minPlayers} players, so at least ${info.minPlayers - 1} computers.`;
  if (setup.mode === "darts" && setup.setsToWin !== 3 && setup.setsToWin !== 5) return "Play to 3 or 5 sets.";
  if (setup.mode === "dominoes" && !(Number.isInteger(setup.limit) && (setup.limit as number) >= 10 && (setup.limit as number) <= 999)) return "Choose a number from 10 to 999.";
  return null;
}

export function seriesPlayers(opponents: number): Player[] {
  return [{ id: ME_ID, name: "You" }, ...COMPUTER_NAMES_IN_ORDER.slice(0, opponents).map((name) => ({ id: `cpu-${name.toLowerCase()}`, name }))];
}

/** The value of a card left in hand when a game ends: ace 1 up to king 13 (ruling 22). */
export function cardValue(card: CardId): number {
  const rank = rankOf(card);
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return Number(rank);
}

/** How one table game ended, in terms of series players. */
export interface GameResult {
  /** Best first. The winner, then fewest cards left, then lowest card value left. */
  readonly order: readonly string[];
  readonly winnerId: string;
  /** Value of the cards each player still held (0 for the winner). */
  readonly points: Readonly<Record<string, number>>;
  readonly moves: number;
}

/** Turns a finished table into a result. `ids[seat]` is the series player sitting in that seat. */
export function resultOf(table: TableState, ids: readonly string[]): GameResult {
  const points: Record<string, number> = {};
  const cards: Record<string, number> = {};
  table.hands.forEach((hand, seat) => { points[ids[seat]] = hand.reduce((sum, card) => sum + cardValue(card), 0); cards[ids[seat]] = hand.length; });
  const winnerId = ids[table.winner ?? 0];
  // A play-on game (a league round) was played until every place was decided, so the order is simply who went out when.
  // An ordinary game ends at the first player out and the rest are placed by what they still hold.
  const order = table.playOn
    ? finishingOrder(table).map((seat) => ids[seat])
    : [...ids].sort((a, b) => (a === winnerId ? -1 : b === winnerId ? 1 : 0) || cards[a] - cards[b] || points[a] - points[b] || ids.indexOf(a) - ids.indexOf(b));
  return { order, winnerId, points, moves: table.move };
}

/** Plays a whole game between computers, instantly. Used for every game you are not in. */
export function simulateGame(ids: readonly string[], level: ComputerLevel, random: RandomSource, playOn = false): GameResult {
  let table = createTable(ids.length, random, Math.floor(random() * ids.length), { playOn });
  let guard = 0;
  while (table.status === "playing" && guard < 3000) {
    table = applyTableAction(table, chooseTableAction(table, random, level));
    guard += 1;
  }
  if (table.status === "playing") {
    // A game that never ends (it should not happen): the shortest hands take the places. A play-on game keeps whoever is already out.
    const sizes = table.hands.map((hand) => hand.length);
    if (table.playOn) {
      const out = [...(table.out ?? [])];
      for (const seat of sizes.map((size, index) => ({ size, index })).filter((entry) => !out.includes(entry.index)).sort((a, b) => a.size - b.size || a.index - b.index).map((entry) => entry.index)) out.push(seat);
      table = { ...table, out, status: "won", winner: out[0] };
    } else table = { ...table, status: "won", winner: sizes.indexOf(Math.min(...sizes)) };
  }
  return resultOf(table, ids);
}

export interface PendingGame {
  /** Unique within the series; used to say which game a result belongs to. */
  readonly key: string;
  readonly title: string;
  readonly playerIds: readonly string[];
  /**
   * Play on after the first player is out until every place is decided (league rounds and deciding games, ruling 24):
   * with four players the first out gets 4 points, the other three play on, the next out gets 3, and the last two play for 2 and 1.
   */
  readonly playOn?: boolean;
}

interface KnockoutPart { readonly remaining: readonly string[]; readonly out: readonly string[]; readonly championId: string | null }
interface LeagueSlot { readonly id: string; readonly name: string; readonly ids: readonly string[]; readonly played: number; readonly points: Readonly<Record<string, number>>; readonly wins: Readonly<Record<string, number>>; readonly playoffOrder: readonly string[]; readonly deciders: readonly (readonly string[])[] }

export type SeriesState =
  /** Knock Out and the Cup are both head-to-head knockout rounds (ruling 11): win your game to go through. */
  | { readonly kind: "knockout" | "cup"; readonly base: SeriesBase; readonly cup: CupState }
  | { readonly kind: "darts"; readonly base: SeriesBase; readonly legs: Readonly<Record<string, number>>; readonly sets: Readonly<Record<string, number>>; readonly setsToWin: number; readonly winnerId: string | null }
  | { readonly kind: "dominoes"; readonly base: SeriesBase; readonly totals: Readonly<Record<string, number>>; readonly limit: number; readonly loserId: string | null; readonly last: Readonly<Record<string, number>> }
  | { readonly kind: "group"; readonly base: SeriesBase; readonly leagues: readonly LeagueSlot[]; readonly phase: "league" | "decider" | "playoffs"; readonly championship: KnockoutPart | null; readonly plate: KnockoutPart | null };

export interface SeriesBase {
  readonly id: string;
  readonly setup: SeriesSetup;
  readonly players: readonly Player[];
  /** How many games have been played in the series, yours and the computers'. */
  readonly games: number;
  /** Games the human sat in, with the cards they were left holding. */
  readonly yourGames: number;
  readonly yourWins: number;
}

const nameOf = (state: SeriesState, id: string): string => state.base.players.find((player) => player.id === id)?.name ?? id;
export { nameOf as seriesPlayerName };

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** League sizes for a group of `players`: 6 is 3 and 3, 7 is 4 and 3, 8 is 4 and 4 (ruling 16). */
export function leagueSizes(players: number): [number, number] {
  const second = Math.floor(players / 2);
  return [players - second, second];
}

export function startSeries(setup: SeriesSetup, random: RandomSource, id = `series-${Date.now()}-${Math.floor(random() * 1e6).toString(36)}`): SeriesState {
  const problem = validateSetup(setup);
  if (problem) throw new Error(problem);
  const players = seriesPlayers(setup.opponents);
  const ids = players.map((player) => player.id);
  const base: SeriesBase = { id, setup, players, games: 0, yourGames: 0, yourWins: 0 };
  switch (setup.mode) {
    case "knockout": return { kind: "knockout", base, cup: createCup(players, random) };
    case "cup": return { kind: "cup", base, cup: createCup(players, random) };
    case "darts": return { kind: "darts", base, legs: Object.fromEntries(ids.map((entry) => [entry, 0])), sets: Object.fromEntries(ids.map((entry) => [entry, 0])), setsToWin: setup.setsToWin as number, winnerId: null };
    case "dominoes": return { kind: "dominoes", base, totals: Object.fromEntries(ids.map((entry) => [entry, 0])), limit: setup.limit as number, loserId: null, last: {} };
    default: {
      // Your league is always A. The draw puts everyone else in at random.
      const rest = shuffled(ids.slice(1), random);
      const [firstSize] = leagueSizes(players.length);
      const first = [ME_ID, ...rest.slice(0, firstSize - 1)];
      const second = rest.slice(firstSize - 1);
      const slot = (leagueId: string, name: string, members: readonly string[]): LeagueSlot => ({ id: leagueId, name, ids: members, played: 0, points: Object.fromEntries(members.map((entry) => [entry, 0])), wins: Object.fromEntries(members.map((entry) => [entry, 0])), playoffOrder: [], deciders: [] });
      return { kind: "group", base, leagues: [slot("A", "League A", first), slot("B", "League B", second)], phase: "league", championship: null, plate: null };
    }
  }
}

const koFinished = (part: KnockoutPart | null) => !part || part.championId !== null;

/**
 * The next game of a play-off knockout (ruling 28). Everyone still in plays one game together and it is played on
 * until only one player is left holding cards: that player is out. Four become three, three become two, and the
 * last two play a 1 v 1 final for the title.
 */
function koPending(part: KnockoutPart | null, key: string, label: string): PendingGame[] {
  if (!part || part.championId !== null || part.remaining.length < 2) return [];
  const left = part.remaining.length;
  const title = left === 2 ? `${label} final · 1 v 1` : `${label} knock out · ${left} players`;
  return [{ key: `${key}-${part.out.length + 1}`, title, playerIds: part.remaining, playOn: left > 2 }];
}

function koApply(part: KnockoutPart, result: GameResult): KnockoutPart {
  const loser = [...result.order].reverse().find((id) => part.remaining.includes(id)) as string;
  const remaining = part.remaining.filter((id) => id !== loser);
  return { remaining, out: [...part.out, loser], championId: remaining.length === 1 ? remaining[0] : null };
}

/** Everyone in a knockout part from the winner down: champion, then the last one out, and so on. */
function koOrder(part: KnockoutPart): string[] {
  return [...part.remaining, ...[...part.out].reverse()];
}

export function pendingGames(state: SeriesState): PendingGame[] {
  switch (state.kind) {
    case "darts": return state.winnerId ? [] : [{ key: `darts-${state.base.games + 1}`, title: `Game ${state.base.games + 1}`, playerIds: state.base.players.map((player) => player.id) }];
    case "dominoes": return state.loserId ? [] : [{ key: `dominoes-${state.base.games + 1}`, title: `Game ${state.base.games + 1}`, playerIds: state.base.players.map((player) => player.id) }];
    case "knockout":
    case "cup": {
      if (state.cup.championId) return [];
      const round = state.cup.rounds.at(-1);
      return (round?.fixtures ?? []).filter((fixture) => !fixture.winnerId).map((fixture) => ({ key: fixture.id, title: `Round ${round?.number} match`, playerIds: [...fixture.playerIds] }));
    }
    case "group": {
      if (state.phase === "league") {
        return state.leagues.filter((league) => league.played < league.ids.length)
          .map((league) => ({ key: `${league.id}-game-${league.played + 1}`, title: `${league.name} · game ${league.played + 1} of ${league.ids.length}`, playerIds: league.ids, playOn: true }));
      }
      if (state.phase === "decider") {
        return state.leagues.flatMap((league) => tiedGroups(leagueOf(league)).map((group) => ({ key: `${league.id}-decider-${group.map((player) => player.id).join("+")}`, title: `${league.name} deciding game`, playerIds: group.map((player) => player.id), playOn: true })));
      }
      return [...koPending(state.championship, "championship", "Championship"), ...koPending(state.plate, "plate", "Plate")];
    }
  }
}

function leagueOf(slot: LeagueSlot): League {
  const named = (id: string) => ({ id, name: id });
  return { id: slot.id, name: slot.name, results: slot.ids.map((id) => ({ player: named(id), points: slot.points[id], wins: slot.wins[id] })), playoffOrder: slot.playoffOrder };
}

function withGame(state: SeriesState, result: GameResult, ids: readonly string[]): SeriesBase {
  const mine = ids.includes(ME_ID);
  return { ...state.base, games: state.base.games + 1, yourGames: state.base.yourGames + (mine ? 1 : 0), yourWins: state.base.yourWins + (mine && result.winnerId === ME_ID ? 1 : 0) };
}

/** Records the result of one waiting game and moves the series on. */
export function submitGame(state: SeriesState, key: string, result: GameResult): SeriesState {
  const pending = pendingGames(state).find((game) => game.key === key);
  if (!pending) throw new Error("That game is not waiting to be played.");
  const base = withGame(state, result, pending.playerIds);
  switch (state.kind) {
    case "darts": {
      const legs = { ...state.legs, [result.winnerId]: state.legs[result.winnerId] + 1 };
      const sets = { ...state.sets };
      if (legs[result.winnerId] >= 3) {
        sets[result.winnerId] += 1;
        for (const id of Object.keys(legs)) legs[id] = 0;
      }
      return { ...state, base, legs, sets, winnerId: sets[result.winnerId] >= state.setsToWin ? result.winnerId : null };
    }
    case "dominoes": {
      const totals = Object.fromEntries(Object.entries(state.totals).map(([id, total]) => [id, total + (result.points[id] ?? 0)]));
      const over = Object.entries(totals).filter(([, total]) => total >= state.limit);
      // Two over the line in the same game: the higher total loses, then the one left holding more this game.
      const loserId = over.length ? over.sort((a, b) => b[1] - a[1] || (result.points[b[0]] ?? 0) - (result.points[a[0]] ?? 0) || state.base.players.findIndex((p) => p.id === b[0]) - state.base.players.findIndex((p) => p.id === a[0]))[0][0] : null;
      return { ...state, base, totals, loserId, last: result.points };
    }
    case "knockout":
    case "cup": {
      let cup = selectCupWinner(state.cup, key, result.winnerId);
      const round = cup.rounds.at(-1);
      if (round && round.fixtures.every((fixture) => fixture.winnerId)) cup = drawNextCupRound(cup, Math.random);
      return { ...state, base, cup };
    }
    case "group": return submitGroup({ ...state, base }, key, result, pending.playerIds);
  }
}

function submitGroup(state: Extract<SeriesState, { kind: "group" }>, key: string, result: GameResult, ids: readonly string[]): SeriesState {
  if (state.phase === "league") {
    const leagues = state.leagues.map((league) => {
      if (!key.startsWith(`${league.id}-game-`)) return league;
      const points = { ...league.points };
      const wins = { ...league.wins };
      result.order.forEach((id, index) => { points[id] += league.ids.length - index; });
      wins[result.winnerId] += 1;
      return { ...league, played: league.played + 1, points, wins };
    });
    const done = leagues.every((league) => league.played >= league.ids.length);
    return settle({ ...state, leagues, phase: done ? "decider" : "league" });
  }
  if (state.phase === "decider") {
    const leagues = state.leagues.map((league) => {
      if (!league.ids.includes(ids[0])) return league;
      // The deciding game orders the whole tied group; other players keep their place in the order.
      const rest = league.playoffOrder.filter((id) => !ids.includes(id));
      return { ...league, playoffOrder: [...rest, ...result.order] };
    });
    return settle({ ...state, leagues });
  }
  const isChampionship = key.startsWith("championship");
  return {
    ...state,
    championship: isChampionship && state.championship ? koApply(state.championship, result) : state.championship,
    plate: !isChampionship && state.plate ? koApply(state.plate, result) : state.plate,
  };
}

/** Once the leagues are finished and no one is level, the playoffs are drawn: top two of each league v everyone else. */
function settle(state: Extract<SeriesState, { kind: "group" }>): SeriesState {
  if (state.phase !== "decider") return state;
  if (state.leagues.some((league) => tiedGroups(leagueOf(league)).length > 0)) return state;
  const ranked = state.leagues.map((league) => rankLeague(leagueOf(league).results, league.playoffOrder).map((entry) => entry.player.id));
  // Best seeds first: every league's first place, then every second place. Everyone else goes in the plate.
  const championshipIds = [...ranked.map((list) => list[0]), ...ranked.map((list) => list[1])].filter(Boolean);
  const plateIds = ranked.flatMap((list) => list.slice(2));
  return {
    ...state,
    phase: "playoffs",
    championship: { remaining: championshipIds, out: [], championId: championshipIds.length === 1 ? championshipIds[0] : null },
    plate: plateIds.length === 0 ? null : { remaining: plateIds, out: [], championId: plateIds.length === 1 ? plateIds[0] : null },
  };
}

export function isSeriesOver(state: SeriesState): boolean {
  switch (state.kind) {
    case "knockout":
    case "cup": return state.cup.championId !== null;
    case "darts": return state.winnerId !== null;
    case "dominoes": return state.loserId !== null;
    case "group": return state.phase === "playoffs" && koFinished(state.championship) && koFinished(state.plate);
  }
}

export interface SeriesOutcome {
  /** The series winner: the champion, the match winner, or the player on the lowest total in dominoes. */
  readonly winnerId: string;
  /** Everyone, best first. */
  readonly order: readonly string[];
  /** Dominoes only: who reached the number. */
  readonly loserId?: string;
}

export function seriesOutcome(state: SeriesState): SeriesOutcome | null {
  if (!isSeriesOver(state)) return null;
  const ids = state.base.players.map((player) => player.id);
  switch (state.kind) {
    case "knockout":
    case "cup": {
      const champion = state.cup.championId as string;
      // Furthest into the draw is best: players who lasted more rounds rank higher.
      const exitRound = (id: string) => { let last = 0; for (const round of state.cup.rounds) if (round.fixtures.some((f) => f.playerIds.includes(id)) || round.byePlayerId === id) last = round.number; return last; };
      const order = [champion, ...ids.filter((id) => id !== champion).sort((a, b) => exitRound(b) - exitRound(a) || ids.indexOf(a) - ids.indexOf(b))];
      return { winnerId: champion, order };
    }
    case "darts": {
      const winnerId = state.winnerId as string;
      const order = [...ids].sort((a, b) => (a === winnerId ? -1 : b === winnerId ? 1 : 0) || state.sets[b] - state.sets[a] || state.legs[b] - state.legs[a] || ids.indexOf(a) - ids.indexOf(b));
      return { winnerId, order };
    }
    case "dominoes": {
      const order = [...ids].sort((a, b) => state.totals[a] - state.totals[b] || (state.last[a] ?? 0) - (state.last[b] ?? 0) || ids.indexOf(a) - ids.indexOf(b));
      // The loser is last by definition, whatever the tie-breaks say.
      const loserId = state.loserId as string;
      const fixed = [...order.filter((id) => id !== loserId), loserId];
      return { winnerId: fixed[0], order: fixed, loserId };
    }
    case "group": {
      const order = [...koOrder(state.championship as KnockoutPart), ...(state.plate ? koOrder(state.plate) : [])];
      return { winnerId: order[0], order };
    }
  }
}

export interface StandingRow { readonly id: string; readonly name: string; readonly main: string; readonly note: string; readonly out?: boolean }

/** A table of how everyone stands right now, for the screen between games. */
export function standings(state: SeriesState): { readonly heading: string; readonly rows: StandingRow[] }[] {
  const name = (id: string) => nameOf(state, id);
  switch (state.kind) {
    case "darts": return [{ heading: `First to ${state.setsToWin} sets`, rows: state.base.players.map((player) => ({ id: player.id, name: player.name, main: `${state.sets[player.id]} set${state.sets[player.id] === 1 ? "" : "s"}`, note: `${state.legs[player.id]} leg${state.legs[player.id] === 1 ? "" : "s"}` })).sort((a, b) => state.sets[b.id] - state.sets[a.id] || state.legs[b.id] - state.legs[a.id]) }];
    case "dominoes": return [{ heading: `First to ${state.limit} loses`, rows: state.base.players.map((player) => ({ id: player.id, name: player.name, main: String(state.totals[player.id]), note: state.last[player.id] === undefined ? "" : `+${state.last[player.id]} last game` })).sort((a, b) => Number(a.main) - Number(b.main)) }];
    case "knockout":
    case "cup": return state.cup.rounds.slice(-1).map((round) => ({ heading: `Round ${round.number}`, rows: [...round.fixtures.map((fixture) => ({ id: fixture.id, name: fixture.playerIds.map(name).join(" v "), main: fixture.winnerId ? `${name(fixture.winnerId)} won` : "To play", note: "" })), ...(round.byePlayerId ? [{ id: "bye", name: name(round.byePlayerId), main: "Bye", note: "straight through" }] : [])] }));
    case "group": {
      const tables = state.leagues.map((league) => ({ heading: league.name, rows: rankLeague(leagueOf(league).results, league.playoffOrder).map((entry) => ({ id: entry.player.id, name: name(entry.player.id), main: `${entry.points} pts`, note: `${entry.wins ?? 0} win${entry.wins === 1 ? "" : "s"}${entry.tied && league.played >= league.ids.length ? " · level" : ""}` })) }));
      const parts = [["Championship", state.championship], ["Plate", state.plate]] as const;
      return [...tables, ...parts.flatMap(([heading, part]) => part ? [{ heading, rows: [...part.remaining.map((id) => ({ id, name: name(id), main: part.championId ? "Champion" : "In", note: "" })), ...[...part.out].reverse().map((id) => ({ id, name: name(id), main: "Out", note: "", out: true }))] }] : [])];
    }
  }
}

/** Where a player finished, 1 for the winner. Only once the series is over. */
export function placeOf(state: SeriesState, id: string): number | null {
  const outcome = seriesOutcome(state);
  if (!outcome) return null;
  const at = outcome.order.indexOf(id);
  return at < 0 ? null : at + 1;
}

/**
 * Plays every waiting game you are not in, over and over, until the next one needs you (or the series is over).
 * Returns the new state and the lines to show for what the computers did.
 */
export function advanceComputers(state: SeriesState, random: RandomSource): { readonly state: SeriesState; readonly lines: string[] } {
  let current = state;
  const lines: string[] = [];
  for (let guard = 0; guard < 200; guard += 1) {
    const waiting = pendingGames(current).find((game) => !game.playerIds.includes(ME_ID));
    if (!waiting) break;
    const result = simulateGame(waiting.playerIds, current.base.setup.level, random, waiting.playOn === true);
    lines.push(`${waiting.title}: ${nameOf(current, result.winnerId)} won.`);
    current = submitGame(current, waiting.key, result);
  }
  return { state: current, lines };
}

/** The game you must play next, if any. */
export function yourNextGame(state: SeriesState): PendingGame | null {
  return pendingGames(state).find((game) => game.playerIds.includes(ME_ID)) ?? null;
}
