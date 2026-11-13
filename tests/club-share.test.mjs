import assert from "node:assert/strict";
import test from "node:test";
import { handleClub } from "../api/_club.js";
import { mergeClub } from "../api/_clubMerge.js";

const memory = () => { const rows = new Map(); return { rows, read: async (code) => rows.get(code) ?? null, write: async (code, row) => { rows.set(code, JSON.parse(JSON.stringify(row))); } }; };
const profile = (id, name, extra = {}) => ({ version: 1, id, name, colour: "forest", createdAt: "2026-11-01T10:00:00.000Z", archived: false, ...extra });
const night = (id, at, winner = "a") => ({ version: 1, id, completedAt: at, title: "Friday", format: "head-to-head", formatLabel: "One v One", players: [{ id: "a", name: "Ann" }, { id: "b", name: "Bo" }], winnerIds: [winner], outcome: "x", details: [{ heading: "Game by game", lines: ["Game 1"] }] });
const send = (store, method, code, doc) => handleClub(new Request(`https://x.test/api/club${code ? `?code=${code}` : ""}`, { method, body: doc ? JSON.stringify({ doc }) : undefined }), store).then(async (response) => ({ status: response.status, body: await response.json() }));

test("a club is created, joined and kept in step by every phone without losing anything", async () => {
  const store = memory();
  const created = await send(store, "POST", null, { name: "Fridays", nameAt: 5, profiles: [profile("a", "Ann"), profile("b", "Bo")], nights: [night("n1", "2026-11-01T20:00:00.000Z")], seasons: [], removed: [] });
  assert.equal(created.status, 201);
  assert.match(created.body.code, /^[A-Z2-9]{8}$/);
  // A second phone adds its own player and night; the first phone's are still there.
  const second = await send(store, "PUT", created.body.code, { name: "", nameAt: 0, profiles: [profile("c", "Cy")], nights: [night("n2", "2026-11-02T20:00:00.000Z", "b")], seasons: [], removed: [] });
  assert.deepEqual(second.body.doc.profiles.map((p) => p.name).sort(), ["Ann", "Bo", "Cy"]);
  assert.deepEqual(second.body.doc.nights.map((n) => n.id), ["n2", "n1"]);
  assert.equal(second.body.doc.name, "Fridays");
  // Asking again with nothing new does not rewrite the club.
  const stamp = store.rows.get(created.body.code).updatedAt;
  const again = await send(store, "PUT", created.body.code, second.body.doc);
  assert.equal(again.body.updatedAt, stamp);
  const quick = await handleClub(new Request(`https://x.test/api/club?code=${created.body.code}&since=${stamp}`), store);
  assert.equal((await quick.json()).unchanged, true);
});

test("demo data, the automatic You player and malformed records never reach the shared club", async () => {
  const store = memory();
  const made = await send(store, "POST", null, { profiles: [profile("demo-1", "Sample"), profile("me", "You"), profile("ok", "Real"), { id: "bad" }], nights: [night("demo-n", "2026-11-01T20:00:00.000Z"), { id: "junk" }], seasons: [] });
  assert.deepEqual(made.body.doc.profiles.map((p) => p.name), ["Real"]);
  assert.equal(made.body.doc.nights.length, 0);
  assert.equal((await send(store, "GET", "ZZZZZZZZ")).status, 404);
  assert.equal((await send(store, "GET", "nope")).status, 400);
});

test("a deleted night stays deleted, and the newer change to a player wins", () => {
  const merged = mergeClub({ profiles: [profile("a", "Ann", { updatedAt: 10 })], nights: [night("n1", "2026-11-01T20:00:00.000Z")], removed: [] }, { profiles: [profile("a", "Annie", { updatedAt: 20 })], nights: [], removed: ["n1"] });
  assert.equal(merged.nights.length, 0);
  assert.equal(merged.profiles[0].name, "Annie");
  const archived = mergeClub({ profiles: [profile("a", "Ann", { archived: true })] }, { profiles: [profile("a", "Ann")] });
  assert.equal(archived.profiles[0].archived, true);
});
