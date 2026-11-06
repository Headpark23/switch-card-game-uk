import type { Player, RandomSource } from "./types";

export interface CupFixture { readonly id: string; readonly playerIds: readonly [string, string]; readonly winnerId: string | null }
export interface CupRound { readonly number: number; readonly fixtures: readonly CupFixture[]; readonly byePlayerId: string | null }
export interface CupState { readonly players: readonly Player[]; readonly rounds: readonly CupRound[]; readonly championId: string | null }

function shuffle(ids: readonly string[], random: RandomSource): string[] {
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.max(0, Math.min(0.999999, random())) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function createRound(ids: readonly string[], number: number, random: RandomSource): CupRound {
  const drawn = shuffle(ids, random);
  const byePlayerId = drawn.length % 2 === 1 ? drawn.shift() ?? null : null;
  const fixtures: CupFixture[] = [];
  for (let index = 0; index < drawn.length; index += 2) {
    fixtures.push({ id: `round-${number}-match-${fixtures.length + 1}`, playerIds: [drawn[index], drawn[index + 1]], winnerId: null });
  }
  return { number, fixtures, byePlayerId };
}

export function createCup(players: readonly Player[], random: RandomSource): CupState {
  if (players.length < 2 || players.length > 10) throw new Error("Switch Cup supports two to ten players.");
  return { players: [...players], rounds: [createRound(players.map((player) => player.id), 1, random)], championId: null };
}

export function selectCupWinner(state: CupState, fixtureId: string, playerId: string): CupState {
  if (state.championId) throw new Error("This Cup already has a champion.");
  const roundIndex = state.rounds.length - 1;
  const round = state.rounds[roundIndex];
  const fixture = round.fixtures.find((entry) => entry.id === fixtureId);
  if (!fixture) throw new Error("That fixture is not in the current round.");
  if (!fixture.playerIds.includes(playerId)) throw new Error("Only a player in this fixture can win it.");
  const fixtures = round.fixtures.map((entry) => entry.id === fixtureId ? { ...entry, winnerId: playerId } : entry);
  const rounds = state.rounds.map((entry, index) => index === roundIndex ? { ...round, fixtures } : entry);
  return { ...state, rounds };
}

export function drawNextCupRound(state: CupState, random: RandomSource): CupState {
  const round = state.rounds.at(-1) as CupRound;
  if (round.fixtures.some((fixture) => !fixture.winnerId)) throw new Error("Complete all fixtures before drawing the next round.");
  const advancing = [...round.fixtures.map((fixture) => fixture.winnerId as string), ...(round.byePlayerId ? [round.byePlayerId] : [])];
  if (advancing.length === 1) return { ...state, championId: advancing[0] };
  return { ...state, rounds: [...state.rounds, createRound(advancing, round.number + 1, random)] };
}
