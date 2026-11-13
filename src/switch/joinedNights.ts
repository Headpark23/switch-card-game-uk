import { readClub, updateClub } from "./clubStore";
import { getMeId } from "./computerLog";
import { addNight, getHistory, type SwitchNightRecord } from "./history";
import { claimMe } from "./identity";
import { ensureProfiles, getProfiles } from "./profiles";
import { fetchShare } from "./shareNight";

type Extensions = Readonly<Record<string, unknown>>;

/** A shared night this phone has joined, and which player on the host's scoreboard is the person holding it. */
export interface JoinedNight {
  readonly code: string;
  readonly joinedAt: number;
  /** Their name as the host typed it. Null means they are only watching, so nothing is saved. */
  readonly as: string | null;
}

const KEY = "switchJoinedNights";
const KEEP_MS = 21 * 24 * 3_600_000;
const same = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

export function loadJoined(now = Date.now()): JoinedNight[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item) => typeof item?.code === "string" && typeof item?.joinedAt === "number" && now - item.joinedAt < KEEP_MS && (item.as === null || typeof item.as === "string")) : [];
  } catch { return []; }
}

export function rememberJoin(code: string, as: string | null): void {
  try {
    const rest = loadJoined().filter((item) => item.code !== code);
    localStorage.setItem(KEY, JSON.stringify([{ code, joinedAt: Date.now(), as }, ...rest].slice(0, 12)));
  } catch { /* storage unavailable */ }
}

export function forgetJoin(code: string): void {
  try { localStorage.setItem(KEY, JSON.stringify(loadJoined().filter((item) => item.code !== code))); } catch { /* storage unavailable */ }
}

/** The saved name of whoever holds this phone, if they have one. */
export function myName(extensions: Extensions): string | null {
  const id = getMeId(extensions);
  return getProfiles(extensions).find((profile) => profile.id === id)?.name ?? null;
}

const ALIAS_KEY = "switchNightAliases";
const isPlaceholder = (name: string) => same(name, "you");

function loadAliases(): string[] {
  try { const raw = JSON.parse(localStorage.getItem(ALIAS_KEY) || "[]"); return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; } catch { return []; }
}

/** Every name the person holding this phone goes by: their saved name, then any other name they picked on a host's scoreboard. */
export function myNames(extensions: Extensions): string[] {
  const mine = myName(extensions);
  return [...(mine && !isPlaceholder(mine) ? [mine] : []), ...loadAliases()];
}

/**
 * Called when someone says which player they are on a shared night. A phone that does not yet know its owner learns it
 * straight away (so the next night or club needs no question), and a different spelling is remembered as another name for them.
 */
export function rememberWho(name: string): void {
  const clean = name.trim();
  if (!clean) return;
  updateClub((current) => {
    const mine = myName(current);
    if (mine && !isPlaceholder(mine)) {
      if (!same(mine, clean) && !loadAliases().some((alias) => same(alias, clean))) {
        try { localStorage.setItem(ALIAS_KEY, JSON.stringify([clean, ...loadAliases()].slice(0, 8))); } catch { /* storage unavailable */ }
      }
      return current;
    }
    const ensured = ensureProfiles(current, [clean]);
    return claimMe(ensured.extensions, ensured.players[0].id);
  });
}

/**
 * Adds a night the host saved to this phone's own history. The player they said they are becomes "me",
 * and everyone else is matched to (or added as) a saved player, so wins, losses, streaks and badges all count here too.
 * Returns null when the night is already saved or they did not play in it.
 */
export function adoptResult(extensions: Extensions, record: SwitchNightRecord, as: string): Record<string, unknown> | null {
  if (getHistory(extensions).some((night) => night.id === record.id)) return null;
  const mine = record.players.find((player) => same(player.name, as));
  if (!mine) return null;
  let next: Record<string, unknown> = { ...extensions };
  let meId = getMeId(next);
  if (!meId) {
    const ensured = ensureProfiles(next, [mine.name]);
    meId = ensured.players[0].id;
    next = claimMe(ensured.extensions, meId);
  }
  const me = getProfiles(next).find((profile) => profile.id === meId);
  if (!me) return null;
  const ids = new Map<string, { id: string; name: string }>([[mine.id, { id: me.id, name: me.name }]]);
  for (const player of record.players) {
    if (player.id === mine.id) continue;
    try {
      const ensured = ensureProfiles(next, [player.name]);
      // Someone else with my name stays as the host wrote them, so their result is never counted as mine.
      if (ensured.players[0].id === me.id) continue;
      next = ensured.extensions;
      ids.set(player.id, { id: ensured.players[0].id, name: ensured.players[0].name });
    } catch { /* two saved players share that name: leave this one as the host wrote it */ }
  }
  const night: SwitchNightRecord = {
    ...record,
    players: record.players.map((player) => ids.get(player.id) ?? player),
    winnerIds: record.winnerIds.map((id) => ids.get(id)?.id ?? id),
  };
  return addNight(next, night);
}

/** Saves every new result for one joined night. Returns the nights that were added. */
export function collectResults(as: string | null, results: readonly SwitchNightRecord[]): SwitchNightRecord[] {
  if (!as) return [];
  const added: SwitchNightRecord[] = [];
  // Oldest first, so streaks build in the order the nights were played.
  for (const record of [...results].sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))) {
    if (adoptResult(readClub(), record, as) === null) continue;
    updateClub((current) => adoptResult(current, record, as) ?? current);
    if (getHistory(readClub()).some((night) => night.id === record.id)) added.push(record);
  }
  return added;
}

/** Checks every night this phone has joined, so results saved while the app was closed still arrive. */
export async function syncJoinedNights(): Promise<SwitchNightRecord[]> {
  const added: SwitchNightRecord[] = [];
  for (const joined of loadJoined()) {
    if (!joined.as) continue;
    try { added.push(...collectResults(joined.as, (await fetchShare(joined.code)).results)); } catch { /* offline or the code has expired: try again next time */ }
  }
  return added;
}
