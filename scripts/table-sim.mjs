// Plays full Switch games for 2-6 players, straight from the WRITTEN rules (src/content.ts),
// independent of src/switch/rules.ts. Used to find places where the rules do not make sense.
// Usage: node scripts/table-sim.mjs [players] [games] [seed] [--story]
const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const rankOf = (c) => c.slice(0, -1);
export const suitOf = (c) => c.slice(-1);
const SYM = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const pretty = (c) => rankOf(c) + SYM[suitOf(c)];
const POWER = new Set(["A", "2", "7", "8", "J", "K"]);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(n, random) {
  const deck = RANKS.flatMap((r) => SUITS.map((s) => r + s));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({ length: n }, () => []);
  for (let r = 0; r < 7; r++) for (let p = 0; p < n; p++) hands[p].push(deck.pop());
  let idx = deck.length - 1;
  while (idx > 0 && POWER.has(rankOf(deck[idx]))) idx--; // a power card turned up is tucked back; turn the next
  const starter = deck.splice(idx, 1)[0];
  return { n, hands, draw: deck, discard: [starter], suit: suitOf(starter), dir: 1, cur: 0, penalty: null, moves: 0, recycles: 0, winner: null, ambiguous: {} };
}

const playable = (g, c) => {
  const top = g.discard.at(-1);
  const r = rankOf(c);
  if (!g.penalty) return r === "A" || suitOf(c) === g.suit || r === rankOf(top);
  if (g.penalty.kind === "two") return r === "2";
  if (g.penalty.kind === "king") return r === "K";
  return r === "8";
};
const cannotFinish = (g, rank) => rank === "7" || (rank === "J" && g.n === 2);

const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));

export function legalPlays(g, p = g.cur) {
  const hand = g.hands[p];
  const out = [];
  for (const rank of new Set(hand.map(rankOf))) {
    const same = hand.filter((c) => rankOf(c) === rank);
    for (let mask = 1; mask < 1 << same.length; mask++) {
      const set = same.filter((_, i) => mask & (1 << i));
      if (cannotFinish(g, rank) && set.length === hand.length) continue;
      if (!set.some((c) => playable(g, c))) continue;
      if (rank === "K") {
        for (const order of perms(set)) if (playable(g, order[0])) out.push({ cards: order, suit: suitOf(order.at(-1)) });
        continue;
      }
      for (const last of set) {
        const lead = set.find((c) => c !== last && playable(g, c)) ?? (playable(g, last) ? last : null);
        if (!lead) continue;
        const order = [lead, ...set.filter((c) => c !== lead && c !== last), ...(last !== lead ? [last] : [])];
        if (rank === "A") { for (const s of SUITS) out.push({ cards: order, suit: s }); break; }
        out.push({ cards: order, suit: suitOf(last) });
      }
    }
  }
  return out;
}

function drawCards(g, p, count) {
  let got = 0;
  while (got < count) {
    if (!g.draw.length) {
      if (g.discard.length <= 1) break;
      const top = g.discard.pop();
      g.draw = g.discard.reverse(); // turning the played pile face down flips it: the oldest card ends on top
      g.discard = [top];
      g.recycles++;
    }
    g.hands[p].push(g.draw.pop());
    got++;
  }
  return got;
}
const mod = (a, n) => ((a % n) + n) % n;

/** Applies one decision: {kind:'play', play:{cards,suit}} or {kind:'pickup'}. Returns a log line. */
export function step(g, decision) {
  const p = g.cur;
  const name = `P${p + 1}`;
  g.moves++;
  if (decision.kind === "pickup") {
    const forced = g.penalty && g.penalty.kind !== "miss";
    const count = forced ? g.penalty.cards : g.penalty ? 0 : 1;
    const got = count ? drawCards(g, p, count) : 0;
    const was = g.penalty;
    g.penalty = null;
    g.cur = mod(p + g.dir, g.n);
    if (was?.kind === "miss") return `${name} misses the turn`;
    if (was) return `${name} picks up ${count} penalty cards${got < count ? ` (only ${got} left to draw)` : ""}`;
    return `${name} picks up a card${got ? "" : " (nothing left to draw!)"}`;
  }
  const { cards, suit } = decision.play;
  const rank = rankOf(cards[0]);
  g.hands[p] = g.hands[p].filter((c) => !cards.includes(c));
  g.discard.push(...cards);
  g.suit = rank === "A" ? suit : suitOf(cards.at(-1));
  const k = cards.length;
  let note = "";
  if (k > 1 && ["8", "7", "A"].includes(rank)) g.ambiguous[`${k}x${rank}`] = (g.ambiguous[`${k}x${rank}`] ?? 0) + 1;
  if (rank === "2") g.penalty = { kind: "two", cards: (g.penalty?.cards ?? 0) + 2 * k };
  else if (rank === "8") g.penalty = { kind: "miss" };
  else if (rank === "K") {
    let units = g.penalty?.kind === "king" ? g.penalty.units : 0;
    for (const c of cards) units = "SC".includes(suitOf(c)) ? Math.min(2, units + 1) : Math.max(0, units - 1);
    if (cards.some((c) => "SC".includes(suitOf(c))) && cards.some((c) => "HD".includes(suitOf(c)))) g.ambiguous["black+red king in one play"] = (g.ambiguous["black+red king in one play"] ?? 0) + 1;
    g.penalty = units ? { kind: "king", units, cards: units * 5 } : null;
  } else g.penalty = null;
  let next;
  if (rank === "7") { next = p; note = " and plays again"; }
  else if (rank === "J" && k % 2 === 1) {
    if (g.n === 2) { next = p; note = " (two players: play comes straight back)"; }
    else { g.dir *= -1; next = mod(p + g.dir, g.n); note = " and reverses direction"; }
  } else next = mod(p + g.dir, g.n);
  if (!g.hands[p].length) g.winner = p;
  g.cur = next;
  return `${name} plays ${cards.map(pretty).join(" ")}${rank === "A" ? ` and calls ${SYM[suit]}` : ""}${note}`;
}

const isPower = (c) => POWER.has(rankOf(c));
/** Playing styles so a table is made of genuinely different people. */
export const STYLES = {
  Cautious: (g, plays) => {
    const plain = plays.filter((x) => !isPower(x.cards[0]));
    if (plain.length) return { kind: "play", play: [...plain].sort((a, b) => b.cards.length - a.cards.length)[0] };
    if (g.penalty) return plays.length ? { kind: "play", play: plays[0] } : { kind: "pickup" };
    return g.hands[g.cur].length <= 3 && plays.length ? { kind: "play", play: plays[0] } : { kind: "pickup" };
  },
  Aggressive: (g, plays) => {
    if (!plays.length) return { kind: "pickup" };
    return { kind: "play", play: [...plays].sort((a, b) => Number(isPower(b.cards[0])) - Number(isPower(a.cards[0])) || b.cards.length - a.cards.length)[0] };
  },
  Hoarder: (g, plays) => {
    const noAce = plays.filter((x) => rankOf(x.cards[0]) !== "A");
    const pool = noAce.length ? noAce : plays;
    return pool.length ? { kind: "play", play: pool[0] } : { kind: "pickup" };
  },
  Random: (g, plays, random) => {
    const options = [...plays.map((play) => ({ kind: "play", play })), { kind: "pickup" }];
    return options[Math.floor(random() * options.length)];
  },
};

export function check(g, label) {
  const all = [...g.hands.flat(), ...g.draw, ...g.discard];
  const problems = [];
  if (all.length !== 52 || new Set(all).size !== 52) problems.push(`${label}: cards not conserved (${all.length} cards, ${new Set(all).size} unique)`);
  if (g.penalty && g.penalty.kind === "two" && g.penalty.cards > 8) problems.push(`${label}: two-penalty above 8`);
  return problems;
}

export function playGame({ n, seed, styles, cap = 4000, story = false }) {
  const random = rng(seed);
  const g = newGame(n, random);
  const log = [];
  const problems = [];
  const names = styles ?? Array.from({ length: n }, (_, i) => Object.keys(STYLES)[i % 4]);
  if (story) log.push(`Start card ${pretty(g.discard[0])}. Hands: ${g.hands.map((h, i) => `P${i + 1}(${names[i]}) ${h.length}`).join(", ")}`);
  let stalls = 0;
  let lastSize = g.hands.reduce((s, h) => s + h.length, 0);
  while (g.winner === null && g.moves < cap) {
    const plays = legalPlays(g);
    const decision = STYLES[names[g.cur]](g, plays, random);
    const line = step(g, decision);
    if (story) log.push(`${String(g.moves).padStart(3)}. ${line}  [${g.hands.map((h) => h.length).join("/")}] top ${pretty(g.discard.at(-1))}${g.penalty ? ` ⚠ ${g.penalty.kind}${g.penalty.cards ? " " + g.penalty.cards : ""}` : ""}`);
    problems.push(...check(g, `move ${g.moves}`));
    if (g.winner !== null && cannotFinish(g, rankOf(g.discard.at(-1)))) problems.push(`P${g.winner + 1} won on a ${rankOf(g.discard.at(-1))} which the rules forbid`);
    const size = g.hands.reduce((s, h) => s + h.length, 0);
    stalls = size === lastSize && decision.kind === "pickup" ? stalls + 1 : 0;
    lastSize = size;
    if (stalls > n * 6) { problems.push("stalemate: nobody can draw or play"); break; }
  }
  return { g, log, problems, finished: g.winner !== null, names };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/table-sim.mjs");
if (isMain) {
  const nums = process.argv.slice(2).filter((x) => !x.startsWith("--")).map(Number);
  const [n = 4, games = 500, seed = 1] = nums;
  const story = process.argv.includes("--story");
  const stat = { finished: 0, capped: 0, moves: [], recycles: 0, maxHand: 0, problems: new Set(), ambiguous: {}, wins: {}, finishRank: {} };
  for (let i = 0; i < games; i++) {
    const r = playGame({ n, seed: seed * 100003 + i, story: story && i === 0 });
    if (story && i === 0) console.log(r.log.join("\n"));
    if (r.finished) {
      stat.finished++;
      stat.moves.push(r.g.moves);
      const w = r.names[r.g.winner];
      stat.wins[w] = (stat.wins[w] ?? 0) + 1;
      const fr = rankOf(r.g.discard.at(-1));
      stat.finishRank[fr] = (stat.finishRank[fr] ?? 0) + 1;
    } else stat.capped++;
    stat.recycles += r.g.recycles;
    stat.maxHand = Math.max(stat.maxHand, ...r.g.hands.map((h) => h.length));
    r.problems.forEach((p) => stat.problems.add(p.replace(/move \d+/, "move N")));
    for (const [k, v] of Object.entries(r.g.ambiguous)) stat.ambiguous[k] = (stat.ambiguous[k] ?? 0) + v;
  }
  stat.moves.sort((a, b) => a - b);
  console.log(JSON.stringify({ players: n, games, finished: stat.finished, notFinished: stat.capped, medianMoves: stat.moves[Math.floor(stat.moves.length / 2)], longest: stat.moves.at(-1), shortest: stat.moves[0], deckRecycles: stat.recycles, biggestHandSeen: stat.maxHand, winsByStyle: stat.wins, winningCardRank: stat.finishRank, ambiguousCombos: stat.ambiguous, problems: [...stat.problems] }, null, 1));
}
