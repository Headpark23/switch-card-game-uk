import type { Player, RandomSource } from "./types";

export interface LeagueResult { readonly player: Player; readonly points: number; /** Rounds won (finished first). Breaks ties on points. */ readonly wins?: number }
export interface League { readonly id: string; readonly name: string; readonly results: readonly LeagueResult[]; /** Players in the order play-offs put them, best first. Only used to split ties on points and wins. */ readonly playoffOrder?: readonly string[] }
export interface LeagueStanding extends LeagueResult { readonly rank: number; /** Level with a neighbour on points, wins and play-offs: a deciding game is needed. */ readonly tied: boolean }
export interface PlayoffEntrant { readonly player: Player; readonly leagueId: string; readonly seed: number }
export interface PlayoffFixture { readonly id: string; readonly home: PlayoffEntrant; readonly away: PlayoffEntrant }
export interface PlayoffBracket { readonly entrants: readonly PlayoffEntrant[]; readonly fixtures: readonly PlayoffFixture[]; /** With an odd number of entrants one player goes straight through. */ readonly bye?: PlayoffEntrant }

/** Same points and same round wins: only a deciding game can separate these players. */
const sameRecord = (a: LeagueResult, b: LeagueResult) => a.points === b.points && (a.wins ?? 0) === (b.wins ?? 0);

/**
 * Groups of players still level after points and round wins whose deciding game has not been
 * recorded. A group is settled only when every member has a place from the deciding game, so a
 * three- or four-way tie is never split by one head-to-head result.
 */
function unresolvedGroups(results: readonly LeagueResult[], playoffOrder: readonly string[]): LeagueResult[][] {
  const groups: LeagueResult[][] = [];
  for (const result of results) {
    const group = groups.find((entry) => sameRecord(entry[0], result));
    if (group) group.push(result); else groups.push([result]);
  }
  return groups.filter((group) => group.length > 1 && group.some((result) => !playoffOrder.includes(result.player.id)));
}

export function rankLeague(results: readonly LeagueResult[], playoffOrder: readonly string[] = []): LeagueStanding[] {
  const order = (id: string) => { const at = playoffOrder.indexOf(id); return at < 0 ? Number.POSITIVE_INFINITY : at; };
  const open = new Set(unresolvedGroups(results, playoffOrder).flat().map((result) => result.player.id));
  // An unsettled group keeps its table order; the deciding-game order only applies once the whole group is settled.
  const deciding = (id: string) => open.has(id) ? Number.POSITIVE_INFINITY : order(id);
  const sorted = results
    .map((result, index) => ({ result, index }))
    .sort((left, right) => right.result.points - left.result.points
      || (right.result.wins ?? 0) - (left.result.wins ?? 0)
      || deciding(left.result.player.id) - deciding(right.result.player.id)
      || left.index - right.index);
  return sorted.map(({ result }, index) => ({ ...result, rank: index + 1, tied: open.has(result.player.id) }));
}

/** Each group of players who need a deciding game, in table order. */
export function tiedGroups(league: League): Player[][] {
  const ranked = rankLeague(league.results, league.playoffOrder);
  const groups = unresolvedGroups(league.results, league.playoffOrder ?? []);
  return groups.map((group) => ranked.filter((entry) => group.some((member) => member.player.id === entry.player.id)).map((entry) => entry.player));
}

/** Neighbouring pairs inside each group that still needs a deciding game. */
export function playoffsNeeded(league: League): [Player, Player][] {
  return tiedGroups(league).flatMap((group) => group.slice(1).map((player, index) => [group[index], player] as [Player, Player]));
}

function bracketFor(leagues: readonly League[], positions: readonly [number, number], label: string): PlayoffBracket {
  const first = leagues.map((league) => ({ player: rankLeague(league.results, league.playoffOrder)[positions[0]].player, leagueId: league.id, seed: positions[0] + 1 }));
  const second = leagues.map((league) => ({ player: rankLeague(league.results, league.playoffOrder)[positions[1]].player, leagueId: league.id, seed: positions[1] + 1 }));
  const away = second.map((_, index) => second[(index + 1) % second.length]);
  const fixtures = first.map((home, index) => ({ id: `${label}-${index + 1}`, home, away: away[index] }));
  return { entrants: [...first, ...second], fixtures };
}

/** Everyone ranked third or lower, best first. Each plays someone from another league where possible; an odd one out gets a bye. */
function plateFor(leagues: readonly League[]): PlayoffBracket {
  const pool: PlayoffEntrant[] = [];
  const deepest = Math.max(...leagues.map((league) => league.results.length));
  for (let place = 2; place < deepest; place += 1) {
    for (const league of leagues) {
      const entry = rankLeague(league.results, league.playoffOrder)[place];
      if (entry) pool.push({ player: entry.player, leagueId: league.id, seed: place + 1 });
    }
  }
  const entrants = [...pool];
  const fixtures: PlayoffFixture[] = [];
  let bye: PlayoffEntrant | undefined;
  while (pool.length) {
    const home = pool.shift() as PlayoffEntrant;
    if (!pool.length) { bye = home; break; }
    let at = pool.length - 1;
    for (let index = pool.length - 1; index >= 0; index -= 1) if (pool[index].leagueId !== home.leagueId) { at = index; break; }
    const [away] = pool.splice(at, 1);
    fixtures.push({ id: `plate-${fixtures.length + 1}`, home, away });
  }
  return { entrants, fixtures, ...(bye ? { bye } : {}) };
}

export function createCrossLeaguePlayoffs(leagues: readonly League[], random: RandomSource):
  | { readonly status: "not-ready"; readonly reason: string }
  | { readonly status: "ready"; readonly championship: PlayoffBracket; readonly plate: PlayoffBracket } {
  void random;
  if (leagues.length < 1 || leagues.length > 4) return { status: "not-ready", reason: "Choose one to four leagues." };
  const undecided = leagues.flatMap((league) => tiedGroups(league).map((group) => group.map((player) => player.name).join(" v ")));
  if (undecided.length) return { status: "not-ready", reason: `Level on points and wins: play a deciding game (${undecided.join(", ")}).` };
  if (leagues.some((league) => rankLeague(league.results).length < 3)) return { status: "not-ready", reason: "Each league needs at least three entrants." };
  return {
    status: "ready",
    championship: bracketFor(leagues, [0, 1], "championship"),
    plate: plateFor(leagues),
  };
}
