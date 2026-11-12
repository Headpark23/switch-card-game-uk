import { derivePlayerStats } from "./analytics";
import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";

export interface Dashboard {
  readonly totalNights: number;
  readonly activePlayers: number;
  readonly champion: { readonly name: string; readonly wins: number } | null;
  readonly hot: { readonly name: string; readonly streak: number } | null;
  readonly months: readonly { readonly key: string; readonly label: string; readonly nights: number }[];
  readonly busiest: { readonly label: string; readonly nights: number } | null;
}

/** Club-wide numbers for the Stats dashboard. Pure and based only on saved nights; the chart ends at the latest saved night. */
export function deriveDashboard(nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): Dashboard {
  const active = profiles.filter((profile) => !profile.archived);
  const stats = active.map((profile) => ({ profile, stats: derivePlayerStats(profile, nights, profiles) }));
  const byWins = [...stats].sort((a, b) => b.stats.wins - a.stats.wins || b.stats.winRate - a.stats.winRate);
  const champion = byWins[0] && byWins[0].stats.wins > 0 ? { name: byWins[0].profile.name, wins: byWins[0].stats.wins } : null;
  const hotEntry = [...stats].sort((a, b) => b.stats.currentWinStreak - a.stats.currentWinStreak)[0];
  const hot = hotEntry && hotEntry.stats.currentWinStreak >= 2 ? { name: hotEntry.profile.name, streak: hotEntry.stats.currentWinStreak } : null;

  const latest = nights.reduce((max, night) => Math.max(max, new Date(night.completedAt).getTime()), 0);
  const anchor = new Date(latest || Date.now());
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (5 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date), nights: 0 };
  });
  for (const night of nights) {
    const date = new Date(night.completedAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = months.find((entry) => entry.key === key);
    if (month) (month as { nights: number }).nights += 1;
  }
  const best = [...months].sort((a, b) => b.nights - a.nights)[0];
  return { totalNights: nights.length, activePlayers: active.length, champion, hot, months, busiest: best && best.nights > 0 ? { label: best.label, nights: best.nights } : null };
}
