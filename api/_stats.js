// Anonymous usage counters for the owner's dashboard (public/stats.html).
//
// Only NUMBERS are stored: one small file per calendar day (UTC) holding named counters such as "games.finished".
// There is no user id, device id, cookie, IP address, name, score or club anywhere in it. The phone sends a handful of
// whitelisted events; this file turns each into counter increments and ignores everything else, so a bad or hostile
// request can only ever move a counter, and by a capped amount.
//
// Read-modify-write on a blob is not atomic, so two events landing in the same instant can lose one increment.
// These are trend figures, not accounts, and that is an accepted trade for needing no database.
import { createHash, timingSafeEqual } from "node:crypto";

export const LEVELS = ["relaxed", "standard", "sharp"];
export const PLATFORMS = ["ios", "android", "windows", "mac", "linux", "other"];
export const FORMATS = ["head-to-head", "domino", "darts", "league", "knockout", "cup"];
/** Ways to play against the computer, as named in src/switch/series.ts (PlayMode). */
export const GAME_MODES = ["single", "match", "lastout", "knockout", "group", "cup", "darts", "dominoes"];
/** Moves played when someone left a game, in four bands: where do people give up? */
export const QUIT_BANDS = [[0, "0"], [10, "10"], [30, "30"], [60, "60"]];
/** Screens, as named in Prototype.tsx. */
export const PAGES = ["Learn", "Rules", "Cards", "Modes", "Watch", "Questions", "Tutorial", "Score", "Club", "Quick", "Puzzles", "Privacy", "Play", "Table", "Me"];
/** One-off things worth counting. Anything not listed here is dropped. */
export const FEATURES = [
  "share_app", "install_prompt", "install_done", "signin", "feedback_open", "club_created", "club_joined", "night_shared", "night_joined",
  "puzzle_solved", "referee_used", "hand_counter_used", "export_data",
];
export const RANKS = ["2", "7", "8", "J", "K", "A"];

export const MAX_EVENTS = 25;
export const MAX_BODY = 6000;

const num = (value, max) => { const n = Math.round(Number(value)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };
const oneOf = (value, list) => (list.includes(value) ? value : null);
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Adds `n` to a counter, skipping zeros so day files stay small. */
function add(out, key, n = 1) { if (n > 0) out.add[key] = (out.add[key] ?? 0) + n; }
function peak(out, key, n) { if (n > 0) out.max[key] = Math.max(out.max[key] ?? 0, n); }

/** What one event adds to the day's counters. Unknown events and fields add nothing. */
export function countersFor(event, now = Date.now(), out = { add: {}, max: {} }) {
  if (!event || typeof event !== "object") return out;
  switch (event.e) {
    case "visit": {
      add(out, "visits");
      add(out, `hour.${String(new Date(now).getUTCHours()).padStart(2, "0")}`);
      break;
    }
    case "open": {
      add(out, "opens");
      // "new" is a phone with no Switch data at all; "existing" had data from before tracking began. Neither sends an id.
      const device = oneOf(event.device, ["new", "existing"]);
      if (device) { add(out, `devices.${device}`); add(out, "devices.total"); }
      if (event.today === true) {
        add(out, "active");
        if (!device) add(out, "returning");
        const platform = oneOf(event.platform, PLATFORMS);
        if (platform) add(out, `platform.${platform}`);
        if (event.installed === true) add(out, "installed");
      }
      break;
    }
    case "view": {
      const page = oneOf(event.page, PAGES);
      if (page) add(out, `view.${page}`);
      break;
    }
    case "practice": {
      const stage = oneOf(event.stage, ["start", "finish"]);
      if (stage) add(out, `practice.${stage}`);
      if (stage === "finish" && event.won === true) add(out, "practice.won");
      break;
    }
    case "night": {
      const format = oneOf(event.format, FORMATS);
      if (!format) break;
      add(out, "nights.saved");
      add(out, `nights.format.${format}`);
      const players = num(event.players, 24);
      add(out, "nights.players", players);
      add(out, `nights.format.${format}.players`, players);
      if (players >= 2) add(out, `nights.size.${players}`);
      if (event.shared === true) add(out, "nights.sharedSaved");
      break;
    }
    case "feature": {
      const name = oneOf(event.name, FEATURES);
      if (name) add(out, `feature.${name}`);
      break;
    }
    case "game_start": {
      if (event.resumed === true) break;
      add(out, "games.started");
      const level = oneOf(event.level, LEVELS);
      if (level) add(out, `games.started.${level}`);
      const startedMode = oneOf(event.mode, GAME_MODES);
      if (startedMode) add(out, `games.started.mode.${startedMode}`);
      const startedWith = num(event.opponents, 7);
      if (startedWith >= 1) add(out, `games.started.opp.${startedWith}`);
      break;
    }
    case "game": {
      const level = oneOf(event.level, LEVELS);
      const opponents = num(event.opponents, 7);
      if (!level || opponents < 1) break;
      const won = event.won === true;
      const place = Math.max(1, num(event.place, 8));
      const moves = num(event.moves, 2000);
      add(out, "games.finished");
      add(out, won ? "games.won" : "games.lost");
      add(out, `games.level.${level}`);
      if (won) add(out, `games.level.${level}.won`);
      add(out, `games.opp.${opponents}`);
      if (won) add(out, `games.opp.${opponents}.won`);
      add(out, `games.place.${place}`);
      const mode = oneOf(event.mode, GAME_MODES);
      if (mode) { add(out, `games.mode.${mode}`); if (won) add(out, `games.mode.${mode}.won`); }
      add(out, "games.moves", moves);
      peak(out, "max.moves", moves);
      const seconds = num(event.seconds, 3600);
      if (seconds > 0) { add(out, "games.timed"); add(out, "games.seconds", seconds); peak(out, "max.seconds", seconds); }
      const t = event.tally && typeof event.tally === "object" ? event.tally : {};
      const field = (name, key, cap = 600) => { const n = num(t[name], cap); add(out, key, n); return n; };
      const byCpu = field("dealtByCpu", "pen.dealtByCpu");
      field("dealtByYou", "pen.dealtByYou");
      field("landedOnYou", "pen.landedOnYou");
      field("landedOnCpu", "pen.landedOnCpu");
      field("lastCardMissed", "pen.lastCard", 40);
      field("ouches", "pen.ouch", 40);
      field("missedYou", "pen.missedYou", 200);
      field("missedCpu", "pen.missedCpu", 200);
      field("drawsYou", "draws.you");
      field("drawsCpu", "draws.cpu");
      field("cardsYou", "cards.you");
      field("cardsCpu", "cards.cpu");
      peak(out, "max.stack", num(t.maxStack, 40));
      peak(out, "max.dealtByCpuInGame", byCpu);
      for (const who of ["c", "y"]) {
        const plays = t.plays && typeof t.plays === "object" ? t.plays[who] : null;
        if (plays && typeof plays === "object") for (const rank of RANKS) add(out, `plays.${who}.${rank}`, num(plays[rank], 200));
      }
      break;
    }
    case "game_quit": {
      // Someone left a table with the game still going. It may be resumed later, so "unfinished" is the safer measure.
      const mode = oneOf(event.mode, GAME_MODES);
      const moves = num(event.moves, 2000);
      add(out, "games.quit");
      if (mode) add(out, `games.quit.mode.${mode}`);
      const band = [...QUIT_BANDS].reverse().find(([from]) => moves >= from);
      if (band) add(out, `games.quit.moves.${band[1]}`);
      break;
    }
    case "series": {
      // A tournament or match against the computers as a whole (each of its games also counts as a normal game).
      const mode = oneOf(event.mode, GAME_MODES);
      const stage = oneOf(event.stage, ["start", "finish", "leave"]);
      if (!mode || !stage) break;
      const key = stage === "start" ? "started" : stage === "finish" ? "finished" : "left";
      add(out, `series.${key}`);
      add(out, `series.${key}.${mode}`);
      if (stage === "finish" && event.won === true) add(out, `series.won.${mode}`);
      if (stage === "start") add(out, `series.size.${Math.max(2, num(event.players, 8))}`);
      break;
    }
    case "night_start": {
      // A scorecard was begun (as opposed to saved): the gap between the two is nights that never reached a result.
      const format = oneOf(event.format, FORMATS);
      if (!format) break;
      add(out, "nights.started");
      add(out, `nights.started.format.${format}`);
      add(out, `nights.started.size.${Math.max(2, num(event.players, 24))}`);
      break;
    }
    default: break;
  }
  return out;
}

/** Folds events into one set of increments. Returns how many events counted for something. */
export function tally(events, now = Date.now()) {
  const out = { add: {}, max: {} };
  let counted = 0;
  for (const event of (Array.isArray(events) ? events : []).slice(0, MAX_EVENTS)) {
    const before = JSON.stringify(out);
    countersFor(event, now, out);
    if (JSON.stringify(out) !== before) counted += 1;
  }
  return { ...out, counted };
}

/** Applies increments to one day's file. `store.read(day)` / `store.write(day, doc)`. */
export async function bump(store, increments, now = Date.now()) {
  const empty = !Object.keys(increments.add).length && !Object.keys(increments.max).length;
  if (empty) return;
  const day = dayKey(now);
  const doc = (await store.read(day)) ?? { day, c: {}, m: {} };
  doc.c ??= {}; doc.m ??= {};
  for (const [key, n] of Object.entries(increments.add)) doc.c[key] = (doc.c[key] ?? 0) + n;
  for (const [key, n] of Object.entries(increments.max)) doc.m[key] = Math.max(doc.m[key] ?? 0, n);
  await store.write(day, doc);
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** POST /api/stat: the phone reports what happened. Always answers quickly and never reveals what was counted. */
export async function handleCollect(request, store, now = Date.now()) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Wrong origin" }, 403);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "Too large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request" }, 400); }
  const result = tally(body?.events, now);
  await bump(store, result, now);
  return json({ ok: true, counted: result.counted });
}

/** True when the request carries the owner's token. A missing STATS_TOKEN means the dashboard is switched off. */
export function authorised(request, token) {
  if (!token || token.length < 12) return false;
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = createHash("sha256").update(given).digest(); const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/** Merges day files into the dashboard's numbers: every day, the lifetime totals and the all-time peaks. */
export async function readStats(store, { days = 120 } = {}) {
  const names = (await store.list()).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
  const docs = [];
  // Read in small batches so a long history never opens hundreds of connections at once.
  for (let index = 0; index < names.length; index += 20) {
    // One unreadable or damaged day file must never take the whole dashboard down: that day is skipped.
    docs.push(...(await Promise.all(names.slice(index, index + 20).map((name) => store.read(name).catch(() => null)))));
  }
  const totals = { c: {}, m: {} };
  const all = docs.filter(Boolean);
  for (const doc of all) {
    for (const [key, n] of Object.entries(doc.c ?? {})) totals.c[key] = (totals.c[key] ?? 0) + n;
    for (const [key, n] of Object.entries(doc.m ?? {})) totals.m[key] = Math.max(totals.m[key] ?? 0, n);
  }
  return { firstDay: names[0] ?? null, days: all.slice(-days).map((doc) => ({ day: doc.day, c: doc.c ?? {}, m: doc.m ?? {} })), totals };
}
