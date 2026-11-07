import assert from "node:assert/strict";
import test from "node:test";
import { playGame } from "../scripts/table-sim.mjs";

// Every table size, played to the end by four different styles of player, straight from the written rules.
for (const n of [2, 3, 4, 5, 6]) {
  test(`${n} players: 300 full games finish, keep all 52 cards, and never win on a forbidden card`, () => {
    for (let i = 0; i < 300; i++) {
      const result = playGame({ n, seed: 1000 + i });
      assert.deepEqual(result.problems, [], `seed ${1000 + i}`);
      assert.equal(result.finished, true, `game ${i} with ${n} players did not finish`);
    }
  });
}
