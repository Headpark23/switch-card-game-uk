// Anonymous counters for tables of friends, worked out on the server from what changed in a table.
//
// The server owns every online game, so this is the honest place to count them: a phone that closes the app mid-game
// still leaves the table's history behind. Only numbers leave this file: how many tables, which game type, how many
// people and computers sat down, how many games finished and how many moves the computer had to play for someone who
// went quiet. No names, codes, tokens or scores.
import { GAME_MODES } from "./_stats.js";

const modeOf = (room) => (GAME_MODES.includes(room.setup?.mode) ? room.setup.mode : "single");
const humansIn = (room) => (room.seats ?? []).filter((seat) => seat.kind === "human").length;

/** The few facts about a table that the counters are worked out from. */
export function summarise(room) {
  const history = Array.isArray(room.history) ? room.history : [];
  return {
    mode: modeOf(room),
    status: room.status,
    humans: humansIn(room),
    seats: (room.seats ?? []).length,
    games: new Set(history.map((game) => game.gameId)),
    // Moves the computer played for a person who ran out of time. Only ever goes up.
    auto: (room.seats ?? []).reduce((total, seat) => total + (seat.kind === "human" ? (seat.autoTotal ?? 0) : 0), 0),
    history,
    seatKinds: (room.seats ?? []).map((seat) => seat.kind),
  };
}

const add = (out, key, n = 1) => { if (n > 0) out.add[key] = (out.add[key] ?? 0) + n; };
const cap = (value, max) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

/** A new table was made. */
export function tableCreated(room) {
  const out = { add: {}, max: {} };
  add(out, "online.tables.created");
  add(out, `online.tables.created.mode.${modeOf(room)}`);
  add(out, `online.tables.created.size.${cap(room.capacity, 16)}`);
  return out;
}

/** Somebody joined a table that has not started. */
export function tableJoined() {
  const out = { add: {}, max: {} };
  add(out, "online.joins");
  return out;
}

/** What one change to a table adds to the day's counters. `before` and `after` come from `summarise`. */
export function tableChanged(before, after) {
  const out = { add: {}, max: {} };
  const mode = after.mode;

  if (before.status === "lobby" && after.status !== "lobby") {
    add(out, "online.tables.started");
    add(out, `online.tables.started.mode.${mode}`);
    add(out, `online.tables.humans.${cap(after.humans, 16)}`);
    add(out, `online.tables.seats.${cap(after.seats, 16)}`);
    add(out, "online.people", after.humans);
    add(out, "online.computerSeats", Math.max(0, after.seats - after.humans));
  }

  for (const game of after.history) {
    if (before.games.has(game.gameId)) continue;
    const seatsAtTable = Array.isArray(game.seats) ? game.seats : [];
    const humans = seatsAtTable.filter((seat) => seat.kind === "human").length;
    const players = seatsAtTable.length || (Array.isArray(game.players) ? game.players.length : 0);
    const moves = cap(game.moves, 2000);
    add(out, "online.games.finished");
    add(out, `online.games.mode.${mode}`);
    add(out, `online.games.humans.${cap(humans, 16)}`);
    add(out, `online.games.players.${cap(players, 16)}`);
    add(out, "online.games.moves", moves);
    if (seatsAtTable.some((seat) => seat.kind === "human" && (seat.autoMoves ?? 0) > 0)) {
      add(out, "online.games.withAuto");
      add(out, `online.games.withAuto.mode.${mode}`);
    }
  }

  const covered = Math.max(0, cap(after.auto, 1_000_000) - cap(before.auto, 1_000_000));
  if (covered) add(out, "online.autoMoves", cap(covered, 600));

  if (before.status !== "finished" && after.status === "finished") {
    add(out, "online.tables.finished");
    add(out, `online.tables.finished.mode.${mode}`);
  }
  return out;
}

export const hasCounts = (increments) => Object.keys(increments.add).length > 0 || Object.keys(increments.max).length > 0;
