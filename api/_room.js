// Online play: a private table for friends and family. The server owns the game, so nobody can see another seat's
// cards. It deals, checks every move with the same engine the app uses (api/_engine.js is built from src/switch),
// plays for computers and for absent people, and sends each seat a view with only that seat's own hand in it.
//
// Time is handled lazily: there are no timers on the server. Every request first catches up on anything that was due
// (a computer's move, an absent player's move, a missed "Last Card" being spotted), then does what it was asked.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { applyTableAction, chooseTableAction, createTable, dealTo, isLegalTablePlay, isSeriesOver, MAX_SEATS, pendingGames, penaliseMissedLastCard, resultOf, seriesOutcome, simulateGame, startSeries, submitGame, tablePlaces, validateSetup } from "./_engine.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z2-9]{6}$/;
const CARD = /^(?:A|10|[2-9]|J|Q|K)[SHDC]'?$/;
const LEVELS = ["relaxed", "standard", "sharp"];
const SUITS = ["S", "H", "D", "C"];
const COMPUTER_NAMES = ["John", "Paul", "George", "Ringo", "Ziggy", "Marley", "Bowie"];
/** The ways to play at an online table. Knock Out with friends is "last one out leaves" (ruling 11; owner decision, 14 Nov 2026). */
export const MODES = Object.freeze(["single", "knockout", "cup", "group", "darts", "dominoes"]);

/** Owner decision (14 Nov 2026): told at 30 s that the computer plays in 10 s; plays at 40 s. */
export const TIMING = Object.freeze({
  /** Time for the last move to finish playing on screen before a person's clock starts. */
  graceMs: 2_000,
  nudgeMs: 30_000,
  autoMs: 40_000,
  /** A person who has been played for twice running is "away": the computer plays for them after this. */
  awayMs: 5_000,
  /** The pause before a computer seat plays. */
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
  /** In a tournament, the next game is dealt this long after the last one ends, unless the host deals it sooner. */
  betweenMs: 20_000,
  ttlMs: 24 * 3_600_000,
});
export const AWAY_AFTER = 2;

/** The 18 reactions. The server keeps only the id; the words and emoji live in the app. */
export const REACTIONS = Object.freeze([
  "good-game", "nice-one", "well-played", "ouch", "bad-luck", "phew", "your-turn", "take-your-time", "rematch", "cheers",
  "clap", "laugh", "wow", "grimace", "sad", "fire", "party", "cool",
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
  if (chosen === "single") return { mode: "single" };
  const setup = { mode: chosen, opponents: capacity - 1, level, knockout: "last-out",
    ...(chosen === "darts" ? { setsToWin: Number(setsToWin ?? 3) } : {}), ...(chosen === "dominoes" ? { limit: Number(limit ?? 100) } : {}) };
  const problem = validateSetup(setup);
  if (problem) throw new RoomError(problem.replace(/, so at least d+ computers?./, "."));
  return setup;
}

export function createRoom({ seats, level, name, mode, setsToWin, limit }, token, now) {
  const capacity = Number(seats);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > MAX_SEATS) throw new RoomError(`A table is for 2 to ${MAX_SEATS} players.`);
  const chosen = level === undefined ? "standard" : level;
  if (!LEVELS.includes(chosen)) throw new RoomError("Pick relaxed, standard or sharp computers.");
  return {
    v: 2, rev: 0, createdAt: now, updatedAt: now, status: "lobby", capacity, level: chosen, setup: cleanSetup({ mode, setsToWin, limit }, capacity, chosen),
    gameNo: 0, seq: 0, reactSeq: 0, seriesNo: 0,
    seats: [humanSeat(cleanName(name), token, now, true)], table: null, game: null, turnAt: null, moves: [], reactions: [], result: null,
    series: null, pending: null, nextAt: null, seriesLog: [],
  };
}

/* ── Who sits in the current game ── */

/** `room.seats` is everyone at the table; `room.table` lists who plays in the game being played, by their place in `seats`. */
const tableOf = (room) => room.table ?? room.seats.map((_, index) => index);
const playerAt = (room, seat) => room.seats[tableOf(room)[seat]];
const sid = (index) => `p${index}`;
const indexOf = (id) => Number(id.slice(1));

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
  if (room.setup?.mode && room.setup.mode !== "single") beginSeries(room, now, random);
  else dealGame(room, room.seats.map((_, index) => index), now, random);
}

/** Deals a fresh game to the players listed (by their place in `seats`). */
function dealGame(room, table, now, random, playOn = false) {
  room.table = table;
  for (const seat of room.seats) { seat.called = seat.kind === "computer"; seat.exposedAt = null; seat.autoStreak = 0; seat.autoTotal = 0; }
  room.game = createTable(table.length, random, Math.floor(random() * table.length), playOn ? { playOn: true } : undefined);
  room.gameNo += 1;
  room.status = "playing";
  room.result = null;
  room.moves = [];
  room.turnAt = now;
  room.nextAt = null;
}

/* ── Tournaments and matches: a run of ordinary games, one at a time ── */

function beginSeries(room, now, random) {
  room.seriesNo = (room.seriesNo ?? 0) + 1;
  const players = room.seats.map((seat, index) => ({ id: sid(index), name: seat.name }));
  room.series = startSeries({ ...room.setup, opponents: room.seats.length - 1, level: room.level }, random, `${room.code ?? "room"}-series-${room.seriesNo}`, players);
  room.seriesLog = [];
  dealSeriesGame(room, now, random);
}

/** Plays, in a blink, every waiting game with no person in it, as the app does at home. */
function advanceSeries(room, random) {
  for (let guard = 0; guard < 200 && !isSeriesOver(room.series); guard += 1) {
    const games = pendingGames(room.series);
    if (games.some((game) => game.playerIds.some((id) => room.seats[indexOf(id)].kind === "human"))) return;
    const game = games[0];
    if (!game) return;
    const result = simulateGame(game.playerIds, room.level, random, game.playOn === true);
    room.series = submitGame(room.series, game.key, result);
    room.seriesLog = [...(room.seriesLog ?? []), `${game.title}: ${room.seats[indexOf(result.winnerId)].name} won.`].slice(-8);
  }
}

/** Deals the next game that has a person in it. Everyone not in it watches. */
function dealSeriesGame(room, now, random) {
  advanceSeries(room, random);
  const game = isSeriesOver(room.series) ? null : pendingGames(room.series).find((entry) => entry.playerIds.some((id) => room.seats[indexOf(id)].kind === "human"));
  if (!game) { room.status = "finished"; room.pending = null; room.nextAt = null; return; }
  room.pending = { key: game.key, title: game.title, playOn: game.playOn === true };
  dealGame(room, game.playerIds.map(indexOf).sort((a, b) => a - b), now, random, game.playOn === true);
}

/** The host deals again: the next game of a tournament, a new tournament once one is over, or another single game. */
export function againRoom(room, seatIndex, now, random = secureRandom) {
  if (!room.seats[seatIndex]?.host) throw new RoomError("Only the person who made the table can deal again.", 403);
  if (room.status !== "finished") throw new RoomError("The game is not over yet.", 409);
  if (!room.series) dealGame(room, room.seats.map((_, index) => index), now, random);
  else if (isSeriesOver(room.series)) beginSeries(room, now, random);
  else dealSeriesGame(room, now, random);
}
export const rematchRoom = againRoom;

/* ── Playing a move ── */

function recordMove(room, entry) {
  room.seq += 1;
  room.moves.push({ n: room.seq, ...entry });
  if (room.moves.length > 40) room.moves.splice(0, room.moves.length - 40);
}

function buildResult(room, at) {
  const places = tablePlaces(room.game);
  return {
    gameId: `${room.code ?? "room"}-${room.gameNo}`, finishedAt: at, winner: room.game.winner,
    seats: tableOf(room).map((player, index) => { const seat = room.seats[player]; return { name: seat.name, kind: seat.kind, place: places[index], cardsLeft: room.game.hands[index].length, autoMoves: seat.autoTotal }; }),
  };
}

/** One action by one seat: legality, the "Last Card" rule, the engine's result, and everything that follows from it. */
function playAction(room, seat, action, { at, lastCard, auto }) {
  const game = room.game;
  const mine = playerAt(room, seat);
  if (action.type === "play" && !isLegalTablePlay(game, action)) throw new RoomError("That play is not allowed.");
  let after;
  try { after = applyTableAction(game, action); } catch { throw new RoomError("That move is not allowed right now."); }

  // Ruling 20: putting down your last cards without having called "Last Card" does not win. You pick up two.
  const called = lastCard || mine.called;
  const emptied = action.type === "play" && action.cards.length === game.hands[seat].length;
  const missed = emptied && !called;
  if (missed) after = penaliseMissedLastCard(after, seat);

  tableOf(room).forEach((player, index) => {
    const other = room.seats[player];
    if (other.kind === "computer") return;
    const size = after.hands[index].length;
    if (index === seat && action.type === "play") other.called = !emptied && size <= 1 && called;
    else if (size > game.hands[index].length && size > 1) other.called = false;
    // A move the computer made for a person never costs them the two-card penalty.
    if (index === seat && auto && size === 1) other.called = true;
    other.exposedAt = after.status === "playing" && size === 1 && !other.called ? (other.exposedAt ?? at) : null;
  });

  recordMove(room, {
    seat, type: action.type, cards: action.type === "play" ? [...action.cards] : [], ...(action.chosenSuit ? { chosenSuit: action.chosenSuit } : {}),
    auto: Boolean(auto), computer: mine.kind === "computer", missedLastCard: missed, counts: after.hands.map((hand) => hand.length), at,
  });
  if (mine.kind === "human") { if (auto) { mine.autoStreak += 1; mine.autoTotal += 1; } else mine.autoStreak = 0; }
  room.game = after;
  room.turnAt = at;
  if (after.status === "won") {
    room.status = "finished";
    room.turnAt = null;
    room.result = buildResult(room, at);
    for (const other of room.seats) other.exposedAt = null;
    if (room.series && room.pending) {
      room.series = submitGame(room.series, room.pending.key, resultOf(room.game, tableOf(room).map(sid)));
      room.seriesLog = [...(room.seriesLog ?? []), `${room.pending.title}: ${playerAt(room, room.game.winner ?? 0).name} won.`].slice(-8);
      advanceSeries(room, secureRandom);
      room.nextAt = isSeriesOver(room.series) ? null : at + TIMING.betweenMs;
    }
  }
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

export function humanMove(room, seatIndex, body, now) {
  if (room.status !== "playing") throw new RoomError("The game is not in play.", 409);
  const at = tableOf(room).indexOf(seatIndex);
  if (at < 0) throw new RoomError("You are watching this game.", 409);
  if (room.game.turn !== at) throw new RoomError("It is not your turn.", 409);
  if (body?.expect !== undefined && body.expect !== room.seq) throw new RoomError("The table has moved on. Look again.", 409);
  playAction(room, at, cleanAction(body?.action), { at: now, lastCard: body?.lastCard === true, auto: false });
}

/** "Last Card": said before playing the second-to-last or last cards, or while holding one. */
export function callLastCard(room, seatIndex) {
  if (room.status !== "playing") throw new RoomError("The game is not in play.", 409);
  if (!tableOf(room).includes(seatIndex)) throw new RoomError("You are watching this game.", 409);
  const seat = room.seats[seatIndex];
  seat.called = true;
  seat.exposedAt = null;
}

export function react(room, seatIndex, id, now) {
  if (!REACTIONS.includes(id)) throw new RoomError("That reaction is not recognised.");
  const seat = room.seats[seatIndex];
  if (now - seat.lastReactAt < TIMING.reactionGapMs) throw new RoomError("Easy there. One reaction at a time.", 429);
  seat.lastReactAt = now;
  room.reactSeq += 1;
  room.reactions.push({ n: room.reactSeq, player: seatIndex, id, at: now });
  if (room.reactions.length > 20) room.reactions.splice(0, room.reactions.length - 20);
}

/* ── Catching up on time ── */

/** When a seat's turn is due to be played for them, and whether that is a person being covered. */
function dueFor(room) {
  const seat = playerAt(room, room.game.turn);
  if (seat.kind === "computer") return { at: room.turnAt + TIMING.computerMs, auto: false };
  const wait = seat.autoStreak >= AWAY_AFTER ? TIMING.awayMs : TIMING.autoMs;
  return { at: room.turnAt + TIMING.graceMs + wait, auto: true };
}

/**
 * Plays everything that was due by `now`, in order, as if it had been done on time: computers, people who ran out of
 * time, and missed "Last Card" calls being spotted. Returns true if anything changed.
 */
export function tick(room, now, random = secureRandom) {
  let changed = false;
  // Between the games of a tournament: the next one is dealt when its time comes, if the host has not dealt it already.
  if (room.status === "finished" && room.series && room.nextAt && now >= room.nextAt && !isSeriesOver(room.series)) {
    dealSeriesGame(room, room.nextAt, random);
    changed = true;
  }
  const table = tableOf(room);
  for (let guard = 0; guard < 80 && room.status === "playing"; guard += 1) {
    // Five seconds to say "Last Card", counted from when the move reached the table, plus a second for the call to travel.
    // The extra second applies whoever is looking, so another phone checking in at exactly five seconds cannot cut it short.
    const spotAfter = TIMING.spotMs + TIMING.leniencyMs;
    const spotted = table.findIndex((player, index) => { const seat = room.seats[player]; return seat.exposedAt !== null && now - seat.exposedAt >= spotAfter && room.game.hands[index].length === 1 && !seat.called; });
    if (spotted >= 0) {
      const seat = playerAt(room, spotted);
      const at = seat.exposedAt + spotAfter;
      room.game = dealTo(room.game, spotted, 2);
      seat.exposedAt = null;
      recordMove(room, { seat: spotted, type: "spot", cards: [], auto: false, computer: false, missedLastCard: true, counts: room.game.hands.map((hand) => hand.length), at });
      changed = true;
      continue;
    }
    const due = dueFor(room);
    if (due.at > now) break;
    // A computer seat plays as itself (its personality and tactics). When the computer plays for a person who ran out of
    // time, it plays plainly, with no tactics: it is covering for them, not out to win (owner decision, 14 Nov 2026).
    const mover = playerAt(room, room.game.turn);
    const options = mover.kind === "human" ? { tactics: false } : { personality: mover.name };
    playAction(room, room.game.turn, chooseTableAction(room.game, random, room.level, options), { at: due.at, lastCard: true, auto: due.auto });
    changed = true;
  }
  return changed;
}

/** Notes that this person is here. If nobody has been here for a while, the clocks start again from now. Returns true if the room changed. */
export function touch(room, seatIndex, now) {
  let changed = false;
  const lastSeen = Math.max(...room.seats.filter((seat) => seat.kind === "human").map((seat) => seat.seenAt));
  if (room.status === "playing" && now - lastSeen > TIMING.pauseMs) {
    room.turnAt = now;
    for (const seat of room.seats) if (seat.exposedAt !== null) seat.exposedAt = now;
    changed = true;
  }
  const seat = room.seats[seatIndex];
  if (now - seat.seenAt >= TIMING.seenEveryMs || changed) { seat.seenAt = now; changed = true; }
  return changed;
}

/* ── What each seat is allowed to see ── */

const rotate = (list, viewer) => list.map((_, index) => list[(index + viewer) % list.length]);

function clockFor(room, now) {
  if (room.status !== "playing") return null;
  const seat = playerAt(room, room.game.turn);
  if (seat.kind === "computer") return { seat: room.game.turn, computer: true, now };
  const start = room.turnAt + TIMING.graceMs;
  const away = seat.autoStreak >= AWAY_AFTER;
  return { seat: room.game.turn, computer: false, away, nudgeAt: away ? start : start + TIMING.nudgeMs, autoAt: start + (away ? TIMING.awayMs : TIMING.autoMs), now };
}

/**
 * The table as one seat sees it. Seats are turned so the viewer is always seat 0, which is how the app's table screen
 * already thinks. The viewer's own cards are real; every other hand and the draw pile are the same number of backs.
 */
export function viewFor(room, viewer, now) {
  const table = tableOf(room);
  const at = room.game ? table.indexOf(viewer) : -1;
  // Someone not in this game of a tournament watches it: every hand face down, the table as it sits.
  const watching = Boolean(room.game) && at < 0;
  const shift = Math.max(0, at);
  const count = table.length;
  const turned = (seat) => (seat === null || seat === undefined ? seat : (seat - shift + count) % count);
  const players = room.seats.map((seat, index) => ({ name: seat.name, kind: seat.kind, you: index === viewer, host: Boolean(seat.host), playing: Boolean(room.game) && table.includes(index) }));
  const series = room.series ? {
    setup: room.setup, state: room.series, title: room.pending?.title ?? null, over: isSeriesOver(room.series), outcome: seriesOutcome(room.series),
    nextAt: room.status === "finished" ? (room.nextAt ?? null) : null, log: room.seriesLog ?? [], me: sid(viewer),
  } : null;
  const base = { code: room.code, rev: room.rev, status: room.status, level: room.level, mode: room.setup?.mode ?? "single", setup: room.setup ?? { mode: "single" }, capacity: room.capacity, gameNo: room.gameNo, seq: room.seq, serverNow: now, players, series, you: { seat: watching ? null : 0, host: Boolean(room.seats[viewer].host), watching, id: sid(viewer) } };
  if (!room.game) return { ...base, seats: room.seats.map((seat, index) => ({ name: seat.name, kind: seat.kind, you: index === viewer, host: Boolean(seat.host), away: false, lastCardCalled: false })), canStart: Boolean(room.seats[viewer].host) && room.seats.length >= 2 };
  const game = room.game;
  const seatAt = (index) => (index + shift) % count;
  const seats = Array.from({ length: count }, (_, index) => {
    const seat = room.seats[table[seatAt(index)]];
    return { name: seat.name, kind: seat.kind, you: !watching && index === 0, host: Boolean(seat.host), away: seat.autoStreak >= AWAY_AFTER, lastCardCalled: seat.kind === "computer" || seat.called, cards: game.hands[seatAt(index)].length };
  });
  const back = (length) => Array.from({ length }, () => "back");
  const clock = clockFor(room, now);
  const rotated = (list) => Array.from({ length: count }, (_, index) => list[seatAt(index)]);
  return {
    ...base,
    seats,
    game: {
      hands: Array.from({ length: count }, (_, index) => (index === 0 && !watching ? [...game.hands[seatAt(0)]] : back(game.hands[seatAt(index)].length))),
      drawPile: back(game.drawPile.length), discardPile: [...game.discardPile], currentSuit: game.currentSuit, turn: turned(game.turn),
      direction: game.direction, dealer: turned(game.dealer), pendingPenalty: game.pendingPenalty, status: game.status, winner: turned(game.winner), move: game.move,
      ...(game.playOn ? { playOn: true, out: (game.out ?? []).map(turned) } : {}),
    },
    clock: clock ? { ...clock, seat: turned(clock.seat) } : null,
    moves: room.moves.map((move) => ({ ...move, seat: turned(move.seat), counts: rotated(move.counts) })),
    reactions: room.reactions.map((entry) => {
      const player = entry.player ?? table[entry.seat];
      const sitting = table.indexOf(player);
      return { n: entry.n, id: entry.id, at: entry.at, name: room.seats[player]?.name ?? "", seat: sitting < 0 ? null : turned(sitting) };
    }),
    result: room.result ? { ...room.result, winner: turned(room.result.winner), seats: rotated(room.result.seats) } : null,
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
    return json(viewFor(outcome.room, findSeat(outcome.room, token), now));
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

  let seatIndex = -1;
  const outcome = await mutate(store, code, now, (room) => {
    seatIndex = findSeat(room, token);
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
  return json(viewFor(outcome.room, findSeat(outcome.room, token), now));
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
