/**
 * Anonymous usage counters for the owner's dashboard.
 *
 * What is sent: small named events ("a game finished: 3 players, you lost, computers dealt 6 penalty cards"). There is
 * no name, score, club, id, cookie or address in any of them, and the phone keeps no identifier: it only remembers
 * "I have been seen" and "I was counted today" so the server can tell new phones and busy days from repeat opens.
 * Respect: nothing is sent if the person has turned counting off (Me > Privacy), their browser says Do Not Track or
 * Global Privacy Control, or the page is driven by an automated browser (so tests never touch real numbers).
 * Offline events wait in a small outbox and go out later. Counting never delays or breaks the app.
 */
const OUTBOX = "switchStatsOutbox";
const SEEN = "switchStatsSeen";
const DAY = "switchStatsDay";
const OPT_OUT = "switchStatsOptOut";
const TEST_FLAG = "switchStatsTest";
const ENDPOINT = "/api/stat";
const MAX_OUTBOX = 100;
const BATCH = 20;

export type StatEvent = { readonly e: string; readonly [field: string]: unknown };

const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
const read = (key: string) => { try { return store()?.getItem(key) ?? null; } catch { return null; } };
const write = (key: string, value: string) => { try { store()?.setItem(key, value); } catch { /* counting is optional */ } };
const remove = (key: string) => { try { store()?.removeItem(key); } catch { /* nothing to clear */ } };
const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** Whether the person has chosen not to be counted. */
export function statsOptedOut(): boolean { return read(OPT_OUT) === "1"; }
export function setStatsOptedOut(value: boolean): void {
  if (value) { write(OPT_OUT, "1"); remove(OUTBOX); } else remove(OPT_OUT);
}

function allowed(): boolean {
  if (typeof window === "undefined") return false;
  if (statsOptedOut()) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  if (nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || nav.globalPrivacyControl === true) return false;
  if (nav.webdriver && read(TEST_FLAG) !== "1") return false;
  return true;
}

function outbox(): StatEvent[] {
  try { const list = JSON.parse(read(OUTBOX) ?? "[]"); return Array.isArray(list) ? list.slice(-MAX_OUTBOX) : []; } catch { return []; }
}
const saveOutbox = (list: StatEvent[]) => { if (list.length) write(OUTBOX, JSON.stringify(list.slice(-MAX_OUTBOX))); else remove(OUTBOX); };

let timer: number | undefined;
let sending = false;

/** Sends what is waiting. A failure keeps the events for next time; any answer from the server (even "no") clears them. */
export async function flushStats(): Promise<void> {
  if (!allowed() || sending) return;
  const waiting = outbox();
  if (!waiting.length) return;
  sending = true;
  try {
    const batch = waiting.slice(0, BATCH);
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events: batch }), keepalive: true });
    if (response.status >= 500 || response.status === 429) return;
    saveOutbox(outbox().slice(batch.length));
    if (outbox().length) schedule(400);
  } catch { /* offline: try again later */ } finally { sending = false; }
}

function schedule(ms = 1500) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { void flushStats(); }, ms);
}

/** Counts one thing. Safe to call anywhere: it never throws and never waits. */
export function track(event: StatEvent): void {
  try {
    if (!allowed()) return;
    saveOutbox([...outbox(), event]);
    schedule();
  } catch { /* counting must never break the app */ }
}

export function platformOf(win: Window = window): string {
  const ua = win.navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && win.navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh/.test(ua)) return "mac";
  if (/Linux|X11/.test(ua)) return "linux";
  return "other";
}

function installedApp(): boolean {
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
}

/** Whether Switch has already saved anything of its own on this phone (apart from the counting keys). */
function hasOwnData(): boolean {
  try {
    const s = store();
    if (!s) return false;
    for (let index = 0; index < s.length; index += 1) { const key = s.key(index); if (key && key.startsWith("switch") && !key.startsWith("switchStats")) return true; }
  } catch { /* unreadable */ }
  return false;
}

let opened = false;
/**
 * Called once as the app loads, before anything else has written to storage.
 * "new" = no Switch data on this phone; "existing" = it already had some when counting began; neither = seen before.
 */
export function trackOpen(): void {
  if (opened || typeof window === "undefined") return;
  opened = true;
  try {
    if (!allowed()) return;
    const today = utcDay();
    const firstEver = read(SEEN) === null;
    const device = firstEver ? (hasOwnData() ? "existing" : "new") : null;
    const firstToday = read(DAY) !== today;
    if (firstEver) write(SEEN, today);
    if (firstToday) write(DAY, today);
    track({ e: "open", ...(device ? { device } : {}), today: firstToday, platform: platformOf(), installed: installedApp() });
    window.addEventListener("appinstalled", () => track({ e: "feature", name: "install_done" }));
    window.addEventListener("online", () => schedule(500));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushStats(); });
    schedule(800);
  } catch { /* counting must never break the app */ }
}

export const trackView = (page: string) => track({ e: "view", page });
/** A night was saved on this phone: only its kind and how many played, never who or the scores. */
export const trackNightSaved = (format: string, players: number, shared: boolean) => track({ e: "night", format, players, shared });
export const trackFeature = (name: string) => track({ e: "feature", name });
