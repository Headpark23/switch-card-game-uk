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

/** True when this round is the final: one match and nobody waiting on a bye. */
export function isCupFinal(round: CupRound): boolean {
  return round.fixtures.length === 1 && !round.byePlayerId;
}

/** Clears a result in the current round so the right winner can be tapped instead. */
export function clearCupResult(state: CupState, fixtureId: string): CupState {
  if (state.championId) throw new Error("Undo the champion first.");
  const roundIndex = state.rounds.length - 1;
  const round = state.rounds[roundIndex];
  if (!round.fixtures.some((entry) => entry.id === fixtureId)) throw new Error("Only results in the current round can be changed.");
  const fixtures = round.fixtures.map((entry) => entry.id === fixtureId ? { ...entry, winnerId: null } : entry);
  return { ...state, rounds: state.rounds.map((entry, index) => index === roundIndex ? { ...round, fixtures } : entry) };
}

/** What "Undo" would take back now: the champion, or a round drawn before any of its games were played. */
export function cupUndoStep(state: CupState): "champion" | "draw" | null {
  if (state.championId) return "champion";
  const round = state.rounds.at(-1) as CupRound;
  if (state.rounds.length > 1 && round.fixtures.every((fixture) => !fixture.winnerId)) return "draw";
  return null;
}

/** Steps the Cup back one stage, keeping every result already entered in earlier rounds. */
export function undoCupStep(state: CupState): CupState {
  const step = cupUndoStep(state);
  if (step === "champion") return { ...state, championId: null };
  if (step === "draw") return { ...state, rounds: state.rounds.slice(0, -1) };
  throw new Error("Nothing to undo yet. Tap Change beside a result to fix it.");
}
