import { get, put } from "@vercel/blob";
import { handleNight } from "./_night.js";
import { makeLimiter, tooMany } from "./_limit.js";
import { countOnServer } from "./_statsStore.js";

const allow = makeLimiter({ max: 120, windowMs: 60_000 });

const store = {
  async read(code) {
    const result = await get(`night-share/${code}.json`, { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  },
  async write(code, row) {
    await put(`night-share/${code}.json`, JSON.stringify(row), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  },
};

export default {
  async fetch(request) {
    if (!allow(request)) return tooMany();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response(JSON.stringify({ error: "Sharing is not switched on yet." }), { status: 503, headers: { "content-type": "application/json" } });
    try {
      const response = await handleNight(request, store);
      if (request.method === "POST" && response.status === 201) await countOnServer(["server.nights.shared"]);
      else if (request.method === "PATCH" && response.ok) await countOnServer(["server.nights.joined"]);
      return response;
    } catch { return new Response(JSON.stringify({ error: "Sharing is unavailable right now." }), { status: 503, headers: { "content-type": "application/json" } }); }
  },
};
