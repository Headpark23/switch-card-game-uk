// Google sign-in and cloud backup for signed-in clubs.
//
// Routes:
//   POST /api/auth/google   body {credential}: verifies the Google ID token, sets a secure session cookie
//   POST /api/auth/logout   clears the cookie
//   GET  /api/auth/me       who is signed in
//   GET  /api/sync          the saved club for the signed-in account
//   PUT  /api/sync          save the club
//
// Environment:
//   GOOGLE_CLIENT_ID  the OAuth web client ID (tokens meant for any other app are refused)
//   SESSION_SECRET    a long random string used to sign the session cookie
//   DB                a D1 database with:
//     CREATE TABLE IF NOT EXISTS club_sync (user_id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL);
//
// Each Google account can only ever read and write its own row. The Google token is
// used once at sign-in; afterwards only an HTTP-only cookie is used.

const MAX_BODY_BYTES = 1_000_000;
const COOKIE = "switch_session";
const SESSION_SECONDS = 60 * 60 * 24 * 365; // stay signed in for a year
const encoder = new TextEncoder();

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload, secret) {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64url(signature)}`;
}

export async function readSession(cookieValue, secret) {
  if (!cookieValue || !secret) return null;
  const [body, signature] = cookieValue.split(".");
  if (!body || !signature) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(signature), encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return payload.exp * 1000 > Date.now() && payload.sub ? payload : null;
  } catch {
    return null;
  }
}

function cookieFrom(request, name) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

const sessionCookie = (value, maxAge) => `${COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;

export async function verifyGoogleToken(token, clientId, fetcher = fetch) {
  if (!token || !clientId) return null;
  const response = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const claims = await response.json();
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (claims.aud !== clientId || !issuerOk || !verified || !claims.sub) return null;
  if (Number(claims.exp) * 1000 < Date.now()) return null;
  return {
    sub: String(claims.sub),
    email: String(claims.email ?? ""),
    name: String(claims.name ?? claims.email ?? ""),
    picture: typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : "",
  };
}

function isDocument(value) {
  return !!value && typeof value === "object" && value.schemaVersion === 1 && !!value.extensions && typeof value.extensions === "object" && !Array.isArray(value.extensions);
}

/** Changing requests must come from this site, as a second guard beside SameSite cookies. */
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: json({ error: "Too large" }, 413) };
  try { return { value: JSON.parse(text) }; } catch { return { error: json({ error: "Invalid JSON" }, 400) }; }
}

/** Returns a Response for /api/auth/* and /api/sync requests, or null for anything else. */
export async function handleSync(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  const isAuth = url.pathname.startsWith("/api/auth/");
  if (url.pathname !== "/api/sync" && !isAuth) return null;
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) return json({ error: "Sign-in is not set up on this server" }, 503);
  if (request.method !== "GET" && !sameOrigin(request)) return json({ error: "Wrong origin" }, 403);

  if (url.pathname === "/api/auth/google" && request.method === "POST") {
    const { value, error } = await readJson(request);
    if (error) return error;
    const user = await verifyGoogleToken(value?.credential, env.GOOGLE_CLIENT_ID, fetcher);
    if (!user) return json({ error: "Not signed in" }, 401);
    const cookie = await signSession({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, env.SESSION_SECRET);
    return json({ account: { name: user.name, email: user.email, picture: user.picture } }, 200, { "Set-Cookie": sessionCookie(cookie, SESSION_SECONDS) });
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  const session = await readSession(cookieFrom(request, COOKIE), env.SESSION_SECRET);
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return session ? json({ account: { name: session.name, email: session.email, picture: session.picture } }) : json({ error: "Not signed in" }, 401);
  }
  if (url.pathname !== "/api/sync" || !["GET", "PUT", "DELETE"].includes(request.method)) return json({ error: "Not found" }, 404);
  if (!env.DB) return json({ error: "Cloud storage is not set up on this server" }, 503);
  if (!session) return json({ error: "Not signed in" }, 401);

  if (request.method === "DELETE") {
    // GDPR erasure: the signed-in person can remove their cloud copy at any time.
    await env.DB.prepare("DELETE FROM club_sync WHERE user_id = ?").bind(session.sub).run();
    return json({ ok: true });
  }

  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT document, updated_at FROM club_sync WHERE user_id = ?").bind(session.sub).first();
    return json({ document: row ? JSON.parse(row.document) : null, updatedAt: row?.updated_at ?? null });
  }

  const { value, error } = await readJson(request);
  if (error) return error;
  if (!isDocument(value?.document)) return json({ error: "Not a Switch backup" }, 400);
  const updatedAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO club_sync (user_id, document, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at")
    .bind(session.sub, JSON.stringify(value.document), updatedAt).run();
  return json({ ok: true, updatedAt });
}
