import assert from "node:assert/strict";
import test from "node:test";
import { makeLimiter } from "../api/_limit.js";

const req = (ip) => new Request("https://x.test/api/hit", { headers: { "x-forwarded-for": ip } });

test("allows a burst up to the limit, then blocks until the window passes", () => {
  const allow = makeLimiter({ max: 3, windowMs: 60_000 });
  assert.deepEqual([1, 2, 3, 4].map(() => allow(req("1.1.1.1"), 1000)), [true, true, true, false]);
  assert.equal(allow(req("2.2.2.2"), 1000), true);
  assert.equal(allow(req("1.1.1.1"), 61_001), true);
});
