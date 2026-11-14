// Where the dashboard's counters live: one small private file per day. Also used to count server-side events.
import { get, list, put } from "@vercel/blob";
import { bump, tally } from "./_stats.js";

const PREFIX = "stats/days/";
const pathFor = (day) => `${PREFIX}${day}.json`;

export const statsStore = {
  async read(day) {
    const result = await get(pathFor(day), { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  },
  async write(day, doc) {
    await put(pathFor(day), JSON.stringify(doc), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  },
  async list() {
    const names = [];
    let cursor;
    for (let page = 0; page < 20; page += 1) {
      const result = await list({ prefix: PREFIX, cursor, limit: 1000 });
      for (const blob of result.blobs) names.push(blob.pathname.slice(PREFIX.length).replace(/\.json$/, ""));
      if (!result.hasMore) break;
      cursor = result.cursor;
    }
    return names;
  },
};

/** Counts something that happened on the server (not reported by a phone). Never throws and never slows a request down much. */
export async function countOnServer(keys) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try { await bump(statsStore, { add: Object.fromEntries(keys.map((key) => [key, 1])), max: {} }); } catch { /* a missed count is fine */ }
}

/** Counts phone-style events (such as a visit) from the server's own side. */
export async function recordOnServer(events) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try { await bump(statsStore, tally(events)); } catch { /* a missed count is fine */ }
}
