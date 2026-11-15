/**
 * Cloud sync for the club. The whole saved document travels as one backup file.
 * Merging is by id, so signing in on a second phone combines clubs instead of
 * overwriting one with the other. Players, nights and seasons are never dropped.
 *
 * Known limit: because merging is a union, a night deleted on one phone can come
 * back from another phone that still has it.
 */
import { getMeId, putMeId } from "./computerLog";
import { claimMe, mergeProfiles } from "./identity";
import { getProfiles, putProfiles } from "./profiles";

type Extensions = Record<string, unknown>;

const LIST_KEYS = ["switchProfiles", "switchSeasons", "switchNightHistory", "switchComputerGames"] as const;
/** Single values where this phone wins, and a second phone fills the gap. */
const VALUE_KEYS = ["switchClub", "switchMe", "switchLastPlace", "switchAccountMe"] as const;
/**
 * Which saved player is "me" for the whole account. Every phone and browser makes its own "You" the first time it is
 * used, so without this a signed-in person's games sit under a different player on each device and each device only
 * counts its own. The first device to sync sets it; every other device folds its own "me" into it.
 */
const ACCOUNT_ME_KEY = "switchAccountMe";
const isPlaceholder = (name: string) => name.trim().toLowerCase() === "you";

export interface SyncDocument {
  readonly schemaVersion: 1;
  readonly extensions: Extensions;
  readonly [key: string]: unknown;
}

function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") : [];
}

function mergeById(local: unknown, remote: unknown): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of asList(remote)) byId.set(item.id as string, item);
  // The copy on this phone wins when both sides have the same id.
  for (const item of asList(local)) {
    const other = byId.get(item.id as string);
    byId.set(item.id as string, other ? preferSeason(item, other) : item);
  }
  return [...byId.values()];
}

/** For a season on both sides, keep the one with more counted nights (or the finished one). */
function preferSeason(local: Record<string, unknown>, remote: Record<string, unknown>) {
  const localNights = Array.isArray(local.nightIds) ? local.nightIds.length : -1;
  const remoteNights = Array.isArray(remote.nightIds) ? remote.nightIds.length : -1;
  if (remote.status === "complete" && local.status !== "complete") return remote;
  if (local.status === "complete" && remote.status !== "complete") return local;
  return remoteNights > localNights ? remote : local;
}

export function mergeDocuments(local: SyncDocument, remote: SyncDocument): SyncDocument {
  const extensions: Extensions = { ...remote.extensions, ...local.extensions };
  for (const key of LIST_KEYS) {
    const merged = mergeById(local.extensions[key], remote.extensions[key]);
    if (merged.length) extensions[key] = merged;
  }
  for (const key of VALUE_KEYS) {
    extensions[key] = local.extensions[key] ?? remote.extensions[key];
    if (extensions[key] === undefined) delete extensions[key];
  }
  return { ...local, extensions: unifyIdentity(extensions, local.extensions, remote.extensions) };
}

/**
 * Makes the account one person. When this device's "me" and the account's "me" are different saved players, the games,
 * nights and seasons of one are moved onto the other, so the stats on every device add up to the same total.
 * A real name beats the automatic "You"; otherwise the account's player stays, so every device settles on the same one.
 */
export function unifyIdentity(merged: Extensions, local: Extensions, remote: Extensions): Extensions {
  const localMe = getMeId(local);
  const remoteAccount = typeof remote[ACCOUNT_ME_KEY] === "string" ? (remote[ACCOUNT_ME_KEY] as string) : getMeId(remote);
  const profiles = getProfiles(merged);
  const nameOf = (id: string | null) => profiles.find((profile) => profile.id === id)?.name ?? "";
  let account = remoteAccount && profiles.some((profile) => profile.id === remoteAccount) ? remoteAccount : localMe;
  if (!account) return merged;
  let next: Extensions = merged;
  if (localMe && localMe !== account) {
    const keepLocal = isPlaceholder(nameOf(account)) && !isPlaceholder(nameOf(localMe));
    const [from, into] = keepLocal ? [account, localMe] : [localMe, account];
    // The player being kept must be visible, or the games would move onto someone hidden.
    next = putProfiles(next, getProfiles(next).map((profile) => (profile.id === into && profile.archived ? { ...profile, archived: false, updatedAt: Date.now() } : profile)));
    next = mergeProfiles(next, from, into);
    account = into;
  }
  // Any other automatic "You" left behind by a third device joins the same person.
  next = claimMe(next, account);
  return { ...putMeId(next, account), [ACCOUNT_ME_KEY]: account };
}

export function hasClubData(doc: SyncDocument): boolean {
  return LIST_KEYS.some((key) => asList(doc.extensions[key]).length > 0);
}

/** Two documents describe the same club when every list holds the same ids. */
export function sameClub(a: SyncDocument, b: SyncDocument): boolean {
  return LIST_KEYS.every((key) => {
    const left = asList(a.extensions[key]).map((item) => item.id).sort().join("|");
    const right = asList(b.extensions[key]).map((item) => item.id).sort().join("|");
    return left === right;
  }) && VALUE_KEYS.every((key) => JSON.stringify(a.extensions[key] ?? null) === JSON.stringify(b.extensions[key] ?? null));
}

export function isSyncDocument(value: unknown): value is SyncDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as { schemaVersion?: unknown; extensions?: unknown };
  return doc.schemaVersion === 1 && !!doc.extensions && typeof doc.extensions === "object" && !Array.isArray(doc.extensions);
}
