// Differential test: the app's rules engine (src/switch/rules.ts) against the independent simulator
// built from the written rules (scripts/table-sim.mjs). Needs the dev server: npm run dev -- --port 4199
import { legalPlays, newGame, rng, step, STYLES, rankOf } from "./table-sim.mjs";

/** Builds the positions and moves from the written-rules simulator. Pure Node, no browser. */
export function buildCases(games) {

const snapshots = [];
for (const n of [2, 3, 4]) {
  for (let i = 0; i < games; i++) {
    const random = rng(9000 + i * 7 + n);
    const g = newGame(n, random);
    const names = Array.from({ length: n }, (_, k) => Object.keys(STYLES)[(k + i) % 4]);
    while (g.winner === null && g.moves < 600) {
      snapshots.push({
        n, hand: [...g.hands[g.cur]], others: g.hands.filter((_, k) => k !== g.cur).flat(), draw: [...g.draw], discard: [...g.discard], suit: g.suit, penalty: g.penalty,
        legal: legalPlays(g).map((p) => ({ key: [...p.cards].sort().join(",") + (rankOf(p.cards[0]) === "A" ? "@" + p.suit : "") })),
      });
      const plays = legalPlays(g);
      step(g, STYLES[names[g.cur]](g, plays, random));
    }
  }
}

const transitions = [];
for (let i = 0; i < games * 3; i++) {
  const random = rng(500 + i);
  const g = newGame(2, random);
  const names = [Object.keys(STYLES)[i % 4], Object.keys(STYLES)[(i + 1) % 4]];
  while (g.winner === null && g.moves < 600) {
    const before = { hand: [...g.hands[g.cur]], other: [...g.hands[1 - g.cur]], draw: [...g.draw], discard: [...g.discard], suit: g.suit, penalty: g.penalty };
    const cur = g.cur;
    const decision = STYLES[names[g.cur]](g, legalPlays(g), random);
    step(g, decision);
    transitions.push({ before, decision, after: { mine: g.hands[cur].length, theirs: g.hands[1 - cur].length, suit: g.suit, top: g.discard.at(-1), penalty: g.penalty, sameMover: g.cur === cur, winner: g.winner === cur ? "mover" : null } });
  }
}
return { snapshots, transitions };
}

/** Runs both comparisons inside a page that can import the app's engine. Returns mismatch counts and samples. */
export async function compareInPage(page, { snapshots, transitions }) {
const result = await page.evaluate(async (all) => {
  const rules = await import("/src/switch/rules.ts");
  const mismatches = [];
  let checked = 0;
  for (const s of all) {
    const pen = !s.penalty ? null : s.penalty.kind === "two" ? { kind: "draw-two", cards: s.penalty.cards } : s.penalty.kind === "king" ? { kind: "black-king", units: s.penalty.units, cards: s.penalty.cards } : { kind: "miss-turn" };
    const ctx = { discardPile: s.discard, currentSuit: s.suit, pendingPenalty: pen };
    const engine = rules.legalActionsFor(s.hand, ctx, { jackMayFinish: s.n > 2 }).filter((a) => a.type === "play")
      .map((a) => [...a.cards].sort().join(",") + (a.cards[0].slice(0, -1) === "A" ? "@" + a.chosenSuit : ""));
    const mine = new Set(s.legal.map((l) => l.key));
    const theirs = new Set(engine);
    checked++;
    const onlyMine = [...mine].filter((k) => !theirs.has(k));
    const onlyEngine = [...theirs].filter((k) => !mine.has(k));
    if (onlyMine.length || onlyEngine.length) mismatches.push({ n: s.n, hand: s.hand.join(" "), top: s.discard.at(-1), suit: s.suit, penalty: s.penalty?.kind ?? null, onlyWrittenRules: onlyMine.slice(0, 4), onlyEngine: onlyEngine.slice(0, 4) });
  }
  return { checked, mismatches: mismatches.length, sample: mismatches.slice(0, 12) };
}, snapshots);
const moved = await page.evaluate(async (all) => {
  const rules = await import("/src/switch/rules.ts");
  const bad = [];
  let checked = 0;
  for (const t of all) {
    const b = t.before;
    const pen = !b.penalty ? null : b.penalty.kind === "two" ? { kind: "draw-two", cards: b.penalty.cards } : b.penalty.kind === "king" ? { kind: "black-king", units: b.penalty.units, cards: b.penalty.cards } : { kind: "miss-turn" };
    const state = { playerHand: b.hand, computerHand: b.other, drawPile: b.draw, discardPile: b.discard, currentSuit: b.suit, turn: "player", pendingPenalty: pen, status: "playing", winner: null, move: 0 };
    const action = t.decision.kind === "pickup" ? (pen?.kind === "miss-turn" ? { type: "accept-missed-turn" } : { type: "draw" }) : { type: "play", cards: t.decision.play.cards, chosenSuit: t.decision.play.cards[0].slice(0, -1) === "A" ? t.decision.play.suit : undefined };
    let next;
    try { next = rules.applyAction(state, action); } catch (e) { bad.push({ why: "engine refused a move the written rules allow", hand: b.hand.join(" "), top: b.discard.at(-1), penalty: b.penalty?.kind ?? null, action: JSON.stringify(action) }); continue; }
    checked++;
    const a = t.after;
    const enginePen = !next.pendingPenalty ? null : next.pendingPenalty.kind === "draw-two" ? { kind: "two", cards: next.pendingPenalty.cards } : next.pendingPenalty.kind === "black-king" ? { kind: "king", units: next.pendingPenalty.units, cards: next.pendingPenalty.cards } : { kind: "miss" };
    const diffs = [];
    if (next.playerHand.length !== a.mine) diffs.push("mover hand " + next.playerHand.length + " vs " + a.mine);
    if (next.computerHand.length !== a.theirs) diffs.push("other hand " + next.computerHand.length + " vs " + a.theirs);
    if (next.currentSuit !== a.suit) diffs.push("suit " + next.currentSuit + " vs " + a.suit);
    if (next.discardPile.at(-1) !== a.top && !(t.decision.kind === "pickup")) diffs.push("top card");
    if (JSON.stringify(enginePen) !== JSON.stringify(a.penalty)) diffs.push("penalty " + JSON.stringify(enginePen) + " vs " + JSON.stringify(a.penalty));
    if ((next.turn === "player") !== a.sameMover) diffs.push("whose turn: engine says " + next.turn + ", rules say mover " + (a.sameMover ? "plays again" : "passes"));
    if (diffs.length) bad.push({ diffs, hand: b.hand.join(" "), top: b.discard.at(-1), suit: b.suit, penalty: b.penalty?.kind ?? null, action: JSON.stringify(action) });
  }
  return { checked, mismatches: bad.length, sample: bad.slice(0, 10) };
}, transitions);
return { legality: result, transitions: moved };
}

const isMain = process.argv[1] && process.argv[1].split("\\").join("/").endsWith("scripts/engine-vs-rules.mjs");
if (isMain) {
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(new URL("../package.json", import.meta.url))("@playwright/test");
  const port = process.argv[2] ?? "4199";
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/?frame=1`);
  console.log(JSON.stringify(await compareInPage(page, buildCases(Number(process.argv[3] ?? 150))), null, 1));
  await browser.close();
}
