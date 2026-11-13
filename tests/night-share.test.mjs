import test from "node:test";
import assert from "node:assert/strict";
import { handleNight, cleanSnapshot, cleanResult } from "../api/_night.js";

const memory = () => { const rows = new Map(); return { read: async (c) => rows.get(c) ?? null, write: async (c, r) => void rows.set(c, r) }; };
const req = (method, path, body, headers = {}) => new Request("https://x.test/api/night" + path, { method, body: body ? JSON.stringify(body) : undefined, headers });
const snap = { title: "Friday", format: "domino", status: "Target 100", lines: [{ label: "Alex", value: "40 points", lead: true }, { label: "Blair", value: "22 points" }] };

test("a host creates a code, updates with the token, and friends read it", async () => {
  const store = memory();
  const made = await handleNight(req("POST", "", { snapshot: snap }), store, 1000);
  assert.equal(made.status, 201);
  const { code, token } = await made.json();
  assert.match(code, /^[A-Z2-9]{6}$/);
  const read = await (await handleNight(req("GET", `?code=${code.toLowerCase()}`), store, 2000)).json();
  assert.equal(read.snapshot.lines[0].label, "Alex");
  const next = { ...snap, lines: [{ label: "Alex", value: "70 points", lead: true }] };
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: next }, { "x-night-token": token }), store, 3000)).status, 200);
  assert.equal((await (await handleNight(req("GET", `?code=${code}`), store, 4000)).json()).snapshot.lines[0].value, "70 points");
});

test("only the host can update, and the stored token is hashed", async () => {
  const store = memory();
  const { code, token } = await (await handleNight(req("POST", "", { snapshot: snap }), store, 1)).json();
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap }, { "x-night-token": "wrong" }), store, 2)).status, 403);
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap }), store, 2)).status, 403);
  assert.ok(![...JSON.stringify([...(await store.read(code) ? [await store.read(code)] : [])])].join("").includes(token));
});

test("bad codes, oversize bodies, empty scoreboards and expired nights are refused", async () => {
  const store = memory();
  assert.equal((await handleNight(req("GET", "?code=nope"), store)).status, 400);
  assert.equal((await handleNight(req("GET", "?code=ABCDEF"), store)).status, 404);
  assert.equal((await handleNight(req("POST", "", { snapshot: { title: "x", lines: [] } }), store)).status, 400);
  assert.equal((await handleNight(new Request("https://x.test/api/night", { method: "POST", body: "x".repeat(30000) }), store)).status, 413);
  const { code } = await (await handleNight(req("POST", "", { snapshot: snap }), store, 0)).json();
  assert.equal((await handleNight(req("GET", `?code=${code}`), store, 15 * 86_400_000)).status, 404);
});

test("snapshots are trimmed to plain names and scores", () => {
  const clean = cleanSnapshot({ title: "T".repeat(200), lines: Array.from({ length: 40 }, (_, i) => ({ label: "P" + i, value: "v".repeat(200), extra: "<script>" })) });
  assert.equal(clean.title.length, 60);
  assert.equal(clean.lines.length, 24);
  assert.equal(clean.lines[0].value.length, 60);
  assert.equal("extra" in clean.lines[0], false);
});

test("a saved night travels with the code so every phone that joined can add it to its history", async () => {
  const store = memory();
  const { code, token } = await (await handleNight(req("POST", "", { snapshot: { ...snap, players: ["Alex", "Blair"] } }), store, 1)).json();
  const night = { version: 1, id: "night-1", completedAt: "2026-11-13T21:00:00.000Z", title: "Friday", format: "head-to-head", formatLabel: "One v One", players: [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }], winnerIds: ["b", "stranger"], outcome: "Blair won", details: [{ heading: "Final games", lines: ["Blair — 3 games", "Alex — 1 game"] }], place: { name: "The Crown", country: "GB" }, secret: "dropped" };
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap, result: night }, { "x-night-token": token }), store, 2)).status, 200);
  // A later scoreboard update without a result keeps the saved night, and saving it twice does not double it.
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap }, { "x-night-token": token }), store, 3)).status, 200);
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap, result: night }, { "x-night-token": token }), store, 4)).status, 200);
  const read = await (await handleNight(req("GET", `?code=${code}`), store, 5)).json();
  assert.equal(read.results.length, 1);
  assert.deepEqual(read.results[0].winnerIds, ["b"]);
  assert.equal(read.results[0].place.name, "The Crown");
  assert.equal(read.results[0].secret, undefined);
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap, result: night }, { "x-night-token": "wrong" }), store, 6)).status, 403);
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: snap, result: { id: "x" } }, { "x-night-token": token }), store, 7)).status, 400);
  assert.equal(cleanResult({ ...night, format: "poker" }), null);
});

test("a friend says who they are, the host can read it back, and only names on the scoreboard are accepted", async () => {
  const store = memory();
  const { code, token } = await (await handleNight(req("POST", "", { snapshot: { ...snap, players: ["Alex", "Blair"] } }), store, 1)).json();
  assert.deepEqual((await (await handleNight(req("GET", `?code=${code}`), store, 2)).json()).joined, []);
  const said = await handleNight(req("PATCH", `?code=${code}`, { joined: "  blair " }), store, 3);
  assert.equal(said.status, 200);
  assert.equal((await said.json()).joined[0].name, "Blair");
  // Saying it twice does not list them twice, and a stranger's name is refused.
  await handleNight(req("PATCH", `?code=${code}`, { joined: "Blair" }), store, 4);
  assert.equal((await handleNight(req("PATCH", `?code=${code}`, { joined: "Mallory" }), store, 5)).status, 400);
  assert.equal((await handleNight(req("PATCH", `?code=${code}`, { joined: "" }), store, 5)).status, 400);
  assert.equal((await handleNight(req("PATCH", "?code=ZZZZZZ", { joined: "Blair" }), store, 5)).status, 404);
  // A scoreboard update from the host keeps who has joined.
  assert.equal((await handleNight(req("PUT", `?code=${code}`, { snapshot: { ...snap, players: ["Alex", "Blair"] } }, { "x-night-token": token }), store, 6)).status, 200);
  const read = await (await handleNight(req("GET", `?code=${code}`), store, 7)).json();
  assert.deepEqual(read.joined.map((entry) => entry.name), ["Blair"]);
});
