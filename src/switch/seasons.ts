import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import { resolveHistoryPlayerId } from "./profiles";

export interface SwitchSeason {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly profileIds: readonly string[];
  readonly createdAt: string;
  readonly status: "active" | "complete";
  readonly nightIds: readonly string[];
}

export interface SeasonStanding {
  readonly rank: number;
  readonly profileId: string;
  readonly played: number;
  readonly wins: number;
  readonly points: number;
}

interface SeasonOptions {
  readonly id?: string;
  readonly now?: string;
}

const SEASON_KEY = "switchSeasons";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSeason(value: unknown): value is SwitchSeason {
  return isRecord(value)
    && value.version === 1
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.name === "string"
    && value.name.trim().length > 0
    && Array.isArray(value.profileIds)
    && value.profileIds.length >= 2
    && value.profileIds.every((id) => typeof id === "string")
    && new Set(value.profileIds).size === value.profileIds.length
    && typeof value.createdAt === "string"
    && !Number.isNaN(Date.parse(value.createdAt))
    && (value.status === "active" || value.status === "complete")
    && Array.isArray(value.nightIds)
    && value.nightIds.every((id) => typeof id === "string")
    && new Set(value.nightIds).size === value.nightIds.length;
}

function mappedNight(night: SwitchNightRecord, profiles: readonly LocalProfile[]): { participants: string[]; winners: string[] } {
  const mapping = night.players.map((player) => ({ sourceId: player.id, profileId: resolveHistoryPlayerId(player, profiles) }));
  return {
    participants: [...new Set(mapping.map((entry) => entry.profileId).filter((id): id is string => id !== null))],
    winners: [...new Set(mapping.filter((entry) => night.winnerIds.includes(entry.sourceId)).map((entry) => entry.profileId).filter((id): id is string => id !== null))],
  };
}

export function getSeasons(extensions: Readonly<Record<string, unknown>>): SwitchSeason[] {
  const source = extensions[SEASON_KEY];
  if (!Array.isArray(source)) return [];
  return source.filter(isSeason).map((season) => clone(season));
}

export function putSeasons(extensions: Readonly<Record<string, unknown>>, seasons: readonly SwitchSeason[]): Record<string, unknown> {
  return { ...extensions, [SEASON_KEY]: clone(seasons) };
}

export function createSeason(
  name: string,
  profileIds: readonly string[],
  profiles: readonly LocalProfile[],
  options: SeasonOptions = {},
): SwitchSeason {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Give this league a name.");
  if (profileIds.length < 2) throw new Error("Choose at least two league players.");
  if (new Set(profileIds).size !== profileIds.length) throw new Error("Choose each league player once.");
  if (profileIds.some((id) => !profiles.some((profile) => profile.id === id && !profile.archived))) throw new Error("Every league player needs an active local profile.");
  return {
    version: 1,
    id: options.id ?? `season-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    profileIds: [...profileIds],
    createdAt: options.now ?? new Date().toISOString(),
    status: "active",
    nightIds: [],
  };
}

export function addNightToSeason(season: SwitchSeason, night: SwitchNightRecord, profiles: readonly LocalProfile[]): SwitchSeason {
  if (season.status === "complete") throw new Error("This league season is complete.");
  if (season.nightIds.includes(night.id)) return clone(season);
  const participants = mappedNight(night, profiles).participants.filter((id) => season.profileIds.includes(id));
  if (participants.length < 2) throw new Error("At least two league members must appear in this night.");
  return { ...season, nightIds: [...season.nightIds, night.id] };
}

export function completeSeason(season: SwitchSeason): SwitchSeason {
  return { ...season, status: "complete" };
}

export function seasonStandings(season: SwitchSeason, nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): SeasonStanding[] {
  const values = new Map(season.profileIds.map((profileId, index) => [profileId, { profileId, played: 0, wins: 0, points: 0, index }]));
  for (const nightId of season.nightIds) {
    const night = nights.find((entry) => entry.id === nightId);
    if (!night) continue;
    const mapped = mappedNight(night, profiles);
    for (const profileId of mapped.participants.filter((id) => season.profileIds.includes(id))) {
      const value = values.get(profileId);
      if (!value) continue;
      value.played += 1;
      if (mapped.winners.includes(profileId)) {
        value.wins += 1;
        value.points += 3;
      } else {
        value.points += 1;
      }
    }
  }
  return [...values.values()]
    .sort((left, right) => right.points - left.points || right.wins - left.wins || right.played - left.played || left.index - right.index)
    .map(({ index: _index, ...value }, index) => ({ rank: index + 1, ...value }));
}
