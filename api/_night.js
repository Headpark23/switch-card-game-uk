// Shared night codes: the host publishes a small read-only scoreboard under a short code, friends open the code to watch.
// Only names and scores are stored, and a night expires after two weeks. The host keeps a secret edit token on their phone.
// When the host saves a finished night, its result is kept under the code too, so every phone that joined can add it to its own history.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z2-9]{6}$/;
const MAX_BYTES = 24000;
const MAX_RESULTS = 20;
const FORMATS = ["head-to-head", "domino", "darts", "league", "knockout", "cup"];
const TTL_MS = 14 * 24 * 3_600_000;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const hash = (token) => createHash("sha256").update(token).digest("hex");
export const newCode = () => Array.from(randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

/** Keeps only what a scoreboard needs, trimmed so nothing large or odd is stored. */
export function cleanSnapshot(input) {
  if (!input || typeof input !== "object") return null;
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const lines = Array.isArray(input.lines) ? input.lines.slice(0, 24).map((line) => ({ label: text(line?.label, 40), value: text(line?.value, 60), lead: Boolean(line?.lead) })).filter((line) => line.label) : [];
  if (!lines.length) return null;
  const players = Array.isArray(input.players) ? input.players.slice(0, 24).map((name) => text(name, 40)).filter(Boolean) : [];
  const host = text(input.host, 40);
  return { title: text(input.title, 60) || "Switch night", format: text(input.format, 30), status: text(input.status, 80), lines, ...(players.length ? { players } : {}), ...(host ? { host } : {}), ...(input.done === true ? { done: true } : {}) };
}

/** A finished night as the host saved it: who played, who won and the full scores. Anything else is dropped. */
export function cleanResult(input) {
  if (!input || typeof input !== "object") return null;
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const id = text(input.id, 60);
  const completedAt = text(input.completedAt, 40);
  const players = Array.isArray(input.players) ? input.players.slice(0, 24).map((player) => ({ id: text(player?.id, 60), name: text(player?.name, 40) })).filter((player) => player.id && player.name) : [];
  if (!id || Number.isNaN(Date.parse(completedAt)) || !FORMATS.includes(input.format) || players.length < 1) return null;
  const ids = new Set(players.map((player) => player.id));
  const details = Array.isArray(input.details) ? input.details.slice(0, 12).map((section) => ({ heading: text(section?.heading, 60), lines: Array.isArray(section?.lines) ? section.lines.slice(0, 120).map((line) => text(line, 120)).filter(Boolean) : [] })) : [];
  const place = input.place && typeof input.place === "object" && text(input.place.name, 60) && /^[A-Z]{2}$/.test(text(input.place.country, 2)) ? { name: text(input.place.name, 60), country: text(input.place.country, 2) } : null;
  return {
    version: 1, id, completedAt, title: text(input.title, 60) || "Switch night", format: input.format, formatLabel: text(input.formatLabel, 30) || "Switch",
    players, winnerIds: Array.isArray(input.winnerIds) ? input.winnerIds.filter((winner) => ids.has(winner)).slice(0, 24) : [],
    outcome: text(input.outcome, 160), details, ...(place ? { place } : {}),
  };
}

/**
 * A friend says "I am Martin" after opening the host's link, so the host can see who has joined.
 * No token is needed (friends do not have one), so only a name already on the scoreboard is accepted, spelled as the host wrote it.
 */
async function handleJoin(code, body, store, now) {
  if (!CODE.test(code)) return json({ error: "That code does not look right." }, 400);
  const row = await store.read(code);
  if (!row || now - row.updatedAt > TTL_MS) return json({ error: "No night found with that code." }, 404);
  const asked = typeof body?.joined === "string" ? body.joined.trim().slice(0, 40) : "";
  if (!asked) return json({ error: "Say which player you are." }, 400);
  const names = (row.snapshot?.players?.length ? row.snapshot.players : (row.snapshot?.lines ?? []).map((line) => String(line.label).replace(/^\d+\.\s*/, ""))).filter(Boolean);
  const same = (left, right) => left.trim().toLowerCase() === right.trim().toLowerCase();
  const name = names.find((candidate) => same(candidate, asked));
  if (!name) return json({ error: "That name is not on this night." }, 400);
  const joined = [{ name, at: now }, ...(row.joined ?? []).filter((entry) => !same(entry.name, name))].slice(0, 24);
  await store.write(code, { ...row, joined });
  return json({ code, joined });
}

export async function handleNight(request, store, now = Date.now()) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  if (request.method === "GET") {
    if (!CODE.test(code)) return json({ error: "That code does not look right." }, 400);
    const row = await store.read(code);
    if (!row || now - row.updatedAt > TTL_MS) return json({ error: "No night found with that code. Ask the host to check it." }, 404);
    return json({ code, snapshot: row.snapshot, results: row.results ?? [], joined: row.joined ?? [], updatedAt: row.updatedAt });
  }
  if (request.method !== "POST" && request.method !== "PUT" && request.method !== "PATCH") return json({ error: "Method not allowed" }, 405);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: "That scoreboard is too large." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
  if (request.method === "PATCH") return handleJoin(code, body, store, now);
  const snapshot = cleanSnapshot(body.snapshot);
  if (!snapshot) return json({ error: "Nothing to share yet." }, 400);
  if (request.method === "POST") {
    let fresh = "";
    for (let attempt = 0; attempt < 5 && !fresh; attempt += 1) {
      const candidate = newCode();
      const taken = await store.read(candidate);
      if (!taken || now - taken.updatedAt > TTL_MS) fresh = candidate;
    }
    if (!fresh) return json({ error: "Could not make a code. Try again." }, 503);
    const token = randomBytes(18).toString("hex");
    await store.write(fresh, { snapshot, tokenHash: hash(token), updatedAt: now });
    return json({ code: fresh, token }, 201);
  }
  if (!CODE.test(code)) return json({ error: "That code does not look right." }, 400);
  const row = await store.read(code);
  const token = request.headers.get("x-night-token") || "";
  if (!row) return json({ error: "No night found with that code." }, 404);
  const a = Buffer.from(hash(token)); const b = Buffer.from(row.tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Only the host can update this night." }, 403);
  const result = body.result === undefined || body.result === null ? null : cleanResult(body.result);
  if (body.result && !result) return json({ error: "That result could not be read." }, 400);
  const results = result ? [result, ...(row.results ?? []).filter((entry) => entry.id !== result.id)].slice(0, MAX_RESULTS) : row.results ?? [];
  await store.write(code, { ...row, snapshot, results, updatedAt: now });
  return json({ code, updatedAt: now });
}
