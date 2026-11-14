#!/usr/bin/env node
// Measures what the computer tactics are worth: tactical computers against plain ones, same level, seats rotated.
// Usage: node scripts/ai-selfplay.mjs [games=600] [personalities|ablate]
import { writeFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rolldown } from "rolldown";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await rolldown({ input: path.join(root, "scripts", "ai-selfplay-entry.ts"), platform: "node", logLevel: "warn" });
const { output } = await bundle.generate({ format: "esm" });
await bundle.close();
const dir = mkdtempSync(path.join(os.tmpdir(), "switch-selfplay-"));
const file = path.join(dir, "engine.mjs");
writeFileSync(file, output[0].code);
const { applyTableAction, createTable, chooseTableAction, PERSONALITIES } = await import(pathToFileURL(file).href);

const games = Number(process.argv[2] ?? 600);
const mode = process.argv[3] ?? "personalities";
let seed = 12345;
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** One game. `styles[seat]` is the options for that seat. */
function play(seats, level, styles) {
  let state = createTable(seats, random, Math.floor(random() * seats));
  let guard = 0;
  while (state.status === "playing" && guard++ < 3000) state = applyTableAction(state, chooseTableAction(state, random, level, styles[state.turn]));
  return { winner: state.winner, finished: state.status === "won", moves: state.move };
}

/** One seat plays tactically (rotating), everyone else plays plain. `weights` overrides the personality. */
function versus(seats, level, personality, weights) {
  let wins = 0, finished = 0, moves = 0;
  for (let game = 0; game < games; game += 1) {
    const tactical = game % seats;
    const styles = Array.from({ length: seats }, (_, seat) => (seat === tactical ? (weights ? { weights } : { personality }) : { tactics: false }));
    const result = play(seats, level, styles);
    if (result.finished) { finished += 1; moves += result.moves; if (result.winner === tactical) wins += 1; }
  }
  const rate = wins / finished;
  return { rate, margin: 1.96 * Math.sqrt((rate * (1 - rate)) / finished), finished, avgMoves: Math.round(moves / finished) };
}
const pct = (r) => `${(r.rate * 100).toFixed(1)}% ±${(r.margin * 100).toFixed(1)}`;

if (mode === "ablate") {
  const ids = ["tempo", "shield", "aces", "patience", "hunter", "counting", "planner"];
  const only = (set) => Object.fromEntries(ids.map((id) => [id, set.includes(id) ? 1 : 0]));
  for (const level of ["standard", "sharp"]) {
    const allowed = level === "standard" ? ["tempo", "shield", "aces"] : ids;
    console.log(`\n${level.toUpperCase()} heads up, vs plain: one tactic at a time, then all but one`);
    for (const id of allowed) console.log(`  only ${id.padEnd(9)} ${pct(versus(2, level, "balanced", only([id])))}`);
    console.log(`  everything  ${pct(versus(2, level, "balanced", only(allowed)))}`);
    for (const id of allowed) console.log(`  all but ${id.padEnd(9)} ${pct(versus(2, level, "balanced", only(allowed.filter((x) => x !== id))))}`);
  }
} else {
  for (const level of ["standard", "sharp"]) {
    for (const seats of [2, 4]) {
      console.log(`\n${level.toUpperCase()}, ${seats} seats, 1 tactical vs ${seats - 1} plain (fair share ${(100 / seats).toFixed(0)}%)`);
      for (const personality of ["balanced", ...PERSONALITIES.map((p) => p.id)]) {
        const r = versus(seats, level, personality);
        console.log(`  ${personality.padEnd(8)} wins ${pct(r)}  finished ${r.finished}/${games}  avg moves ${r.avgMoves}`);
      }
    }
  }
}
