import { get, put } from "@vercel/blob";
import { handleClub } from "./_club.js";
import { makeLimiter, tooMany } from "./_limit.js";
import { countOnServer } from "./_statsStore.js";

const allow = makeLimiter({ max: 120, windowMs: 60_000 });

const store = {
  async read(code) {
    const result = await get(`club-share/${code}.json`, { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  },
  async write(code, row) {
    await put(`club-share/${code}.json`, JSON.stringify(row), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  },
};

export default {
  async fetch(request) {
    if (!allow(request)) return tooMany();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response(JSON.stringify({ error: "Sharing is not switched on yet." }), { status: 503, headers: { "content-type": "application/json" } });
    try {
      const response = await handleClub(request, store);
      // A new shared club is the moment sharing starts; every later save from a phone is a sync.
      if (request.method === "POST" && response.status === 201) await countOnServer(["server.clubs.created"]);
      else if (request.method === "PUT" && response.ok) await countOnServer(["server.clubs.syncs"]);
      return response;
    } catch { return new Response(JSON.stringify({ error: "Club sharing is unavailable right now." }), { status: 503, headers: { "content-type": "application/json" } }); }
  },
};
