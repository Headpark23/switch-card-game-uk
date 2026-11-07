import assert from "node:assert/strict";
import test from "node:test";
import { makeDb } from "../api/_db.js";
import { handleSync, signSession } from "../worker/sync.js";

const memory = () => { const rows = new Map(); return { read: async (id) => rows.get(id) ?? null, write: async (id, row) => { rows.set(id, row); } }; };

test("the file-backed store keeps one club per Google account", async () => {
  const db = makeDb(memory());
  const env = { GOOGLE_CLIENT_ID: "client", SESSION_SECRET: "secret-secret-secret", DB: db };
  const cookie = await signSession({ sub: "user-1", email: "a@b.c", name: "A", picture: "", exp: Math.floor(Date.now() / 1000) + 3600 }, env.SESSION_SECRET);
  const other = await signSession({ sub: "user-2", email: "d@e.f", name: "D", picture: "", exp: Math.floor(Date.now() / 1000) + 3600 }, env.SESSION_SECRET);
  const call = (method, who, body) => handleSync(new Request("https://x.test/api/sync", { method, headers: { Cookie: `switch_session=${who}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }), env);
  const doc = { schemaVersion: 1, extensions: { switchProfiles: [{ id: "p1" }] } };
  assert.equal((await (await call("GET", cookie)).json()).document, null);
  assert.equal((await call("PUT", cookie, { document: doc })).status, 200);
  assert.deepEqual((await (await call("GET", cookie)).json()).document, doc);
  assert.equal((await (await call("GET", other)).json()).document, null);
  assert.equal((await call("GET", "bad.cookie")).status, 401);
});
