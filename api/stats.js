// The owner's dashboard data. Protected by STATS_TOKEN (set it in the Vercel project's environment variables).
// Without the token set the dashboard is simply off.
import { get, list } from "@vercel/blob";
import { authorised, readStats } from "./_stats.js";
import { statsStore } from "./_statsStore.js";
import { buildSnapshot } from "./_statsSnapshot.js";
import { makeLimiter, tooMany } from "./_limit.js";

// Guessing the token is the only attack on this endpoint, so keep it slow.
const allow = makeLimiter({ max: 20, windowMs: 60_000 });
const headers = { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function listAll(prefix) {
  const files = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const result = await list({ prefix, cursor, limit: 1000 });
    files.push(...result.blobs.map((blob) => ({ pathname: blob.pathname, size: blob.size, uploadedAt: blob.uploadedAt })));
    if (!result.hasMore) break;
    cursor = result.cursor;
  }
  return files;
}
async function readJson(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export default {
  async fetch(request) {
    if (!allow(request)) return tooMany();
    if (request.method !== "GET") return reply({ error: "Method not allowed" }, 405);
    if (!process.env.STATS_TOKEN) return reply({ error: "The dashboard is switched off. Set STATS_TOKEN (at least 12 characters) in the project's environment variables." }, 503);
    if (!authorised(request, process.env.STATS_TOKEN)) return reply({ error: "That token is not right." }, 401);
    if (!process.env.BLOB_READ_WRITE_TOKEN) return reply({ error: "Storage is not connected." }, 503);
    try {
      const days = Math.min(730, Math.max(7, Number(new URL(request.url).searchParams.get("days")) || 120));
      const [stats, snapshot, hits] = await Promise.all([
        readStats(statsStore, { days }),
        buildSnapshot({ list: listAll, read: readJson }),
        readJson("site/hits.json").catch(() => null),
      ]);
      return reply({ generatedAt: new Date().toISOString(), hits: hits?.hits ?? 0, ...stats, snapshot });
    } catch {
      return reply({ error: "The numbers could not be read just now." }, 503);
    }
  },
};
