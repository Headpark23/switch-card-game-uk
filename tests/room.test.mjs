import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { AWAY_AFTER, REACTIONS, TIMING, handleRoom, memoryStore } from "../api/_room.js";
import { chooseTableAction } from "../api/_engine.js";
import { redisStore, storeFromEnv } from "../api/_roomStore.js";

/** A seeded random source, so a failing game can be played again exactly. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const T0 = 1_700_000_000_000;
async function call(store, { method = "POST", code, op, token, body, watch }, now, random = seeded(1)) {
  const query = [code ? `code=${code}` : "", op ? `op=${op}` : "", watch ? `watch=${watch}` : ""].filter(Boolean).join("&");
  const request = new Request(`https://example.test/api/room${query ? `?${query}` : ""}`, { method, headers: { ...(token ? { "x-seat-token": token } : {}), "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
  const response = await handleRoom(request, store, now, random);
  return { status: response.status, body: await response.json() };
}

/** A table with the given first names (the first is the host) and computers filling it to `capacity`. */
async function table(names, capacity, { seed = 1, level = "standard" } = {}) {
  const store = memoryStore();
  const random = seeded(seed);
  const made = await call(store, { body: { seats: capacity, level, name: names[0] } }, T0, random);
  assert.equal(made.status, 201);
  const code = made.body.code;
  const tokens = [made.body.token];
  for (const name of names.slice(1)) {
    const joined = await call(store, { code, op: "join", body: { name } }, T0, random);
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    tokens.push(joined.body.token);
  }
  const started = await call(store, { code, op: "start", token: tokens[0] }, T0, random);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  // One game at a time here: "the game" is the room's latest table, seen through the room for these tests.
  const room = () => { const row = store.rows.get(code); const latest = row.tables?.at(-1); return latest ? { ...row, game: latest.game, seq: latest.seq, moves: latest.moves, table: latest.players } : row; };
  const view = async (who, now) => (await call(store, { method: "GET", code, token: tokens[who] }, now, random)).body;
  const seatOf = (who) => room().seats.findIndex((seat) => seat.name === names[who]);
  return { store, code, tokens, random, room, view, seatOf, names };
}

/** Time passing with someone polling every few seconds, as a phone with the app open does. */
async function wait(t, who, from, to) {
  let now = from;
  while (now < to) { now = Math.min(to, now + 5_000); await t.view(who, now); }
  return now;
}

const CARD_TEXT = /"(?:A|10|[2-9]|J|Q|K)[SHDC]'?"/g;

test("nobody can see another seat's cards, in the lobby, mid-game or at the end", async () => {
  for (const seed of [3, 11, 29]) {
    const t = await table(["Ana", "Ben", "Cat"], 5, { seed });
    const known = [new Set(), new Set(), new Set()];
    let now = T0;
    for (let step = 0; step < 4000 && t.room().status === "playing"; step += 1) {
      const game = t.room().game;
      const seat = game.turn;
      const who = [0, 1, 2].find((index) => t.seatOf(index) === seat);
      if (who === undefined) now += 2500;
      else {
        const action = chooseTableAction(game, t.random, "standard");
        const moved = await call(t.store, { code: t.code, op: "move", token: t.tokens[who], body: { action, lastCard: true, expect: t.room().seq } }, now, t.random);
        assert.equal(moved.status, 200, JSON.stringify(moved.body));
        now += 100;
      }
      for (const viewer of [0, 1, 2]) {
        const view = await t.view(viewer, now + 1);
        const mine = view.game.hands[0];
        mine.forEach((card) => known[viewer].add(card));
        view.game.discardPile.forEach((card) => known[viewer].add(card));
        view.game.hands.slice(1).forEach((hand) => assert.ok(hand.every((card) => card === "back")));
        assert.ok(view.game.drawPile.every((card) => card === "back"));
        for (const text of JSON.stringify(view).match(CARD_TEXT) ?? []) assert.ok(known[viewer].has(JSON.parse(text)), `seat ${viewer} was shown ${text}`);
      }
    }
    assert.equal(t.room().status, "finished", `seed ${seed} should reach the end`);
    const final = await t.view(1, now + 1);
    assert.equal(final.status, "finished");
    assert.equal(final.result.seats.length, 5);
    assert.equal(final.result.seats.filter((seat) => seat.place === 1).length >= 1, true);
    assert.equal(final.game.winner !== null, true);
  }
});

test("someone with the code but no seat sees who is at the table and nothing else", async () => {
  const store = memoryStore();
  const made = await call(store, { body: { seats: 3, name: "Ana" } }, T0);
  const lobby = await call(store, { method: "GET", code: made.body.code }, T0);
  assert.deepEqual(Object.keys(lobby.body).sort(), ["capacity", "code", "level", "mode", "open", "seats", "status"]);
  const wrong = await call(store, { method: "GET", code: made.body.code, token: "not-a-real-token" }, T0);
  assert.equal(wrong.body.seats[0].name, "Ana");
  assert.equal(wrong.body.game, undefined);
  const joined = await call(store, { code: made.body.code, op: "join", body: { name: "Ben" } }, T0);
  await call(store, { code: made.body.code, op: "start", token: made.body.token }, T0);
  const stranger = await call(store, { method: "GET", code: made.body.code }, T0 + 1000);
  assert.equal(stranger.body.game, undefined);
  assert.ok(JSON.stringify(stranger.body).match(CARD_TEXT) === null);
  assert.ok(joined.body.token !== made.body.token);
});

test("joining, naming and starting follow the rules of the table", async () => {
  const store = memoryStore();
  const made = await call(store, { body: { seats: 3, name: "Ana" } }, T0);
  const code = made.body.code;
  assert.equal((await call(store, { code, op: "start", token: made.body.token }, T0)).status, 409, "needs a friend first");
  assert.equal((await call(store, { code, op: "join", body: { name: "ana" } }, T0)).status, 409, "names are unique");
  assert.equal((await call(store, { code, op: "join", body: { name: "<b>" } }, T0)).status, 400);
  const ben = await call(store, { code, op: "join", body: { name: "Ben" } }, T0);
  assert.equal((await call(store, { code, op: "start", token: ben.body.token }, T0)).status, 403, "only the host starts");
  assert.equal((await call(store, { code, op: "join", body: { name: "Cat" } }, T0)).status, 201);
  assert.equal((await call(store, { code, op: "join", body: { name: "Dan" } }, T0)).status, 409, "the table is full");
  assert.equal((await call(store, { body: { seats: 9, name: "Ana" } }, T0)).status, 400);
  assert.equal((await call(store, { body: { seats: 4, level: "godlike", name: "Ana" } }, T0)).status, 400);
  assert.equal((await call(store, { code: "ZZZZZZ", op: "join", body: { name: "Eve" } }, T0)).status, 404);
  const started = await call(store, { code, op: "start", token: made.body.token }, T0);
  assert.equal(started.status, 200);
  assert.equal((await call(store, { code, op: "join", body: { name: "Eve" } }, T0)).status, 409, "no joining once it has started");
  assert.equal((await call(store, { code, op: "start", token: made.body.token }, T0)).status, 409);
});

test("computers fill the empty seats, in a random order, and every seat sees itself as seat 0", async () => {
  const t = await table(["Ana", "Ben"], 6, { seed: 5 });
  const room = t.room();
  assert.equal(room.seats.length, 6);
  assert.equal(room.seats.filter((seat) => seat.kind === "computer").length, 4);
  assert.equal(new Set(room.seats.map((seat) => seat.name)).size, 6);
  for (const who of [0, 1]) {
    const view = await t.view(who, T0);
    assert.equal(view.seats[0].name, t.names[who]);
    assert.equal(view.seats[0].you, true);
    assert.equal(view.game.hands[0].length, 7);
    assert.equal(view.game.hands.length, 6);
    assert.equal(view.game.turn, (t.room().game.turn - t.seatOf(who) + 6) % 6);
  }
});

test("moves are checked: wrong seat, stale view, illegal cards and strangers are all refused", async () => {
  const t = await table(["Ana", "Ben"], 2, { seed: 7 });
  const game = t.room().game;
  const turnWho = [0, 1].find((index) => t.seatOf(index) === game.turn);
  const otherWho = 1 - turnWho;
  const mine = game.hands[game.turn];
  const draw = { type: "draw" };
  assert.equal((await call(t.store, { code: t.code, op: "move", token: t.tokens[otherWho], body: { action: draw } }, T0 + 10)).status, 409, "not your turn");
  assert.equal((await call(t.store, { code: t.code, op: "move", token: "nope", body: { action: draw } }, T0 + 10)).status, 403);
  assert.equal((await call(t.store, { code: t.code, op: "move", token: t.tokens[turnWho], body: { action: draw, expect: 99 } }, T0 + 10)).status, 409, "stale view");
  const notHeld = ["AS", "KH", "9D", "2C"].find((card) => !mine.includes(card));
  assert.equal((await call(t.store, { code: t.code, op: "move", token: t.tokens[turnWho], body: { action: { type: "play", cards: [notHeld] } } }, T0 + 10)).status, 400, "cards you do not hold");
  assert.equal((await call(t.store, { code: t.code, op: "move", token: t.tokens[turnWho], body: { action: { type: "play", cards: ["ZZ"] } } }, T0 + 10)).status, 400);
  assert.equal((await call(t.store, { code: t.code, op: "move", token: t.tokens[turnWho], body: { action: { type: "fly" } } }, T0 + 10)).status, 400);
  const moved = await call(t.store, { code: t.code, op: "move", token: t.tokens[turnWho], body: { action: draw, expect: 0 } }, T0 + 10);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.seq, 1);
  assert.equal(t.room().game.hands[game.turn].length, mine.length + 1);
});

/** Puts a table in a chosen position so a rule can be tried in one move. */
async function staged(hand, { others = 3, spare = ["9H", "9S"] } = {}) {
  const t = await table(["Ana", "Ben"], 2, { seed: 9 });
  const row = t.store.rows.get(t.code).tables.at(-1);
  const seat = row.game.turn;
  row.game.hands = row.game.hands.map((current, index) => (index === seat ? hand : spare.slice(0, others)));
  row.game.discardPile = ["5S"];
  row.game.currentSuit = "S";
  row.game.pendingPenalty = null;
  row.game.drawPile = ["2C", "3C", "4C", "6C", "8C", "9C", "10C", "QC"];
  const who = [0, 1].find((index) => t.seatOf(index) === seat);
  return { ...t, seat, who };
}

test("putting down your last cards without saying Last Card does not win: you pick up two", async () => {
  const t = await staged(["5H"]);
  const refused = await call(t.store, { code: t.code, op: "move", token: t.tokens[t.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  assert.equal(refused.status, 200);
  assert.equal(t.room().status, "playing");
  assert.equal(t.room().game.hands[t.seat].length, 2);
  assert.equal(t.room().moves.at(-1).missedLastCard, true);
});

test("saying Last Card first wins; the call can be made on its own or with the play", async () => {
  const withPlay = await staged(["5H"]);
  const won = await call(withPlay.store, { code: withPlay.code, op: "move", token: withPlay.tokens[withPlay.who], body: { action: { type: "play", cards: ["5H"] }, lastCard: true } }, T0 + 10);
  assert.equal(won.body.status, "finished");
  assert.equal(won.body.result.gameId, `${withPlay.code}-1`);
  const separate = await staged(["5H"]);
  await call(separate.store, { code: separate.code, op: "call", token: separate.tokens[separate.who] }, T0 + 5);
  const alsoWon = await call(separate.store, { code: separate.code, op: "move", token: separate.tokens[separate.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  assert.equal(alsoWon.body.status, "finished");
});

test("holding one card without saying Last Card is spotted when your own phone says your five seconds ran out, and the call prevents it", async () => {
  const quiet = await staged(["5H", "KD"], { others: 4 });
  await call(quiet.store, { code: quiet.code, op: "move", token: quiet.tokens[quiet.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 1);
  const other = 1 - quiet.who;
  await call(quiet.store, { method: "GET", code: quiet.code, token: quiet.tokens[other] }, T0 + 3_000);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 1, "not yet");
  // A report sooner than five seconds is ignored; your phone reports once its five seconds have run out.
  await call(quiet.store, { code: quiet.code, op: "missed", token: quiet.tokens[quiet.who] }, T0 + 4_000);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 1, "too soon to be spotted");
  await call(quiet.store, { code: quiet.code, op: "missed", token: quiet.tokens[quiet.who] }, T0 + 5_300);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 3, "spotted: two cards");
  assert.equal(quiet.room().moves.filter((move) => move.type === "spot").length, 1);
  // A second report for the same miss changes nothing.
  await call(quiet.store, { code: quiet.code, op: "missed", token: quiet.tokens[quiet.who] }, T0 + 5_600);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 3, "spotted once only");

  const loud = await staged(["5H", "KD"], { others: 4 });
  await call(loud.store, { code: loud.code, op: "move", token: loud.tokens[loud.who], body: { action: { type: "play", cards: ["5H"] }, lastCard: true } }, T0 + 10);
  await call(loud.store, { method: "GET", code: loud.code, token: loud.tokens[1 - loud.who] }, T0 + 9_000);
  assert.equal(loud.room().game.hands[loud.seat].length, 1, "called in time: no penalty");
});

test("the turn clock: nudge at 30 s, the computer plays at 40 s, and a move made first always wins", async () => {
  const t = await table(["Ana", "Ben"], 2, { seed: 13 });
  const seat = t.room().game.turn;
  const who = [0, 1].find((index) => t.seatOf(index) === seat);
  const start = T0 + TIMING.graceMs;
  const early = await t.view(1 - who, T0 + 1_000);
  assert.equal(early.clock.nudgeAt, start + TIMING.nudgeMs);
  assert.equal(early.clock.autoAt, start + TIMING.autoMs);
  assert.equal(early.clock.seat, (seat - t.seatOf(1 - who) + 2) % 2);
  await wait(t, 1 - who, T0 + 1_000, T0 + 39_000);
  assert.equal(t.room().seq, 0, "still the person's turn at 39 s");
  await wait(t, 1 - who, T0 + 39_000, T0 + 43_000);
  assert.equal(t.room().seq, 1, "the computer played at 42 s");
  const played = t.room().moves[0];
  assert.equal(played.auto, true);
  assert.equal(played.seat, seat);
  assert.equal(t.room().seats[seat].autoStreak, 1);
  assert.equal(t.room().seats[seat].autoTotal, 1);

  // A move that beats the deadline wins, even if it arrives a moment late (leniency); one that is later loses.
  const t2 = await table(["Ana", "Ben"], 2, { seed: 13 });
  const turn2 = t2.room().game.turn;
  const who2 = [0, 1].find((index) => t2.seatOf(index) === turn2);
  await wait(t2, 1 - who2, T0 + 1_000, T0 + 41_500);
  const onTime = await call(t2.store, { code: t2.code, op: "move", token: t2.tokens[who2], body: { action: { type: "draw" } } }, T0 + 42_900);
  assert.equal(onTime.status, 200, "within a second of the deadline still counts");
  assert.equal(t2.room().moves[0].auto, false);
  const t3 = await table(["Ana", "Ben"], 2, { seed: 13 });
  const turn3 = t3.room().game.turn;
  const who3 = [0, 1].find((index) => t3.seatOf(index) === turn3);
  await wait(t3, 1 - who3, T0 + 1_000, T0 + 41_500);
  const tooLate = await call(t3.store, { code: t3.code, op: "move", token: t3.tokens[who3], body: { action: { type: "draw" } } }, T0 + 43_100);
  assert.equal(tooLate.status, 409);
  await t3.view(1 - who3, T0 + 43_200);
  assert.equal(t3.room().moves[0].auto, true, "the computer's move stands");
});

test("after two computer-played moves in a row a person is away and the computer plays for them after 5 s; a move of their own brings them back", async () => {
  const t = await table(["Ana", "Ben"], 2, { seed: 21 });
  const seat = t.room().game.turn;
  const who = [0, 1].find((index) => t.seatOf(index) === seat);
  const watcher = 1 - who;
  const watcherSeat = t.seatOf(watcher);
  let now = T0;
  // Ana and Ben alternate; only the watcher ever acts. Keep the watcher moving so the other seat is the absent one.
  let covered = 0;
  for (let step = 0; step < 400 && covered < AWAY_AFTER; step += 1) {
    const game = t.room().game;
    if (game.turn === watcherSeat) {
      await call(t.store, { code: t.code, op: "move", token: t.tokens[watcher], body: { action: chooseTableAction(game, t.random, "standard"), lastCard: true } }, now, t.random);
      now += 100;
    } else {
      now = await wait(t, watcher, now, now + TIMING.graceMs + TIMING.autoMs + 100);
      covered = t.room().seats[seat].autoStreak;
    }
    if (t.room().status !== "playing") break;
  }
  assert.ok(t.room().seats[seat].autoStreak >= AWAY_AFTER, "became away");
  const view = await t.view(watcher, now);
  assert.equal(view.seats.find((entry) => entry.name === t.names[who]).away, true);
  // Away: the next time it is their turn the computer plays after about five seconds, not forty.
  while (t.room().game.turn === watcherSeat && t.room().status === "playing") {
    await call(t.store, { code: t.code, op: "move", token: t.tokens[watcher], body: { action: chooseTableAction(t.room().game, t.random, "standard"), lastCard: true } }, now, t.random);
    now += 100;
  }
  const before = t.room().seq;
  now = await wait(t, watcher, now, now + TIMING.graceMs + TIMING.awayMs + 100);
  assert.ok(t.room().seq > before, "played for the away person after 5 s");
});

test("nobody being here stops the clocks: coming back later does not play the whole game", async () => {
  const t = await table(["Ana", "Ben"], 3, { seed: 17 });
  await t.view(0, T0 + 1_000);
  const before = t.room().seq;
  const view = await t.view(0, T0 + 10 * 60_000);
  assert.ok(t.room().seq - before <= 1, `only what was due after coming back, not ten minutes of play (${t.room().seq - before})`);
  assert.equal(view.status, "playing");
});

test("computers play on their own, one after another, in the order of the table", async () => {
  const t = await table(["Ana", "Ben"], 6, { seed: 31 });
  let now = T0;
  const seen = [];
  for (let step = 0; step < 60 && t.room().status === "playing"; step += 1) {
    const game = t.room().game;
    const who = [0, 1].find((index) => t.seatOf(index) === game.turn);
    if (who !== undefined) await call(t.store, { code: t.code, op: "move", token: t.tokens[who], body: { action: chooseTableAction(game, t.random, "standard"), lastCard: true } }, now, t.random);
    else { now += 10_000; await t.view(0, now); }
    seen.push(...t.room().moves.map((move) => move.n));
    now += 50;
  }
  const unique = [...new Set(seen)];
  assert.deepEqual(unique, [...unique].sort((a, b) => a - b), "moves are numbered in order");
  assert.ok(t.room().seats.some((seat, index) => seat.kind === "computer" && t.room().moves.some((move) => move.seat === index && move.computer)), "a computer played");
});

test("reactions: only the fixed ones (85 for people, plus the computers' own lines), one at a time, shown to everyone", async () => {
  assert.equal(new Set(REACTIONS).size, REACTIONS.length);
  assert.ok(REACTIONS.length >= 85);
  assert.ok(REACTIONS.includes("john-play-blackKing-1") && REACTIONS.includes("paul-at-john-1"));
  assert.equal(REACTIONS.filter((id) => id.startsWith("spicy-")).length, 37);
  const t = await table(["Ana", "Ben"], 3, { seed: 2 });
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "hello-there" } }, T0 + 10)).status, 400);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "sweating-yet" } }, T0 + 10)).status, 200);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "seven-on-fire" } }, T0 + 500)).status, 429);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "seven-on-fire" } }, T0 + 2_100)).status, 200);
  const view = await t.view(1, T0 + 2_200);
  assert.deepEqual(view.reactions.map((entry) => entry.id), ["sweating-yet", "seven-on-fire"]);
  assert.equal(view.reactions[0].seat, (t.seatOf(0) - t.seatOf(1) + 3) % 3);
  for (let n = 0; n < 30; n += 1) await call(t.store, { code: t.code, op: "react", token: t.tokens[1], body: { id: "behave" } }, T0 + 5_000 + n * 2_100);
  assert.ok(t.room().reactions.length <= 20);
  assert.ok(JSON.stringify(t.room()).includes("behave") && !JSON.stringify(t.room()).includes("<"));
});

test("the host can deal again after a game; nobody else can", async () => {
  const t = await staged(["5H"]);
  await call(t.store, { code: t.code, op: "move", token: t.tokens[t.who], body: { action: { type: "play", cards: ["5H"] }, lastCard: true } }, T0 + 10);
  assert.equal(t.room().status, "finished");
  const host = t.tokens[0];
  const guest = t.tokens[1];
  assert.equal((await call(t.store, { code: t.code, op: "again", token: guest }, T0 + 20)).status, 403);
  const again = await call(t.store, { code: t.code, op: "again", token: host }, T0 + 20);
  assert.equal(again.status, 200);
  assert.equal(again.body.status, "playing");
  assert.equal(again.body.gameNo, 2);
  assert.equal(again.body.result, null);
});

test("a table that has been quiet for a day is gone", async () => {
  const t = await table(["Ana", "Ben"], 2);
  const gone = await call(t.store, { method: "GET", code: t.code, token: t.tokens[0] }, T0 + TIMING.ttlMs + 1_000);
  assert.equal(gone.status, 404);
});

test("two requests that collide are both applied; a table that is always contended says so", async () => {
  const t = await table(["Ana", "Ben"], 2, { seed: 4 });
  let failures = 1;
  const flaky = { read: (code) => t.store.read(code), create: (...args) => t.store.create(...args), cas: async (...args) => (failures-- > 0 ? false : t.store.cas(...args)) };
  const reacted = await call(flaky, { code: t.code, op: "react", token: t.tokens[0], body: { id: "smug-king" } }, T0 + 10);
  assert.equal(reacted.status, 200);
  assert.equal(t.room().reactions.length, 1);
  const stuck = { read: (code) => t.store.read(code), create: () => false, cas: async () => false };
  assert.equal((await call(stuck, { code: t.code, op: "react", token: t.tokens[0], body: { id: "smug-king" } }, T0 + 5_000)).status, 503);
});

test("Redis: the commands are the right shape, namespaced and always expiring", async () => {
  const sent = [];
  const answers = [{ result: "OK" }, { result: null }, { result: 1 }, { result: 0 }, { result: JSON.stringify({ rev: 3 }) }, { result: null }];
  const fetcher = async (url, init) => { sent.push({ url, auth: init.headers.authorization, command: JSON.parse(init.body) }); return new Response(JSON.stringify(answers.shift()), { status: 200 }); };
  const store = redisStore("https://redis.example", "secret", fetcher);
  assert.equal(await store.create("ABC234", { rev: 0 }, 86400), true);
  assert.equal(await store.create("ABC234", { rev: 0 }, 86400), false, "NX refuses a code that exists");
  assert.equal(await store.cas("ABC234", 0, { rev: 1 }, 86400), true);
  assert.equal(await store.cas("ABC234", 0, { rev: 1 }, 86400), false);
  assert.deepEqual(await store.read("ABC234"), { rev: 3 });
  assert.equal(await store.read("ZZZ222"), null);
  assert.deepEqual(sent[0].command, ["SET", "switch:room:ABC234", JSON.stringify({ rev: 0 }), "EX", "86400", "NX"]);
  assert.equal(sent[2].command[0], "EVAL");
  assert.equal(sent[2].command[3], "switch:room:ABC234");
  assert.match(sent[2].command[1], /'EX'/);
  assert.match(sent[2].command[1], /rev/);
  assert.ok(sent.every((entry) => entry.auth === "Bearer secret" && entry.url === "https://redis.example"));
  assert.ok(sent.every((entry) => entry.command.some((part) => String(part).startsWith("switch:room:"))));
  assert.equal(storeFromEnv({}), null);
  assert.ok(storeFromEnv({ ROOMS_KV_REST_API_URL: "https://a", ROOMS_KV_REST_API_TOKEN: "t" }));
  assert.ok(storeFromEnv({ KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "t" }));
});

test("the server's copy of the rules is built from the app's rules and is up to date", () => {
  execFileSync(process.execPath, ["scripts/build-room-engine.mjs", "--check"], { stdio: "pipe" });
});

test("the answer to starting a game is cut for the person who started it, even though the seats were shuffled", async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const store = memoryStore();
    const random = seeded(seed);
    const made = await call(store, { body: { seats: 4, level: "standard", name: "Host" } }, T0, random);
    const joined = await call(store, { code: made.body.code, op: "join", body: { name: "Guest" } }, T0, random);
    const started = await call(store, { code: made.body.code, op: "start", token: made.body.token }, T0, random);
    assert.equal(started.body.seats[0].name, "Host", `seed ${seed}: the host sees themself first`);
    assert.equal(started.body.seats[0].you, true);
    const again = await call(store, { method: "GET", code: made.body.code, token: made.body.token }, T0, random);
    assert.deepEqual(started.body.game.hands[0], again.body.game.hands[0], `seed ${seed}: same hand as a fresh look`);
    const guest = await call(store, { method: "GET", code: made.body.code, token: joined.body.token }, T0, random);
    assert.equal(guest.body.seats[0].name, "Guest");
    assert.notDeepEqual(started.body.game.hands[0], guest.body.game.hands[0]);
  }
});

test("you get the full five seconds to say Last Card, even when other phones are checking in", async () => {
  const late = await staged(["5H", "KD"], { others: 4 });
  await call(late.store, { code: late.code, op: "move", token: late.tokens[late.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  const other = 1 - late.who;
  // The other phone looks at 5.0 and 5.6 seconds; the call, pressed just inside five seconds on screen, arrives at 5.8.
  for (const at of [T0 + 5_010, T0 + 5_600]) await call(late.store, { method: "GET", code: late.code, token: late.tokens[other] }, at);
  assert.equal(late.room().game.hands[late.seat].length, 1, "not spotted while the call could still be on its way");
  await call(late.store, { code: late.code, op: "call", token: late.tokens[late.who] }, T0 + 5_800);
  await call(late.store, { method: "GET", code: late.code, token: late.tokens[other] }, T0 + 9_000);
  assert.equal(late.room().game.hands[late.seat].length, 1, "called in time: no penalty");

  const silent = await staged(["5H", "KD"], { others: 4 });
  await call(silent.store, { code: silent.code, op: "move", token: silent.tokens[silent.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  await call(silent.store, { method: "GET", code: silent.code, token: silent.tokens[1 - silent.who] }, T0 + 5_000 + 4_000);
  assert.equal(silent.room().game.hands[silent.seat].length, 1, "another phone's clock never spots it");
  await call(silent.store, { method: "GET", code: silent.code, token: silent.tokens[1 - silent.who] }, T0 + 10 + TIMING.spotBackstopMs);
  assert.equal(silent.room().game.hands[silent.seat].length, 3, "never called, and the phone went quiet: two cards");
});

test("owner report, 18 Nov 2026: a Last Card pressed in time is never beaten by other phones, a slow network or a retry", async () => {
  // Other phones keep looking at the table; the call is slow to arrive (a weak signal, a busy server, a retry).
  const slow = await staged(["5H", "KD"], { others: 4 });
  await call(slow.store, { code: slow.code, op: "move", token: slow.tokens[slow.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  const other = 1 - slow.who;
  for (let at = T0 + 1_500; at < T0 + 11_000; at += 1_500) await call(slow.store, { method: "GET", code: slow.code, token: slow.tokens[other] }, at);
  assert.equal(slow.room().game.hands[slow.seat].length, 1, "only the phone holding the card decides the five seconds are up");
  await call(slow.store, { code: slow.code, op: "call", token: slow.tokens[slow.who] }, T0 + 11_000);
  // Even a stray miss report after the call changes nothing.
  await call(slow.store, { code: slow.code, op: "missed", token: slow.tokens[slow.who] }, T0 + 11_100);
  await call(slow.store, { method: "GET", code: slow.code, token: slow.tokens[other] }, T0 + 30_000);
  assert.equal(slow.room().game.hands[slow.seat].length, 1, "called: never spotted");
  assert.equal(slow.room().moves.some((move) => move.type === "spot"), false);
  // Saying it again, as a retried request does, is harmless, and the last card then wins.
  await call(slow.store, { code: slow.code, op: "call", token: slow.tokens[slow.who] }, T0 + 30_100);
  assert.equal(slow.room().seats[slow.room().table[slow.seat]].called, true);

  // Accepting a missed turn (an eight played at you) keeps your call.
  const eight = await staged(["5H", "KD"], { others: 4 });
  await call(eight.store, { code: eight.code, op: "call", token: eight.tokens[eight.who] }, T0 + 5);
  await call(eight.store, { code: eight.code, op: "move", token: eight.tokens[eight.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  const row = eight.store.rows.get(eight.code).tables.at(-1);
  row.game.turn = eight.seat;
  row.game.pendingPenalty = { kind: "miss-turn" };
  await call(eight.store, { code: eight.code, op: "move", token: eight.tokens[eight.who], body: { action: { type: "accept-missed-turn" } } }, T0 + 1_000);
  await call(eight.store, { code: eight.code, op: "missed", token: eight.tokens[eight.who] }, T0 + 7_000);
  await call(eight.store, { method: "GET", code: eight.code, token: eight.tokens[1 - eight.who] }, T0 + 30_000);
  assert.equal(eight.room().game.hands[eight.seat].length, 1, "the call survives a missed turn");
});

/** Plays a whole online tournament: people move when it is their turn, time passes for computers and between games. */
async function playSeries(mode, capacity, extra = {}, seed = 5) {
  const store = memoryStore();
  const random = seeded(seed);
  const made = await call(store, { body: { seats: capacity, level: "standard", name: "Ana", mode, ...extra } }, T0, random);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const code = made.body.code;
  const joined = await call(store, { code, op: "join", body: { name: "Ben" } }, T0, random);
  const tokens = [made.body.token, joined.body.token];
  const started = await call(store, { code, op: "start", token: tokens[0] }, T0, random);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const room = () => store.rows.get(code);
  let now = T0;
  let games = 0;
  let watched = 0;
  let maxLive = 0;
  let over = false;
  for (let step = 0; step < 20000 && !over; step += 1) {
    for (const token of tokens) {
      const view = (await call(store, { method: "GET", code, token }, now, random)).body;
      if (view.series?.over) over = true;
      if (!view.game) continue;
      const hidden = view.you.watching ? view.game.hands : view.game.hands.slice(1);
      assert.ok(hidden.every((hand) => hand.every((card) => card === "back")), "only your own cards are ever shown");
      // Someone who is not in a game being played sees how their last game ended, and can choose any game being played to watch.
      const live = view.tables?.find((entry) => entry.playing && !entry.you);
      if (live && !view.table?.playing) {
        const looking = (await call(store, { method: "GET", code, token, watch: live.id }, now, random)).body;
        assert.equal(looking.you.watching, true, "choosing a live game watches it");
        assert.equal(looking.table.id, live.id);
        assert.ok(looking.game.hands.every((hand) => hand.every((card) => card === "back")), "a watcher sees every hand face down");
        watched += 1;
      }
      if (view.you.watching) {
        assert.equal(view.seats.some((seat) => seat.you), false);
        if (view.table?.playing) assert.equal((await call(store, { code, op: "move", token, body: { action: { type: "draw" } } }, now, random)).status, 409, "a watcher cannot move");
      }
    }
    const r = room();
    if (over) break;
    const live = r.tables.filter((table) => table.game.status === "playing");
    maxLive = Math.max(maxLive, live.length);
    // Ruling 38: one deck, so no game ever has more than six players, and there is always a pile to pick up from.
    for (const table of live) assert.ok(table.players.length <= 6, `${mode} with ${capacity}: a game of ${table.players.length} players`);
    const mine = live.find((table) => r.seats[table.players[table.game.turn]].kind === "human");
    if (mine) {
      const player = mine.players[mine.game.turn];
      const token = tokens[r.seats[player].name === "Ana" ? 0 : 1];
      const action = chooseTableAction(mine.game, random, "standard");
      const moved = await call(store, { code, op: "move", token, body: { action, lastCard: true } }, now, random);
      assert.equal(moved.status, 200, JSON.stringify(moved.body));
      games += 1;
      now += 50;
    } else now += live.length ? 2_100 : TIMING.betweenMs + 10;
  }
  return { room: room(), games, watched, maxLive, view: async (who) => (await call(store, { method: "GET", code, token: tokens[who] }, now, random)).body };
}

for (const [mode, capacity, extra] of [["darts", 3, { setsToWin: 3 }], ["dominoes", 4, { limit: 30 }], ["lastout", 5, {}], ["knockout", 4, {}], ["cup", 4, {}], ["group", 6, {}]]) {
  test(`online ${mode}: a whole tournament is played to the end, one game at a time, and nobody sees another hand`, async () => {
    const played = await playSeries(mode, capacity, extra);
    const final = await played.view(0);
    assert.equal(final.status, "finished");
    assert.equal(final.series.over, true, "the tournament reaches its end");
    assert.ok(final.series.outcome.winnerId);
    assert.equal(final.series.outcome.order.length, capacity);
    assert.ok(final.series.state.base.games >= 1, "games were played");
    if (mode === "knockout" || mode === "lastout") assert.equal(played.room.series.kind, "lastout", "last one out leaves, one more game each time");
  });
}

test("online Last One Out: five become four, then three, then two, and the last one standing wins", async () => {
  const played = await playSeries("lastout", 5, {});
  const final = await played.view(0);
  assert.equal(final.series.over, true);
  assert.equal(final.series.state.part.out.length, 4, "four players drop out, one by one");
  assert.equal(final.series.outcome.order.length, 5);
  assert.equal(final.series.state.base.games, 4, "5 players, 4 games: 5, 4, 3, then the 1 v 1 final");
});

test("the host can pick which computers fill the empty seats, and the rest are drawn at random", async () => {
  const store = memoryStore();
  const random = seeded(11);
  const made = await call(store, { body: { seats: 5, level: "standard", name: "Ana", mode: "lastout", computers: ["Bowie", "Marley", "Bowie", "Nobody"] } }, T0, random);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.deepEqual(made.body.view.setup.computers, ["Bowie", "Marley"], "only known names, once each");
  const joined = await call(store, { code: made.body.code, op: "join", body: { name: "Ben" } }, T0, random);
  assert.ok(joined.status < 300, JSON.stringify(joined.body));
  const started = await call(store, { code: made.body.code, op: "start", token: made.body.token }, T0, random);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const computers = store.rows.get(made.body.code).seats.filter((seat) => seat.kind === "computer").map((seat) => seat.name);
  assert.equal(computers.length, 3);
  assert.ok(computers.includes("Bowie") && computers.includes("Marley"), "the picked computers sit down");
  assert.equal(new Set(computers).size, 3, "nobody twice");
  const plain = await call(store, { body: { seats: 4, level: "standard", name: "Cat" } }, T0, random);
  assert.equal(plain.body.view.setup.computers, undefined, "no picks means a surprise table");
  const bad = await call(store, { body: { seats: 4, level: "standard", name: "Dee", computers: "Bowie" } }, T0, random);
  assert.equal(bad.status, 400);
});

test("a big table plays its games at the same time: every Cup match of a round, both leagues, Knock Out split onto tables of up to six", async () => {
  for (const [mode, capacity, tables] of [["cup", 12, 6], ["group", 12, 3] /* two leagues of 6, then a plate of 8 split onto two tables beside the championship */, ["knockout", 12, 2], ["lastout", 12, 2], ["cup", 16, 8], ["knockout", 16, 3], ["lastout", 16, 3], ["group", 7, 2]]) {
    const played = await playSeries(mode, capacity, {}, 3);
    assert.equal(played.maxLive, tables, `${mode} with ${capacity}: ${tables} games at once`);
    const final = await played.view(0);
    assert.equal(final.series.over, true, `${mode} with ${capacity} reaches its end`);
    assert.equal(final.series.outcome.order.length, capacity);
    assert.ok(final.news.some((entry) => / won\./.test(entry.text)), "finished games are announced");
    assert.ok(final.news.some((entry) => / out\./.test(entry.text)), "knock-outs are announced");
    assert.ok(final.news.at(-1).text.includes("wins"), "the winner is announced");
    assert.ok(final.history.length >= 1, "your own games are in your history");
  }
});

test("online Knock Out: whoever is left holding cards is out, and the people who are out watch the rest", async () => {
  const played = await playSeries("knockout", 5, {}, 9);
  const humanOutEarly = played.room.series.part.out.slice(0, -1).some((id) => played.room.seats[Number(id.slice(1))].kind === "human");
  assert.ok(played.watched > 0 || !humanOutEarly, "a person knocked out early can watch the rest");
  const order = played.room.series.part;
  assert.equal(order.remaining.length, 1);
  assert.equal(order.out.length, 4);
});

test("online Last One Out can be first to several round wins: everyone is dealt back in after each round", async () => {
  const played = await playSeries("lastout", 4, { roundsToWin: 3 }, 11);
  const state = played.room.series;
  assert.equal(state.part.remaining.length, 1, "the last round was played down to one player");
  const wins = state.roundWins;
  assert.equal(wins[state.part.championId], 3, "the champion has three round wins");
  assert.ok(Object.values(wins).every((count) => count <= 3), "nobody went past the target");
  assert.ok(state.rounds >= 3, "at least three rounds were played");
  const final = await played.view(0);
  assert.equal(final.series.over, true);
  assert.equal(final.series.outcome.order[0], state.part.championId);
});

test("a one-off Last One Out ignores rounds and a bad round count is refused", async () => {
  const store = memoryStore();
  const bad = await call(store, { body: { seats: 4, level: "standard", name: "Ana", mode: "lastout", roundsToWin: 12 } }, T0, seeded(1));
  assert.equal(bad.status, 400);
});

test("a tournament needs enough players: Group Play needs six, Knock Out three", async () => {
  const store = memoryStore();
  assert.equal((await call(store, { body: { seats: 5, name: "Ana", mode: "group" } }, T0)).status, 400);
  assert.equal((await call(store, { body: { seats: 2, name: "Ana", mode: "knockout" } }, T0)).status, 400);
  assert.equal((await call(store, { body: { seats: 6, name: "Ana", mode: "group" } }, T0)).status, 201);
  assert.equal((await call(store, { body: { seats: 3, name: "Ana", mode: "chess" } }, T0)).status, 400);
  assert.equal((await call(store, { body: { seats: 16, name: "Ana", mode: "cup" } }, T0)).status, 201, "a Cup for sixteen");
  assert.equal((await call(store, { body: { seats: 17, name: "Ana", mode: "cup" } }, T0)).status, 400, "no more than sixteen");
  assert.equal((await call(store, { body: { seats: 7, name: "Ana", mode: "darts" } }, T0)).status, 400, "Darts is everyone in one game: six at most (ruling 38)");
  assert.equal((await call(store, { body: { seats: 7, name: "Ana" } }, T0)).status, 400, "a single game: six at most (ruling 38)");
  assert.equal((await call(store, { body: { seats: 6, name: "Ana" } }, T0)).status, 201, "a single game of six");
  assert.equal((await call(store, { body: { seats: 12, name: "Ana", mode: "group" } }, T0)).status, 201, "Group Play for twelve: two leagues of six");
  assert.equal((await call(store, { body: { seats: 13, name: "Ana", mode: "group" } }, T0)).status, 400, "Group Play: no league bigger than six");
});

test("the owner's anonymous counters see tables made, started and finished, and only ever numbers", async () => {
  const { tableChanged } = await import("../api/_onlineStats.js");
  const seen = [];
  const observe = async (increments) => { seen.push(increments); };
  const store = memoryStore();
  const random = seeded(5);
  const ask = async (opts, now) => {
    const query = [opts.code ? `code=${opts.code}` : "", opts.op ? `op=${opts.op}` : ""].filter(Boolean).join("&");
    const request = new Request(`https://example.test/api/room${query ? `?${query}` : ""}`, { method: opts.method ?? "POST", headers: { ...(opts.token ? { "x-seat-token": opts.token } : {}), "content-type": "application/json" }, body: (opts.method ?? "POST") === "GET" ? undefined : JSON.stringify(opts.body ?? {}) });
    const response = await handleRoom(request, store, now, random, observe);
    return { status: response.status, body: await response.json() };
  };
  const made = await ask({ body: { seats: 4, level: "standard", name: "Alice Secret" } }, T0);
  assert.equal(seen[0].add["online.tables.created"], 1);
  assert.equal(seen[0].add["online.tables.created.mode.single"], 1);
  assert.equal(seen[0].add["online.tables.created.size.4"], 1);
  const joined = await ask({ code: made.body.code, op: "join", body: { name: "Bob Private" } }, T0);
  assert.equal(seen[1].add["online.joins"], 1);
  await ask({ code: made.body.code, op: "start", token: made.body.token }, T0);
  const started = seen[2];
  assert.equal(started.add["online.tables.started"], 1);
  assert.equal(started.add["online.tables.humans.2"], 1);
  assert.equal(started.add["online.tables.seats.4"], 1);
  assert.equal(started.add["online.computerSeats"], 2);
  // Poll with nothing due: nothing is counted.
  const before = seen.length;
  await ask({ method: "GET", code: made.body.code, token: joined.body.token }, T0 + 1000);
  assert.equal(seen.length, before, "a quiet poll adds no counts");
  // Play the whole game out by letting time pass: the computer covers for both people.
  // Someone is always looking, as a phone with the app open is (it polls every few seconds).
  for (let now = T0 + 5_000; now < T0 + 4 * 3_600_000 && !seen.some((s) => s.add["online.games.finished"]); now += 5_000) await ask({ method: "GET", code: made.body.code, token: made.body.token }, now);
  const finished = seen.find((s) => s.add["online.games.finished"]);
  assert.ok(finished, "the finished game is counted once");
  assert.equal(seen.filter((s) => s.add["online.games.finished"]).length, 1);
  assert.equal(finished.add["online.games.mode.single"], 1);
  assert.equal(finished.add["online.tables.finished"], 1);
  assert.ok(finished.add["online.games.withAuto"] >= 1, "people who went quiet are counted");
  const text = JSON.stringify(seen);
  assert.ok(!/Alice|Bob|Secret|Private|[A-Z2-9]{6}/.test(text.replace(/online\.[a-zA-Z.0-9]+/g, "")), "only counter names and numbers");
  assert.ok(seen.every((s) => Object.values(s.add).every((v) => Number.isInteger(v))));
  assert.equal(typeof tableChanged, "function");
});
