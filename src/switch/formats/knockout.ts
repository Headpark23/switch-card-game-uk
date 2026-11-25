import type { Player } from "../engine/types";

/** One finished round of a Last One Out night: who went out, in order, and who was left standing. */
export interface KnockoutRound {
  readonly eliminatedIds: readonly string[];
  readonly winnerId: string;
}

/**
 * Last One Out on the scorekeeper. Each round, whoever finishes last drops out until one player is left: that is a round
 * win. `winsToWin` round wins take the night (absent means one, a one-off game). `eliminatedIds` is the round in play;
 * `rounds` holds the ones already finished. `championId` is the winner of the whole night.
 */
export interface KnockoutState {
  readonly players: readonly Player[];
  readonly eliminatedIds: readonly string[];
  readonly championId: string | null;
  readonly winsToWin?: number;
  readonly rounds?: readonly KnockoutRound[];
}

export const MAX_ROUNDS_TO_WIN = 9;

export function createKnockout(players: readonly Player[], winsToWin = 1): KnockoutState {
  if (players.length < 3 || players.length > 6) throw new Error("Last One Out supports three to six players.");
  if (!Number.isInteger(winsToWin) || winsToWin < 1 || winsToWin > MAX_ROUNDS_TO_WIN) throw new Error(`Choose 1 to ${MAX_ROUNDS_TO_WIN} round wins.`);
  return { players: [...players], eliminatedIds: [], championId: null, winsToWin };
}

export const roundsToWin = (state: KnockoutState): number => state.winsToWin ?? 1;

/** Whoever is left standing in the round in play, once everyone else has gone out. */
export function roundWinnerId(state: KnockoutState): string | null {
  const active = state.players.filter((player) => !state.eliminatedIds.includes(player.id));
  return active.length === 1 ? active[0].id : null;
}

/** Round wins so far, counting the round in play if it has just been decided. */
export function roundWins(state: KnockoutState): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(state.players.map((player) => [player.id, 0]));
  for (const round of state.rounds ?? []) wins[round.winnerId] = (wins[round.winnerId] ?? 0) + 1;
  const current = roundWinnerId(state);
  if (current) wins[current] = (wins[current] ?? 0) + 1;
  return wins;
}

/** A round has been decided but the night has not: the next round can be dealt. */
export function canStartNextRound(state: KnockoutState): boolean {
  return !state.championId && roundWinnerId(state) !== null;
}

export function markLost(state: KnockoutState, playerId: string): KnockoutState {
  if (!state.players.some((player) => player.id === playerId)) throw new Error("That player is not in this knockout.");
  if (state.eliminatedIds.includes(playerId)) throw new Error("That player has already LOST.");
  if (state.championId) throw new Error("This knockout already has a champion.");
  if (roundWinnerId(state)) throw new Error("This round is already won. Start the next round.");
  const eliminatedIds = [...state.eliminatedIds, playerId];
  const next = { ...state, eliminatedIds };
  const winner = roundWinnerId(next);
  return { ...next, championId: winner && roundWins(next)[winner] >= roundsToWin(state) ? winner : null };
}

/** Everyone is back in for the next round. */
export function startNextRound(state: KnockoutState): KnockoutState {
  const winnerId = roundWinnerId(state);
  if (!winnerId || state.championId) throw new Error("This round is not finished.");
  return { ...state, eliminatedIds: [], championId: null, rounds: [...(state.rounds ?? []), { eliminatedIds: state.eliminatedIds, winnerId }] };
}

export function undoKnockout(state: KnockoutState): KnockoutState {
  if (state.eliminatedIds.length > 0) return { ...state, eliminatedIds: state.eliminatedIds.slice(0, -1), championId: null };
  const rounds = state.rounds ?? [];
  if (rounds.length === 0) return state;
  // Back into the finished round before this one, so its last result can be corrected.
  return { ...state, eliminatedIds: rounds[rounds.length - 1].eliminatedIds, championId: null, rounds: rounds.slice(0, -1) };
}

/** Most players a tournament night can hold: four leagues of six. */
export const MAX_PLAYOFF_PLAYERS = 24;

/** League play-off groups (the championship and the plate) are knockouts too: one drops out each game. Four leagues of six put sixteen in the plate. */
export function createPlayoffKnockout(players: readonly Player[]): KnockoutState {
  if (players.length < 2 || players.length > MAX_PLAYOFF_PLAYERS) throw new Error(`A play-off knockout needs two to ${MAX_PLAYOFF_PLAYERS} players.`);
  return { players: [...players], eliminatedIds: [], championId: null };
}
