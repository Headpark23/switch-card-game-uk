import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import { resolveHistoryPlayerId } from "./profiles";

/** Trophy tiers, smallest to grandest. The bigger the table and the bigger the event, the fancier the cup. */
export type TrophyTier = "bronze" | "silver" | "gold" | "platinum" | "grand";

export const TROPHY_TIERS: readonly { tier: TrophyTier; name: string }[] = [
  { tier: "bronze", name: "Bronze Cup" },
  { tier: "silver", name: "Silver Cup" },
  { tier: "gold", name: "Gold Cup" },
  { tier: "platinum", name: "Platinum Trophy" },
  { tier: "grand", name: "Grand Trophy" },
];

const TOURNAMENTS = new Set(["cup", "knockout", "league"]);

/** Table size plus two for a tournament: 2 players is bronze, a five-player Switch Cup is the grand trophy. */
export function trophyTier(format: string, players: number): TrophyTier {
  const size = players + (TOURNAMENTS.has(format) ? 2 : 0);
  if (size <= 2) return "bronze";
  if (size <= 4) return "silver";
  if (size <= 5) return "gold";
  if (size <= 6) return "platinum";
  return "grand";
}

export interface Trophy {
  readonly nightId: string;
  readonly title: string;
  readonly format: string;
  readonly formatLabel: string;
  readonly tier: TrophyTier;
  readonly tierName: string;
  readonly players: number;
  readonly wonAt: string;
}

export type BadgeId =
  | "first-night" | "first-win" | "five-nights" | "ten-nights" | "twenty-five-nights"
  | "three-win-streak" | "five-win-streak" | "three-formats" | "full-house"
  | "cup-champion" | "knockout-king" | "domino-master" | "dart-thrower" | "duellist"
  | "hat-trick-month" | "big-table" | "trophy-cabinet";

export interface BadgeDefinition {
  readonly id: BadgeId;
  readonly label: string;
  readonly hint: string;
  readonly glyph: string;
  readonly need: number;
}

export const BADGES: readonly BadgeDefinition[] = [
  { id: "first-night", label: "First night", hint: "Play a saved night", glyph: "1", need: 1 },
  { id: "first-win", label: "First win", hint: "Win a saved night", glyph: "★", need: 1 },
  { id: "five-nights", label: "Regular", hint: "Play 5 saved nights", glyph: "5", need: 5 },
  { id: "ten-nights", label: "Table fixture", hint: "Play 10 saved nights", glyph: "10", need: 10 },
  { id: "twenty-five-nights", label: "Card night legend", hint: "Play 25 saved nights", glyph: "25", need: 25 },
  { id: "three-win-streak", label: "Hot streak", hint: "Win 3 nights in a row", glyph: "🔥", need: 3 },
  { id: "five-win-streak", label: "Unstoppable", hint: "Win 5 nights in a row", glyph: "⚡", need: 5 },
  { id: "three-formats", label: "All-rounder", hint: "Play 3 different formats", glyph: "◆", need: 3 },
  { id: "full-house", label: "Full house", hint: "Play all 5 formats", glyph: "♠", need: 5 },
  { id: "cup-champion", label: "Cup champion", hint: "Win a Switch Cup", glyph: "🏆", need: 1 },
  { id: "knockout-king", label: "Knockout king", hint: "Win a Knockout", glyph: "♚", need: 1 },
  { id: "domino-master", label: "Domino master", hint: "Win 3 Domino nights", glyph: "▣", need: 3 },
  { id: "dart-thrower", label: "Bullseye", hint: "Win a Darts night", glyph: "◎", need: 1 },
  { id: "duellist", label: "Duellist", hint: "Win 3 One v One nights", glyph: "⚔", need: 3 },
  { id: "hat-trick-month", label: "Hat-trick month", hint: "Win 3 nights in one month", glyph: "♣", need: 3 },
  { id: "big-table", label: "Big table", hint: "Win with 5 or more players", glyph: "♥", need: 1 },
  { id: "trophy-cabinet", label: "Trophy cabinet", hint: "Collect 10 trophies", glyph: "♛", need: 10 },
];

export interface BadgeProgress extends BadgeDefinition {
  readonly have: number;
  readonly earned: boolean;
}

export interface TrophyRoom {
  readonly profileId: string;
  readonly trophies: readonly Trophy[];
  readonly tierCounts: Readonly<Record<TrophyTier, number>>;
  readonly badges: readonly BadgeProgress[];
  readonly earnedCount: number;
}

const ALL_FORMATS = ["domino", "head-to-head", "darts", "knockout", "cup"];

/** Everything here is derived from saved nights, so removing a night takes its trophy away too. */
export function deriveTrophyRoom(profile: LocalProfile, nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): TrophyRoom {
  const ordered = [...nights].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id.localeCompare(b.id));
  const trophies: Trophy[] = [];
  const formats = new Set<string>();
  const wins: Record<string, number> = {};
  const months: Record<string, number> = {};
  let played = 0;
  let streak = 0;
  let bestStreak = 0;
  let biggestWin = 0;
  for (const night of ordered) {
    const ids = night.players.map((player) => ({ source: player.id, profile: resolveHistoryPlayerId(player, profiles) }));
    if (!ids.some((entry) => entry.profile === profile.id)) continue;
    played += 1;
    formats.add(night.format);
    const won = ids.some((entry) => entry.profile === profile.id && night.winnerIds.includes(entry.source));
    if (!won) { streak = 0; continue; }
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    wins[night.format] = (wins[night.format] ?? 0) + 1;
    const month = night.completedAt.slice(0, 7);
    months[month] = (months[month] ?? 0) + 1;
    biggestWin = Math.max(biggestWin, night.players.length);
    const tier = trophyTier(night.format, night.players.length);
    trophies.push({
      nightId: night.id, title: night.title, format: night.format, formatLabel: night.formatLabel, tier,
      tierName: TROPHY_TIERS.find((entry) => entry.tier === tier)?.name ?? "Cup", players: night.players.length, wonAt: night.completedAt,
    });
  }
  const totalWins = trophies.length;
  const have: Record<BadgeId, number> = {
    "first-night": played, "first-win": totalWins, "five-nights": played, "ten-nights": played, "twenty-five-nights": played,
    "three-win-streak": bestStreak, "five-win-streak": bestStreak, "three-formats": formats.size,
    "full-house": ALL_FORMATS.filter((format) => formats.has(format)).length,
    "cup-champion": wins.cup ?? 0, "knockout-king": wins.knockout ?? 0, "domino-master": wins.domino ?? 0,
    "dart-thrower": wins.darts ?? 0, duellist: wins["head-to-head"] ?? 0,
    "hat-trick-month": Math.max(0, ...Object.values(months)), "big-table": biggestWin >= 5 ? 1 : 0, "trophy-cabinet": totalWins,
  };
  const badges = BADGES.map((badge) => ({ ...badge, have: Math.min(have[badge.id], badge.need), earned: have[badge.id] >= badge.need }));
  const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, grand: 0 } as Record<TrophyTier, number>;
  for (const trophy of trophies) tierCounts[trophy.tier] += 1;
  return { profileId: profile.id, trophies: trophies.reverse(), tierCounts, badges, earnedCount: badges.filter((badge) => badge.earned).length };
}
