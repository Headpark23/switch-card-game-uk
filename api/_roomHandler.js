import { handleRoom } from "./_room.js";
import { storeFromEnv } from "./_roomStore.js";
import { makeLimiter, tooMany } from "./_limit.js";

// A family on one home connection shares one address and every phone polls every second or two, so this is far
// more generous than the club limit. It is only a flood guard.
const allow = makeLimiter({ max: 900, windowMs: 60_000 });
const unavailable = (message) => new Response(JSON.stringify({ error: message }), { status: 503, headers: { "content-type": "application/json" } });

export default {
  async fetch(request) {
    if (!allow(request)) return tooMany();
    const store = storeFromEnv();
    if (!store) return unavailable("Playing with friends is not switched on yet.");
    try { return await handleRoom(request, store); } catch { return unavailable("Playing with friends is unavailable right now."); }
  },
};
