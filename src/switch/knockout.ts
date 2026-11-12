import type { Player } from "./types";

export interface KnockoutState {
  readonly players: readonly Player[];
  readonly eliminatedIds: readonly string[];
  readonly championId: string | null;
}

export function createKnockout(players: readonly Player[]): KnockoutState {
  if (players.length < 3 || players.length > 6) throw new Error("LOST knockout supports three to six players.");
  return { players: [...players], eliminatedIds: [], championId: null };
}

export function markLost(state: KnockoutState, playerId: string): KnockoutState {
  if (!state.players.some((player) => player.id === playerId)) throw new Error("That player is not in this knockout.");
  if (state.eliminatedIds.includes(playerId)) throw new Error("That player has already LOST.");
  if (state.championId) throw new Error("This knockout already has a champion.");
  const eliminatedIds = [...state.eliminatedIds, playerId];
  const active = state.players.filter((player) => !eliminatedIds.includes(player.id));
  return { ...state, eliminatedIds, championId: active.length === 1 ? active[0].id : null };
}

export function undoKnockout(state: KnockoutState): KnockoutState {
  if (state.eliminatedIds.length === 0) return state;
  return { ...state, eliminatedIds: state.eliminatedIds.slice(0, -1), championId: null };
}

/** Most players a tournament night can hold: four leagues of six. */
export const MAX_PLAYOFF_PLAYERS = 24;

/** League play-off groups (the championship and the plate) are knockouts too: one drops out each game. Four leagues of six put sixteen in the plate. */
export function createPlayoffKnockout(players: readonly Player[]): KnockoutState {
  if (players.length < 2 || players.length > MAX_PLAYOFF_PLAYERS) throw new Error(`A play-off knockout needs two to ${MAX_PLAYOFF_PLAYERS} players.`);
  return { players: [...players], eliminatedIds: [], championId: null };
}
