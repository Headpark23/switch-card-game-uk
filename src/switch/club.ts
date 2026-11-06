import { derivePlayerStats } from "./analytics";
import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import type { SwitchSeason, SeasonStanding } from "./seasons";

type Extensions = Readonly<Record<string, unknown>>;

const CLUB_KEY = "switchClub";
export const MAX_CLUB_NAME = 32;

export function getClubName(extensions: Extensions): string {
  const value = extensions[CLUB_KEY];
  const name = value && typeof value === "object" ? (value as { name?: unknown }).name : null;
  return typeof name === "string" ? name.trim().slice(0, MAX_CLUB_NAME) : "";
}

export function putClubName(extensions: Extensions, name: string): Record<string, unknown> {
  const next = { ...extensions };
  const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_CLUB_NAME);
  if (clean) next[CLUB_KEY] = { version: 1, name: clean };
  else delete next[CLUB_KEY];
  return next;
}

export interface LeaderboardRow {
  readonly profileId: string;
  readonly name: string;
  readonly rank: number;
  readonly wins: number;
  readonly nights: number;
  readonly winRate: number;
}

/** Ranks active players by wins, then win rate, then fewest nights; ties share a rank. */
export function buildLeaderboard(profiles: readonly LocalProfile[], nights: readonly SwitchNightRecord[]): LeaderboardRow[] {
  const rows = profiles
    .filter((profile) => !profile.archived)
    .map((profile) => ({ profile, stats: derivePlayerStats(profile, nights, profiles) }))
    .filter(({ stats }) => stats.appearances > 0)
    .sort((a, b) => b.stats.wins - a.stats.wins || b.stats.winRate - a.stats.winRate || a.stats.appearances - b.stats.appearances || a.profile.name.localeCompare(b.profile.name));
  let rank = 0;
  return rows.map(({ profile, stats }, index) => {
    const previous = rows[index - 1]?.stats;
    if (!previous || previous.wins !== stats.wins || previous.winRate !== stats.winRate) rank = index + 1;
    return { profileId: profile.id, name: profile.name, rank, wins: stats.wins, nights: stats.appearances, winRate: stats.winRate };
  });
}

/** What goes on a shareable picture. Pure data so it can be tested without a canvas. */
export interface ShareCardContent {
  readonly club: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly rows: readonly { readonly rank: number | null; readonly label: string; readonly value: string; readonly highlight: boolean }[];
  readonly filename: string;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "switch";
const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(iso));

export function nightShareCard(night: SwitchNightRecord, club: string): ShareCardContent {
  return {
    club,
    eyebrow: `${night.formatLabel.toUpperCase()} NIGHT`,
    title: night.title,
    subtitle: `${night.outcome} · ${dateLabel(night.completedAt)}`,
    rows: night.players.slice(0, 6).map((player) => ({ rank: null, label: player.name, value: night.winnerIds.includes(player.id) ? "Winner" : "", highlight: night.winnerIds.includes(player.id) })),
    filename: `switch-${slug(night.title)}.png`,
  };
}

export function seasonShareCard(season: SwitchSeason, standings: readonly SeasonStanding[], nameOf: (id: string) => string, club: string): ShareCardContent {
  return {
    club,
    eyebrow: season.status === "complete" ? "FINAL TABLE" : "LEAGUE TABLE",
    title: season.name,
    subtitle: `${season.nightIds.length} night${season.nightIds.length === 1 ? "" : "s"} counted · 3 for a win, 1 for playing`,
    rows: standings.slice(0, 6).map((row) => ({ rank: row.rank, label: nameOf(row.profileId), value: `${row.points} pts`, highlight: row.rank === 1 })),
    filename: `switch-${slug(season.name)}-table.png`,
  };
}

export function leaderboardShareCard(rows: readonly LeaderboardRow[], nights: number, club: string): ShareCardContent {
  return {
    club,
    eyebrow: "THE RECORD BOOK",
    title: "Club leaderboard",
    subtitle: `After ${nights} saved night${nights === 1 ? "" : "s"}`,
    rows: rows.slice(0, 6).map((row) => ({ rank: row.rank, label: row.name, value: `${row.wins} win${row.wins === 1 ? "" : "s"} · ${Math.round(row.winRate * 100)}%`, highlight: row.rank === 1 })),
    filename: "switch-leaderboard.png",
  };
}
