import type { CupState } from "./cup";
import type { KnockoutState } from "./knockout";
import { rankLeague, type League } from "./leagues";
import { isGameMatch, scoreWinnerId, type ScoreSession } from "./scoring";
import type { SwitchNightRecord } from "./history";

export interface NightSnapshot {
  readonly title: string;
  readonly format: string;
  readonly status: string;
  readonly lines: readonly { label: string; value: string; lead?: boolean }[];
  /** Everyone playing, so a friend who joins can say which one they are. */
  readonly players?: readonly string[];
}

export interface SharedNightKeys { readonly code: string; readonly token: string }

/** Turns whatever night is being scored into a small read-only scoreboard that friends can watch. */
function buildBoard(input: { club?: string; session: ScoreSession | null; knockout: KnockoutState | null; cup: CupState | null; leagues: readonly League[] }): NightSnapshot | null {
  const title = input.club ? `${input.club} night` : "Switch night";
  const { session, knockout, cup, leagues } = input;
  if (session) {
    const winner = scoreWinnerId(session);
    const darts = session.format === "darts";
    const lines = session.players.map((player) => ({
      label: player.name,
      value: darts ? `${session.darts?.sets[player.id] ?? 0} sets · ${session.darts?.legs[player.id] ?? 0} legs` : `${session.scores[player.id] ?? 0} ${isGameMatch(session) ? "games" : "points"}`,
      lead: winner === player.id,
    }));
    const name = session.format === "domino" ? "Domino" : session.format === "darts" ? "Darts" : "One v One";
    return { title, format: session.format, status: winner ? `${session.players.find((p) => p.id === winner)?.name} wins the match` : darts ? `First to ${session.darts?.setsToWin ?? 3} sets` : isGameMatch(session) ? `${name} · first to ${session.target} games` : `${name} · first to ${session.target}`, lines };
  }
  if (knockout) {
    const still = knockout.players.filter((player) => !knockout.eliminatedIds.includes(player.id));
    const lines = knockout.players.map((player) => ({ label: player.name, value: knockout.championId === player.id ? "CHAMPION" : knockout.eliminatedIds.includes(player.id) ? "Out" : "Still in", lead: knockout.championId === player.id }));
    return { title, format: "knockout", status: knockout.championId ? "We have a champion" : `${still.length} still playing`, lines };
  }
  if (cup) {
    const round = cup.rounds.at(-1);
    const name = (id: string) => cup.players.find((player) => player.id === id)?.name ?? "?";
    const lines = (round?.fixtures ?? []).map((fixture) => ({ label: `${name(fixture.playerIds[0])} v ${name(fixture.playerIds[1])}`, value: fixture.winnerId ? `${name(fixture.winnerId)} won` : "to play", lead: Boolean(fixture.winnerId) }));
    if (round?.byePlayerId) lines.push({ label: name(round.byePlayerId), value: "bye", lead: false });
    return { title, format: "cup", status: cup.championId ? `${name(cup.championId)} is champion` : `Switch Cup · round ${round?.number ?? 1}`, lines };
  }
  const league = leagues[0];
  if (league) {
    const lines = rankLeague(league.results, league.playoffOrder).map((entry) => ({ label: `${entry.rank}. ${entry.player.name}`, value: `${entry.points} points`, lead: entry.rank === 1 }));
    return { title, format: "league", status: league.name, lines };
  }
  return null;
}

export function buildSnapshot(input: Parameters<typeof buildBoard>[0]): NightSnapshot | null {
  const board = buildBoard(input);
  if (!board) return null;
  const players = input.session?.players ?? input.knockout?.players ?? input.cup?.players ?? input.leagues.flatMap((league) => league.results.map((result) => result.player));
  return { ...board, players: players.map((player) => player.name) };
}

const KEY = "switchSharedNight";
export function loadKeys(): SharedNightKeys | null {
  try { const raw = JSON.parse(localStorage.getItem(KEY) || "null"); return raw && typeof raw.code === "string" && typeof raw.token === "string" ? raw : null; } catch { return null; }
}
export function saveKeys(keys: SharedNightKeys | null) {
  try { if (keys) localStorage.setItem(KEY, JSON.stringify(keys)); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export async function createShare(snapshot: NightSnapshot): Promise<SharedNightKeys> {
  const response = await fetch("/api/night", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Sharing is unavailable right now.");
  return { code: body.code, token: body.token };
}
export async function pushShare(keys: SharedNightKeys, snapshot: NightSnapshot, result?: SwitchNightRecord): Promise<void> {
  const response = await fetch(`/api/night?code=${keys.code}`, { method: "PUT", headers: { "content-type": "application/json", "x-night-token": keys.token }, body: JSON.stringify(result ? { snapshot, result } : { snapshot }) });
  if (!response.ok) throw new Error("The shared night could not be updated.");
}
export async function fetchShare(code: string): Promise<{ snapshot: NightSnapshot; results: SwitchNightRecord[]; updatedAt: number }> {
  const response = await fetch(`/api/night?code=${encodeURIComponent(code.trim().toUpperCase())}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not load that night.");
  return { snapshot: body.snapshot, results: Array.isArray(body.results) ? body.results : [], updatedAt: body.updatedAt };
}
export const shareLink = (code: string) => `${window.location.origin}/?night=${code}`;

/* ── Host: saved nights wait here until they have reached the shared code, so a dropped signal never loses a result. ── */
const OUTBOX = "switchShareOutbox";
interface Pending { readonly keys: SharedNightKeys; readonly snapshot: NightSnapshot; readonly result: SwitchNightRecord }
function readOutbox(): Pending[] {
  try { const raw = JSON.parse(localStorage.getItem(OUTBOX) || "[]"); return Array.isArray(raw) ? raw.filter((item) => item?.keys?.code && item?.keys?.token && item?.result?.id && item?.snapshot) : []; } catch { return []; }
}
function writeOutbox(items: readonly Pending[]) {
  try { if (items.length) localStorage.setItem(OUTBOX, JSON.stringify(items.slice(-20))); else localStorage.removeItem(OUTBOX); } catch { /* storage unavailable */ }
}
let flushing = false;
/** Sends every waiting result. Anything that fails stays in the queue for the next try. */
export async function flushSharedResults(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const item of readOutbox()) {
      try { await pushShare(item.keys, item.snapshot, item.result); } catch { continue; }
      writeOutbox(readOutbox().filter((entry) => entry.result.id !== item.result.id));
    }
  } finally { flushing = false; }
}
/** Called when the host saves a night while a code is live: every phone that joined gets the result. Returns false when nothing is being shared. */
export function publishResult(snapshot: NightSnapshot | null, result: SwitchNightRecord): boolean {
  const keys = loadKeys();
  if (!keys || !snapshot) return false;
  writeOutbox([...readOutbox().filter((entry) => entry.result.id !== result.id), { keys, snapshot, result }]);
  void flushSharedResults();
  return true;
}
