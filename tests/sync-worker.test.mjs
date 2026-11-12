import assert from "node:assert/strict";
import test from "node:test";
import { handleSync } from "../worker/sync.js";

const CLIENT = "client-123.apps.googleusercontent.com";
const ORIGIN = "https://x.test";

function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => (rows.has(args[0]) ? rows.get(args[0]) : null),
            run: async () => { if (/^\s*DELETE/i.test(sql)) rows.delete(args[0]); else rows.set(args[0], { document: args[1], updated_at: args[2] }); },
          };
        },
      };
    },
  };
}

const google = (claims) => async () => new Response(JSON.stringify(claims), { status: claims ? 200 : 400 });
const good = { iss: "https://accounts.google.com", aud: CLIENT, sub: "user-1", email: "a@example.com", name: "Alex", picture: "https://example.com/a.png", email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 3600) };
const doc = { schemaVersion: 1, extensions: { switchProfiles: [{ id: "alex" }] } };
const newEnv = () => ({ DB: fakeDb(), GOOGLE_CLIENT_ID: CLIENT, SESSION_SECRET: "a-long-random-secret-for-tests" });

const post = (path, body, headers = {}) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
const call = (method, path, cookie, body, headers = {}) => new Request(`${ORIGIN}${path}`, { method, headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });

async function signIn(env, claims = good) {
  const response = await handleSync(post("/api/auth/google", { credential: "tok" }), env, google(claims));
  const setCookie = response.headers.get("Set-Cookie");
  return { response, cookie: setCookie ? setCookie.split(";")[0] : null, setCookie };
}

test("ignores other paths", async () => {
  assert.equal(await handleSync(new Request(`${ORIGIN}/assets/a.js`), newEnv()), null);
});

test("answers 503 until the server is configured", async () => {
  assert.equal((await handleSync(call("GET", "/api/sync"), {})).status, 503);
  assert.equal((await handleSync(call("GET", "/api/sync"), { GOOGLE_CLIENT_ID: CLIENT, SESSION_SECRET: "s" })).status, 503);
});

test("sign-in sets a secure HTTP-only cookie and never returns the token", async () => {
  const { response, setCookie } = await signIn(newEnv());
  assert.equal(response.status, 200);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const body = await response.json();
  assert.deepEqual(body.account, { name: "Alex", email: "a@example.com", picture: "https://example.com/a.png" });
  assert.equal(JSON.stringify(body).includes("tok"), false);
});

test("refuses tokens meant for another app, unverified emails, and expired tokens", async () => {
  const env = newEnv();
  for (const claims of [{ ...good, aud: "someone-else" }, { ...good, email_verified: "false" }, { ...good, exp: "1" }, { ...good, iss: "evil.example" }, null]) {
    const { response, cookie } = await signIn(env, claims);
    assert.equal(response.status, 401);
    assert.equal(cookie, null);
  }
});

test("saves and returns a club, one row per account", async () => {
  const env = newEnv();
  const alex = (await signIn(env)).cookie;
  assert.equal((await (await handleSync(call("GET", "/api/sync", alex), env)).json()).document, null);
  assert.equal((await handleSync(call("PUT", "/api/sync", alex, { document: doc }), env)).status, 200);
  assert.deepEqual((await (await handleSync(call("GET", "/api/sync", alex), env)).json()).document, doc);
  const blair = (await signIn(env, { ...good, sub: "user-2" })).cookie;
  assert.equal((await (await handleSync(call("GET", "/api/sync", blair), env)).json()).document, null);
  assert.equal(env.DB.rows.size, 1);
});

test("rejects a missing, forged or tampered session", async () => {
  const env = newEnv();
  const cookie = (await signIn(env)).cookie;
  assert.equal((await handleSync(call("GET", "/api/sync"), env)).status, 401);
  assert.equal((await handleSync(call("GET", "/api/sync", "switch_session=abc.def"), env)).status, 401);
  const [body, signature] = cookie.split("=")[1].split(".");
  const forgedBody = Buffer.from(JSON.stringify({ sub: "user-9", exp: 9999999999 })).toString("base64url");
  assert.equal((await handleSync(call("GET", "/api/sync", `switch_session=${forgedBody}.${signature}`), env)).status, 401);
  assert.equal((await handleSync(call("GET", "/api/sync", cookie), { ...env, SESSION_SECRET: "a-different-secret" })).status, 401);
  assert.ok(body);
});

test("blocks writes from another site and bad bodies", async () => {
  const env = newEnv();
  const cookie = (await signIn(env)).cookie;
  const foreign = call("PUT", "/api/sync", cookie, { document: doc }, { Origin: "https://evil.test" });
  assert.equal((await handleSync(foreign, env)).status, 403);
  assert.equal((await handleSync(call("PUT", "/api/sync", cookie, { document: { hello: 1 } }), env)).status, 400);
  assert.equal((await handleSync(call("PATCH", "/api/sync", cookie), env)).status, 404);
  assert.equal((await handleSync(call("DELETE", "/api/sync", cookie, undefined, { Origin: "https://evil.test" }), env)).status, 403);
});

test("me reports the signed-in account, and logout clears the cookie", async () => {
  const env = newEnv();
  const cookie = (await signIn(env)).cookie;
  assert.equal((await (await handleSync(call("GET", "/api/auth/me", cookie), env)).json()).account.name, "Alex");
  assert.equal((await handleSync(call("GET", "/api/auth/me"), env)).status, 401);
  const out = await handleSync(post("/api/auth/logout", {}), env);
  assert.match(out.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("a signed-in person can erase their cloud copy, and only theirs", async () => {
  const env = newEnv();
  const alex = (await signIn(env)).cookie;
  const blair = (await signIn(env, { ...good, sub: "user-2" })).cookie;
  await handleSync(call("PUT", "/api/sync", alex, { document: doc }), env);
  await handleSync(call("PUT", "/api/sync", blair, { document: doc }), env);
  assert.equal((await handleSync(call("DELETE", "/api/sync", null), env)).status, 401);
  assert.equal((await handleSync(call("DELETE", "/api/sync", alex), env)).status, 200);
  assert.equal((await (await handleSync(call("GET", "/api/sync", alex), env)).json()).document, null);
  assert.deepEqual((await (await handleSync(call("GET", "/api/sync", blair), env)).json()).document, doc);
});
