// A tiny Redis (Upstash REST) client shared by the counters. Plain fetch, nothing to install.
// The database is shared with another app, so every Switch key starts with "switch:" and always carries an expiry.
export function redisClient(env = process.env, fetcher = fetch) {
  const url = env.ROOMS_KV_REST_API_URL || env.KV_REST_API_URL;
  const token = env.ROOMS_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return {
    async run(command) {
      const response = await fetcher(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(command) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) throw new Error(body.error || `Redis answered ${response.status}`);
      return body.result;
    },
  };
}
