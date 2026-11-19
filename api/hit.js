import { handleHit } from "./_hit.js";
import { makeLimiter, tooMany } from "./_limit.js";
import { recordOnServer } from "./_statsStore.js";
import { hitStore } from "./_hitStore.js";

const allow = makeLimiter({ max: 60, windowMs: 60_000 });

export default {
  async fetch(request) {
    const fail = () => new Response(JSON.stringify({ error: "Counter unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    if (!allow(request)) return tooMany();
    if (!hitStore.configured) return fail();
    try {
      const response = await handleHit(request, hitStore);
      // The footer counter is the lifetime total; the dashboard also wants visits per day.
      if (request.method === "POST" && response.ok) await recordOnServer([{ e: "visit" }]);
      return response;
    } catch { return fail(); }
  },
};
