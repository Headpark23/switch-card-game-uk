import { expect, test } from "@playwright/test";
// @ts-expect-error plain JavaScript module shared with the Vercel function
import { createRoom, joinRoom, startRoom, tick, REACTIONS } from "../api/_room.js";

/** A small deterministic random, so the table plays the same game every run. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4_294_967_296; };
}

function playOut(seed: number, humans: boolean) {
  const random = seeded(seed);
  const start = 1_000_000;
  const room = createRoom({ seats: 4, level: "standard", name: "Mark", mode: "single" }, "token", start);
  joinRoom(room, "Rebecca", "token2", start);
  startRoom(room, 0, start, random);
  // Everyone is away, so the clocks run on and the computers cover for the person.
  if (!humans) for (const seat of room.seats) seat.kind = "computer";
  let moves = 0;
  for (let step = 1; step <= 400 && room.tables.some((table: { finishedAt: number | null }) => table.finishedAt === null); step += 1) {
    tick(room, start + step * 3_000, random);
    moves = room.tables[0].seq;
  }
  return { room, moves };
}

test("computers at an online table react now and then, only with real reactions, and never every move", () => {
  let said = 0, moves = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const { room, moves: played } = playOut(seed, true);
    moves += played;
    said += room.reactions.length;
    for (const entry of room.reactions) {
      expect(REACTIONS).toContain(entry.id);
      expect(room.seats[entry.player].kind).toBe("computer");
    }
  }
  expect(said).toBeGreaterThan(0);
  expect(said).toBeLessThan(moves / 4);
});

test("computer-only tables stay silent", () => {
  const { room } = playOut(3, false);
  expect(room.reactions).toHaveLength(0);
});
