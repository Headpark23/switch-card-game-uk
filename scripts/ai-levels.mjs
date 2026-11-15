#!/usr/bin/env node
// Measures the three levels against each other, heads up, seats alternating: Easy < Medium < Hard.
// Usage: node scripts/ai-levels.mjs [games=1000]
// Checks the two-player engine (what tests/switch-opponent.spec.ts measures) and the table engine at 2 and 4 seats.
import { writeFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rolldown } from "rolldown";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await rolldown({ input: path.join(root, "scripts", "ai-levels-entry.ts"), platform: "node", logLevel: "warn" });
const { output } = await bundle.generate({ format: "esm" });
await bundle.close();
const dir = mkdtempSync(path.join(os.tmpdir(), "switch-levels-"));
const file = path.join(dir, "engine.mjs");
writeFileSync(file, output[0].code);
const { applyTableAction, createTable, chooseTableAction, applyAction, createInitialGame, chooseComputerAction } = await import(pathToFileURL(file).href);

const games = Number(process.argv[2] ?? 1000);
let seed = 99;
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pct = (wins, n) => { const r = wins / n; return `${(r * 100).toFixed(1)}% ±${(196 * Math.sqrt((r * (1 - r)) / n)).toFixed(1)}`; };

/** Two-player engine, as the Playwright test plays it. */
function twoPlayer(a, b) {
  const mirror = (s) => ({ ...s, playerHand: s.computerHand, computerHand: s.playerHand, turn: s.turn === "player" ? "computer" : "player" });
  let wins = 0, finished = 0;
  for (let game = 0; game < games; game += 1) {
    let state = createInitialGame(random, game % 2 ? "player" : "computer");
    while (state.status === "playing" && state.move < 800) {
      const action = state.turn === "computer" ? chooseComputerAction(state, random, a) : chooseComputerAction(mirror(state), random, b);
      state = applyAction(state, action);
    }
    if (state.status === "won") { finished += 1; if (state.winner === "computer") wins += 1; }
  }
  return pct(wins, finished);
}

/** Table engine: one seat of level `a` (rotating) against the rest at level `b`. Fair share is 1/seats. */
function table(seats, a, b) {
  let wins = 0, finished = 0;
  for (let game = 0; game < games; game += 1) {
    const mine = game % seats;
    let state = createTable(seats, random, Math.floor(random() * seats));
    let guard = 0;
    while (state.status === "playing" && guard++ < 3000) state = applyTableAction(state, chooseTableAction(state, random, state.turn === mine ? a : b, {}));
    if (state.status === "won") { finished += 1; if (state.winner === mine) wins += 1; }
  }
  return pct(wins, finished);
}

const pairs = [["standard", "relaxed"], ["sharp", "standard"], ["sharp", "relaxed"]];
for (const [a, b] of pairs) {
  console.log(`${a} vs ${b}: two-player engine ${twoPlayer(a, b)} | table 2 seats ${table(2, a, b)} | table 4 seats (fair 25%) ${table(4, a, b)}`);
}
