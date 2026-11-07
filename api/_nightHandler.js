import { get, put } from "@vercel/blob";
import { handleNight } from "./_night.js";

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
    if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response(JSON.stringify({ error: "Sharing is not switched on yet." }), { status: 503, headers: { "content-type": "application/json" } });
    try { return await handleNight(request, store); } catch { return new Response(JSON.stringify({ error: "Sharing is unavailable right now." }), { status: 503, headers: { "content-type": "application/json" } }); }
  },
};
