// Cloud sync endpoint for signed-in clubs. Not yet wired into worker/index.js:
// that file is part of the protected runtime and needs an explicit go-ahead.
//
// Needs two things in the environment:
//   GOOGLE_CLIENT_ID  the OAuth web client ID (tokens for any other app are refused)
//   DB                a D1 database with:
//     CREATE TABLE IF NOT EXISTS club_sync (user_id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL);
//
// Each Google account can only ever read and write its own row.

const MAX_BODY_BYTES = 1_000_000;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function verifyGoogleToken(token, clientId, fetcher = fetch) {
  if (!token || !clientId) return null;
  const response = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const claims = await response.json();
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (claims.aud !== clientId || !issuerOk || !verified || !claims.sub) return null;
  if (Number(claims.exp) * 1000 < Date.now()) return null;
  return { userId: String(claims.sub), email: String(claims.email ?? "") };
}

function isDocument(value) {
  return !!value && typeof value === "object" && value.schemaVersion === 1 && !!value.extensions && typeof value.extensions === "object" && !Array.isArray(value.extensions);
}

/** Returns a Response for /api/sync requests, or null for anything else. */
export async function handleSync(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/sync") return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!["GET", "PUT"].includes(request.method)) return json({ error: "Method not allowed" }, 405);
  if (!env.DB || !env.GOOGLE_CLIENT_ID) return json({ error: "Sync is not set up on this server" }, 503);

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s*/i, "");
  const user = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, fetcher);
  if (!user) return json({ error: "Not signed in" }, 401);

  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT document, updated_at FROM club_sync WHERE user_id = ?").bind(user.userId).first();
    return json({ document: row ? JSON.parse(row.document) : null, updatedAt: row?.updated_at ?? null });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "Too large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!isDocument(body?.document)) return json({ error: "Not a Switch backup" }, 400);

  const updatedAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO club_sync (user_id, document, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at")
    .bind(user.userId, JSON.stringify(body.document), updatedAt).run();
  return json({ ok: true, updatedAt });
}
