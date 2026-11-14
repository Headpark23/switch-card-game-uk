// Where online tables live: Redis (Upstash), one JSON document per table under switch:room:CODE, each with an expiry.
// Talks to Upstash's REST address with plain fetch, so there is nothing extra to install.
// The database is shared with another app, so every key starts with switch:room: and always carries an expiry.
const PREFIX = "switch:room:";

/** Replaces the table only if it is still at the revision the caller read. Returns 1 if it did, 0 if another request got there first. */
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if cjson.decode(current).rev ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1`;

export function redisStore(url, token, fetcher = fetch) {
  async function run(command) {
    const response = await fetcher(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(command) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error || `Redis answered ${response.status}`);
    return body.result;
  }
  return {
    async read(code) {
      const text = await run(["GET", PREFIX + code]);
      return text ? JSON.parse(text) : null;
    },
    async create(code, room, ttlSeconds) {
      return (await run(["SET", PREFIX + code, JSON.stringify(room), "EX", String(ttlSeconds), "NX"])) === "OK";
    },
    async cas(code, expectedRev, room, ttlSeconds) {
      return (await run(["EVAL", COMPARE_AND_SET, "1", PREFIX + code, String(expectedRev), JSON.stringify(room), String(ttlSeconds)])) === 1;
    },
  };
}

export function storeFromEnv(env = process.env, fetcher = fetch) {
  const url = env.ROOMS_KV_REST_API_URL || env.KV_REST_API_URL;
  const token = env.ROOMS_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? redisStore(url, token, fetcher) : null;
}
