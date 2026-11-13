/**
 * Cloud sync for the club. The whole saved document travels as one backup file.
 * Merging is by id, so signing in on a second phone combines clubs instead of
 * overwriting one with the other. Players, nights and seasons are never dropped.
 *
 * Known limit: because merging is a union, a night deleted on one phone can come
 * back from another phone that still has it.
 */
type Extensions = Record<string, unknown>;

const LIST_KEYS = ["switchProfiles", "switchSeasons", "switchNightHistory", "switchComputerGames"] as const;
/** Single values where this phone wins, and a second phone fills the gap. */
const VALUE_KEYS = ["switchClub", "switchMe", "switchLastPlace"] as const;

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
  return { ...local, extensions };
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
