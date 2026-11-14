import type { ComputerLevel } from "./ai";
import { addComputerGame, ensureMe, getComputerGames, newGameId, setSeriesResult, type SeriesResult } from "./computerLog";
import type { PlayMode } from "./series";
import { updateClub } from "./clubStore";

/**
 * Saves one finished competitive game against the computer to this phone's club, under the player who is "me".
 * Pass the game's own `id`: saving the same id again replaces the entry, so a game can never be counted twice.
 * Guided practice in Learn the Rules never calls this: practice is unranked.
 */
export function logComputerGame(game: { id?: string; opponents: number; level: ComputerLevel; won: boolean; place: number; moves: number; mode?: PlayMode; seriesId?: string }): void {
  const { id = newGameId(), ...rest } = game;
  updateClub((extensions) => {
    const ensured = ensureMe(extensions);
    const already = getComputerGames(ensured.extensions).find((entry) => entry.id === id);
    if (already) return extensions;
    return addComputerGame(ensured.extensions, { id, playedAt: new Date().toISOString(), playerId: ensured.me.id, ...rest });
  });
}

/** When a tournament or match ends, writes its result onto the last game you played in it so it counts in stats, badges and trophies. */
export function logSeriesResult(lastGameId: string, result: SeriesResult): void {
  updateClub((extensions) => setSeriesResult(extensions, lastGameId, result));
}
