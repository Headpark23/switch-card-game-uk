// Where the dashboard's counters live: Redis, one pair of hashes per UTC day (counters and peaks), added to atomically.
// Counting used to rewrite one Blob file per event, which used up Blob's monthly operations and got the store suspended
// (19 Nov 2026), so Blob now holds only shared clubs and nights. Days counted before the move are still read from Blob
// (stats/days/YYYY-MM-DD.json) when Blob is reachable; if it is not, those days are simply missing.
import { get, list } from "@vercel/blob";
import { redisClient } from "./_redis.js";
import { bump, tally } from "./_stats.js";

const LEGACY = "stats/days/";
const DAYS_SET = "switch:stats:days";
const dayKeys = (day) => [`switch:stats:c:${day}`, `switch:stats:m:${day}`];
const KEEP_SECONDS = 800 * 86_400; // a little over two years, matching the dashboard's longest range

// Adds every counter and raises every peak in one round trip, so two events in the same instant never lose one.
const INCREMENT = `
local add = cjson.decode(ARGV[1])
local top = cjson.decode(ARGV[2])
for k, v in pairs(add) do redis.call('HINCRBY', KEYS[1], k, math.floor(v)) end
for k, v in pairs(top) do
  local cur = tonumber(redis.call('HGET', KEYS[2], k) or '0') or 0
  if v > cur then redis.call('HSET', KEYS[2], k, math.floor(v)) end
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
redis.call('SADD', KEYS[3], ARGV[4])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[3]))
return 1`;

const pairsToObject = (flat) => {
  const out = {};
  for (let index = 0; index + 1 < (flat?.length ?? 0); index += 2) out[flat[index]] = Number(flat[index + 1]);
  return out;
};

async function legacyRead(day) {
  try {
    const result = await get(`${LEGACY}${day}.json`, { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  } catch { return null; } // Blob suspended or the file is damaged: that day is just missing
}
async function legacyList() {
  const names = [];
  try {
    let cursor;
    for (let page = 0; page < 20; page += 1) {
      const result = await list({ prefix: LEGACY, cursor, limit: 1000 });
      for (const blob of result.blobs) names.push(blob.pathname.slice(LEGACY.length).replace(/\.json$/, ""));
      if (!result.hasMore) break;
      cursor = result.cursor;
    }
  } catch { /* Blob unreachable: only counters kept in Redis are listed */ }
  return names;
}

/** `redis` is a client from redisClient() (or null); `legacy` reads days written before the move. Both can be replaced in tests. */
export function makeStatsStore({ redis, legacy = { read: legacyRead, list: legacyList } }) {
  return {
    configured: Boolean(redis),
    async increment(day, { add, max }) {
      await redis.run(["EVAL", INCREMENT, "3", ...dayKeys(day), DAYS_SET, JSON.stringify(add), JSON.stringify(max), String(KEEP_SECONDS), day]);
    },
    async read(day) {
      const [c, m] = await Promise.all(dayKeys(day).map(async (key) => pairsToObject(await redis.run(["HGETALL", key]))));
      if (Object.keys(c).length || Object.keys(m).length) return { day, c, m };
      return legacy.read(day);
    },
    async list() {
      const [fresh, old] = await Promise.all([redis.run(["SMEMBERS", DAYS_SET]), legacy.list()]);
      return [...new Set([...(fresh ?? []), ...old])];
    },
  };
}

const defaultRedis = redisClient();
export const statsStore = makeStatsStore({ redis: defaultRedis });
/** True when counting has somewhere to go. */
export const statsConfigured = () => Boolean(defaultRedis);

/** Counts something that happened on the server (not reported by a phone). Never throws and never slows a request down much. */
export async function countOnServer(keys) {
  if (!defaultRedis) return;
  try { await bump(statsStore, { add: Object.fromEntries(keys.map((key) => [key, 1])), max: {} }); } catch { /* a missed count is fine */ }
}

/** Adds ready-made increments (already worked out and capped by the server itself, such as online table counts). */
export async function recordIncrements(increments) {
  if (!defaultRedis) return;
  try { await bump(statsStore, increments); } catch { /* a missed count is fine */ }
}

/** Counts phone-style events (such as a visit) from the server's own side. */
export async function recordOnServer(events) {
  if (!defaultRedis) return;
  try { await bump(statsStore, tally(events)); } catch { /* a missed count is fine */ }
}
