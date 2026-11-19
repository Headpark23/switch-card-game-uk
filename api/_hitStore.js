// The footer's lifetime visit counter. It lives in Redis now (one atomic add per visit); the total counted before the move
// sits in Blob (site/hits.json) and is copied across once, the first time Blob can be read. Until then the footer hides its number.
import { get } from "@vercel/blob";
import { redisClient } from "./_redis.js";

const BASE = "switch:hits:base";
const DELTA = "switch:hits:delta";
const KEEP_SECONDS = 10 * 365 * 86_400;
const ADD = "local n = redis.call('INCR', KEYS[1]) redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) return n";

async function legacyHits() {
  const result = await get("site/hits.json", { access: "private" }); // throws when Blob cannot be read: the base stays unknown
  if (!result || !result.stream) return 0;
  const hits = JSON.parse(await new Response(result.stream).text())?.hits;
  return Number.isFinite(hits) && hits > 0 ? Math.floor(hits) : 0;
}

export function makeHitStore({ redis, legacy = legacyHits }) {
  async function base() {
    const known = await redis.run(["GET", BASE]);
    if (known !== null && known !== undefined) return Number(known);
    const fromBlob = await legacy();
    await redis.run(["SET", BASE, String(fromBlob), "EX", String(KEEP_SECONDS), "NX"]);
    return Number(await redis.run(["GET", BASE]));
  }
  return {
    configured: Boolean(redis),
    /** { hits }. Throws while the earlier total cannot be read, so the footer shows nothing instead of a wrong number. */
    async read() {
      const [start, added] = await Promise.all([base(), redis.run(["GET", DELTA])]);
      return { hits: start + Number(added ?? 0) };
    },
    async increment() {
      await redis.run(["EVAL", ADD, "1", DELTA, String(KEEP_SECONDS)]);
    },
  };
}

export const hitStore = makeHitStore({ redis: redisClient() });
