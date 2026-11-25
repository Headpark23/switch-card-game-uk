import type { KnockoutState } from "./knockout";

/**
 * Everything a league night records as it is played: points, round wins, rounds played, the
 * finishing order being tapped in, deciding-game results and the play-off knockouts. `log` keeps
 * each league's finished rounds so the last one can be undone exactly.
 */
export interface LeagueProgress {
  readonly scores: Readonly<Record<string, number>>;
  readonly wins: Readonly<Record<string, number>>;
  readonly rounds: Readonly<Record<string, number>>;
  readonly picks: Readonly<Record<string, readonly string[]>>;
  readonly playoffOrder: Readonly<Record<string, readonly string[]>>;
  readonly playoffKnockouts: Readonly<Record<string, KnockoutState>>;
  /** Finishing order of every round played, per league, oldest first. Older saves leave it out. */
  readonly log: Readonly<Record<string, readonly (readonly string[])[]>>;
}

export function emptyLeagueProgress(playerIds: readonly string[]): LeagueProgress {
  return { scores: Object.fromEntries(playerIds.map((id) => [id, 0])), wins: {}, rounds: {}, picks: {}, playoffOrder: {}, playoffKnockouts: {}, log: {} };
}

/** True once any championship or plate game has been recorded. League results are then locked. */
export function playoffsStarted(progress: LeagueProgress): boolean {
  return Object.values(progress.playoffKnockouts).some((state) => state.eliminatedIds.length > 0);
}

/**
 * Records the next finisher in a league round. When only one player is left, they are placed last
 * and the round is scored: the league size in points for 1st down to 1 for last, and a round win for 1st.
 */
export function recordFinisher(progress: LeagueProgress, leagueId: string, leaguePlayerIds: readonly string[], playerId: string): LeagueProgress {
  const size = leaguePlayerIds.length;
  const current = progress.picks[leagueId] ?? [];
  if (!leaguePlayerIds.includes(playerId) || current.includes(playerId)) throw new Error("That player has already been placed this round.");
  if ((progress.rounds[leagueId] ?? 0) >= size) throw new Error("Every round in this league has been played.");
  const picks = [...current, playerId];
  if (picks.length < size - 1) return { ...progress, picks: { ...progress.picks, [leagueId]: picks } };
  const last = leaguePlayerIds.find((id) => !picks.includes(id)) as string;
  const finishing = [...picks, last];
  const scores = { ...progress.scores };
  finishing.forEach((id, place) => { scores[id] = (scores[id] ?? 0) + (size - place); });
  const wins = { ...progress.wins, [finishing[0]]: (progress.wins[finishing[0]] ?? 0) + 1 };
  return {
    ...progress,
    scores,
    wins,
    rounds: { ...progress.rounds, [leagueId]: (progress.rounds[leagueId] ?? 0) + 1 },
    picks: { ...progress.picks, [leagueId]: [] },
    // A new result can change who is level, so earlier deciding games for this league no longer apply.
    playoffOrder: { ...progress.playoffOrder, [leagueId]: [] },
    log: { ...progress.log, [leagueId]: [...(progress.log[leagueId] ?? []), finishing] },
  };
}

export function clearPicks(progress: LeagueProgress, leagueId: string): LeagueProgress {
  return { ...progress, picks: { ...progress.picks, [leagueId]: [] } };
}

/** Why the last round of a league cannot be undone, or null when it can. */
export function undoRoundBlocker(progress: LeagueProgress, leagueId: string): string | null {
  if (!(progress.log[leagueId] ?? []).length) return (progress.rounds[leagueId] ?? 0) > 0 ? "This round was saved before undo was available." : "No rounds played yet.";
  if (playoffsStarted(progress)) return "Undo the play-off games first.";
  return null;
}

/** Takes the last finished round of a league back off the table, exactly as it was scored. */
export function undoLastRound(progress: LeagueProgress, leagueId: string): LeagueProgress {
  const blocker = undoRoundBlocker(progress, leagueId);
  if (blocker) throw new Error(blocker);
  const log = progress.log[leagueId] ?? [];
  const finishing = log[log.length - 1];
  const size = finishing.length;
  const scores = { ...progress.scores };
  finishing.forEach((id, place) => { scores[id] = Math.max(0, (scores[id] ?? 0) - (size - place)); });
  const wins = { ...progress.wins, [finishing[0]]: Math.max(0, (progress.wins[finishing[0]] ?? 0) - 1) };
  return {
    ...progress,
    scores,
    wins,
    rounds: { ...progress.rounds, [leagueId]: Math.max(0, (progress.rounds[leagueId] ?? 0) - 1) },
    picks: { ...progress.picks, [leagueId]: [] },
    playoffOrder: { ...progress.playoffOrder, [leagueId]: [] },
    // Standings may change, so any play-off draw (with no games played yet) is rebuilt.
    playoffKnockouts: {},
    log: { ...progress.log, [leagueId]: log.slice(0, -1) },
  };
}

/**
 * Records the result of a deciding game between level players: `finishingOrder` lists every player
 * in the tie, winner first. The whole group is placed at once, so no one is ranked without playing.
 */
export function settleTie(progress: LeagueProgress, leagueId: string, finishingOrder: readonly string[]): LeagueProgress {
  if (new Set(finishingOrder).size !== finishingOrder.length || finishingOrder.length < 2) throw new Error("List every player in the deciding game once.");
  const existing = (progress.playoffOrder[leagueId] ?? []).filter((id) => !finishingOrder.includes(id));
  return { ...progress, playoffOrder: { ...progress.playoffOrder, [leagueId]: [...existing, ...finishingOrder] }, playoffKnockouts: {} };
}
