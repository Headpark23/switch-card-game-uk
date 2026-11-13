// Shared clubs: a club's players, saved nights and seasons live under a short code, so every phone that joins sees the same club.
// A phone sends its copy, the server folds it into the shared one (nothing is dropped) and sends the combined club back.
// Anyone holding the code can read and add to the club, like a shared link. Unknown fields are never stored.
import { randomBytes } from "node:crypto";
import { cleanResult } from "./_night.js";
import { MAX_NIGHTS, MAX_PROFILES, MAX_SEASONS, isShareable, mergeClub } from "./_clubMerge.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z2-9]{8}$/;
const MAX_BYTES = 3_000_000;
const COLOURS = ["forest", "gold", "clay", "navy"];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const newClubCode = () => Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const validDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

function cleanProfile(input) {
  const id = text(input?.id, 80); const name = text(input?.name, 40);
  if (!id || !name || !COLOURS.includes(input?.colour) || !validDate(input?.createdAt)) return null;
  return { version: 1, id, name, colour: input.colour, createdAt: input.createdAt, archived: Boolean(input.archived), ...(typeof input.updatedAt === "number" ? { updatedAt: input.updatedAt } : {}) };
}
function cleanSeason(input) {
  const id = text(input?.id, 80); const name = text(input?.name, 60);
  const ids = (list, max) => (Array.isArray(list) ? [...new Set(list.filter((entry) => typeof entry === "string").map((entry) => entry.slice(0, 80)))].slice(0, max) : []);
  const profileIds = ids(input?.profileIds, 60);
  if (!id || !name || profileIds.length < 2 || !validDate(input?.createdAt) || !["active", "complete"].includes(input?.status)) return null;
  return { version: 1, id, name, profileIds, createdAt: input.createdAt, status: input.status, nightIds: ids(input?.nightIds, 200) };
}

/** Keeps only well-formed players, nights and seasons, trimmed so nothing large or odd is stored. */
export function cleanClub(input) {
  const list = (value, clean, max) => (Array.isArray(value) ? value.slice(0, max).map(clean).filter(Boolean) : []);
  return {
    name: text(input?.name, 32), nameAt: typeof input?.nameAt === "number" ? input.nameAt : 0,
    profiles: list(input?.profiles, cleanProfile, MAX_PROFILES).filter(isShareable),
    nights: list(input?.nights, (night) => { const clean = cleanResult(night); return clean && isShareable(clean) ? clean : null; }, MAX_NIGHTS),
    seasons: list(input?.seasons, cleanSeason, MAX_SEASONS).filter(isShareable),
    removed: Array.isArray(input?.removed) ? input.removed.filter((id) => typeof id === "string").map((id) => id.slice(0, 80)).slice(-400) : [],
  };
}

export async function handleClub(request, store, now = Date.now()) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  if (request.method === "GET") {
    if (!CODE.test(code)) return json({ error: "That club code does not look right." }, 400);
    const row = await store.read(code);
    if (!row) return json({ error: "No club found with that code. Ask the person who made it to check it." }, 404);
    if (url.searchParams.get("since") === String(row.updatedAt)) return json({ code, unchanged: true, updatedAt: row.updatedAt });
    return json({ code, doc: row.doc, updatedAt: row.updatedAt });
  }
  if (request.method !== "POST" && request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: "That club is too large to share." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
  const incoming = cleanClub(body.doc);
  if (request.method === "POST") {
    let fresh = "";
    for (let attempt = 0; attempt < 5 && !fresh; attempt += 1) { const candidate = newClubCode(); if (!(await store.read(candidate))) fresh = candidate; }
    if (!fresh) return json({ error: "Could not make a code. Try again." }, 503);
    const doc = mergeClub(incoming, null);
    await store.write(fresh, { doc, updatedAt: now });
    return json({ code: fresh, doc, updatedAt: now }, 201);
  }
  if (!CODE.test(code)) return json({ error: "That club code does not look right." }, 400);
  const row = await store.read(code);
  if (!row) return json({ error: "No club found with that code." }, 404);
  const doc = mergeClub(row.doc, incoming);
  // Nothing new from this phone: leave the stored club (and its timestamp) alone.
  if (JSON.stringify(doc) === JSON.stringify(row.doc)) return json({ code, doc, updatedAt: row.updatedAt });
  await store.write(code, { doc, updatedAt: now });
  return json({ code, doc, updatedAt: now });
}
