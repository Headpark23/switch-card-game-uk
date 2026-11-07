import type { Player, RandomSource } from "./types";

export interface LeagueResult { readonly player: Player; readonly points: number; /** Rounds won (finished first). Breaks ties on points. */ readonly wins?: number }
export interface League { readonly id: string; readonly name: string; readonly results: readonly LeagueResult[]; /** Players in the order play-offs put them, best first. Only used to split ties on points and wins. */ readonly playoffOrder?: readonly string[] }
export interface LeagueStanding extends LeagueResult { readonly rank: number; /** Level with a neighbour on points, wins and play-offs: a deciding game is needed. */ readonly tied: boolean }
export interface PlayoffEntrant { readonly player: Player; readonly leagueId: string; readonly seed: number }
export interface PlayoffFixture { readonly id: string; readonly home: PlayoffEntrant; readonly away: PlayoffEntrant }
export interface PlayoffBracket { readonly entrants: readonly PlayoffEntrant[]; readonly fixtures: readonly PlayoffFixture[] }

export function rankLeague(results: readonly LeagueResult[], playoffOrder: readonly string[] = []): LeagueStanding[] {
  const order = (id: string) => { const at = playoffOrder.indexOf(id); return at < 0 ? Number.POSITIVE_INFINITY : at; };
  const sorted = results
    .map((result, index) => ({ result, index }))
    .sort((left, right) => right.result.points - left.result.points
      || (right.result.wins ?? 0) - (left.result.wins ?? 0)
      || order(left.result.player.id) - order(right.result.player.id)
      || left.index - right.index);
  const level = (a: LeagueResult, b: LeagueResult) => a.points === b.points && (a.wins ?? 0) === (b.wins ?? 0) && (order(a.player.id) === order(b.player.id));
  return sorted.map(({ result }, index) => ({
    ...result,
    rank: index + 1,
    tied: (index > 0 && level(sorted[index - 1].result, result)) || (index < sorted.length - 1 && level(sorted[index + 1].result, result)),
  }));
}

/** Pairs of neighbours who still need a deciding game. */
export function playoffsNeeded(league: League): [Player, Player][] {
  const ranked = rankLeague(league.results, league.playoffOrder);
  const pairs: [Player, Player][] = [];
  for (let index = 1; index < ranked.length; index += 1) {
    if (ranked[index].tied && ranked[index - 1].tied && ranked[index - 1].points === ranked[index].points && (ranked[index - 1].wins ?? 0) === (ranked[index].wins ?? 0)) pairs.push([ranked[index - 1].player, ranked[index].player]);
  }
  return pairs;
}

function bracketFor(leagues: readonly League[], positions: readonly [number, number], label: string): PlayoffBracket {
  const first = leagues.map((league) => ({ player: rankLeague(league.results, league.playoffOrder)[positions[0]].player, leagueId: league.id, seed: positions[0] + 1 }));
  const second = leagues.map((league) => ({ player: rankLeague(league.results, league.playoffOrder)[positions[1]].player, leagueId: league.id, seed: positions[1] + 1 }));
  const away = second.map((_, index) => second[(index + 1) % second.length]);
  const fixtures = first.map((home, index) => ({ id: `${label}-${index + 1}`, home, away: away[index] }));
  return { entrants: [...first, ...second], fixtures };
}

export function createCrossLeaguePlayoffs(leagues: readonly League[], random: RandomSource):
  | { readonly status: "not-ready"; readonly reason: string }
  | { readonly status: "ready"; readonly championship: PlayoffBracket; readonly plate: PlayoffBracket } {
  void random;
  if (leagues.length < 2 || leagues.length > 4) return { status: "not-ready", reason: "Choose two to four leagues." };
  const undecided = leagues.flatMap((league) => playoffsNeeded(league).map(([a, b]) => `${a.name} v ${b.name}`));
  if (undecided.length) return { status: "not-ready", reason: `Level on points and wins: play a deciding game (${undecided.join(", ")}).` };
  if (leagues.some((league) => rankLeague(league.results).length < 4)) return { status: "not-ready", reason: "Each league needs four completed entrants." };
  return {
    status: "ready",
    championship: bracketFor(leagues, [0, 1], "championship"),
    plate: bracketFor(leagues, [2, 3], "plate"),
  };
}
