import type { ComputerLevel } from "./ai";
import { addComputerGame, ensureMe, getComputerGames, newGameId, setSeriesResult, type OnlineGame, type RivalPlace, type SeriesResult } from "./computerLog";
import type { PlayMode } from "./series";
import { updateClub } from "./clubStore";
import { addNight, createNightRecord, type NightCompletion } from "./history";
import { ensureProfiles } from "./profiles";
import type { ScoreFormat } from "./scoring";
import type { Player } from "./types";

/**
 * Saves one finished competitive game against the computer to this phone's club, under the player who is "me".
 * Pass the game's own `id`: saving the same id again replaces the entry, so a game can never be counted twice.
 * Guided practice in Learn the Rules never calls this: practice is unranked.
 */
export function logComputerGame(game: { id?: string; opponents: number; level: ComputerLevel; won: boolean; place: number; moves: number; mode?: PlayMode; seriesId?: string; rivals?: readonly RivalPlace[]; online?: OnlineGame }): void {
  const { id = newGameId(), ...rest } = game;
  updateClub((extensions) => {
    const ensured = ensureMe(extensions);
    const already = getComputerGames(ensured.extensions).find((entry) => entry.id === id);
    if (already) return extensions;
    return addComputerGame(ensured.extensions, { id, playedAt: new Date().toISOString(), playerId: ensured.me.id, ...rest });
  });
}

const ONLINE_FORMATS: Record<PlayMode, { format: ScoreFormat; label: string }> = {
  single: { format: "head-to-head", label: "Switch" }, match: { format: "head-to-head", label: "Switch" }, lastout: { format: "knockout", label: "Last One Out" }, knockout: { format: "knockout", label: "Knock Out" }, group: { format: "league", label: "Group Play" },
  cup: { format: "cup", label: "Switch Cup" }, darts: { format: "darts", label: "Darts" }, dominoes: { format: "domino", label: "Dominoes" },
};

/**
 * A game played online by two or more real people is a night in the club too, so it shows in the club's history, stats and
 * leaderboards for everyone who sat at the table, whoever won (a computer winning is a loss for each person). Its id comes
 * from the game, so every phone that saves it makes the same night and the shared club keeps one copy.
 */
export function logOnlineNight(game: { gameId: string; code: string; mode: PlayMode; finishedAt: number; seats: readonly { name: string; kind: "human" | "computer"; place: number }[] }): void {
  const people = game.seats.filter((seat) => seat.kind === "human");
  if (people.length < 2) return;
  const { format, label } = ONLINE_FORMATS[game.mode];
  updateClub((extensions) => {
    const me = ensureMe(extensions);
    const ensured = ensureProfiles(me.extensions, people.slice(1).map((seat) => seat.name));
    const ids = new Map(people.slice(1).map((seat, index) => [seat.name, ensured.players[index].id]));
    const players: Player[] = game.seats.map((seat, index) => ({ id: index === 0 ? me.me.id : seat.kind === "human" ? ids.get(seat.name) ?? `online-${seat.name}` : `cpu-${seat.name.toLowerCase()}`, name: index === 0 ? me.me.name : seat.name }));
    const winner = game.seats.findIndex((seat) => seat.place === 1);
    const ranked = game.seats.map((seat, index) => ({ seat, player: players[index] })).sort((a, b) => a.seat.place - b.seat.place);
    const completion: NightCompletion = {
      format, formatLabel: label, players, winnerIds: winner >= 0 ? [players[winner].id] : [],
      outcome: winner >= 0 ? `${players[winner].name} won` : "No winner",
      details: [{ heading: "Finishing order", lines: ranked.map((entry) => `${entry.seat.place}. ${entry.player.name}${entry.seat.kind === "computer" ? " (computer)" : ""}`) }],
    };
    const night = createNightRecord(`Online ${label} · table ${game.code}`, completion, new Date(game.finishedAt).toISOString(), `online-${game.gameId}`);
    return addNight(ensured.extensions, night);
  });
}

/** When a tournament or match ends, writes its result onto the last game you played in it so it counts in stats, badges and trophies. */
export function logSeriesResult(lastGameId: string, result: SeriesResult): void {
  updateClub((extensions) => setSeriesResult(extensions, lastGameId, result));
}
