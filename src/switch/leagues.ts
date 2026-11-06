import type { Player, RandomSource } from "./types";

export interface LeagueResult { readonly player: Player; readonly points: number }
export interface League { readonly id: string; readonly name: string; readonly results: readonly LeagueResult[] }
export interface LeagueStanding extends LeagueResult { readonly rank: number }
export interface PlayoffEntrant { readonly player: Player; readonly leagueId: string; readonly seed: number }
export interface PlayoffFixture { readonly id: string; readonly home: PlayoffEntrant; readonly away: PlayoffEntrant }
export interface PlayoffBracket { readonly entrants: readonly PlayoffEntrant[]; readonly fixtures: readonly PlayoffFixture[] }

export function rankLeague(results: readonly LeagueResult[]): LeagueStanding[] {
  return results
    .map((result, index) => ({ result, index }))
    .sort((left, right) => right.result.points - left.result.points || left.index - right.index)
    .map(({ result }, index) => ({ ...result, rank: index + 1 }));
}

function bracketFor(leagues: readonly League[], positions: readonly [number, number], label: string): PlayoffBracket {
  const first = leagues.map((league) => ({ player: rankLeague(league.results)[positions[0]].player, leagueId: league.id, seed: positions[0] + 1 }));
  const second = leagues.map((league) => ({ player: rankLeague(league.results)[positions[1]].player, leagueId: league.id, seed: positions[1] + 1 }));
  const away = second.map((_, index) => second[(index + 1) % second.length]);
  const fixtures = first.map((home, index) => ({ id: `${label}-${index + 1}`, home, away: away[index] }));
  return { entrants: [...first, ...second], fixtures };
}

export function createCrossLeaguePlayoffs(leagues: readonly League[], random: RandomSource):
  | { readonly status: "not-ready"; readonly reason: string }
  | { readonly status: "ready"; readonly championship: PlayoffBracket; readonly plate: PlayoffBracket } {
  void random;
  if (leagues.length < 2 || leagues.length > 4) return { status: "not-ready", reason: "Choose two to four leagues." };
  if (leagues.some((league) => rankLeague(league.results).length < 4)) return { status: "not-ready", reason: "Each league needs four completed entrants." };
  return {
    status: "ready",
    championship: bracketFor(leagues, [0, 1], "championship"),
    plate: bracketFor(leagues, [2, 3], "plate"),
  };
}
