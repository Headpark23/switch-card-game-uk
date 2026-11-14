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
async function call(store, { method = "POST", code, op, token, body }, now, random = seeded(1)) {
  const query = [code ? `code=${code}` : "", op ? `op=${op}` : ""].filter(Boolean).join("&");
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
  const room = () => store.rows.get(code);
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
  assert.deepEqual(Object.keys(lobby.body).sort(), ["capacity", "code", "level", "open", "seats", "status"]);
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
  const row = t.room();
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

test("holding one card without saying Last Card is spotted after five seconds, and the call prevents it", async () => {
  const quiet = await staged(["5H", "KD"], { others: 4 });
  await call(quiet.store, { code: quiet.code, op: "move", token: quiet.tokens[quiet.who], body: { action: { type: "play", cards: ["5H"] } } }, T0 + 10);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 1);
  const other = 1 - quiet.who;
  await call(quiet.store, { method: "GET", code: quiet.code, token: quiet.tokens[other] }, T0 + 3_000);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 1, "not yet");
  await call(quiet.store, { method: "GET", code: quiet.code, token: quiet.tokens[other] }, T0 + 5_100);
  assert.equal(quiet.room().game.hands[quiet.seat].length, 3, "spotted: two cards");
  assert.equal(quiet.room().moves.some((move) => move.type === "spot"), true);

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

test("reactions: only the 18 fixed ones, one at a time, shown to everyone", async () => {
  assert.equal(REACTIONS.length, 18);
  const t = await table(["Ana", "Ben"], 3, { seed: 2 });
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "hello-there" } }, T0 + 10)).status, 400);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "nice-one" } }, T0 + 10)).status, 200);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "fire" } }, T0 + 500)).status, 429);
  assert.equal((await call(t.store, { code: t.code, op: "react", token: t.tokens[0], body: { id: "fire" } }, T0 + 2_100)).status, 200);
  const view = await t.view(1, T0 + 2_200);
  assert.deepEqual(view.reactions.map((entry) => entry.id), ["nice-one", "fire"]);
  assert.equal(view.reactions[0].seat, (t.seatOf(0) - t.seatOf(1) + 3) % 3);
  for (let n = 0; n < 30; n += 1) await call(t.store, { code: t.code, op: "react", token: t.tokens[1], body: { id: "cheers" } }, T0 + 5_000 + n * 2_100);
  assert.ok(t.room().reactions.length <= 20);
  assert.ok(JSON.stringify(t.room()).includes("cheers") && !JSON.stringify(t.room()).includes("<"));
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
  const reacted = await call(flaky, { code: t.code, op: "react", token: t.tokens[0], body: { id: "clap" } }, T0 + 10);
  assert.equal(reacted.status, 200);
  assert.equal(t.room().reactions.length, 1);
  const stuck = { read: (code) => t.store.read(code), create: () => false, cas: async () => false };
  assert.equal((await call(stuck, { code: t.code, op: "react", token: t.tokens[0], body: { id: "clap" } }, T0 + 5_000)).status, 503);
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
