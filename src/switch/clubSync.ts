import { isShareable, mergeClub, type ClubDoc } from "../../api/_clubMerge.js";
import { CLUB_WRITTEN, readClub, updateClub } from "./clubStore";
import { getClubName, getClubNameStamp, putSharedClubName } from "./club";
import { getComputerGames } from "./computerLog";
import { getHistory, REMOVED_NIGHTS_KEY } from "./history";
import { claimMe, mergeProfiles } from "./identity";
import { ensureProfiles, getProfiles, putProfiles, type LocalProfile } from "./profiles";
import { getSeasons } from "./seasons";
import { trackFeature } from "./telemetry";

type Extensions = Record<string, unknown>;

/**
 * A shared club. Every phone keeps its own copy of the club and exchanges it with one shared copy held under a short code.
 * Players, saved nights and seasons are matched by id and combined, so nothing is lost. Games against the computer stay private.
 */
export interface ClubLink { readonly code: string; readonly joinedAt: number; readonly lastSyncAt?: number }

const LINK_KEY = "switchClubLink";
export const CLUB_REFRESH = "switch-club-refresh";
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export function loadLink(): ClubLink | null {
  try { const raw = JSON.parse(localStorage.getItem(LINK_KEY) || "null"); return raw && typeof raw.code === "string" && /^[A-Z2-9]{8}$/.test(raw.code) ? raw : null; } catch { return null; }
}
function saveLink(link: ClubLink | null) {
  try { if (link) localStorage.setItem(LINK_KEY, JSON.stringify(link)); else localStorage.removeItem(LINK_KEY); } catch { /* storage unavailable */ }
}
export const clubLink = (code: string) => `${window.location.origin}/?club=${code}`;
/** The invitation text. It carries the code too, because on an iPhone a link opens in Safari, which does not share storage with the Home Screen app. */
export const inviteMessage = (code: string) => `Join our Switch club. If you use the Switch app, open it, tap "Join a club" on Home and enter the code ${code}. Or open ${clubLink(code)}`;
/** True in a browser tab on an iPhone or iPad. Such a tab keeps its own saved data, separate from the app on the Home Screen. */
export function inIosBrowserTab(): boolean {
  try {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    return ios && !installed;
  } catch { return false; }
}
export const cleanClubCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

/** This phone's club in the shape the shared copy uses. Demo data and the automatic "You" player stay on the phone. */
export function localDoc(extensions: Extensions): ClubDoc {
  const removed = extensions[REMOVED_NIGHTS_KEY];
  return {
    name: getClubName(extensions), nameAt: getClubNameStamp(extensions),
    profiles: getProfiles(extensions).filter(isShareable), nights: getHistory(extensions).filter(isShareable),
    seasons: getSeasons(extensions).filter(isShareable), removed: Array.isArray(removed) ? removed.filter((id): id is string => typeof id === "string") : [],
  };
}

/** The same club always gives the same text, whatever order its lists happen to be in. */
const byIdOrder = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
const canon = (doc: ClubDoc) => JSON.stringify({ ...doc, profiles: byIdOrder(doc.profiles), nights: byIdOrder(doc.nights), seasons: byIdOrder(doc.seasons), removed: [...doc.removed].sort() });
const fingerprint = (extensions: Extensions) => canon(localDoc(extensions)) + JSON.stringify(byIdOrder(getProfiles(extensions))) + JSON.stringify(extensions.switchMe ?? null);

const isPlaceholder = (profile: LocalProfile) => profile.name.trim().toLowerCase() === "you";

function referenced(extensions: Extensions, id: string): boolean {
  return getHistory(extensions).some((night) => night.players.some((player) => player.id === id))
    || getSeasons(extensions).some((season) => season.profileIds.includes(id))
    || getComputerGames(extensions).some((game) => game.playerId === id);
}

/**
 * Two phones can each have made a player with the same name. Everyone settles on the same one (the oldest) and the
 * others are folded into it, with their nights, seasons and games, so a person is never split in two.
 */
export function converge(extensions: Extensions): Extensions {
  let next = extensions;
  const groups = new Map<string, LocalProfile[]>();
  for (const profile of getProfiles(next)) if (!isPlaceholder(profile)) groups.set(profile.name.trim().toLocaleLowerCase(), [...(groups.get(profile.name.trim().toLocaleLowerCase()) ?? []), profile]);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...others] = [...group].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
    for (const other of others) {
      if (other.archived && !referenced(next, other.id)) continue;
      next = mergeProfiles(next, other.id, keep.id);
    }
    if (keep.archived && group.some((profile) => !profile.archived)) next = putProfiles(next, getProfiles(next).map((profile) => (profile.id === keep.id ? { ...profile, archived: false, updatedAt: Date.now() } : profile)));
  }
  return next;
}

/** Folds the shared club into this phone's copy. Returns the new copy (equal to the old one when nothing was new). */
export function applyClub(extensions: Extensions, remote: ClubDoc): Extensions {
  const local = localDoc(extensions);
  const merged = mergeClub(local, remote);
  let next: Extensions = { ...extensions };
  // Keep what never leaves the phone (demo data, the automatic "You" player) alongside the shared records.
  next = putProfiles(next, [...merged.profiles, ...getProfiles(extensions).filter((profile) => !isShareable(profile))]);
  next.switchNightHistory = [...merged.nights, ...getHistory(extensions).filter((night) => !isShareable(night))];
  next.switchSeasons = [...merged.seasons, ...getSeasons(extensions).filter((season) => !isShareable(season))];
  if (merged.removed.length) next[REMOVED_NIGHTS_KEY] = merged.removed;
  if (merged.name && merged.nameAt > getClubNameStamp(extensions)) next = putSharedClubName(next, merged.name, merged.nameAt);
  return converge(next);
}

/** Says who is holding this phone, by the name they picked on the club's list (or typed, if they were not on it). */
export function claimByName(extensions: Extensions, name: string): Extensions {
  const clean = name.trim();
  const existing = getProfiles(extensions).find((profile) => !profile.archived && same(profile.name, clean));
  if (existing) return claimMe(extensions, existing.id);
  const ensured = ensureProfiles(extensions, [clean]);
  return claimMe(ensured.extensions, ensured.players[0].id);
}

/* ── Talking to the server ── */
async function call(method: "GET" | "POST" | "PUT", code: string | null, doc?: ClubDoc, since?: number): Promise<{ code: string; doc?: ClubDoc; updatedAt: number; unchanged?: boolean }> {
  const query = code ? `?code=${code}${since ? `&since=${since}` : ""}` : "";
  const response = await fetch(`/api/club${query}`, { method, cache: "no-store", headers: { "content-type": "application/json" }, body: doc ? JSON.stringify({ doc }) : undefined });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Club sharing is unavailable right now.");
  return body;
}

let applying = false;
let busy = false;
let lastSent = "";
let lastStamp = 0;

function writeClub(change: (extensions: Extensions) => Extensions): boolean {
  const before = fingerprint(readClub());
  applying = true;
  try { updateClub(change); } finally { applying = false; }
  const changed = fingerprint(readClub()) !== before;
  // Whatever screen is showing reloads, so a new player or night appears without leaving the app.
  if (changed) try { window.dispatchEvent(new Event(CLUB_REFRESH)); } catch { /* no window */ }
  return changed;
}

/** What a stranger holding the code would see before joining: who is in the club, so they can say which one they are. */
export async function previewClub(code: string): Promise<{ name: string; players: string[]; nights: number }> {
  const result = await call("GET", cleanClubCode(code));
  const doc = result.doc;
  const players = (doc?.profiles ?? []).filter((profile) => !profile.archived && isShareable(profile)).map((profile) => String(profile.name));
  return { name: doc?.name ?? "", players, nights: doc?.nights.length ?? 0 };
}

/** Starts sharing this phone's club. Returns the code to give to friends. */
export async function createClub(): Promise<string> {
  const result = await call("POST", null, localDoc(readClub()));
  saveLink({ code: result.code, joinedAt: Date.now(), lastSyncAt: Date.now() });
  lastSent = ""; lastStamp = 0;
  if (result.doc) writeClub((current) => applyClub(current, result.doc as ClubDoc));
  markJoined(result.doc?.name ?? "", "");
  return result.code;
}

/** Joins a club: its players, nights and seasons arrive, and this phone's owner is the player they said they are. */
export async function joinClub(code: string, as: string): Promise<void> {
  const clean = cleanClubCode(code);
  const result = await call("GET", clean);
  saveLink({ code: clean, joinedAt: Date.now() });
  lastSent = ""; lastStamp = 0;
  writeClub((current) => claimByName(applyClub(current, result.doc as ClubDoc), as));
  markJoined(result.doc?.name ?? "", as.trim());
  trackFeature("club_joined");
  // The invitation has done its job: take it out of the address so nothing offers to join again.
  try { const url = new URL(window.location.href); if (url.searchParams.has("club")) { url.searchParams.delete("club"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); } } catch { /* ignore */ }
  await syncClub();
}

let joinWanted = false;
/** Home's "Join a club" button asks the Club screen to open its join form straight away. */
export const wantJoinForm = () => { joinWanted = true; };
export const takeJoinRequest = () => { const wanted = joinWanted; joinWanted = false; return wanted; };

/** Remembered for a few minutes after joining so the "You are in" message survives screens reloading. */
const JOINED_KEY = "switchJustJoined";
export function markJoined(club: string, as: string) { try { sessionStorage.setItem(JOINED_KEY, JSON.stringify({ club, as, at: Date.now() })); } catch { /* private mode */ } }
export function justJoined(): { club: string; as: string } | null {
  try { const raw = JSON.parse(sessionStorage.getItem(JOINED_KEY) || "null"); return raw && Date.now() - raw.at < 5 * 60_000 ? { club: String(raw.club || ""), as: String(raw.as || "") } : null; } catch { return null; }
}
export function clearJoined() { try { sessionStorage.removeItem(JOINED_KEY); } catch { /* private mode */ } }

export function leaveClub() { clearJoined(); saveLink(null); lastSent = ""; lastStamp = 0; }

/**
 * Exchanges this phone's club with the shared one. Sends only when something here has changed, and otherwise just asks
 * whether the shared copy has. Returns true when this phone's club changed, so the screen can refresh.
 */
export async function syncClub(): Promise<boolean> {
  const link = loadLink();
  if (!link || busy) return false;
  busy = true;
  try {
    const local = localDoc(readClub());
    const text = canon(local);
    let result;
    if (text === lastSent && lastStamp) {
      result = await call("GET", link.code, undefined, lastStamp);
      if (result.unchanged) return false;
    } else {
      result = await call("PUT", link.code, local);
      lastSent = text;
    }
    lastStamp = result.updatedAt;
    saveLink({ ...link, lastSyncAt: Date.now() });
    return result.doc ? writeClub((current) => applyClub(current, result.doc as ClubDoc)) : false;
  } finally { busy = false; }
}

let timer: number | undefined;
/** Runs a sync soon after the club is written, so a new player or saved night reaches everyone within seconds. */
export function requestClubSync(onChanged?: () => void) {
  if (!loadLink()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { syncClub().then((changed) => { if (changed) onChanged?.(); }).catch(() => {}); }, 1200);
}

/** Keeps the club in step while the app is open: on launch, when it comes back into view, when the club is written, and every 15 seconds. */
export function startClubSync(onChanged: () => void): () => void {
  const run = () => { syncClub().then((changed) => { if (changed) onChanged(); }).catch(() => {}); };
  const onVisible = () => { if (document.visibilityState === "visible") run(); };
  const onWritten = () => { if (!applying) requestClubSync(onChanged); };
  run();
  const interval = window.setInterval(() => { if (document.visibilityState === "visible") run(); }, 15000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", run);
  window.addEventListener(CLUB_WRITTEN, onWritten);
  window.addEventListener(CLUB_REFRESH, onChanged);
  return () => { window.removeEventListener(CLUB_REFRESH, onChanged); window.clearInterval(interval); window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", run); window.removeEventListener(CLUB_WRITTEN, onWritten); };
}
