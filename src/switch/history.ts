import type { CupState } from "./cup";
import type { League, PlayoffBracket } from "./leagues";
import { rankLeague } from "./leagues";
import type { KnockoutState } from "./knockout";
import { isGameMatch, type ScoreFormat, type ScoreSession } from "./scoring";
import type { Player } from "./types";
import type { Place } from "./places";

export interface HistorySection {
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface NightCompletion {
  readonly format: ScoreFormat;
  readonly formatLabel: string;
  readonly players: readonly Player[];
  readonly winnerIds: readonly string[];
  readonly outcome: string;
  readonly details: readonly HistorySection[];
}

export interface SwitchNightRecord extends NightCompletion {
  readonly version: 1;
  readonly id: string;
  readonly completedAt: string;
  readonly title: string;
  /** Where the night was played, when the host said. */
  readonly place?: Place;
}

export type HistorySource = Readonly<Record<string, unknown>>;

type ReadyPlayoffs = {
  readonly status: "ready";
  readonly championship: PlayoffBracket;
  readonly plate: PlayoffBracket;
};

const HISTORY_KEY = "switchNightHistory";
const FORMAT_LABELS: Record<ScoreFormat, string> = {
  "head-to-head": "One v One",
  domino: "Domino",
  darts: "Darts",
  league: "Group Play",
  knockout: "Knock Out",
  cup: "Switch Cup",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function playerName(players: readonly Player[], id: string): string {
  return players.find((player) => player.id === id)?.name ?? "Unknown player";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlayer(value: unknown): value is Player {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.name === "string" && value.name.trim().length > 0;
}

function isSection(value: unknown): value is HistorySection {
  return isRecord(value)
    && typeof value.heading === "string"
    && Array.isArray(value.lines)
    && value.lines.every((line) => typeof line === "string");
}

function isNightRecord(value: unknown): value is SwitchNightRecord {
  if (!isRecord(value)) return false;
  const formats = Object.keys(FORMAT_LABELS);
  return value.version === 1
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.completedAt === "string"
    && !Number.isNaN(Date.parse(value.completedAt))
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && typeof value.format === "string"
    && formats.includes(value.format)
    && typeof value.formatLabel === "string"
    && Array.isArray(value.players)
    && value.players.every(isPlayer)
    && Array.isArray(value.winnerIds)
    && value.winnerIds.every((id) => typeof id === "string")
    && typeof value.outcome === "string"
    && Array.isArray(value.details)
    && value.details.every(isSection);
}

/** Every game, leg or round in the order it was played, worked out from the running scores. */
function playByPlay(session: ScoreSession): HistorySection | null {
  const steps = [...session.history, { scores: session.scores, darts: session.darts }];
  const lines: string[] = [];
  for (let index = 1; index < steps.length; index += 1) {
    const before = steps[index - 1];
    const after = steps[index];
    if (session.format === "darts") {
      const winner = session.players.find((player) => (after.darts?.legs[player.id] ?? 0) !== (before.darts?.legs[player.id] ?? 0) || (after.darts?.sets[player.id] ?? 0) > (before.darts?.sets[player.id] ?? 0));
      const tookSet = winner && (after.darts?.sets[winner.id] ?? 0) > (before.darts?.sets[winner.id] ?? 0);
      if (winner) lines.push(`Leg ${index}: ${winner.name}${tookSet ? ` — takes the set (${session.players.map((player) => after.darts?.sets[player.id] ?? 0).join("–")})` : ""}`);
      continue;
    }
    const scorer = session.players.find((player) => (after.scores[player.id] ?? 0) !== (before.scores[player.id] ?? 0));
    if (!scorer) continue;
    const running = session.players.map((player) => after.scores[player.id] ?? 0).join("–");
    lines.push(isGameMatch(session)
      ? `Game ${index}: ${scorer.name} won (${running})`
      : `${scorer.name} +${(after.scores[scorer.id] ?? 0) - (before.scores[scorer.id] ?? 0)} (${running})`);
  }
  if (!lines.length) return null;
  return { heading: session.format === "darts" ? "Leg by leg" : isGameMatch(session) ? "Game by game" : "Score by score", lines };
}

export function completionFromSession(session: ScoreSession): NightCompletion | null {
  if (session.format === "darts" && session.darts) {
    const winner = session.players.find((player) => session.darts && session.darts.sets[player.id] >= session.darts.setsToWin);
    if (!winner) return null;
    return {
      format: session.format,
      formatLabel: FORMAT_LABELS[session.format],
      players: clone(session.players),
      winnerIds: [winner.id],
      outcome: `${winner.name} won`,
      details: [{
        heading: "Final sets",
        lines: session.players.map((player) => `${player.name} — ${session.darts?.sets[player.id] ?? 0} sets`),
      }, ...[playByPlay(session)].filter((section): section is HistorySection => section !== null)],
    };
  }
  if (session.format !== "domino" && session.format !== "head-to-head") return null;
  const highest = Math.max(...session.players.map((player) => session.scores[player.id] ?? 0));
  const leaders = session.players.filter((player) => (session.scores[player.id] ?? 0) === highest);
  if (highest < session.target || leaders.length !== 1) return null;
  return {
    format: session.format,
    formatLabel: FORMAT_LABELS[session.format],
    players: clone(session.players),
    winnerIds: [leaders[0].id],
    outcome: `${leaders[0].name} won`,
    details: [{
      heading: isGameMatch(session) ? `Final games · first to ${session.target}` : "Final scores",
      lines: [...session.players]
        .sort((left, right) => (session.scores[right.id] ?? 0) - (session.scores[left.id] ?? 0))
        .map((player) => { const total = session.scores[player.id] ?? 0; return `${player.name} — ${total} ${isGameMatch(session) ? (total === 1 ? "game" : "games") : (total === 1 ? "point" : "points")}`; }),
    }, ...[playByPlay(session)].filter((section): section is HistorySection => section !== null)],
  };
}

export function completionFromKnockout(state: KnockoutState): NightCompletion | null {
  if (!state.championId) return null;
  const lines = state.eliminatedIds.map((id) => `${playerName(state.players, id)} — LOST`);
  lines.push(`${playerName(state.players, state.championId)} — CHAMPION`);
  return {
    format: "knockout",
    formatLabel: FORMAT_LABELS.knockout,
    players: clone(state.players),
    winnerIds: [state.championId],
    outcome: `${playerName(state.players, state.championId)} won`,
    details: [{ heading: "Elimination order", lines }],
  };
}

export function completionFromCup(state: CupState): NightCompletion | null {
  if (!state.championId) return null;
  const details = state.rounds.map((round) => ({
    heading: `Round ${round.number}`,
    lines: [
      ...(round.byePlayerId ? [`${playerName(state.players, round.byePlayerId)} — bye`] : []),
      ...round.fixtures.map((fixture) => {
        const opponents = fixture.playerIds.map((id) => playerName(state.players, id)).join(" v ");
        return `${opponents} — ${fixture.winnerId ? `${playerName(state.players, fixture.winnerId)} won` : "unfinished"}`;
      }),
    ],
  }));
  return {
    format: "cup",
    formatLabel: FORMAT_LABELS.cup,
    players: clone(state.players),
    winnerIds: [state.championId],
    outcome: `${playerName(state.players, state.championId)} won`,
    details,
  };
}

/** Knockout progress for the league play-offs, keyed "championship" and "plate". */
export type LeaguePlayoffKnockouts = Readonly<Record<string, KnockoutState | undefined>>;

/** How a play-off knockout went: who went out in which order, then the winner. */
function knockoutLines(state: KnockoutState): string[] {
  const lines = state.eliminatedIds.map((id, index) => `Game ${index + 1}: ${playerName(state.players, id)} out`);
  if (state.championId) lines.push(`${playerName(state.players, state.championId)} — winner`);
  return lines;
}

/**
 * A league night is complete only when the championship knockout has a winner and the plate is
 * decided too (or had a single player, who takes it on a bye). The championship winner is the
 * night's winner; the plate winner is recorded in the outcome and details.
 */
export function completionFromLeagues(
  leagues: readonly League[],
  playoffs: { readonly status: "not-ready"; readonly reason: string } | ReadyPlayoffs | null,
  knockouts: LeaguePlayoffKnockouts = {},
): NightCompletion | null {
  if (!playoffs || playoffs.status !== "ready" || leagues.length < 1 || leagues.some((league) => league.results.length < 3)) return null;
  const championship = knockouts.championship;
  if (!championship?.championId) return null;
  const plateEntrants = playoffs.plate.entrants;
  const plate = knockouts.plate;
  let plateWinnerId: string | null = null;
  if (plateEntrants.length === 1) plateWinnerId = plateEntrants[0].player.id;
  else if (plateEntrants.length > 1) {
    if (!plate?.championId) return null;
    plateWinnerId = plate.championId;
  }
  const players = leagues.flatMap((league) => league.results.map((result) => result.player));
  const champion = playerName(players, championship.championId);
  const plateWinner = plateWinnerId ? playerName(players, plateWinnerId) : null;
  return {
    format: "league",
    formatLabel: FORMAT_LABELS.league,
    players: clone(players),
    winnerIds: [championship.championId],
    outcome: plateWinner ? `${champion} won the championship; ${plateWinner} won the plate` : `${champion} won the championship`,
    details: [
      ...leagues.map((league) => ({
        heading: league.name,
        lines: rankLeague(league.results, league.playoffOrder).map((entry) => `${entry.rank}. ${entry.player.name} — ${entry.points} ${entry.points === 1 ? "point" : "points"}`),
      })),
      { heading: "Championship", lines: knockoutLines(championship) },
      ...(plateWinnerId ? [{ heading: "Plate", lines: plate?.championId ? knockoutLines(plate) : [`${plateWinner} — winner (bye)`] }] : []),
    ],
  };
}

export function createNightRecord(
  title: string,
  completion: NightCompletion,
  completedAt = new Date().toISOString(),
  id = `night-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  place?: Place,
): SwitchNightRecord {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("Give this Switch Night a name.");
  return clone({ ...completion, version: 1 as const, id, completedAt, title: cleanTitle, ...(place ? { place } : {}) });
}

export function getHistory(extensions: HistorySource): SwitchNightRecord[] {
  const source = extensions[HISTORY_KEY];
  if (!Array.isArray(source)) return [];
  return source.filter(isNightRecord).map((entry) => clone(entry));
}

export function addNight(extensions: HistorySource, night: SwitchNightRecord): Record<string, unknown> {
  const history = getHistory(extensions).filter((entry) => entry.id !== night.id);
  return { ...extensions, [HISTORY_KEY]: [clone(night), ...history] };
}

export function deleteNight(extensions: HistorySource, nightId: string): Record<string, unknown> {
  return { ...extensions, [HISTORY_KEY]: getHistory(extensions).filter((entry) => entry.id !== nightId) };
}

export function exportHistory(nights: readonly SwitchNightRecord[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ version: 1, exportedAt, nights: clone(nights) }, null, 2);
}
