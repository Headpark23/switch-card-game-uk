import assert from "node:assert/strict";
import test from "node:test";
import { handleHit } from "../api/_hit.js";

const memory = () => { let row = null; return { read: async () => row, write: async (next) => { row = next; } }; };
const req = (method, headers = {}) => new Request("https://x.test/api/hit", { method, headers });

test("counts each page load and starts from zero", async () => {
  const store = memory();
  assert.deepEqual(await (await handleHit(req("GET"), store)).json(), { hits: 0 });
  assert.deepEqual(await (await handleHit(req("POST"), store)).json(), { hits: 1 });
  assert.deepEqual(await (await handleHit(req("POST", { Origin: "https://x.test" }), store)).json(), { hits: 2 });
  assert.deepEqual(await (await handleHit(req("GET"), store)).json(), { hits: 2 });
});

test("ignores other sites and other methods, and stores only a number", async () => {
  const store = memory();
  assert.equal((await handleHit(req("POST", { Origin: "https://evil.test" }), store)).status, 403);
  assert.equal((await handleHit(req("DELETE"), store)).status, 405);
  await handleHit(req("POST", { "x-forwarded-for": "1.2.3.4", "user-agent": "secret" }), store);
  assert.deepEqual(await store.read(), { hits: 1 });
});
