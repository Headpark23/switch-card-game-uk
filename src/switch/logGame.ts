import type { ComputerLevel } from "./ai";
import { addComputerGame, ensureMe, newGameId } from "./computerLog";
import { updateClub } from "./clubStore";

/** Saves one finished game against the computer to this phone's club, under the player who is "me". */
export function logComputerGame(game: { opponents: number; level: ComputerLevel; won: boolean; place: number; moves: number }): void {
  updateClub((extensions) => {
    const ensured = ensureMe(extensions);
    return addComputerGame(ensured.extensions, { id: newGameId(), playedAt: new Date().toISOString(), playerId: ensured.me.id, ...game });
  });
}
