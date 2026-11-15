// Online play: a private table for friends and family. The server owns the games, so nobody can see another seat's
// cards. It deals, checks every move with the same engine the app uses (api/_engine.js is built from src/switch),
// plays for computers and for absent people, and sends each person a view with only their own hand in it.
//
// A table of up to 16 people can play a tournament, and its games run at the same time, as at a real card night:
// two leagues side by side, every Cup match of a round at once, a big Knock Out split across tables. Each game is a
// "table" with its own cards, clock and moves. Finished games and knock-outs are announced to everyone.
//
// Time is handled lazily: there are no timers on the server. Every request first catches up on anything that was due,
// at every table and in the order it happened (a computer's move, an absent player's move, a missed "Last Card" being
// spotted, the next game being dealt), then does what it was asked.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  applyTableAction, chooseTableAction, createTable, dealTo, isLegalTablePlay, isSeriesOver, MAX_SEATS, ONLINE_MAX_PLAYERS, pendingGames,
  penaliseMissedLastCard, resultOf, seriesOutcome, startSeries, submitGame, tablePlaces, validateSetup,
} from "./_engine.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z2-9]{6}$/;
const CARD = /^(?:A|10|[2-9]|J|Q|K)[SHDC]'?$/;
const LEVELS = ["relaxed", "standard", "sharp"];
const SUITS = ["S", "H", "D", "C"];
/** The seven computers of the Play lobby first, then more for big tables. */
const COMPUTER_NAMES = ["John", "Paul", "George", "Ringo", "Ziggy", "Marley", "Bowie", "Elton", "Freddie", "Dolly", "Stevie", "Cher", "Prince", "Adele", "Elvis"];
/** The ways to play at an online table. Knock Out with friends is "last one out leaves" (ruling 11; owner decision, 14 Nov 2026). */
export const MODES = Object.freeze(["single", "knockout", "cup", "group", "darts", "dominoes"]);
const MODE_NAMES = { single: "game", knockout: "Knock Out", cup: "Switch Cup", group: "Group Play", darts: "Darts match", dominoes: "Dominoes match" };
/** The most people at one online table (ruling 32). */
export const MAX_PLAYERS = 16;

/** Owner decision (14 Nov 2026): told at 30 s that the computer plays in 10 s; plays at 40 s. */
export const TIMING = Object.freeze({
  /** Time for the last move to finish playing on screen before a person's clock starts. */
  graceMs: 2_000,
  nudgeMs: 30_000,
  autoMs: 40_000,
  /** A person who has been played for twice running is "away": the computer plays for them after this. */
  awayMs: 5_000,
  /** The pause before a computer seat plays. Games with only computers play at this pace too, in real time. */
  computerMs: 2_000,
  /** How long someone holding one card has to say "Last Card" before the table spots it. */
  spotMs: 5_000,
  /** A move that reaches the server this soon after the deadline still beats the computer. */
  leniencyMs: 1_000,
  /** If nobody at all has been seen for this long, the clocks stop and start again when someone returns. */
  pauseMs: 30_000,
  /** How often a person's "last seen" is written. Polling must not turn every read into a write. */
  seenEveryMs: 10_000,
  reactionGapMs: 2_000,
  /** In a tournament, a game is dealt this long after the game it follows on from ends, unless the host deals it sooner. */
  betweenMs: 20_000,
  ttlMs: 24 * 3_600_000,
});
export const AWAY_AFTER = 2;

/**
 * The 55 reactions: ten cheeky sayings, eight stickers and thirty-seven spicy sayings (swear words always masked). The server keeps only the id; the
 * words and drawings live in the app (`src/switch/reactions.ts`). A spicy id is shown as its clean stand-in on any
 * phone that has Spicy off, so the server never needs to know who wants swearing.
 */
export const REACTIONS = Object.freeze([
  "read-em-and-weep", "all-youve-got", "sweating-yet", "absolute-sausage", "pick-up-sunshine", "who-taught-you", "lucky-so-and-so", "not-today-sweetheart", "revenge-is-coming", "behave",
  "smug-king", "salty", "card-shark", "sweating-ace", "mic-drop", "facepalm-jack", "crying-joker", "seven-on-fire",
  "spicy-bollocks", "spicy-bugger", "spicy-bloody-hell", "spicy-sod-off", "spicy-jammy", "spicy-cheating", "spicy-pick-up-arse", "spicy-shite-hand", "spicy-holy-shit", "spicy-piss-off", "spicy-fucking-yes", "spicy-for-fucks-sake",
  "spicy-wanker", "spicy-prick", "spicy-arsehole", "spicy-fk-off", "spicy-what-the-f", "spicy-no-f-way", "spicy-dick-move", "spicy-twat", "spicy-crap", "spicy-damn", "spicy-hell", "spicy-git",
  "spicy-lucky-bastard", "spicy-shitshow", "spicy-bullshit", "spicy-pissed", "spicy-f-hell", "spicy-dickhead", "spicy-bellend", "spicy-tosser", "spicy-sodding", "spicy-bloody-lucky", "spicy-piss-take", "spicy-eat-shit", "spicy-knob",
]);

export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const hash = (token) => createHash("sha256").update(token).digest("hex");
export const newCode = () => Array.from(randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
const secureRandom = () => randomInt(0, 4_294_967_296) / 4_294_967_296;

function cleanName(value) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 20) : "";
  if (!name) throw new RoomError("Type your first name.");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '.-]*$/u.test(name)) throw new RoomError("Use letters and numbers for your name.");
  return name;
}
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function humanSeat(name, token, now, host = false) {
  return { name, kind: "human", tokenHash: hash(token), host, joinedAt: now, seenAt: now, called: false, exposedAt: null, autoStreak: 0, autoTotal: 0, lastReactAt: 0 };
}

/** What the host chose: the way to play and its settings. Anything a tournament needs is checked by the app's own rules. */
function cleanSetup({ mode, setsToWin, limit }, capacity, level) {
  const chosen = mode === undefined ? "single" : mode;
  if (!MODES.includes(chosen)) throw new RoomError("That way to play is not recognised.");
  if (capacity > ONLINE_MAX_PLAYERS[chosen]) throw new RoomError(chosen === "single" ? `A single game is for up to ${MAX_SEATS} players.` : `${MODE_NAMES[chosen]} is for up to ${ONLINE_MAX_PLAYERS[chosen]} players.`);
  if (chosen === "single") return { mode: "single" };
  const setup = { mode: chosen, opponents: capacity - 1, level, knockout: "last-out",
    ...(chosen === "darts" ? { setsToWin: Number(setsToWin ?? 3) } : {}), ...(chosen === "dominoes" ? { limit: Number(limit ?? 100) } : {}) };
  const problem = validateSetup(setup, ONLINE_MAX_PLAYERS[chosen]);
  if (problem) throw new RoomError(problem.replace(/, so at least \d+ computers?\./, "."));
  return setup;
}

export function createRoom({ seats, level, name, mode, setsToWin, limit }, token, now) {
  const capacity = Number(seats);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > MAX_PLAYERS) throw new RoomError(`A table is for 2 to ${MAX_PLAYERS} players.`);
  const chosen = level === undefined ? "standard" : level;
  if (!LEVELS.includes(chosen)) throw new RoomError("Pick relaxed, standard or sharp computers.");
  return {
    v: 3, rev: 0, createdAt: now, updatedAt: now, status: "lobby", capacity, level: chosen, setup: cleanSetup({ mode, setsToWin, limit }, capacity, chosen),
    gameNo: 0, reactSeq: 0, newsSeq: 0, seriesNo: 0,
    seats: [humanSeat(cleanName(name), token, now, true)], tables: [], reactions: [], news: [], history: [],
    series: null, ready: {},
  };
}

export function joinRoom(room, name, token, now) {
  if (room.status !== "lobby") throw new RoomError("That game has already started.", 409);
  if (room.seats.length >= room.capacity) throw new RoomError("That table is full.", 409);
  const clean = cleanName(name);
  if (room.seats.some((seat) => sameName(seat.name, clean))) throw new RoomError("Someone at this table already has that name. Add an initial.", 409);
  room.seats.push(humanSeat(clean, token, now));
}

function findSeat(room, token) {
  if (!token || token.length > 200) return -1;
  const wanted = Buffer.from(hash(token));
  return room.seats.findIndex((seat) => {
    if (!seat.tokenHash) return false;
    const have = Buffer.from(seat.tokenHash);
    return have.length === wanted.length && timingSafeEqual(have, wanted);
  });
}

function shuffled(list, random) {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

/* ── Tables: one game each ── */

const sid = (index) => `p${index}`;
const indexOf = (id) => Number(id.slice(1));
const active = (table) => table.game.status === "playing";
/** The game a person is playing in right now, if any. A person is only ever in one. */
const activeTableOf = (room, player) => room.tables.find((table) => active(table) && table.players.includes(player)) ?? null;
/** The most recent game a person sat in, playing or finished. */
const latestTableOf = (room, player) => room.tables.filter((table) => table.players.includes(player)).sort((a, b) => b.no - a.no)[0] ?? null;
const seatOf = (room, table, seat) => room.seats[table.players[seat]];

function news(room, text, at) {
  room.newsSeq = (room.newsSeq ?? 0) + 1;
  room.news.push({ n: room.newsSeq, at, text });
  if (room.news.length > 30) room.news.splice(0, room.news.length - 30);
}

/** Deals a fresh game to the players listed (by their place in `seats`). */
function dealTable(room, players, now, random, { key = null, title = null, playOn = false } = {}) {
  room.gameNo += 1;
  for (const player of players) Object.assign(room.seats[player], { called: room.seats[player].kind === "computer", exposedAt: null, autoStreak: 0, autoTotal: 0 });
  room.tables.push({
    id: `t${room.gameNo}`, no: room.gameNo, gameId: `${room.code ?? "room"}-${room.gameNo}`, key, title, playOn, players: [...players],
    game: createTable(players.length, random, Math.floor(random() * players.length), playOn ? { playOn: true } : undefined),
    turnAt: now, seq: 0, moves: [], result: null, finishedAt: null,
  });
  // A finished game is kept while it is still someone's latest, so its result can be shown to them.
  room.tables = room.tables.filter((table) => active(table) || table.players.some((player) => latestTableOf(room, player) === table));
  refreshStatus(room);
}

function refreshStatus(room) {
  if (room.status === "lobby") return;
  if (room.tables.some(active)) room.status = "playing";
  else if (room.series && !isSeriesOver(room.series)) room.status = "between";
  else room.status = "finished";
}

export function startRoom(room, seatIndex, now, random = secureRandom) {
  if (!room.seats[seatIndex]?.host) throw new RoomError("Only the person who made the table can start it.", 403);
  if (room.status !== "lobby") throw new RoomError("The game has already started.", 409);
  const humans = room.seats.filter((seat) => seat.kind === "human");
  if (humans.length < 2) throw new RoomError("Wait for at least one friend to join first.", 409);
  const free = COMPUTER_NAMES.filter((candidate) => !humans.some((seat) => sameName(seat.name, candidate)));
  const computers = Array.from({ length: room.capacity - humans.length }, (_, index) => ({
    name: free[index] ?? `Computer ${index + 1}`, kind: "computer", host: false, called: true, exposedAt: null, autoStreak: 0, autoTotal: 0, seenAt: 0, lastReactAt: 0,
  }));
  // Humans and computers are seated in a random order, so the computers are not all in a row.
  room.seats = shuffled([...humans, ...computers], random);
  room.status = "playing";
  if (room.setup?.mode && room.setup.mode !== "single") beginSeries(room, now, random);
  else dealTable(room, room.seats.map((_, index) => index), now, random);
}

/* ── Tournaments and matches: many games, several at once ── */

const keyOf = (room, key) => `${room.seriesNo}:${key}`;

function beginSeries(room, now, random) {
  room.seriesNo = (room.seriesNo ?? 0) + 1;
  const players = room.seats.map((seat, index) => ({ id: sid(index), name: seat.name }));
  room.series = startSeries({ ...room.setup, opponents: room.seats.length - 1, level: room.level }, random, `${room.code ?? "room"}-series-${room.seriesNo}`, players);
  room.ready = {};
  news(room, `The ${MODE_NAMES[room.setup.mode]} begins: ${room.seats.length} players.`, now);
  scheduleSeries(room, now, 0);
  dealDue(room, now, random);
}

/**
 * Notes when each waiting game may be dealt: straight away at the start, or `gap` after the game that led to it.
 * Every game of a round, or both leagues' next games, get their own time, so one slow table never holds up another.
 */
function scheduleSeries(room, at, gap) {
  if (!room.series || isSeriesOver(room.series)) return;
  const dealt = new Set(room.tables.map((table) => table.key));
  for (const game of pendingGames(room.series)) {
    const key = keyOf(room, game.key);
    if (!dealt.has(key) && room.ready[key] === undefined) room.ready[key] = at + gap;
  }
}

/** Waiting games whose time is set, earliest first. */
function waitingGames(room) {
  if (!room.series || isSeriesOver(room.series)) return [];
  const dealt = new Set(room.tables.map((table) => table.key));
  return pendingGames(room.series).map((game) => ({ game, key: keyOf(room, game.key) }))
    .filter((entry) => !dealt.has(entry.key) && room.ready[entry.key] !== undefined)
    .sort((a, b) => room.ready[a.key] - room.ready[b.key]);
}

function dealDue(room, now, random) {
  for (const { game, key } of waitingGames(room)) {
    if (room.ready[key] > now) continue;
    dealTable(room, game.playerIds.map(indexOf).sort((a, b) => a - b), room.ready[key], random, { key, title: game.title, playOn: game.playOn === true });
  }
}

/** Who has been knocked out so far: Knock Out, the play-offs, and every Cup match lost. */
function knockedOut(series) {
  if (!series) return [];
  if (series.kind === "lastout") return [...series.part.out];
  if (series.kind === "group") return [...(series.championship?.out ?? []), ...(series.plate?.out ?? [])];
  if (series.kind === "cup" || series.kind === "knockout") return series.cup.rounds.flatMap((round) => round.fixtures.filter((fixture) => fixture.winnerId).flatMap((fixture) => fixture.playerIds.filter((id) => id !== fixture.winnerId)));
  return [];
}

/** The host deals again: every waiting game of a tournament now, a new tournament once one is over, or another single game. */
export function againRoom(room, seatIndex, now, random = secureRandom) {
  if (!room.seats[seatIndex]?.host) throw new RoomError("Only the person who made the table can deal again.", 403);
  if (!room.series) {
    if (room.tables.some(active)) throw new RoomError("The game is not over yet.", 409);
    dealTable(room, room.seats.map((_, index) => index), now, random);
    return;
  }
  if (isSeriesOver(room.series)) { beginSeries(room, now, random); return; }
  const waiting = waitingGames(room);
  if (!waiting.length) throw new RoomError("Nothing is waiting to be dealt.", 409);
  for (const { key } of waiting) room.ready[key] = Math.min(room.ready[key], now);
  dealDue(room, now, random);
}
export const rematchRoom = againRoom;

/* ── Playing a move ── */

function recordMove(table, entry) {
  table.seq += 1;
  table.moves.push({ n: table.seq, ...entry });
  if (table.moves.length > 30) table.moves.splice(0, table.moves.length - 30);
}

function finishTable(room, table, at) {
  const places = tablePlaces(table.game);
  table.finishedAt = at;
  table.turnAt = null;
  table.result = {
    gameId: table.gameId, finishedAt: at, winner: table.game.winner,
    seats: table.players.map((player, index) => { const seat = room.seats[player]; return { name: seat.name, kind: seat.kind, place: places[index], cardsLeft: table.game.hands[index].length, autoMoves: seat.autoTotal }; }),
  };
  for (const player of table.players) room.seats[player].exposedAt = null;
  room.history.push({ gameId: table.gameId, title: table.title, players: [...table.players], winner: table.game.winner, moves: table.game.move, finishedAt: at, seats: table.result.seats, seriesId: room.series?.base.id ?? null });
  if (room.history.length > 80) room.history.splice(0, room.history.length - 80);
  const winner = seatOf(room, table, table.game.winner ?? 0).name;
  if (!room.series || !table.key) { news(room, `${winner} won the game.`, at); refreshStatus(room); return; }

  const before = new Set(knockedOut(room.series));
  room.series = submitGame(room.series, table.key.slice(table.key.indexOf(":") + 1), resultOf(table.game, table.players.map(sid)));
  news(room, `${table.title}: ${winner} won.`, at);
  const gone = knockedOut(room.series).filter((id) => !before.has(id)).map((id) => room.seats[indexOf(id)].name);
  if (gone.length) news(room, `${gone.join(" and ")} ${gone.length === 1 ? "is" : "are"} out.`, at);
  if (isSeriesOver(room.series)) {
    const outcome = seriesOutcome(room.series);
    const name = (id) => room.seats[indexOf(id)].name;
    news(room, room.series.kind === "dominoes" && outcome.loserId ? `${name(outcome.loserId)} reached ${room.series.limit} and loses. ${name(outcome.winnerId)} wins the ${MODE_NAMES.dominoes}.` : `${name(outcome.winnerId)} wins the ${MODE_NAMES[room.setup.mode]}!`, at);
  } else scheduleSeries(room, at, TIMING.betweenMs);
  refreshStatus(room);
}

/* ── Computer banter ── */

/** Each computer's voice, mirroring `src/switch/reactions.ts`: how chatty it is and what it says in each mood. */
const BANTER_MOODS = Object.freeze({
  gloat: ["read-em-and-weep", "pick-up-sunshine", "smug-king", "card-shark", "spicy-sod-off", "spicy-pick-up-arse", "spicy-fk-off", "spicy-eat-shit", "spicy-git", "spicy-dickhead", "spicy-tosser"],
  sulk: ["revenge-is-coming", "salty", "crying-joker", "facepalm-jack", "spicy-bollocks", "spicy-bugger", "spicy-for-fucks-sake", "spicy-cheating", "spicy-what-the-f", "spicy-pissed", "spicy-crap", "spicy-damn", "spicy-sodding", "spicy-bullshit", "spicy-shitshow", "spicy-piss-take"],
  tease: ["sweating-yet", "not-today-sweetheart", "sweating-ace", "spicy-holy-shit", "spicy-bloody-hell", "spicy-no-f-way", "spicy-hell"],
  win: ["mic-drop", "read-em-and-weep", "smug-king", "seven-on-fire", "spicy-fucking-yes", "spicy-sod-off", "spicy-pick-up-arse", "spicy-eat-shit", "spicy-wanker", "spicy-fk-off"],
  lose: ["lucky-so-and-so", "salty", "crying-joker", "revenge-is-coming", "spicy-jammy", "spicy-bloody-hell", "spicy-shite-hand", "spicy-piss-off", "spicy-bollocks", "spicy-lucky-bastard", "spicy-bloody-lucky", "spicy-shitshow", "spicy-bullshit", "spicy-crap", "spicy-f-hell"],
});
const BANTER_CHAT = Object.freeze({ John: 0.75, Paul: 0.55, George: 0.35, Ringo: 0.5, Ziggy: 0.6, Marley: 0.45, Bowie: 0.65 });
/** A table hears at most one computer remark in this long (a win always gets one). */
const BANTER_GAP_MS = 7_000;

/**
 * A computer at this table may react to something of note: a big pick-up, a last card, a missed "Last Card", a win.
 * Most moves pass in silence. Only tables with a person playing hear it, so computer-only games stay quiet.
 */
function computerBanter(room, table, event, at, random = secureRandom) {
  if (!table.players.some((player) => room.seats[player].kind === "human")) return;
  if (event.kind !== "win" && at - (table.lastBanterAt ?? -Infinity) < BANTER_GAP_MS) return;
  const isComputer = (index) => typeof index === "number" && index >= 0 && room.seats[table.players[index]]?.kind === "computer";
  const candidates = [];
  if (event.kind === "penalty") {
    if (isComputer(event.by) && event.by !== event.victim) candidates.push({ index: event.by, mood: "gloat", odds: Math.min(0.95, 0.45 + event.cards * 0.06) });
    if (isComputer(event.victim)) candidates.push({ index: event.victim, mood: "sulk", odds: Math.min(0.9, 0.35 + event.cards * 0.05) });
  } else if (event.kind === "spotted") {
    if (isComputer(event.by)) candidates.push({ index: event.by, mood: "gloat", odds: 0.85 });
  } else if (event.kind === "last-card") {
    if (isComputer(event.seat)) candidates.push({ index: event.seat, mood: "tease", odds: 0.4 });
  } else if (event.kind === "win") {
    const losers = table.players.map((_, index) => index).filter((index) => isComputer(index) && index !== event.winner);
    if (isComputer(event.winner)) candidates.push({ index: event.winner, mood: "win", odds: 0.85 });
    losers.forEach((index, n) => candidates.push({ index, mood: "lose", odds: n === losers.length - 1 ? 0.8 : 0.7 / losers.length }));
  }
  for (const candidate of candidates) {
    const player = table.players[candidate.index];
    const seat = room.seats[player];
    if (random() >= candidate.odds * (0.5 + (BANTER_CHAT[seat.name] ?? 0.5))) continue;
    const pool = BANTER_MOODS[candidate.mood];
    room.reactSeq += 1;
    room.reactions.push({ n: room.reactSeq, player, id: pool[Math.floor(random() * pool.length) % pool.length], at });
    if (room.reactions.length > 20) room.reactions.splice(0, room.reactions.length - 20);
    seat.lastReactAt = at;
    table.lastBanterAt = at;
    return;
  }
}

/** One action by one seat at one table: legality, the "Last Card" rule, the engine's result, and everything that follows. */
function playAction(room, table, seat, action, { at, lastCard, auto }) {
  const game = table.game;
  const mine = seatOf(room, table, seat);
  if (action.type === "play" && !isLegalTablePlay(game, action)) throw new RoomError("That play is not allowed.");
  let after;
  try { after = applyTableAction(game, action); } catch { throw new RoomError("That move is not allowed right now."); }

  // Ruling 20: putting down your last cards without having called "Last Card" does not win. You pick up two.
  const called = lastCard || mine.called;
  const emptied = action.type === "play" && action.cards.length === game.hands[seat].length;
  const missed = emptied && !called;
  if (missed) after = penaliseMissedLastCard(after, seat);

  table.players.forEach((player, index) => {
    const other = room.seats[player];
    if (other.kind === "computer") return;
    const size = after.hands[index].length;
    if (index === seat && action.type === "play") other.called = !emptied && size <= 1 && called;
    else if (size > game.hands[index].length && size > 1) other.called = false;
    // A move the computer made for a person never costs them the two-card penalty.
    if (index === seat && auto && size === 1) other.called = true;
    other.exposedAt = after.status === "playing" && size === 1 && !other.called ? (other.exposedAt ?? at) : null;
  });

  const pickedUp = after.hands[seat].length - game.hands[seat].length;
  const lastMove = table.moves[table.moves.length - 1];
  const penaltyFrom = action.type === "draw" && game.pendingPenalty && game.pendingPenalty.kind !== "miss-turn" && lastMove?.type === "play" ? lastMove.seat : null;
  recordMove(table, {
    seat, type: action.type, cards: action.type === "play" ? [...action.cards] : [], ...(action.chosenSuit ? { chosenSuit: action.chosenSuit } : {}),
    auto: Boolean(auto), computer: mine.kind === "computer", missedLastCard: missed, counts: after.hands.map((hand) => hand.length), at,
  });
  if (mine.kind === "human") { if (auto) { mine.autoStreak += 1; mine.autoTotal += 1; } else mine.autoStreak = 0; }
  table.game = after;
  table.turnAt = at;
  if (after.status === "won") finishTable(room, table, at);
  if (action.type === "draw" && pickedUp >= 2) computerBanter(room, table, { kind: "penalty", victim: seat, by: penaltyFrom, cards: pickedUp }, at);
  if (after.status === "won" && after.winner !== null) computerBanter(room, table, { kind: "win", winner: after.winner }, at);
  else if (after.status === "playing" && after.hands[seat].length === 1 && game.hands[seat].length !== 1) computerBanter(room, table, { kind: "last-card", seat }, at);
}

function cleanAction(input) {
  if (!input || typeof input !== "object") throw new RoomError("Say what you want to play.");
  if (input.type === "draw") return { type: "draw" };
  if (input.type === "accept-missed-turn") return { type: "accept-missed-turn" };
  if (input.type !== "play") throw new RoomError("That move is not recognised.");
  const cards = Array.isArray(input.cards) ? input.cards : [];
  if (cards.length < 1 || cards.length > 8 || !cards.every((card) => typeof card === "string" && CARD.test(card))) throw new RoomError("Those cards are not recognised.");
  if (input.chosenSuit !== undefined && !SUITS.includes(input.chosenSuit)) throw new RoomError("That suit is not recognised.");
  return { type: "play", cards, ...(input.chosenSuit ? { chosenSuit: input.chosenSuit } : {}) };
}

export function humanMove(room, player, body, now) {
  const table = activeTableOf(room, player);
  if (!table) throw new RoomError("You are not in a game being played right now.", 409);
  const at = table.players.indexOf(player);
  if (table.game.turn !== at) throw new RoomError("It is not your turn.", 409);
  if (body?.expect !== undefined && body.expect !== table.seq) throw new RoomError("The table has moved on. Look again.", 409);
  playAction(room, table, at, cleanAction(body?.action), { at: now, lastCard: body?.lastCard === true, auto: false });
}

/** "Last Card": said before playing the second-to-last or last cards, or while holding one. */
export function callLastCard(room, player) {
  if (!activeTableOf(room, player)) throw new RoomError("You are not in a game being played right now.", 409);
  const seat = room.seats[player];
  seat.called = true;
  seat.exposedAt = null;
}

export function react(room, player, id, now) {
  if (!REACTIONS.includes(id)) throw new RoomError("That reaction is not recognised.");
  const seat = room.seats[player];
  if (now - seat.lastReactAt < TIMING.reactionGapMs) throw new RoomError("Easy there. One reaction at a time.", 429);
  seat.lastReactAt = now;
  room.reactSeq += 1;
  room.reactions.push({ n: room.reactSeq, player, id, at: now });
  if (room.reactions.length > 20) room.reactions.splice(0, room.reactions.length - 20);
}

/* ── Catching up on time ── */

/** When the move at a table is due to be played for its seat, and whether that is a person being covered. */
function dueFor(room, table) {
  const seat = seatOf(room, table, table.game.turn);
  if (seat.kind === "computer") return { at: table.turnAt + TIMING.computerMs, auto: false };
  const wait = seat.autoStreak >= AWAY_AFTER ? TIMING.awayMs : TIMING.autoMs;
  return { at: table.turnAt + TIMING.graceMs + wait, auto: true };
}

/** Five seconds to say "Last Card" from when the move reached the table, plus a second for the call to travel, whoever is looking. */
const SPOT_AFTER = TIMING.spotMs + TIMING.leniencyMs;

/** The next thing due anywhere in the room: a missed "Last Card" spotted, a move played for someone, or a game dealt. */
function nextEvent(room) {
  let best = null;
  const consider = (event) => { if (!best || event.at < best.at) best = event; };
  for (const table of room.tables) {
    if (!active(table)) continue;
    table.players.forEach((player, seat) => {
      const person = room.seats[player];
      if (person.exposedAt !== null && person.exposedAt !== undefined && !person.called && table.game.hands[seat].length === 1) consider({ kind: "spot", at: person.exposedAt + SPOT_AFTER, table, seat });
    });
    const due = dueFor(room, table);
    consider({ kind: "move", at: due.at, auto: due.auto, table });
  }
  for (const { key } of waitingGames(room)) consider({ kind: "deal", at: room.ready[key], key });
  return best;
}

/**
 * Plays everything that was due by `now`, in the order it fell due, as if it had been done on time, at every table.
 * Returns true if anything changed.
 */
export function tick(room, now, random = secureRandom) {
  let changed = false;
  for (let guard = 0; guard < 6000; guard += 1) {
    const event = nextEvent(room);
    if (!event || event.at > now) break;
    changed = true;
    if (event.kind === "deal") { dealDue(room, event.at, random); continue; }
    const { table } = event;
    if (event.kind === "spot") {
      const person = seatOf(room, table, event.seat);
      table.game = dealTo(table.game, event.seat, 2);
      person.exposedAt = null;
      computerBanter(room, table, { kind: "spotted", victim: event.seat, by: table.players.findIndex((_, index) => index !== event.seat && seatOf(room, table, index).kind === "computer") }, event.at);
      recordMove(table, { seat: event.seat, type: "spot", cards: [], auto: false, computer: false, missedLastCard: true, counts: table.game.hands.map((hand) => hand.length), at: event.at });
      continue;
    }
    // A computer seat plays as itself (its personality and tactics). When the computer plays for a person who ran out of
    // time, it plays plainly, with no tactics: it is covering for them, not out to win (owner decision, 14 Nov 2026).
    const mover = seatOf(room, table, table.game.turn);
    const options = mover.kind === "human" ? { tactics: false } : { personality: mover.name };
    playAction(room, table, table.game.turn, chooseTableAction(table.game, random, room.level, options), { at: event.at, lastCard: true, auto: event.auto });
  }
  return changed;
}

/** Notes that this person is here. If nobody has been here for a while, the clocks start again from now. Returns true if the room changed. */
export function touch(room, seatIndex, now) {
  let changed = false;
  const lastSeen = Math.max(...room.seats.filter((seat) => seat.kind === "human").map((seat) => seat.seenAt));
  if (room.status !== "lobby" && now - lastSeen > TIMING.pauseMs) {
    for (const table of room.tables) if (active(table)) table.turnAt = now;
    for (const seat of room.seats) if (seat.exposedAt !== null && seat.exposedAt !== undefined) seat.exposedAt = now;
    for (const key of Object.keys(room.ready ?? {})) if (room.ready[key] < now) room.ready[key] = now;
    changed = true;
  }
  const seat = room.seats[seatIndex];
  if (now - seat.seenAt >= TIMING.seenEveryMs || changed) { seat.seenAt = now; changed = true; }
  return changed;
}

/* ── What each person is allowed to see ── */

function clockFor(room, table, now) {
  if (!active(table)) return null;
  const seat = seatOf(room, table, table.game.turn);
  if (seat.kind === "computer") return { seat: table.game.turn, computer: true, now };
  const start = table.turnAt + TIMING.graceMs;
  const away = seat.autoStreak >= AWAY_AFTER;
  return { seat: table.game.turn, computer: false, away, nudgeAt: away ? start : start + TIMING.nudgeMs, autoAt: start + (away ? TIMING.awayMs : TIMING.autoMs), now };
}

/** Each table in a line, for the list of games being played. No cards, only who is there and how many they hold. */
function tableSummary(room, table, viewer) {
  return {
    id: table.id, title: table.title, playing: active(table), you: table.players.includes(viewer),
    players: table.players.map((player, seat) => ({ name: room.seats[player].name, kind: room.seats[player].kind, cards: table.game.hands[seat].length, out: (table.game.out ?? []).includes(seat) })),
    turn: active(table) ? room.seats[table.players[table.game.turn]].name : null,
    winner: table.game.winner === null || table.game.winner === undefined ? null : room.seats[table.players[table.game.winner]].name,
  };
}

/** The next game you are due to play in a tournament, and when it is dealt. */
function nextFor(room, viewer) {
  if (!room.series || isSeriesOver(room.series) || activeTableOf(room, viewer)) return null;
  const dealt = new Set(room.tables.map((table) => table.key));
  const game = pendingGames(room.series).find((entry) => entry.playerIds.includes(sid(viewer)) && !dealt.has(keyOf(room, entry.key)));
  if (!game) return null;
  return { title: game.title, players: game.playerIds.map((id) => room.seats[indexOf(id)].name), readyAt: room.ready[keyOf(room, game.key)] ?? null };
}

/**
 * The room as one person sees it. Their own game, while they are playing, always comes first; otherwise the game they
 * chose to watch, or else their last game, so they can see how it ended. Seats are turned so they are seat 0 at their
 * own game. Their own cards are real; every other hand and the draw pile are the same number of backs.
 */
export function viewFor(room, viewer, now, watch = null) {
  const players = room.seats.map((seat, index) => ({ name: seat.name, kind: seat.kind, you: index === viewer, host: Boolean(seat.host), playing: Boolean(activeTableOf(room, index)) }));
  const outcome = room.series && isSeriesOver(room.series) ? seriesOutcome(room.series) : null;
  const series = room.series ? {
    setup: room.setup, state: room.series, over: isSeriesOver(room.series), outcome, me: sid(viewer), next: nextFor(room, viewer),
    waiting: waitingGames(room).length, live: room.tables.filter(active).length,
  } : null;
  const history = room.history.filter((entry) => entry.players.includes(viewer)).map((entry) => {
    const at = entry.players.indexOf(viewer);
    const turn = (list) => list.map((_, index) => list[(index + at) % list.length]);
    return { gameId: entry.gameId, title: entry.title, finishedAt: entry.finishedAt, moves: entry.moves, seriesId: entry.seriesId, winner: (entry.winner - at + entry.players.length) % entry.players.length, seats: turn(entry.seats) };
  });
  const base = {
    code: room.code, rev: room.rev, status: room.status, level: room.level, mode: room.setup?.mode ?? "single", setup: room.setup ?? { mode: "single" }, capacity: room.capacity, serverNow: now,
    players, series, history, news: room.news ?? [], tables: room.tables.map((table) => tableSummary(room, table, viewer)),
  };
  if (room.status === "lobby") {
    return { ...base, you: { seat: 0, host: Boolean(room.seats[viewer].host), watching: false, id: sid(viewer) }, seats: room.seats.map((seat, index) => ({ name: seat.name, kind: seat.kind, you: index === viewer, host: Boolean(seat.host), away: false, lastCardCalled: false })), canStart: Boolean(room.seats[viewer].host) && room.seats.length >= 2, table: null };
  }
  const table = activeTableOf(room, viewer) ?? room.tables.find((entry) => entry.id === watch) ?? latestTableOf(room, viewer) ?? null;
  const reactionsFor = (shift, count, seats) => room.reactions.map((entry) => {
    const sitting = seats ? seats.indexOf(entry.player) : -1;
    return { n: entry.n, id: entry.id, at: entry.at, name: room.seats[entry.player]?.name ?? "", seat: sitting < 0 ? null : (sitting - shift + count) % count };
  });
  if (!table) return { ...base, you: { seat: null, host: Boolean(room.seats[viewer].host), watching: true, id: sid(viewer) }, seats: [], table: null, reactions: reactionsFor(0, 1, null) };

  const at = table.players.indexOf(viewer);
  const watching = at < 0;
  const shift = Math.max(0, at);
  const count = table.players.length;
  const seatAt = (index) => (index + shift) % count;
  const turned = (seat) => (seat === null || seat === undefined ? seat : (seat - shift + count) % count);
  const rotated = (list) => Array.from({ length: count }, (_, index) => list[seatAt(index)]);
  const game = table.game;
  const back = (length) => Array.from({ length }, () => "back");
  const clock = clockFor(room, table, now);
  return {
    ...base,
    you: { seat: watching ? null : 0, host: Boolean(room.seats[viewer].host), watching, id: sid(viewer) },
    table: { id: table.id, title: table.title, gameId: table.gameId, playing: active(table) },
    gameNo: table.no,
    seq: table.seq,
    seats: Array.from({ length: count }, (_, index) => {
      const seat = seatOf(room, table, seatAt(index));
      return { name: seat.name, kind: seat.kind, you: !watching && index === 0, host: Boolean(seat.host), away: seat.autoStreak >= AWAY_AFTER, lastCardCalled: seat.kind === "computer" || seat.called, cards: game.hands[seatAt(index)].length };
    }),
    game: {
      hands: Array.from({ length: count }, (_, index) => (index === 0 && !watching ? [...game.hands[seatAt(0)]] : back(game.hands[seatAt(index)].length))),
      drawPile: back(game.drawPile.length), discardPile: [...game.discardPile], currentSuit: game.currentSuit, turn: turned(game.turn),
      direction: game.direction, dealer: turned(game.dealer), pendingPenalty: game.pendingPenalty, status: game.status, winner: turned(game.winner), move: game.move,
      ...(game.playOn ? { playOn: true, out: (game.out ?? []).map(turned) } : {}),
    },
    clock: clock ? { ...clock, seat: turned(clock.seat) } : null,
    moves: table.moves.map((move) => ({ ...move, seat: turned(move.seat), counts: rotated(move.counts) })),
    reactions: reactionsFor(shift, count, table.players),
    result: table.result ? { ...table.result, winner: turned(table.result.winner), seats: rotated(table.result.seats) } : null,
  };
}

/** What anyone holding the code can see: who is at the table, and nothing about the cards. */
export function publicSummary(room) {
  return { code: room.code, status: room.status, capacity: room.capacity, level: room.level, mode: room.setup?.mode ?? "single", seats: room.seats.map((seat) => ({ name: seat.name, kind: seat.kind })), open: room.status === "lobby" && room.seats.length < room.capacity };
}

/* ── Talking HTTP ── */

/**
 * `store` has read(code), create(code, room, ttlSeconds) and cas(code, expectedRev, room, ttlSeconds).
 * A write that lost a race to another request is read again and redone, so two requests can never both win.
 */
async function load(store, code, now) {
  const row = await store.read(code);
  if (!row || now - row.updatedAt > TIMING.ttlMs) throw new RoomError("No table found with that code. Check it with the person who made it.", 404);
  if (!Array.isArray(row.tables)) throw new RoomError("That table was set up with an older version of the app. Start a new one.", 404);
  return row;
}

async function mutate(store, code, now, change, first = null) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = attempt === 0 && first ? first : await load(store, code, now);
    const room = structuredClone(row);
    room.code = code;
    if (!change(room)) return { room: row, written: false };
    room.rev = row.rev + 1;
    room.updatedAt = now;
    if (await store.cas(code, row.rev, room, Math.ceil(TIMING.ttlMs / 1000))) return { room, written: true };
  }
  throw new RoomError("The table is busy. Try again.", 503);
}

export async function handleRoom(request, store, now = Date.now(), random = secureRandom) {
  try { return await route(request, store, now, random); }
  catch (error) { if (error instanceof RoomError) return json({ error: error.message }, error.status); throw error; }
}

async function route(request, store, now, random) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  const op = url.searchParams.get("op") || "";
  const watch = (url.searchParams.get("watch") || "").slice(0, 12) || null;
  const token = request.headers.get("x-seat-token") || "";

  if (request.method === "GET") {
    if (!CODE.test(code)) throw new RoomError("That code does not look right.");
    const row = await load(store, code, now);
    const index = findSeat(row, token);
    if (index < 0) return json(publicSummary({ ...row, code }));
    const outcome = await mutate(store, code, now, (room) => {
      const seat = findSeat(room, token);
      const touched = touch(room, seat, now);
      return room.status !== "lobby" ? tick(room, now, random) || touched : touched;
    }, row).catch((error) => { if (error instanceof RoomError && error.status === 503) return { room: { ...row, code } }; throw error; });
    return json(viewFor(outcome.room, findSeat(outcome.room, token), now, watch));
  }

  if (request.method !== "POST") throw new RoomError("Method not allowed", 405);
  const raw = await request.text();
  if (raw.length > 4_000) throw new RoomError("That request is too large.", 413);
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { throw new RoomError("Invalid request."); }

  if (!code) {
    const seatToken = randomBytes(18).toString("hex");
    const room = createRoom({ seats: body.seats, level: body.level, name: body.name, mode: body.mode, setsToWin: body.setsToWin, limit: body.limit }, seatToken, now);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const fresh = newCode();
      room.code = fresh;
      if (await store.create(fresh, room, Math.ceil(TIMING.ttlMs / 1000))) return json({ code: fresh, token: seatToken, view: viewFor(room, 0, now) }, 201);
    }
    throw new RoomError("Could not make a code. Try again.", 503);
  }
  if (!CODE.test(code)) throw new RoomError("That code does not look right.");

  if (op === "join") {
    const seatToken = randomBytes(18).toString("hex");
    const outcome = await mutate(store, code, now, (room) => { joinRoom(room, body.name, seatToken, now); return true; });
    return json({ code, token: seatToken, view: viewFor(outcome.room, outcome.room.seats.length - 1, now) }, 201);
  }

  const outcome = await mutate(store, code, now, (room) => {
    const seatIndex = findSeat(room, token);
    if (seatIndex < 0) throw new RoomError("That seat is not yours, or the table has ended.", 403);
    touch(room, seatIndex, now);
    // Whatever was already due happens first. A move that arrives just after a deadline still beats the computer.
    if (room.status !== "lobby") tick(room, now - TIMING.leniencyMs, random);
    if (op === "start") startRoom(room, seatIndex, now, random);
    else if (op === "again") againRoom(room, seatIndex, now, random);
    else if (op === "move") humanMove(room, seatIndex, body, now);
    else if (op === "call") callLastCard(room, seatIndex);
    else if (op === "react") react(room, seatIndex, body.id, now);
    else throw new RoomError("Unknown request.");
    return true;
  });
  // Starting a game shuffles the seats, so the answer is cut for wherever this token sits now, never the seat it had before.
  return json(viewFor(outcome.room, findSeat(outcome.room, token), now, watch));
}

/** A tiny in-memory store with the same shape as the Redis one, for tests and local use. */
export function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async read(code) { const row = rows.get(code); return row ? structuredClone(row) : null; },
    async create(code, room) { if (rows.has(code)) return false; rows.set(code, structuredClone(room)); return true; },
    async cas(code, expectedRev, room) { const row = rows.get(code); if (!row || row.rev !== expectedRev) return false; rows.set(code, structuredClone(room)); return true; },
  };
}
