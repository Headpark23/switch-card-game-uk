import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import { resolveHistoryPlayerId } from "./profiles";
import { deriveBadges, type BadgeProgress } from "./badges";
import { gameMode, seriesGames, type ComputerGame } from "./computerLog";

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

export type { BadgeProgress } from "./badges";
export { BADGES } from "./badges";

export interface TrophyRoom {
  readonly profileId: string;
  readonly trophies: readonly Trophy[];
  readonly tierCounts: Readonly<Record<TrophyTier, number>>;
  readonly badges: readonly BadgeProgress[];
  readonly earnedCount: number;
}

/** Everything here is derived from saved nights and computer games, so removing a night takes its trophy away too. */
export function deriveTrophyRoom(profile: LocalProfile, nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[], computerGames: readonly ComputerGame[] = []): TrophyRoom {
  const ordered = [...nights].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id.localeCompare(b.id));
  const trophies: Trophy[] = [];
  for (const night of ordered) {
    const ids = night.players.map((player) => ({ source: player.id, profile: resolveHistoryPlayerId(player, profiles) }));
    if (!ids.some((entry) => entry.profile === profile.id && night.winnerIds.includes(entry.source))) continue;
    const tier = trophyTier(night.format, night.players.length);
    trophies.push({
      nightId: night.id, title: night.title, format: night.format, formatLabel: night.formatLabel, tier,
      tierName: TROPHY_TIERS.find((entry) => entry.tier === tier)?.name ?? "Cup", players: night.players.length, wonAt: night.completedAt,
    });
  }
  // Winning a tournament or match against the computers earns a cup too, sized by how many sat down.
  const cpuFormat: Record<string, { format: string; label: string }> = {
    knockout: { format: "knockout", label: "Knock Out" }, group: { format: "league", label: "Group Play" }, cup: { format: "cup", label: "Switch Cup" },
    darts: { format: "darts", label: "Darts scoring" }, dominoes: { format: "domino", label: "Dominoes scoring" },
  };
  for (const game of seriesGames(computerGames.filter((entry) => entry.playerId === profile.id))) {
    const info = cpuFormat[gameMode(game)];
    if (!info || !game.series?.won) continue;
    const tier = trophyTier(info.format, game.series.players);
    trophies.push({
      nightId: game.seriesId ?? game.id, title: `${info.label} v ${game.series.players - 1} computer${game.series.players === 2 ? "" : "s"}`, format: info.format, formatLabel: info.label, tier,
      tierName: TROPHY_TIERS.find((entry) => entry.tier === tier)?.name ?? "Cup", players: game.series.players, wonAt: game.playedAt,
    });
  }
  trophies.sort((a, b) => Date.parse(a.wonAt) - Date.parse(b.wonAt));
  const badges = deriveBadges(profile, nights, profiles, computerGames);
  const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, grand: 0 } as Record<TrophyTier, number>;
  for (const trophy of trophies) tierCounts[trophy.tier] += 1;
  return { profileId: profile.id, trophies: trophies.reverse(), tierCounts, badges, earnedCount: badges.filter((badge) => badge.earned).length };
}
