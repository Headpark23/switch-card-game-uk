import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY } from "./storage";

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
