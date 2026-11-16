import type { ComputerLevel } from "./ai";
import { rankOf } from "./cards";
import { createCup, drawNextCupRound, selectCupWinner, type CupState } from "./cup";
import { rankLeague, tiedGroups, type League } from "./leagues";
import { applyTableAction, createTable, finishingOrder, POWER_START_CHANCE, type TableState } from "./table";
import { chooseTableAction } from "./tableAi";
import type { CardId, Player, RandomSource } from "./types";

/**
 * Every way to play Switch against the computer. A "series" is a run of ordinary table games (real Switch, every
 * rule unchanged) that a game type turns into a tournament or a match. Everything here is pure: the screen asks
 * which games are waiting, plays the ones you are in, and `simulateGame` plays the rest in a blink.
 * Rules for each type: docs/RULES-RULINGS.md items 10-12, 16, 17 and 22.
 */
export type PlayMode = "single" | "match" | "lastout" | "knockout" | "group" | "cup" | "darts" | "dominoes";

export const COMPUTER_NAMES_IN_ORDER = ["John", "Paul", "George", "Ringo", "Ziggy", "Marley", "Bowie"] as const;
export const ME_ID = "me";
export const MAX_COMPUTERS = 7;

export interface ModeInfo {
  readonly id: PlayMode;
  readonly name: string;
  /** One short line for the picker. */
  readonly blurb: string;
  /** The fuller explanation shown when a type is opened: how a game plays out, then how it is won (and scored). */
  readonly how: readonly string[];
  readonly scoring: string;
  /** Total players at the start, you included. */
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly short: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: "single", name: "Single game", short: "Single", blurb: "One game of Switch. First out wins.", minPlayers: 2, maxPlayers: 8,
    how: ["One ordinary game of Switch. Everyone is dealt a hand and the first player to get rid of every card wins."], scoring: "No points. A win or a loss goes in your record." },
  { id: "match", name: "Games", short: "Games", blurb: "Play a set number of games. Best of 3, 5 or more, or first to a number of wins.", minPlayers: 2, maxPlayers: 8,
    how: ["The same players play game after game. Pick \"First to\" a number of wins, or \"Best of\" a number of games.", "In a best of, the match stops as soon as nobody can catch the leader. If you are level after the last game, extra games are dealt until someone is ahead."], scoring: "One win per game won. Most wins takes the match." },
  { id: "lastout", name: "Last One Out", short: "Last One Out", blurb: "Everyone plays. The last player still holding cards drops out. Last player left wins.", minPlayers: 3, maxPlayers: 8,
    how: ["Everyone plays the same game together. When one player is left holding cards, they drop out.", "The rest are dealt in again and play on: five become four, four become three, three become two. The last two play a 1 v 1 final."], scoring: "No points. Going out early keeps you in. The last player out finishes last, the winner of the final finishes first." },
  { id: "knockout", name: "Knock Out", short: "Knock Out", blurb: "1 v 1 games. Win yours to go through to the next round, until one is left.", minPlayers: 3, maxPlayers: 8,
    how: ["Players are drawn into pairs and each pair plays a 1 v 1 game. Win yours and you go through to the next round; lose and you are out.", "If there is an odd number, one player gets a bye straight through. Rounds repeat until one player is left."], scoring: "No points. Your place is how far you got. The last one standing wins." },
  { id: "group", name: "Group Play", short: "Group Play", blurb: "Two leagues, then the championship and plate knockouts.", minPlayers: 6, maxPlayers: 8,
    how: ["Players are split into two leagues. Each league plays as many games as it has players, and every game is played on after the first player goes out, until every place is settled.", "The top two in each league go through to the championship. Everyone else plays for the plate. Both are knock-outs: the last player holding cards drops out each game, until a 1 v 1 final."], scoring: "League points: the first out scores as many points as there are players in the league, the next one less, down to 1 for the last. Level on points? Most wins, then one deciding game." },
  { id: "cup", name: "Switch Cup", short: "Switch Cup", blurb: "Head-to-head knockout rounds. Win your match to go through.", minPlayers: 2, maxPlayers: 8,
    how: ["A bracket of head-to-head matches, drawn at random. Win your match to go through to the next round. A bye takes you straight through if the numbers are odd.", "The final decides the Cup."], scoring: "No points. Winning every match wins the Cup." },
  { id: "darts", name: "Darts scoring", short: "Darts", blurb: "Each game is a leg. Three legs win a set; win the sets to win the match.", minPlayers: 2, maxPlayers: 8,
    how: ["Scored like darts. Every game of Switch is a leg: win a game to win a leg.", "Win three legs to win a set. The legs then reset. Keep going until someone has won the sets needed (3 or 5)."], scoring: "Legs win sets, sets win the match. First to 3 or 5 sets wins." },
  { id: "dominoes", name: "Dominoes scoring", short: "Dominoes", blurb: "Cards left in hand add up. First to your number loses.", minPlayers: 2, maxPlayers: 8,
    how: ["After every game, the cards left in each player's hand are added to that player's running total.", "Keep playing games until someone reaches the number you chose. That player loses."], scoring: "Ace is 1 up to king 13 (jack 11, queen 12). The winner of a game adds nothing. The lowest total wins." },
];

/**
 * The ways to play at an online table. Knock Out with friends has always been "last one out leaves", which is now its own
 * type, Last One Out; the server still accepts the old Knock Out for tables made before this change.
 */
export const ONLINE_MODES: readonly ModeInfo[] = MODES.filter((entry) => entry.id !== "single" && entry.id !== "knockout");
/** The ways to play against the computer: "Games" (first to N, best of N; one game is a single game) in place of a single game. */
export const COMPUTER_MODES: readonly ModeInfo[] = MODES.filter((entry) => entry.id !== "single" && entry.id !== "knockout");

export type MatchType = "first" | "best";
/** Wins needed in "first to N", or the most games in "best of N". */
export const MATCH_FIRST_TO = [1, 2, 3, 4, 5] as const;
export const MATCH_BEST_OF = [1, 3, 5, 7, 9] as const;
/** Keeps a sensible count when switching between "first to" and "best of" (best of needs an odd number). */
export function matchCountFor(matchType: MatchType, current: number): number {
  if (matchType === "best") return (MATCH_BEST_OF as readonly number[]).includes(current) ? current : 3;
  return (MATCH_FIRST_TO as readonly number[]).includes(current) ? current : Math.min(5, Math.ceil(current / 2));
}
/** "Best of 5", "First to 3 wins". Games of one are just a single game. */
export function matchLabel(matchType: MatchType | undefined, games: number | undefined): string {
  const count = games ?? 1;
  if (count === 1) return "Single game";
  return matchType === "best" ? `Best of ${count} games` : `First to ${count} wins`;
}

export const modeInfo = (mode: PlayMode): ModeInfo => MODES.find((entry) => entry.id === mode) as ModeInfo;

export interface SeriesSetup {
  readonly mode: Exclude<PlayMode, "single">;
  /** Games: "first" is first to `games` wins; "best" is the most wins after `games` games, a clear lead ending it early. */
  readonly matchType?: MatchType;
  readonly games?: number;
  readonly opponents: number;
  readonly level: ComputerLevel;
  /** Darts: sets to win the match (3 or 5). */
  readonly setsToWin?: number;
  /** Dominoes: the first player to reach this total loses. */
  readonly limit?: number;
  /**
   * Knock Out: "pairs" is 1 v 1 rounds, winners go through (ruling 25, against the computer). "last-out" is the game-night
   * version (ruling 11): everyone left plays each game on until one player is left holding cards, and that player is out.
   */
  readonly knockout?: "pairs" | "last-out";
  /** Against the computer: which computers sit at the table, in seat order (one per opponent). Absent means the usual order. */
  readonly computers?: readonly string[];
}

/** A shuffled copy of the computer names, for "pick them at random". */
export function randomComputers(count: number, random: RandomSource = Math.random, exclude: readonly string[] = []): string[] {
  const pool = COMPUTER_NAMES_IN_ORDER.filter((name) => !exclude.includes(name));
  for (let index = pool.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [pool[index], pool[other]] = [pool[other], pool[index]]; }
  return pool.slice(0, count);
}

/**
 * The computers at a table of `count`: the ones you picked (in the order you picked them), and any seats left over filled
 * at random from the rest. Picking none leaves the whole table to chance.
 */
export function chooseComputers(count: number, picks: readonly string[] = [], random: RandomSource = Math.random): string[] {
  const valid = picks.filter((name, index) => (COMPUTER_NAMES_IN_ORDER as readonly string[]).includes(name) && picks.indexOf(name) === index).slice(0, count);
  return [...valid, ...randomComputers(count - valid.length, random, valid)];
}

/** The most players a way of playing can take at an online table: tournaments split into several games at once. */
export const ONLINE_MAX_PLAYERS: Readonly<Record<PlayMode, number>> = { single: 8, match: 8, darts: 8, dominoes: 8, lastout: 16, knockout: 16, cup: 16, group: 16 };

/** `maxPlayers` is 8 against the computer; an online table allows more for tournaments (ONLINE_MAX_PLAYERS). */
export function validateSetup(setup: SeriesSetup, maxPlayers = MAX_COMPUTERS + 1): string | null {
  const info = modeInfo(setup.mode);
  const players = setup.opponents + 1;
  if (!Number.isInteger(setup.opponents) || setup.opponents < 1 || players > maxPlayers) return maxPlayers === MAX_COMPUTERS + 1 ? "Choose 1 to 7 computers." : `${info.name} is for up to ${maxPlayers} players.`;
  if (players > 8 && (setup.mode === "darts" || setup.mode === "dominoes" || setup.mode === "match")) return `${info.name} is for up to 8 players: everyone plays in every game.`;
  if (players < info.minPlayers) return `${info.name} needs at least ${info.minPlayers} players, so at least ${info.minPlayers - 1} computers.`;
  if (setup.mode === "match") {
    const games = setup.games;
    if (setup.matchType !== "first" && setup.matchType !== "best") return "Choose best of or first to.";
    if (!(Number.isInteger(games) && (games as number) >= 1 && (games as number) <= 15)) return "Choose 1 to 15 games.";
    if (setup.matchType === "best" && (games as number) % 2 === 0) return "Best of needs an odd number of games.";
  }
  if (setup.mode === "darts" && setup.setsToWin !== 3 && setup.setsToWin !== 5) return "Play to 3 or 5 sets.";
  if (setup.mode === "dominoes" && !(Number.isInteger(setup.limit) && (setup.limit as number) >= 10 && (setup.limit as number) <= 999)) return "Choose a number from 10 to 999.";
  return null;
}

export function seriesPlayers(opponents: number, computers?: readonly string[]): Player[] {
  const names = computers && computers.length === opponents ? computers : COMPUTER_NAMES_IN_ORDER.slice(0, opponents);
  return [{ id: ME_ID, name: "You" }, ...names.map((name) => ({ id: `cpu-${name.toLowerCase()}`, name }))];
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
  let table = createTable(ids.length, random, Math.floor(random() * ids.length), { playOn, powerStartChance: POWER_START_CHANCE });
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

interface KnockoutPart {
  readonly remaining: readonly string[];
  readonly out: readonly string[];
  readonly championId: string | null;
  /**
   * More than 8 left cannot sit at one game (ruling 32): they are drawn onto tables of up to 8 that play at the same
   * time, and the last one holding cards at each table is out. `heats` are those tables; `heatLosers` who went at each.
   */
  readonly heats?: readonly (readonly string[])[] | null;
  readonly heatLosers?: readonly (string | null)[];
  readonly round?: number;
}

/** The most players at one game of Switch: two decks (ruling 21). */
const TABLE_MAX = 8;

/** Splits players as evenly as possible onto the fewest tables of up to 8. */
function drawTables(ids: readonly string[], random: RandomSource): string[][] {
  const order = shuffled(ids, random);
  const count = Math.ceil(order.length / TABLE_MAX);
  return Array.from({ length: count }, (_, table) => order.filter((_, index) => index % count === table));
}

function koStart(ids: readonly string[], random: RandomSource = Math.random, round = 1, out: readonly string[] = []): KnockoutPart {
  const heats = ids.length > TABLE_MAX ? drawTables(ids, random) : null;
  return { remaining: ids, out, championId: ids.length === 1 ? ids[0] : null, heats, heatLosers: heats ? heats.map(() => null) : [], round };
}
interface LeagueSlot { readonly id: string; readonly name: string; readonly ids: readonly string[]; readonly played: number; readonly points: Readonly<Record<string, number>>; readonly wins: Readonly<Record<string, number>>; readonly playoffOrder: readonly string[]; readonly deciders: readonly (readonly string[])[] }

export type SeriesState =
  /** Knock Out and the Cup are both head-to-head knockout rounds (ruling 11): win your game to go through. */
  | { readonly kind: "knockout" | "cup"; readonly base: SeriesBase; readonly cup: CupState }
  /** Knock Out with friends (ruling 11): everyone left plays each game, and whoever is left holding cards is out. */
  | { readonly kind: "lastout"; readonly base: SeriesBase; readonly part: KnockoutPart }
  /** A run of ordinary games between the same players: first to N wins, or best of N games. */
  | { readonly kind: "match"; readonly base: SeriesBase; readonly wins: Readonly<Record<string, number>>; readonly matchType: MatchType; readonly games: number; readonly winnerId: string | null }
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

/**
 * `players` defaults to you and the computers. An online table passes its own players (no "me" among them), and then
 * everyone, the host included, is drawn into the leagues at random.
 */
export function startSeries(setup: SeriesSetup, random: RandomSource, id = `series-${Date.now()}-${Math.floor(random() * 1e6).toString(36)}`, given?: readonly Player[]): SeriesState {
  const problem = validateSetup(setup, given ? ONLINE_MAX_PLAYERS[setup.mode] : MAX_COMPUTERS + 1);
  if (problem) throw new Error(problem);
  const players = given ? [...given] : seriesPlayers(setup.opponents, setup.computers);
  if (players.length !== setup.opponents + 1) throw new Error("The players do not match the table.");
  const ids = players.map((player) => player.id);
  const base: SeriesBase = { id, setup, players, games: 0, yourGames: 0, yourWins: 0 };
  switch (setup.mode) {
    case "lastout": return { kind: "lastout", base, part: koStart(ids, random) };
    case "knockout": return setup.knockout === "last-out"
      ? { kind: "lastout", base, part: koStart(ids, random) }
      : { kind: "knockout", base, cup: createCup(players, random) };
    case "cup": return { kind: "cup", base, cup: createCup(players, random) };
    case "match": return { kind: "match", base, wins: Object.fromEntries(ids.map((entry) => [entry, 0])), matchType: setup.matchType as MatchType, games: setup.games as number, winnerId: null };
    case "darts": return { kind: "darts", base, legs: Object.fromEntries(ids.map((entry) => [entry, 0])), sets: Object.fromEntries(ids.map((entry) => [entry, 0])), setsToWin: setup.setsToWin as number, winnerId: null };
    case "dominoes": return { kind: "dominoes", base, totals: Object.fromEntries(ids.map((entry) => [entry, 0])), limit: setup.limit as number, loserId: null, last: {} };
    default: {
      // Your league is always A. The draw puts everyone else in at random. At an online table there is no "you": all are drawn.
      const [firstSize] = leagueSizes(players.length);
      const mine = ids[0] === ME_ID;
      const rest = shuffled(mine ? ids.slice(1) : ids, random);
      const first = mine ? [ME_ID, ...rest.slice(0, firstSize - 1)] : rest.slice(0, firstSize);
      const second = mine ? rest.slice(firstSize - 1) : rest.slice(firstSize);
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
  if (part.heats) {
    const round = part.round ?? 1;
    return part.heats.flatMap((heat, index) => (part.heatLosers?.[index] ? [] : [{ key: `${key}-r${round}-h${index + 1}`, title: `${label ? `${label} round` : "Round"} ${round} · table ${index + 1} of ${part.heats?.length}`, playerIds: heat, playOn: heat.length > 2 }]));
  }
  const left = part.remaining.length;
  const title = left === 2 ? `${label} final · 1 v 1` : `${label} knock out · ${left} players`;
  return [{ key: `${key}-${part.out.length + 1}`, title, playerIds: part.remaining, playOn: left > 2 }];
}

function koApply(part: KnockoutPart, result: GameResult, key = ""): KnockoutPart {
  if (part.heats) {
    const at = Number(/-h(\d+)$/.exec(key)?.[1] ?? 0) - 1;
    const heat = part.heats[at];
    if (!heat) throw new Error("That table is not in this round.");
    const loser = [...result.order].reverse().find((id) => heat.includes(id)) as string;
    const heatLosers = (part.heatLosers ?? part.heats.map(() => null)).map((entry, index) => (index === at ? loser : entry));
    if (heatLosers.some((entry) => !entry)) return { ...part, heatLosers };
    // Every table has finished: everyone left holding cards at a table is out, and the rest are drawn again.
    const gone = heatLosers as string[];
    return koStart(part.remaining.filter((id) => !gone.includes(id)), Math.random, (part.round ?? 1) + 1, [...part.out, ...gone]);
  }
  const loser = [...result.order].reverse().find((id) => part.remaining.includes(id)) as string;
  const remaining = part.remaining.filter((id) => id !== loser);
  return { remaining, out: [...part.out, loser], championId: remaining.length === 1 ? remaining[0] : null, heats: null, heatLosers: [], round: (part.round ?? part.out.length + 1) + 1 };
}

/** Everyone in a knockout part from the winner down: champion, then the last one out, and so on. */
function koOrder(part: KnockoutPart): string[] {
  return [...part.remaining, ...[...part.out].reverse()];
}

export function pendingGames(state: SeriesState): PendingGame[] {
  switch (state.kind) {
    case "match": return state.winnerId ? [] : [{ key: `match-${state.base.games + 1}`, title: matchGameTitle(state), playerIds: state.base.players.map((player) => player.id) }];
    case "darts": return state.winnerId ? [] : [{ key: `darts-${state.base.games + 1}`, title: `Game ${state.base.games + 1}`, playerIds: state.base.players.map((player) => player.id) }];
    case "dominoes": return state.loserId ? [] : [{ key: `dominoes-${state.base.games + 1}`, title: `Game ${state.base.games + 1}`, playerIds: state.base.players.map((player) => player.id) }];
    case "lastout": return state.part.heats
      ? koPending(state.part, "ko", "")
      : koPending(state.part, "ko", "Knock Out").map((game) => ({ ...game, title: state.part.remaining.length === 2 ? "Final · 1 v 1" : `Round ${state.part.round ?? state.part.out.length + 1} · ${state.part.remaining.length} players` }));
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

function matchGameTitle(state: Extract<SeriesState, { kind: "match" }>): string {
  const next = state.base.games + 1;
  if (state.matchType === "first") return `Game ${next}`;
  return next > state.games ? "Deciding game" : `Game ${next} of ${state.games}`;
}

/** First to N: someone reaches N wins. Best of N: someone leads by more than the games left, or after N games is simply ahead. */
function matchWinner(state: Extract<SeriesState, { kind: "match" }>, wins: Readonly<Record<string, number>>, played: number): string | null {
  const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  if (state.matchType === "first") return ranked[0][1] >= state.games ? ranked[0][0] : null;
  const left = Math.max(0, state.games - played);
  return ranked[0][1] - (ranked[1]?.[1] ?? 0) > left ? ranked[0][0] : null;
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
    case "match": {
      const wins = { ...state.wins, [result.winnerId]: state.wins[result.winnerId] + 1 };
      return { ...state, base, wins, winnerId: matchWinner(state, wins, base.games) };
    }
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
    case "lastout": return { ...state, base, part: koApply(state.part, result, key) };
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
    championship: isChampionship && state.championship ? koApply(state.championship, result, key) : state.championship,
    plate: !isChampionship && state.plate ? koApply(state.plate, result, key) : state.plate,
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
    championship: koStart(championshipIds),
    plate: plateIds.length === 0 ? null : koStart(plateIds),
  };
}

export function isSeriesOver(state: SeriesState): boolean {
  switch (state.kind) {
    case "lastout": return koFinished(state.part);
    case "knockout":
    case "cup": return state.cup.championId !== null;
    case "match":
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
    case "lastout": return { winnerId: state.part.championId as string, order: koOrder(state.part) };
    case "knockout":
    case "cup": {
      const champion = state.cup.championId as string;
      // Furthest into the draw is best: players who lasted more rounds rank higher.
      const exitRound = (id: string) => { let last = 0; for (const round of state.cup.rounds) if (round.fixtures.some((f) => f.playerIds.includes(id)) || round.byePlayerId === id) last = round.number; return last; };
      const order = [champion, ...ids.filter((id) => id !== champion).sort((a, b) => exitRound(b) - exitRound(a) || ids.indexOf(a) - ids.indexOf(b))];
      return { winnerId: champion, order };
    }
    case "match": {
      const winnerId = state.winnerId as string;
      const order = [...ids].sort((a, b) => (a === winnerId ? -1 : b === winnerId ? 1 : 0) || state.wins[b] - state.wins[a] || ids.indexOf(a) - ids.indexOf(b));
      return { winnerId, order };
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
    case "match": return [{ heading: `${matchLabel(state.matchType, state.games)} · ${state.base.games} played`, rows: state.base.players.map((player) => ({ id: player.id, name: player.name, main: `${state.wins[player.id]} win${state.wins[player.id] === 1 ? "" : "s"}`, note: "" })).sort((a, b) => state.wins[b.id] - state.wins[a.id]) }];
    case "darts": return [{ heading: `First to ${state.setsToWin} sets`, rows: state.base.players.map((player) => ({ id: player.id, name: player.name, main: `${state.sets[player.id]} set${state.sets[player.id] === 1 ? "" : "s"}`, note: `${state.legs[player.id]} leg${state.legs[player.id] === 1 ? "" : "s"}` })).sort((a, b) => state.sets[b.id] - state.sets[a.id] || state.legs[b.id] - state.legs[a.id]) }];
    case "dominoes": return [{ heading: `First to ${state.limit} loses`, rows: state.base.players.map((player) => ({ id: player.id, name: player.name, main: String(state.totals[player.id]), note: state.last[player.id] === undefined ? "" : `+${state.last[player.id]} last game` })).sort((a, b) => Number(a.main) - Number(b.main)) }];
    case "lastout": return [{ heading: state.part.championId ? (state.base.setup.mode === "lastout" ? "Last One Out" : "Knock Out") : `${state.part.remaining.length} left in`, rows: [...state.part.remaining.map((id) => ({ id, name: name(id), main: state.part.championId ? "Champion" : "In", note: "" })), ...[...state.part.out].reverse().map((id) => ({ id, name: name(id), main: "Out", note: "", out: true }))] }];
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
