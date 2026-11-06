import assert from "node:assert/strict";
import test from "node:test";
import { handleSync } from "../worker/sync.js";

const CLIENT = "client-123.apps.googleusercontent.com";

function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => (rows.has(args[0]) ? rows.get(args[0]) : null),
            run: async () => { rows.set(args[0], { document: args[1], updated_at: args[2] }); },
          };
        },
      };
    },
  };
}

const google = (claims) => async () => new Response(JSON.stringify(claims), { status: claims ? 200 : 400 });
const good = { iss: "https://accounts.google.com", aud: CLIENT, sub: "user-1", email: "a@example.com", email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 3600) };
const doc = { schemaVersion: 1, extensions: { switchProfiles: [{ id: "alex" }] } };
const request = (method, body, token = "tok") => new Request("https://x.test/api/sync", { method, headers: { Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });

test("ignores other paths", async () => {
  assert.equal(await handleSync(new Request("https://x.test/assets/a.js"), { DB: fakeDb(), GOOGLE_CLIENT_ID: CLIENT }), null);
});

test("refuses when not set up or not signed in", async () => {
  assert.equal((await handleSync(request("GET"), {}, google(good))).status, 503);
  const env = { DB: fakeDb(), GOOGLE_CLIENT_ID: CLIENT };
  assert.equal((await handleSync(request("GET"), env, google({ ...good, aud: "someone-else" }))).status, 401);
  assert.equal((await handleSync(request("GET"), env, google({ ...good, email_verified: "false" }))).status, 401);
  assert.equal((await handleSync(request("GET"), env, google({ ...good, exp: "1" }))).status, 401);
  assert.equal((await handleSync(request("GET", null, ""), env, google(good))).status, 401);
});

test("saves and returns a club, one row per account", async () => {
  const db = fakeDb();
  const env = { DB: db, GOOGLE_CLIENT_ID: CLIENT };
  assert.deepEqual((await (await handleSync(request("GET"), env, google(good))).json()).document, null);
  assert.equal((await handleSync(request("PUT", { document: doc }), env, google(good))).status, 200);
  assert.deepEqual((await (await handleSync(request("GET"), env, google(good))).json()).document, doc);
  const other = google({ ...good, sub: "user-2" });
  assert.deepEqual((await (await handleSync(request("GET"), env, other)).json()).document, null);
  assert.equal(db.rows.size, 1);
});

test("rejects bad bodies", async () => {
  const env = { DB: fakeDb(), GOOGLE_CLIENT_ID: CLIENT };
  assert.equal((await handleSync(request("PUT", { document: { hello: 1 } }), env, google(good))).status, 400);
  assert.equal((await handleSync(request("DELETE"), env, google(good))).status, 405);
});
