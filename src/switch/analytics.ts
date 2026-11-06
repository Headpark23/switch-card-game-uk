import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import { resolveHistoryPlayerId } from "./profiles";

export type FormResult = "W" | "L";
export type MilestoneId = "first-night" | "first-win" | "five-nights" | "three-win-streak" | "three-formats" | "cup-champion";

export interface MonthlyWins {
  readonly key: string;
  readonly label: string;
  readonly wins: number;
}

export interface PlayerStats {
  readonly profileId: string;
  readonly appearances: number;
  readonly wins: number;
  readonly winRate: number;
  readonly currentWinStreak: number;
  readonly bestWinStreak: number;
  readonly recentForm: readonly FormResult[];
  readonly formatWins: Readonly<Record<string, number>>;
  readonly monthlyWins: readonly MonthlyWins[];
  readonly milestones: readonly MilestoneId[];
}

export interface Rivalry {
  readonly profileAId: string;
  readonly profileBId: string;
  readonly meetings: number;
  readonly winsA: number;
  readonly winsB: number;
  readonly otherWins: number;
}

export interface ClubhouseSummary {
  readonly totalNights: number;
  readonly mostWinsProfileId: string | null;
  readonly bestWinRateProfileId: string | null;
  readonly closestRivalry: Rivalry | null;
}

interface MappedNight {
  readonly night: SwitchNightRecord;
  readonly participantIds: readonly string[];
  readonly winnerIds: readonly string[];
}

function mapNight(night: SwitchNightRecord, profiles: readonly LocalProfile[]): MappedNight {
  const mappings = night.players.map((player) => ({ sourceId: player.id, profileId: resolveHistoryPlayerId(player, profiles) }));
  return {
    night,
    participantIds: [...new Set(mappings.map((entry) => entry.profileId).filter((id): id is string => id !== null))],
    winnerIds: [...new Set(mappings.filter((entry) => night.winnerIds.includes(entry.sourceId)).map((entry) => entry.profileId).filter((id): id is string => id !== null))],
  };
}

function sortedNights(nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): MappedNight[] {
  return [...nights]
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.id.localeCompare(right.id))
    .map((night) => mapNight(night, profiles));
}

function calendarMonths(nights: readonly SwitchNightRecord[]): MonthlyWins[] {
  const latest = nights.reduce<Date | null>((current, night) => {
    const date = new Date(night.completedAt);
    return !current || date > current ? date : current;
  }, null) ?? new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - (5 - index), 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      wins: 0,
    };
  });
}

export function derivePlayerStats(profile: LocalProfile, nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): PlayerStats {
  const mapped = sortedNights(nights, profiles).filter((entry) => entry.participantIds.includes(profile.id));
  let currentWinStreak = 0;
  let bestWinStreak = 0;
  const formatWins: Record<string, number> = {};
  const formatsPlayed = new Set<string>();
  let cupChampion = false;
  for (const entry of mapped) {
    formatsPlayed.add(entry.night.format);
    if (entry.winnerIds.includes(profile.id)) {
      currentWinStreak += 1;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
      formatWins[entry.night.format] = (formatWins[entry.night.format] ?? 0) + 1;
      if (entry.night.format === "cup") cupChampion = true;
    } else {
      currentWinStreak = 0;
    }
  }
  const wins = Object.values(formatWins).reduce((total, value) => total + value, 0);
  const monthlyWins = calendarMonths(nights);
  for (const entry of mapped) {
    if (!entry.winnerIds.includes(profile.id)) continue;
    const date = new Date(entry.night.completedAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = monthlyWins.find((value) => value.key === key);
    if (month) (month as { wins: number }).wins += 1;
  }
  const milestones: MilestoneId[] = [];
  if (mapped.length >= 1) milestones.push("first-night");
  if (wins >= 1) milestones.push("first-win");
  if (mapped.length >= 5) milestones.push("five-nights");
  if (bestWinStreak >= 3) milestones.push("three-win-streak");
  if (formatsPlayed.size >= 3) milestones.push("three-formats");
  if (cupChampion) milestones.push("cup-champion");
  return {
    profileId: profile.id,
    appearances: mapped.length,
    wins,
    winRate: mapped.length ? wins / mapped.length : 0,
    currentWinStreak,
    bestWinStreak,
    recentForm: mapped.slice(-10).reverse().map((entry) => entry.winnerIds.includes(profile.id) ? "W" : "L"),
    formatWins,
    monthlyWins,
    milestones,
  };
}

export function deriveRivalries(nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): Rivalry[] {
  const mapped = sortedNights(nights, profiles);
  const rivalries: Rivalry[] = [];
  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      const profileAId = profiles[left].id;
      const profileBId = profiles[right].id;
      const meetings = mapped.filter((entry) => entry.participantIds.includes(profileAId) && entry.participantIds.includes(profileBId));
      if (!meetings.length) continue;
      const winsA = meetings.filter((entry) => entry.winnerIds.includes(profileAId)).length;
      const winsB = meetings.filter((entry) => entry.winnerIds.includes(profileBId)).length;
      const otherWins = meetings.filter((entry) => !entry.winnerIds.includes(profileAId) && !entry.winnerIds.includes(profileBId)).length;
      rivalries.push({ profileAId, profileBId, meetings: meetings.length, winsA, winsB, otherWins });
    }
  }
  return rivalries.sort((left, right) => right.meetings - left.meetings || Math.abs(left.winsA - left.winsB) - Math.abs(right.winsA - right.winsB));
}

export function deriveClubhouseSummary(nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): ClubhouseSummary {
  const stats = profiles.map((profile) => derivePlayerStats(profile, nights, profiles));
  const mostWins = [...stats].sort((left, right) => right.wins - left.wins || profiles.findIndex((profile) => profile.id === left.profileId) - profiles.findIndex((profile) => profile.id === right.profileId))[0];
  const bestWinRate = stats
    .filter((entry) => entry.appearances >= 3)
    .sort((left, right) => right.winRate - left.winRate || right.appearances - left.appearances)[0];
  const closestRivalry = deriveRivalries(nights, profiles)[0] ?? null;
  return {
    totalNights: nights.length,
    mostWinsProfileId: mostWins && mostWins.wins > 0 ? mostWins.profileId : null,
    bestWinRateProfileId: bestWinRate?.profileId ?? null,
    closestRivalry,
  };
}
