import { getComputerGames, getMeId, putMeId } from "./computerLog";
import { getHistory } from "./history";
import { getProfiles, putProfiles } from "./profiles";

type Extensions = Readonly<Record<string, unknown>>;

const GAMES_KEY = "switchComputerGames";
const HISTORY_KEY = "switchNightHistory";
const SEASONS_KEY = "switchSeasons";
const isPlaceholder = (name: string) => name.trim().toLowerCase() === "you";

/**
 * Folds one saved player into another: their computer games, nights and season places all move across,
 * and the old name is archived. Used when the person holding the phone turns out to be someone already saved.
 */
export function mergeProfiles(extensions: Extensions, fromId: string, intoId: string): Record<string, unknown> {
  if (fromId === intoId) return { ...extensions };
  const profiles = getProfiles(extensions);
  const into = profiles.find((profile) => profile.id === intoId);
  if (!into || !profiles.some((profile) => profile.id === fromId)) return { ...extensions };
  const next: Record<string, unknown> = { ...extensions };
  next[GAMES_KEY] = getComputerGames(extensions).map((game) => (game.playerId === fromId ? { ...game, playerId: intoId } : game));
  if (Array.isArray(extensions[HISTORY_KEY])) {
    next[HISTORY_KEY] = getHistory(extensions).map((night) => {
      if (!night.players.some((player) => player.id === fromId) || night.players.some((player) => player.id === intoId)) return night;
      return {
        ...night,
        players: night.players.map((player) => (player.id === fromId ? { id: intoId, name: into.name } : player)),
        winnerIds: night.winnerIds.map((id) => (id === fromId ? intoId : id)),
      };
    });
  }
  if (Array.isArray(extensions[SEASONS_KEY])) {
    next[SEASONS_KEY] = (extensions[SEASONS_KEY] as Record<string, unknown>[]).map((season) => {
      const ids = Array.isArray(season?.profileIds) ? (season.profileIds as string[]) : null;
      if (!ids || !ids.includes(fromId)) return season;
      return { ...season, profileIds: ids.includes(intoId) ? ids.filter((id) => id !== fromId) : ids.map((id) => (id === fromId ? intoId : id)) };
    });
  }
  const merged = putProfiles(next, profiles.map((profile) => (profile.id === fromId ? { ...profile, archived: true } : profile)));
  return getMeId(extensions) === fromId ? putMeId(merged, intoId) : merged;
}

/**
 * Says who is holding this phone. Anything played before they named themselves sits under the
 * automatic "You" player, so that comes with them rather than being left behind.
 */
export function claimMe(extensions: Extensions, profileId: string): Record<string, unknown> {
  let next: Record<string, unknown> = putMeId(extensions, profileId);
  for (const profile of getProfiles(next)) {
    if (profile.id !== profileId && isPlaceholder(profile.name)) next = mergeProfiles(next, profile.id, profileId);
  }
  return putMeId(next, profileId);
}

/**
 * Repairs phones where games were left on the automatic "You" player after the owner picked their real
 * name. Returns null when there is nothing to fix.
 */
export function recoverMyGames(extensions: Extensions): Record<string, unknown> | null {
  const meId = getMeId(extensions);
  if (!meId) return null;
  const me = getProfiles(extensions).find((profile) => profile.id === meId);
  if (!me || isPlaceholder(me.name)) return null;
  const strays = getProfiles(extensions).filter((profile) => profile.id !== meId && isPlaceholder(profile.name));
  const games = getComputerGames(extensions);
  if (!strays.some((profile) => games.some((game) => game.playerId === profile.id) || !profile.archived)) return null;
  return claimMe(extensions, meId);
}
