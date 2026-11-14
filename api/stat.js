import { handleCollect } from "./_stats.js";
import { statsStore } from "./_statsStore.js";
import { makeLimiter, tooMany } from "./_limit.js";

const allow = makeLimiter({ max: 90, windowMs: 60_000 });

export default {
  async fetch(request) {
    // The app never waits on this or shows an error from it, so a quiet failure is the right failure.
    const quiet = () => new Response(JSON.stringify({ ok: false }), { status: 503, headers: { "content-type": "application/json" } });
    if (!allow(request)) return tooMany();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return quiet();
    try { return await handleCollect(request, statsStore); } catch { return quiet(); }
  },
};
