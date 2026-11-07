import type { CupState } from './cup';
import type { KnockoutState } from './knockout';
import type { ScoreSession } from './scoring';
import type { Player } from './types';

const KEY = 'switchActiveNight';

export type ActiveNight =
  | { readonly version: 1; readonly kind: 'score'; readonly session: ScoreSession; readonly aceHigh: boolean }
  | { readonly version: 1; readonly kind: 'knockout'; readonly state: KnockoutState }
  | { readonly version: 1; readonly kind: 'cup'; readonly state: CupState }
  | {
    readonly version: 1;
    readonly kind: 'league';
    readonly players: readonly Player[];
    readonly leagueCount: number;
    readonly scores: Readonly<Record<string, number>>;
    readonly wins: Readonly<Record<string, number>>;
    readonly rounds: Readonly<Record<string, number>>;
    readonly picks: Readonly<Record<string, readonly string[]>>;
    readonly playoffOrder: Readonly<Record<string, readonly string[]>>;
  };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function players(value: unknown): value is Player[] {
  return Array.isArray(value) && value.length >= 2 && value.every((entry) => {
    const item = record(entry);
    return !!item && typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && item.name.trim().length > 0;
  });
}

function numberMap(value: unknown): value is Record<string, number> {
  const item = record(value);
  return !!item && Object.values(item).every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0);
}

function stringLists(value: unknown): value is Record<string, string[]> {
  const item = record(value);
  return !!item && Object.values(item).every((entry) => Array.isArray(entry) && entry.every((id) => typeof id === 'string'));
}

function scoreSession(value: unknown): value is ScoreSession {
  const item = record(value);
  if (!item || !['head-to-head', 'domino', 'darts'].includes(String(item.format)) || !players(item.players) || !numberMap(item.scores)) return false;
  if (typeof item.target !== 'number' || !Number.isFinite(item.target) || item.target <= 0 || !Array.isArray(item.history)) return false;
  if (item.format !== 'darts') return item.darts === null;
  const darts = record(item.darts);
  return !!darts && numberMap(darts.legs) && numberMap(darts.sets) && typeof darts.setsToWin === 'number' && darts.setsToWin > 0;
}

function knockout(value: unknown): value is KnockoutState {
  const item = record(value);
  return !!item && players(item.players) && item.players.length >= 3 && item.players.length <= 6
    && Array.isArray(item.eliminatedIds) && item.eliminatedIds.every((id) => typeof id === 'string')
    && (item.championId === null || typeof item.championId === 'string');
}

function cup(value: unknown): value is CupState {
  const item = record(value);
  if (!item || !players(item.players) || item.players.length > 10 || !Array.isArray(item.rounds) || !item.rounds.length) return false;
  const validRounds = item.rounds.every((entry) => {
    const round = record(entry);
    return !!round && typeof round.number === 'number' && Array.isArray(round.fixtures)
      && (round.byePlayerId === null || typeof round.byePlayerId === 'string')
      && round.fixtures.every((fixtureValue) => {
        const fixture = record(fixtureValue);
        return !!fixture && typeof fixture.id === 'string' && Array.isArray(fixture.playerIds) && fixture.playerIds.length === 2
          && fixture.playerIds.every((id) => typeof id === 'string') && (fixture.winnerId === null || typeof fixture.winnerId === 'string');
      });
  });
  return validRounds && (item.championId === null || typeof item.championId === 'string');
}

export function getActiveNight(extensions: Readonly<Record<string, unknown>>): ActiveNight | null {
  const item = record(extensions[KEY]);
  if (!item || item.version !== 1) return null;
  if (item.kind === 'score' && scoreSession(item.session) && typeof item.aceHigh === 'boolean') return item as unknown as ActiveNight;
  if (item.kind === 'knockout' && knockout(item.state)) return item as unknown as ActiveNight;
  if (item.kind === 'cup' && cup(item.state)) return item as unknown as ActiveNight;
  if (item.kind === 'league' && players(item.players) && Number.isInteger(item.leagueCount) && Number(item.leagueCount) >= 1 && Number(item.leagueCount) <= 4
    && numberMap(item.scores) && numberMap(item.wins) && numberMap(item.rounds) && stringLists(item.picks) && stringLists(item.playoffOrder)) return item as unknown as ActiveNight;
  return null;
}

export function putActiveNight(extensions: Readonly<Record<string, unknown>>, active: ActiveNight): Record<string, unknown> {
  return { ...extensions, [KEY]: active };
}

export function clearActiveNight(extensions: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const next = { ...extensions };
  delete next[KEY];
  return next;
}

