import { getProfiles, putProfiles, type LocalProfile } from "./profiles";
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY } from "./storage";
import type { Player } from "../engine/types";

type Extensions = Record<string, unknown>;

/** Fired whenever the club is saved, so a shared club can send the change to everyone straight away. */
export const CLUB_WRITTEN = "switch-club-written";
export const announceClubWritten = () => { try { window.dispatchEvent(new Event(CLUB_WRITTEN)); } catch { /* no window */ } };

/** Reads the club (players, nights, computer games) straight from this phone's storage. */
export function readClub(): Extensions {
  try {
    return { ...loadScorekeeper(window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY)).state.extensions };
  } catch {
    return {};
  }
}

const sameValue = (left: unknown, right: unknown) => left === right || JSON.stringify(left) === JSON.stringify(right);

/**
 * A screen that read the club earlier (`base`) and now wants it to be `intended` writes only what it changed onto the
 * club as it is now (`current`). Anything saved elsewhere in the meantime (another tab, a club sync, a joined night)
 * is kept, so a tap on one screen never wipes a game saved by another.
 */
export function applyOwnChanges(base: Extensions, intended: Extensions, current: Extensions): Extensions {
  const next: Extensions = { ...current };
  for (const key of new Set([...Object.keys(base), ...Object.keys(intended)])) {
    if (sameValue(base[key], intended[key])) continue;
    if (key in intended) next[key] = intended[key];
    else delete next[key];
  }
  return next;
}

/**
 * Changes the club and saves it. Screens that are not the scorekeeper (the computer games, the Me page)
 * use this so they never touch the scorekeeper's own scores. Unreadable saved data is left alone.
 */
export function updateClub(change: (extensions: Extensions) => Extensions): Extensions {
  try {
    const raw = window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY);
    const loaded = loadScorekeeper(raw);
    if (loaded.status === "unreadable") return {};
    const next = change({ ...loaded.state.extensions });
    window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY, saveScorekeeper(raw, { ...loaded.state, extensions: next }, { replaceExtensions: true }));
    announceClubWritten();
    return next;
  } catch {
    return {};
  }
}

/**
 * Typed names are not club players until a night with them is saved. Starts a night with the new profiles held back:
 * `ensured` is the result of ensureProfiles, `known` the profiles the club had before it.
 */
export function withoutNewProfiles(ensured: Extensions, known: readonly LocalProfile[]): Extensions {
  const have = new Set(known.map((profile) => profile.id));
  return putProfiles(ensured, getProfiles(ensured).filter((profile) => have.has(profile.id)));
}

/** Saving a night is what puts its players on the club roster: adds a profile (same id) for any player the club does not hold yet. */
export function withNightProfiles(extensions: Extensions, list: readonly Player[]): Extensions {
  const have = getProfiles(extensions);
  const colours: LocalProfile["colour"][] = ["forest", "gold", "clay", "navy"];
  const missing = list.filter((player) => player.name.trim() && !have.some((profile) => profile.id === player.id));
  if (!missing.length) return extensions;
  return putProfiles(extensions, [...have, ...missing.map((player, index): LocalProfile => ({ version: 1, id: player.id, name: player.name.trim(), colour: colours[(have.length + index) % colours.length], createdAt: new Date().toISOString(), archived: false }))]);
}
