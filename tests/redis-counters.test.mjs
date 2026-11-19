import assert from "node:assert/strict";
import test from "node:test";
import { makeStatsStore } from "../api/_statsStore.js";
import { makeHitStore } from "../api/_hitStore.js";
import { bump, readStats, tally } from "../api/_stats.js";

const NOW = Date.parse("2026-11-19T10:00:00Z");

// A pretend Redis that understands only the commands the counters send. The Lua scripts are modelled by what they do.
function fakeRedis() {
  const hashes = new Map(), sets = new Map(), strings = new Map(), log = [];
  return {
    log,
    async run(command) {
      log.push(command);
      const [name, ...rest] = command;
      if (name === "EVAL" && rest[0].includes("HINCRBY")) {
        const [, , c, m, days, add, max, , day] = rest;
        const hc = hashes.get(c) ?? new Map(), hm = hashes.get(m) ?? new Map();
        for (const [k, v] of Object.entries(JSON.parse(add))) hc.set(k, (hc.get(k) ?? 0) + Math.floor(v));
        for (const [k, v] of Object.entries(JSON.parse(max))) if (v > (hm.get(k) ?? 0)) hm.set(k, Math.floor(v));
        hashes.set(c, hc); hashes.set(m, hm);
        sets.set(days, (sets.get(days) ?? new Set()).add(day));
        return 1;
      }
      if (name === "EVAL" && rest[0].includes("INCR")) { const key = rest[2]; strings.set(key, String(Number(strings.get(key) ?? 0) + 1)); return Number(strings.get(key)); }
      if (name === "HGETALL") return [...(hashes.get(rest[0]) ?? new Map())].flat().map(String);
      if (name === "SMEMBERS") return [...(sets.get(rest[0]) ?? [])];
      if (name === "GET") return strings.get(rest[0]) ?? null;
      if (name === "SET") { if (rest.includes("NX") && strings.has(rest[0])) return null; strings.set(rest[0], rest[1]); return "OK"; }
      throw new Error(`unexpected ${name}`);
    },
  };
}
const noLegacy = { read: async () => null, list: async () => [] };

test("counting adds atomically in one round trip and never rewrites a file", async () => {
  const redis = fakeRedis();
  const store = makeStatsStore({ redis, legacy: noLegacy });
  await bump(store, tally([{ e: "visit" }, { e: "visit" }], NOW), NOW);
  await bump(store, tally([{ e: "visit" }], NOW), NOW);
  assert.equal(redis.log.length, 2, "one command per bump");
  assert.ok(redis.log.every(([name]) => name === "EVAL"));
  const stats = await readStats(store, { days: 30 });
  assert.equal(stats.totals.c.visits, 3);
  assert.equal(stats.firstDay, "2026-11-19");
});

test("days counted before the move are still read from Blob, and a Blob outage only hides them", async () => {
  const redis = fakeRedis();
  const old = { day: "2026-11-10", c: { visits: 5 }, m: {} };
  const withBlob = makeStatsStore({ redis, legacy: { list: async () => ["2026-11-10"], read: async (day) => (day === "2026-11-10" ? old : null) } });
  await bump(withBlob, tally([{ e: "visit" }], NOW), NOW);
  assert.equal((await readStats(withBlob, { days: 30 })).totals.c.visits, 6);
  const blobDown = makeStatsStore({ redis, legacy: noLegacy });
  assert.equal((await readStats(blobDown, { days: 30 })).totals.c.visits, 1);
});

test("the visit counter starts from the old total once Blob can be read, and counts meanwhile", async () => {
  const redis = fakeRedis();
  let blobUp = false;
  const hits = makeHitStore({ redis, legacy: async () => { if (!blobUp) throw new Error("suspended"); return 1200; } });
  await hits.increment(); await hits.increment();
  await assert.rejects(hits.read(), /suspended/);
  blobUp = true;
  assert.deepEqual(await hits.read(), { hits: 1202 });
  blobUp = false;
  await hits.increment();
  assert.deepEqual(await hits.read(), { hits: 1203 }, "the old total is copied across once and never read again");
});
