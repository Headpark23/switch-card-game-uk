// The rules for combining two copies of a club. The server uses them to fold each phone's copy into the shared one,
// and every phone uses them to fold the shared copy into its own. Nothing is ever dropped: players, nights and seasons
// are matched by id, and where both copies have the same player the more recently changed one wins.
// A night someone deleted is remembered in `removed` so it does not come back from another phone.

export const MAX_PROFILES = 80;
export const MAX_NIGHTS = 400;
export const MAX_SEASONS = 40;
export const MAX_REMOVED = 400;

const byId = (list) => (Array.isArray(list) ? list.filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id) : []);
const stamp = (profile) => (typeof profile?.updatedAt === "number" ? profile.updatedAt : 0);

/** Demo data and the automatic "You" player never leave a phone. */
export const isShareable = (item) => !String(item?.id ?? "").startsWith("demo-") && String(item?.name ?? "").trim().toLowerCase() !== "you";

function newerProfile(a, b) {
  if (stamp(a) !== stamp(b)) return stamp(a) > stamp(b) ? a : b;
  // Same moment (or neither stamped): a player archived on either side stays archived, so a merge never resurrects one.
  return a.archived ? a : b.archived ? b : a;
}

function preferSeason(a, b) {
  if (b.status === "complete" && a.status !== "complete") return b;
  if (a.status === "complete" && b.status !== "complete") return a;
  return (b.nightIds?.length ?? -1) > (a.nightIds?.length ?? -1) ? b : a;
}

function union(a, b, pick) {
  const map = new Map();
  for (const item of byId(b)) map.set(item.id, item);
  for (const item of byId(a)) map.set(item.id, map.has(item.id) ? pick(item, map.get(item.id)) : item);
  return [...map.values()];
}

/** @returns {{ name: string, nameAt: number, profiles: object[], nights: object[], seasons: object[], removed: string[] }} */
export function mergeClub(a, b) {
  const removed = [...new Set([...(Array.isArray(a?.removed) ? a.removed : []), ...(Array.isArray(b?.removed) ? b.removed : [])].filter((id) => typeof id === "string"))].slice(-MAX_REMOVED);
  const gone = new Set(removed);
  const aAt = typeof a?.nameAt === "number" ? a.nameAt : 0;
  const bAt = typeof b?.nameAt === "number" ? b.nameAt : 0;
  const named = bAt > aAt ? b : a;
  const nights = union(a?.nights, b?.nights, (left) => left).filter((night) => !gone.has(night.id))
    .sort((x, y) => Date.parse(y.completedAt) - Date.parse(x.completedAt)).slice(0, MAX_NIGHTS);
  return {
    name: typeof named?.name === "string" ? named.name : "",
    nameAt: Math.max(aAt, bAt),
    profiles: union(a?.profiles, b?.profiles, newerProfile).slice(0, MAX_PROFILES),
    nights,
    seasons: union(a?.seasons, b?.seasons, preferSeason).slice(0, MAX_SEASONS),
    removed,
  };
}
