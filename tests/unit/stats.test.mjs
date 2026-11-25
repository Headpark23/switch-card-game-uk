import assert from "node:assert/strict";
import test from "node:test";
import { authorised, bump, dashboardAccess, countersFor, dayKey, handleCollect, readStats, tally } from "../../api/_stats.js";
import { buildSnapshot } from "../../api/_statsSnapshot.js";

const NOW = Date.parse("2026-11-14T20:30:00Z");
const memory = () => {
  const days = new Map();
  return { days, read: async (day) => (days.has(day) ? structuredClone(days.get(day)) : null), write: async (day, doc) => { days.set(day, structuredClone(doc)); }, list: async () => [...days.keys()] };
};
const post = (body, headers = {}) => new Request("https://x.test/api/stat", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

test("a finished game becomes counters, including who dealt the penalty cards", () => {
  const out = tally([{ e: "game", opponents: 3, level: "sharp", won: false, place: 3, moves: 61, seconds: 410,
    tally: { dealtByCpu: 9, dealtByYou: 4, landedOnYou: 11, landedOnCpu: 2, lastCardMissed: 1, ouches: 1, missedYou: 2, missedCpu: 1, maxStack: 8, plays: { c: { 2: 3, K: 1 }, y: { 2: 1 } } } }], NOW);
  assert.equal(out.counted, 1);
  assert.deepEqual(
    { finished: out.add["games.finished"], lost: out.add["games.lost"], won: out.add["games.won"], sharp: out.add["games.level.sharp"], opp: out.add["games.opp.3"], place: out.add["games.place.3"] },
    { finished: 1, lost: 1, won: undefined, sharp: 1, opp: 1, place: 1 },
  );
  assert.equal(out.add["pen.dealtByCpu"], 9);
  assert.equal(out.add["pen.dealtByYou"], 4);
  assert.equal(out.add["pen.landedOnYou"], 11);
  assert.equal(out.add["plays.c.2"], 3);
  assert.equal(out.add["plays.y.2"], 1);
  assert.equal(out.max["max.stack"], 8);
  assert.equal(out.max["max.dealtByCpuInGame"], 9);
  assert.equal(out.add["games.seconds"], 410);
});

test("only whitelisted events and fields count, and every number is capped", () => {
  const out = tally([
    { e: "nope", x: 1 }, null, "string", { e: "view", page: "Not a page" }, { e: "feature", name: "drop table" },
    { e: "game", opponents: 9, level: "extreme", won: true, place: 1, moves: 5 },
    { e: "game", opponents: 2, level: "relaxed", won: true, place: 1, moves: 999999, tally: { dealtByCpu: 1e9, __proto__: { polluted: 1 }, "pen.hack": 5 } },
  ], NOW);
  assert.equal(out.counted, 1);
  assert.equal(out.add["games.moves"], 2000);
  assert.equal(out.add["pen.dealtByCpu"], 600);
  assert.ok(Object.keys(out.add).every((key) => !key.includes("hack") && !key.includes("polluted")));
  assert.equal(({}).polluted, undefined);
});

test("an open counts new phones once, and active devices once per day", () => {
  const first = countersFor({ e: "open", device: "new", today: true, platform: "ios", installed: true }, NOW);
  assert.deepEqual(first.add, { opens: 1, "devices.new": 1, "devices.total": 1, active: 1, "platform.ios": 1, installed: 1 });
  const again = countersFor({ e: "open", today: false, platform: "ios" }, NOW);
  assert.deepEqual(again.add, { opens: 1 });
  const back = countersFor({ e: "open", today: true, platform: "android" }, NOW);
  assert.deepEqual(back.add, { opens: 1, active: 1, returning: 1, "platform.android": 1 });
  assert.equal(countersFor({ e: "open", device: "hacker", today: true, platform: "toaster" }, NOW).add["devices.total"], undefined);
});

test("counters add up through a day file and totals span the days", async () => {
  const store = memory();
  await bump(store, tally([{ e: "visit" }, { e: "visit" }], NOW), NOW);
  await bump(store, tally([{ e: "visit" }], NOW), NOW);
  await bump(store, tally([{ e: "game", opponents: 1, level: "standard", won: true, place: 1, moves: 40, tally: { maxStack: 6 } }], NOW + 86_400_000), NOW + 86_400_000);
  await bump(store, tally([{ e: "game", opponents: 1, level: "standard", won: false, place: 2, moves: 20, tally: { maxStack: 4 } }], NOW + 86_400_000), NOW + 86_400_000);
  assert.deepEqual(store.days.get("2026-11-14").c.visits, 3);
  const stats = await readStats(store, { days: 30 });
  assert.equal(stats.firstDay, "2026-11-14");
  assert.equal(stats.days.length, 2);
  assert.equal(stats.totals.c.visits, 3);
  assert.equal(stats.totals.c["games.finished"], 2);
  assert.equal(stats.totals.m["max.stack"], 6);
  assert.equal(dayKey(NOW), "2026-11-14");
});

test("one unreadable day file is skipped instead of taking the dashboard down", async () => {
  const store = memory();
  await bump(store, tally([{ e: "visit" }], NOW), NOW);
  await bump(store, tally([{ e: "visit" }, { e: "visit" }], NOW + 86_400_000), NOW + 86_400_000);
  const read = store.read;
  store.read = async (day) => { if (day === "2026-11-14") throw new SyntaxError("Unexpected end of JSON input"); return read(day); };
  const stats = await readStats(store, { days: 30 });
  assert.equal(stats.days.length, 1);
  assert.equal(stats.totals.c.visits, 2);
});

test("the owner opens the dashboard by Google account or token, and nobody else does", () => {
  const req = (auth) => new Request("https://x.test/api/stats", { headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  const owner = { ownerEmail: "Owner@Example.com", token: undefined };
  assert.equal(dashboardAccess(req(), { ...owner, session: { email: "owner@example.com" } }).ok, true);
  assert.equal(dashboardAccess(req(), { ...owner, session: { email: "someone@example.com" } }).ok, false);
  assert.equal(dashboardAccess(req(), { ...owner, session: { email: "someone@example.com" } }).signedInAs, "someone@example.com");
  assert.equal(dashboardAccess(req(), { ...owner, session: null }).ok, false);
  assert.equal(dashboardAccess(req(), { ownerEmail: "", token: "x".repeat(12), session: { email: "" } }).ok, false);
  assert.equal(dashboardAccess(req("x".repeat(12)), { ownerEmail: "", token: "x".repeat(12), session: null }).ok, true);
  assert.equal(dashboardAccess(req(), { ownerEmail: "", token: undefined, session: { email: "owner@example.com" } }).configured, false);
  assert.equal(dashboardAccess(req(), { ownerEmail: "owner@example.com", token: undefined, session: null }).configured, true);
});

test("what is stored is only numbers: no ids, names, addresses or user agents", async () => {
  const store = memory();
  const response = await handleCollect(post({ events: [{ e: "open", device: "new", today: true, platform: "ios", name: "Martin", id: "abc", club: "ZZZ" }] }, { "x-forwarded-for": "1.2.3.4", "user-agent": "SecretBrowser/1" }), store, NOW);
  assert.equal(response.status, 200);
  const doc = store.days.get("2026-11-14");
  const text = JSON.stringify(doc);
  assert.ok(!/Martin|abc|ZZZ|1\.2\.3\.4|SecretBrowser/.test(text));
  assert.ok(Object.values(doc.c).every((value) => Number.isInteger(value)));
});

test("the collector refuses other sites, other methods, junk and big bodies", async () => {
  const store = memory();
  assert.equal((await handleCollect(post({ events: [] }, { Origin: "https://evil.test" }), store, NOW)).status, 403);
  assert.equal((await handleCollect(new Request("https://x.test/api/stat", { method: "GET" }), store, NOW)).status, 405);
  assert.equal((await handleCollect(post("{not json"), store, NOW)).status, 400);
  assert.equal((await handleCollect(post("x".repeat(7000)), store, NOW)).status, 413);
  assert.equal(store.days.size, 0);
  assert.equal((await handleCollect(post({ events: Array.from({ length: 60 }, () => ({ e: "visit" })) }), store, NOW)).status, 200);
  assert.equal(store.days.get("2026-11-14").c.visits, 25);
});

test("the dashboard token is checked, and a missing or short token switches the dashboard off", () => {
  const req = (value) => new Request("https://x.test/api/stats", { headers: value ? { authorization: value } : {} });
  assert.equal(authorised(req("Bearer correct-horse-battery"), "correct-horse-battery"), true);
  assert.equal(authorised(req("Bearer wrong"), "correct-horse-battery"), false);
  assert.equal(authorised(req(), "correct-horse-battery"), false);
  assert.equal(authorised(req("Bearer "), ""), false);
  assert.equal(authorised(req("Bearer short"), "short"), false);
  assert.equal(authorised(req("Bearer undefined"), undefined), false);
});

test("the server snapshot counts what is stored without copying names or scores out", async () => {
  const day = 86_400_000;
  const files = {
    "club-sync/": [{ pathname: "club-sync/1.json", size: 900, uploadedAt: new Date(NOW - 2 * day).toISOString() }, { pathname: "club-sync/2.json", size: 100, uploadedAt: new Date(NOW - 40 * day).toISOString() }],
    "club-share/": [{ pathname: "club-share/AAAAAAAA.json", size: 1, uploadedAt: new Date(NOW - day).toISOString() }, { pathname: "club-share/BBBBBBBB.json", size: 1, uploadedAt: new Date(NOW - 20 * day).toISOString() }],
    "night-share/": [{ pathname: "night-share/ABCDEF.json", size: 1, uploadedAt: new Date(NOW - 3_600_000).toISOString() }],
  };
  const docs = {
    "club-share/AAAAAAAA.json": { doc: { name: "Secret Club", profiles: [{ name: "Ann" }, { name: "Bo" }, { name: "Cy", archived: true }], nights: [{ format: "darts", players: [{ name: "Ann" }] }, { format: "cup" }], seasons: [{}] } },
    "club-share/BBBBBBBB.json": { doc: { profiles: Array.from({ length: 6 }, (_, i) => ({ name: `P${i}` })), nights: [{ format: "darts" }], seasons: [] } },
  };
  const snap = await buildSnapshot({ list: async (prefix) => files[prefix], read: async (path) => docs[path] }, NOW);
  assert.deepEqual(snap.accounts, { total: 2, backedUp7d: 1, backedUp30d: 1, bytes: 1000 });
  assert.equal(snap.clubs.total, 2);
  assert.equal(snap.clubs.active7d, 1);
  assert.equal(snap.clubs.players, 8);
  assert.equal(snap.clubs.nights, 3);
  assert.deepEqual(snap.clubs.nightsByFormat, { darts: 2, cup: 1 });
  assert.deepEqual(snap.clubs.sizes, { solo: 0, small: 1, medium: 1, large: 0 });
  assert.equal(snap.sharedNights.liveNow, 1);
  assert.ok(!/Secret|Ann|Bo\b/.test(JSON.stringify(snap)));
});

test("games carry their type, table size and where they were left, and every field is whitelisted", () => {
  const out = tally([
    { e: "game_start", opponents: 6, level: "sharp", mode: "knockout" },
    { e: "game", opponents: 6, level: "sharp", mode: "knockout", won: true, place: 1, moves: 70 },
    { e: "game", opponents: 3, level: "standard", mode: "toaster", won: false, place: 4, moves: 20 },
    { e: "game_start", opponents: 4, level: "standard", mode: "lastout" },
    { e: "game_quit", mode: "cup", opponents: 3, moves: 12 },
    { e: "game_quit", mode: "nope", opponents: 3, moves: 75 },
  ], NOW);
  assert.equal(out.add["games.started.mode.knockout"], 1);
  assert.equal(out.add["games.started.opp.6"], 1);
  assert.equal(out.add["games.opp.6"], 1, "tables of up to 8 count");
  assert.equal(out.add["games.started.mode.lastout"], 1, "Last One Out is a counted game type");
  assert.equal(out.add["games.mode.knockout"], 1);
  assert.equal(out.add["games.mode.knockout.won"], 1);
  assert.equal(out.add["games.mode.toaster"], undefined, "unknown game types are dropped");
  assert.equal(out.add["games.finished"], 2);
  assert.equal(out.add["games.quit"], 2);
  assert.equal(out.add["games.quit.mode.cup"], 1);
  assert.equal(out.add["games.quit.moves.10"], 1);
  assert.equal(out.add["games.quit.moves.60"], 1);
});

test("tournaments and scorecards count when begun, finished and left", () => {
  const out = tally([
    { e: "series", stage: "start", mode: "cup", players: 8 },
    { e: "series", stage: "finish", mode: "cup", won: true },
    { e: "series", stage: "leave", mode: "group" },
    { e: "series", stage: "start", mode: "bogus" },
    { e: "night_start", format: "darts", players: 4 },
    { e: "night_start", format: "pinball", players: 4 },
    { e: "night", format: "darts", players: 4, shared: false },
  ], NOW);
  assert.deepEqual(
    { started: out.add["series.started.cup"], size: out.add["series.size.8"], won: out.add["series.won.cup"], left: out.add["series.left.group"], bogus: out.add["series.started.bogus"] },
    { started: 1, size: 1, won: 1, left: 1, bogus: undefined },
  );
  assert.equal(out.add["nights.started"], 1);
  assert.equal(out.add["nights.started.format.darts"], 1);
  assert.equal(out.add["nights.started.size.4"], 1);
  assert.equal(out.add["nights.format.darts"], 1);
  assert.equal(out.add["nights.format.darts.players"], 4);
  assert.equal(out.add["nights.size.4"], 1);
});

test("a dashboard page holds the new sections and parses", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../public/stats.html", import.meta.url), "utf8");
  for (const id of ["h-all", "h-fin", "h-cpu", "h-online", "h-score"]) assert.ok(html.includes(`id="${id}"`), id);
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script));
});
