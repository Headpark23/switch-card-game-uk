// Plays whole nights of every scoring format through the app's real scoring modules, using real
// Switch games (scripts/table-sim.mjs) for who wins and what is left in hands.
// Usage: node --experimental-transform-types scripts/scoring-sim.mjs [nights per format]
import { legalPlays, newGame, rng, step, STYLES, rankOf } from "./table-sim.mjs";
const src = (f) => new URL(`../src/switch/${f}.ts`, import.meta.url).href;
const { createSession, applyScoreCommand } = await import(src("scoring"));
const { createCup, selectCupWinner, drawNextCupRound } = await import(src("cup"));
const { createKnockout, markLost } = await import(src("knockout"));
const { rankLeague, createCrossLeaguePlayoffs } = await import(src("leagues"));

const nights = Number(process.argv[2] ?? 500);
const STYLE_NAMES = Object.keys(STYLES);
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
const note = {};
const flag = (key, example) => { note[key] ??= { count: 0, example }; note[key].count++; };

function cardValue(card, aceValue) {
  const r = rankOf(card);
  if (r === "A") return aceValue;
  if (r === "J") return 11;
  if (r === "Q") return 12;
  if (r === "K") return 13;
  return Number(r);
}

/** One real game. Returns finishing order (winner first) by continuing play after a player goes out. */
function playRound(n, seed, allowContinue = false) {
  const random = rng(seed);
  const g = newGame(n, random);
  const names = Array.from({ length: n }, (_, k) => STYLE_NAMES[(k + seed) % 4]);
  const out = [];
  let guard = 0;
  while (guard++ < 6000) {
    if (!allowContinue && g.winner !== null) break;
    const alive = g.hands.map((h, i) => (out.includes(i) ? null : i)).filter((i) => i !== null);
    if (alive.length <= 1) break;
    if (out.includes(g.cur)) { g.cur = (g.cur + g.dir + n) % n; continue; }
    const decision = STYLES[names[g.cur]](g, legalPlays(g), random);
    const before = g.cur;
    step(g, decision);
    if (g.hands[before].length === 0 && !out.includes(before)) { out.push(before); g.winner = null; }
    if (!allowContinue && out.length) break;
  }
  const last = g.hands.map((h, i) => i).filter((i) => !out.includes(i));
  return { order: [...out, ...last], g, finished: out.length > 0 };
}

// ---------- One v One / Domino (2 players, real hand values) ----------
const domino = { nights: 0, rounds: [], tieAtTarget: 0, overshoot: [], zeroRound: 0, noEndState: 0 };
for (const aceValue of [1, 11]) {
  for (let i = 0; i < nights; i++) {
    let s = createSession("domino", mkPlayers(2), { target: 100 });
    let rounds = 0;
    while (rounds < 400) {
      const r = playRound(2, 7000 + i * 31 + rounds + aceValue);
      if (!r.finished) { flag("2-player game did not finish", `night ${i}`); break; }
      const win = r.order[0];
      const left = r.g.hands[1 - win].reduce((t, c) => t + cardValue(c, aceValue), 0);
      if (left === 0) domino.zeroRound++;
      s = applyScoreCommand(s, { type: "add-score", playerId: s.players[win].id, value: left });
      rounds++;
      const [a, b] = s.players.map((p) => s.scores[p.id]);
      if (a >= 100 || b >= 100) {
        domino.overshoot.push(Math.max(a, b) - 100);
        if (a >= 100 && b >= 100) domino.tieAtTarget++;
        // the app never announces a winner or stops accepting scores: prove it
        const more = applyScoreCommand(s, { type: "add-score", playerId: "p1", value: 5 });
        if (more.scores.p1 === a + 5) domino.noEndState++;
        break;
      }
    }
    domino.rounds.push(rounds);
    domino.nights++;
  }
}
domino.rounds.sort((x, y) => x - y);
const dominoOut = { nightsPlayed: domino.nights, medianRounds: domino.rounds[domino.rounds.length >> 1], shortest: domino.rounds[0], longest: domino.rounds.at(-1), avgOvershootPastTarget: +(domino.overshoot.reduce((t, x) => t + x, 0) / domino.overshoot.length).toFixed(1), maxOvershoot: Math.max(...domino.overshoot), bothPlayersOverTarget: domino.tieAtTarget, roundsWorthZero: domino.zeroRound, appKeepsAcceptingScoresAfterTarget: domino.noEndState === domino.nights };

// ---------- Darts ----------
const darts = { matches: 0, legsPerSet: [], legCounts: {}, setWon3to2: 0, overtimeSets: 0, noEndState: 0, setsHit: 0, drawnPositions: {} };
for (let i = 0; i < nights; i++) {
  const random = rng(100 + i);
  let s = createSession("darts", mkPlayers(2), { setsToWin: 3 });
  let legsThisSet = 0, guard = 0;
  while (guard++ < 400) {
    const w = random() < 0.5 ? "p1" : "p2";
    const prev = s.darts.sets.p1 + s.darts.sets.p2;
    s = applyScoreCommand(s, { type: "win-leg", playerId: w });
    legsThisSet++;
    const l = s.darts.legs;
    if (l.p1 === l.p2 && l.p1 >= 2) darts.drawnPositions[`${l.p1}-${l.p2}`] = (darts.drawnPositions[`${l.p1}-${l.p2}`] ?? 0) + 1;
    if (s.darts.sets.p1 + s.darts.sets.p2 > prev) {
      darts.legsPerSet.push(legsThisSet);
      if (legsThisSet > 5) darts.overtimeSets++;
      legsThisSet = 0;
    }
    if (s.darts.sets.p1 >= 3 || s.darts.sets.p2 >= 3) {
      darts.setsHit++;
      const more = applyScoreCommand(s, { type: "win-leg", playerId: "p1" });
      if (more.darts.legs.p1 === s.darts.legs.p1 + 1 || more.darts.sets.p1 !== s.darts.sets.p1) darts.noEndState++;
      break;
    }
  }
  darts.matches++;
}
darts.legsPerSet.forEach((n) => (darts.legCounts[n] = (darts.legCounts[n] ?? 0) + 1));
const dartsOut = { matches: darts.matches, matchesReachingThreeSets: darts.setsHit, legsNeededToWinASet: darts.legCounts, setsNeedingMoreThanFiveLegs: darts.overtimeSets, leg2all_or_higher_deadlocks: darts.drawnPositions, appKeepsAcceptingLegsAfterMatchWon: darts.noEndState === darts.setsHit, setsToWinButtonLabelFixedAt3: "Scorekeeper passes setsToWin:3 always; the written mode says agree 3 or 5" };

// ---------- Knock Out (3-6 players; last holder out each round) ----------
const ko = { byPlayers: {}, roundsPlayed: [], singleFinishers: 0, rounds: 0 };
for (const n of [3, 4, 5, 6]) {
  let ok = 0, games = 0, stuck = 0;
  const seatWins = Array(n).fill(0);
  for (let i = 0; i < nights; i++) {
    let st = createKnockout(mkPlayers(n));
    let remaining = n, r = 0;
    while (st.championId === null && r < 40) {
      const alive = st.players.filter((p) => !st.eliminatedIds.includes(p.id));
      const round = playRound(n, 900 + i * 17 + r * 3 + n, true);
      // last holder among the players still in
      const order = round.order.filter((idx) => alive.some((p) => p.id === `p${idx + 1}`));
      const loserIdx = order.at(-1);
      st = markLost(st, `p${loserIdx + 1}`);
      remaining--; r++;
      if (!round.finished) stuck++;
    }
    games++;
    if (st.championId) { ok++; seatWins[Number(st.championId.slice(1)) - 1]++; }
    ko.roundsPlayed.push(r);
  }
  ko.byPlayers[n] = { nights: games, decidedChampion: ok, stuck, roundsToChampion: n - 1, championBySeat: seatWins.join("/") };
}
// the real question: the written rule says the last holder drops out EACH ROUND, but a round is only 'over' when everyone else is out of cards
const koRoundLengths = [];
for (const n of [3, 4, 5, 6]) {
  let totalMoves = 0, games = 0;
  for (let i = 0; i < 300; i++) {
    const a = playRound(n, 31000 + i, false), b = playRound(n, 31000 + i, true);
    totalMoves += b.g.moves - a.g.moves; games++;
  }
  koRoundLengths.push(`${n} players: playing on until one player is left holding cards adds about ${(totalMoves / games).toFixed(0)} turns vs stopping at the first winner`);
}

// ---------- Switch Cup ----------
const cup = { byN: {}, byeStreaks: 0, totalRounds: {}, stalled: 0, bye: {} };
for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const res = { champ: 0, rounds: [], byes: 0, sameByeTwice: 0, matchesPerPlayer: Array(n).fill(0), freeRide: 0, bestWithBye: 0 };
  const byeCount = Array(n).fill(0);
  for (let i = 0; i < nights; i++) {
    const random = rng(5000 + i * 7 + n);
    let c = createCup(mkPlayers(n), random);
    const played = Array(n).fill(0);
    let guard = 0;
    while (!c.championId && guard++ < 30) {
      const round = c.rounds.at(-1);
      if (round.byePlayerId) { res.byes++; byeCount[Number(round.byePlayerId.slice(1)) - 1]++; }
      for (const f of round.fixtures) {
        f.playerIds.forEach((p) => played[Number(p.slice(1)) - 1]++);
        c = selectCupWinner(c, f.id, f.playerIds[random() < 0.5 ? 0 : 1]);
      }
      c = drawNextCupRound(c, random);
    }
    if (c.championId) { res.champ++; res.rounds.push(c.rounds.length); }
    // champion who got a bye in the final round of play? count players who won the cup having played fewer games
    const champIdx = Number(c.championId.slice(1)) - 1;
    if (played[champIdx] < Math.max(...played) - 0) res.freeRide++;
  }
  cup.byN[n] = { nights, champions: res.champ, roundsMin: Math.min(...res.rounds), roundsMax: Math.max(...res.rounds), byesPerNight: +(res.byes / nights).toFixed(2), championsWhoPlayedFewerGamesThanSomeoneElse: res.freeRide, };
}
// bye fairness: can the same player get a bye in consecutive rounds / in the first round and again?
let repeatBye = 0, cupsChecked = 0;
for (let i = 0; i < 2000; i++) {
  const random = rng(8000 + i);
  let c = createCup(mkPlayers(7), random);
  const seen = new Set();
  let guard = 0;
  while (!c.championId && guard++ < 10) {
    const r = c.rounds.at(-1);
    if (r.byePlayerId) { if (seen.has(r.byePlayerId)) repeatBye++; seen.add(r.byePlayerId); }
    for (const f of r.fixtures) c = selectCupWinner(c, f.id, f.playerIds[random() < 0.5 ? 0 : 1]);
    c = drawNextCupRound(c, random);
  }
  cupsChecked++;
}

// ---------- League night / Group Play (4-player leagues the app builds, +1 per win) ----------
const lg = { ties: 0, leaguesRanked: 0, tieBreakByEntryOrder: 0, nightsWithTieForTop2: 0, nightsWithTieForSecond: 0 };
const tieExamples = [];
for (let i = 0; i < nights; i++) {
  const pts = { p1: 0, p2: 0, p3: 0, p4: 0 };
  for (let r = 0; r < 4; r++) {
    const round = playRound(4, 12000 + i * 5 + r, false);
    pts[`p${round.order[0] + 1}`]++;
  }
  const results = mkPlayers(4).map((p) => ({ player: p, points: pts[p.id] }));
  const ranked = rankLeague(results);
  lg.leaguesRanked++;
  const dup = (a, b) => a.points === b.points;
  if (dup(ranked[1], ranked[2])) { lg.nightsWithTieForSecond++; if (tieExamples.length < 3) tieExamples.push(ranked.map((r) => `${r.rank}.${r.player.name}=${r.points}`).join(" ")); }
  if (ranked.some((r, k) => k > 0 && dup(r, ranked[k - 1]))) lg.ties++;
}
// written Group Play: rounds = players, finishing places earn N..1; simulate with 3..6 players
const gp = {};
for (const n of [3, 4, 5, 6]) {
  let tiesTop = 0, tiesBottomTwoSplit = 0, tiesAny = 0;
  for (let i = 0; i < nights; i++) {
    const pts = Array(n).fill(0);
    for (let r = 0; r < n; r++) {
      const round = playRound(n, 20000 + i * 11 + r, true);
      round.order.forEach((idx, place) => (pts[idx] += n - place));
    }
    const sorted = [...pts].sort((a, b) => b - a);
    if (sorted.some((v, k) => k > 0 && v === sorted[k - 1])) tiesAny++;
    if (sorted[1] === sorted[2]) tiesBottomTwoSplit++;
    if (sorted[0] === sorted[1]) tiesTop++;
  }
  gp[n] = { nights, anyTieInTable: tiesAny, tieAtTopSpot: tiesTop, tieForTheLastChampionshipSpot_2nd_vs_3rd: tiesBottomTwoSplit, note: n === 5 ? "5/4/3/2/1 as written" : `no written points for ${n} players; sim used ${n}..1` };
}
// a 3-player night: top two and bottom two overlap
const overlap3 = "With 3 players the 'top two' and 'bottom two' finals share the middle player; with 4 they just fit; the app's own league maker is fixed at 4 per league.";

// ---------- cross-league playoffs ----------
const four = (k) => ({ id: `l${k}`, name: `L${k}`, results: Array.from({ length: 4 }, (_, i) => ({ player: { id: `l${k}p${i}`, name: `L${k}P${i}` }, points: 4 - i })) });
const two = createCrossLeaguePlayoffs([four(1), four(2)], Math.random);
const three = createCrossLeaguePlayoffs([four(1), four(2), four(3)], Math.random);
const oneLeague = createCrossLeaguePlayoffs([four(1)], Math.random);
const playoffs = {
  twoLeagues: two.status === "ready" ? two.championship.fixtures.map((f) => `${f.home.player.name} v ${f.away.player.name}`) : two.reason,
  threeLeaguesChampionship: three.status === "ready" ? three.championship.fixtures.map((f) => `${f.home.player.name} v ${f.away.player.name}`) : three.reason,
  oneLeague: oneLeague.status === "ready" ? "ready" : oneLeague.reason,
};
// 2 leagues: 1st of L1 meets 2nd of L2, 1st of L2 meets 2nd of L1 -> two semi-style games and then?
const playoffOutcomeStage = "Playoffs produce fixtures only; there is no screen or state to record who won or crown a champion";

console.log(JSON.stringify({
  nightsPerFormat: nights,
  dominoAndOneVOne: dominoOut,
  darts: dartsOut,
  knockOut: { byPlayers: ko.byPlayers, extraTurnsToPlayOnUntilLastHolderKnown: koRoundLengths },
  switchCup: { byPlayers: cup.byN, sameByePlayerGettingAnotherByeLaterWith7Players: `${repeatBye} of ${cupsChecked} cups` },
  leagueAsAppBuildsIt: { leaguesRanked: lg.leaguesRanked, leaguesWithAnyTiedPlaces: lg.ties, leaguesTiedFor2ndAnd3rd_decidesPlayoffs: lg.nightsWithTieForSecond, examples: tieExamples, tieBreak: "entry order (whoever was typed first ranks higher)" },
  groupPlayAsWritten: gp, overlap3, playoffs, playoffOutcomeStage,
}, null, 1));
