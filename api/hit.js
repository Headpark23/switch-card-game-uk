import { get, put } from "@vercel/blob";
import { handleHit } from "./_hit.js";
import { makeLimiter, tooMany } from "./_limit.js";

const allow = makeLimiter({ max: 60, windowMs: 60_000 });

const PATH = "site/hits.json";
const store = {
  async read() {
    const result = await get(PATH, { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  },
  async write(row) {
    await put(PATH, JSON.stringify(row), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  },
};

export default {
  async fetch(request) {
    const fail = () => new Response(JSON.stringify({ error: "Counter unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    if (!allow(request)) return tooMany();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return fail();
    try { return await handleHit(request, store); } catch { return fail(); }
  },
};
