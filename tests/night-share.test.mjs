import test from "node:test";
import assert from "node:assert/strict";
import { handleNight, cleanSnapshot } from "../api/_night.js";

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
  assert.equal((await handleNight(new Request("https://x.test/api/night", { method: "POST", body: "x".repeat(9000) }), store)).status, 413);
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
