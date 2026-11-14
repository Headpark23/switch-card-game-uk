import { gameMode, seriesGames, type ComputerGame } from "./computerLog";
import type { SwitchNightRecord } from "./history";
import type { LocalProfile } from "./profiles";
import { resolveHistoryPlayerId } from "./profiles";

export type BadgeCategory = "nights" | "wins" | "formats" | "computer" | "travel" | "social";
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export const BADGE_CATEGORIES: readonly { id: BadgeCategory; name: string; blurb: string }[] = [
  { id: "nights", name: "Game nights", blurb: "Turn up and play." },
  { id: "wins", name: "Winning", blurb: "Wins, streaks and big results." },
  { id: "formats", name: "Every format", blurb: "Master each way to play." },
  { id: "computer", name: "Versus the computer", blurb: "Practice that pays." },
  { id: "travel", name: "Places", blurb: "Take the cards on tour." },
  { id: "social", name: "Company", blurb: "Play with plenty of people." },
];

export interface BadgeDefinition {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly category: BadgeCategory;
  readonly tier: BadgeTier;
  /** The Phosphor icon drawn on the chip. */
  readonly icon: string;
  readonly need: number;
  /** Which measured figure counts towards it. */
  readonly metric: MetricId;
}

type MetricId =
  | "played" | "wins" | "streak" | "formats" | "allFormats" | "winsCup" | "winsKnockout" | "winsDomino" | "winsDarts" | "winsDuel" | "winsLeague"
  | "monthWins" | "bigTable" | "trophies" | "grandTrophy" | "weekendWins" | "lateNights" | "opponents" | "rival"
  | "cpuGames" | "cpuWins" | "cpuStreak" | "cpuSharpWins" | "cpuRelaxedWins" | "cpuFourWins" | "cpuTableWins" | "cpuFast"
  | "cpuKo" | "cpuGroup" | "cpuCup" | "cpuDarts" | "cpuDominoes" | "cpuModesWon" | "cpuEight" | "cpuSeries" | "cpuSeriesStreak" | "cpuEightPlayed"
  | "venues" | "countries" | "homeWins" | "awayWins" | "placedNights";

const b = (id: string, label: string, hint: string, category: BadgeCategory, tier: BadgeTier, icon: string, need: number, metric: MetricId): BadgeDefinition =>
  ({ id, label, hint, category, tier, icon, need, metric });

export const BADGES: readonly BadgeDefinition[] = [
  b("first-night", "First night", "Play a saved night", "nights", "bronze", "Cards", 1, "played"),
  b("five-nights", "Regular", "Play 5 saved nights", "nights", "bronze", "CalendarCheck", 5, "played"),
  b("ten-nights", "Table fixture", "Play 10 saved nights", "nights", "silver", "Armchair", 10, "played"),
  b("twenty-five-nights", "Card night legend", "Play 25 saved nights", "nights", "gold", "Crown", 25, "played"),
  b("fifty-nights", "Pillar of the club", "Play 50 saved nights", "nights", "platinum", "Columns", 50, "played"),
  b("night-owl", "Night owl", "Finish a night after midnight", "nights", "silver", "Moon", 1, "lateNights"),
  b("weekend-warrior", "Weekend warrior", "Win 5 nights on a weekend", "nights", "silver", "Sun", 5, "weekendWins"),
  b("first-win", "First win", "Win a saved night", "wins", "bronze", "Star", 1, "wins"),
  b("ten-wins", "Ten up", "Win 10 saved nights", "wins", "silver", "Medal", 10, "wins"),
  b("twenty-five-wins", "Serial winner", "Win 25 saved nights", "wins", "gold", "Ranking", 25, "wins"),
  b("three-win-streak", "Hot streak", "Win 3 nights in a row", "wins", "bronze", "Fire", 3, "streak"),
  b("five-win-streak", "Unstoppable", "Win 5 nights in a row", "wins", "silver", "Lightning", 5, "streak"),
  b("ten-win-streak", "Untouchable", "Win 10 nights in a row", "wins", "platinum", "Rocket", 10, "streak"),
  b("hat-trick-month", "Hat-trick month", "Win 3 nights in one month", "wins", "silver", "CalendarStar", 3, "monthWins"),
  b("trophy-cabinet", "Trophy cabinet", "Collect 10 trophies", "wins", "gold", "Trophy", 10, "trophies"),
  b("grand-trophy", "Grand slam", "Win a Grand Trophy night", "wins", "platinum", "Diamond", 1, "grandTrophy"),
  b("three-formats", "All-rounder", "Play 3 different formats", "formats", "bronze", "DiamondsFour", 3, "formats"),
  b("full-house", "Full house", "Play all 5 formats", "formats", "gold", "Spade", 5, "allFormats"),
  b("cup-champion", "Cup champion", "Win a Switch Cup", "formats", "silver", "Trophy", 1, "winsCup"),
  b("knockout-king", "Knockout king", "Win a Knock Out", "formats", "silver", "Crown", 1, "winsKnockout"),
  b("domino-master", "Domino master", "Win 3 Domino nights", "formats", "silver", "GridFour", 3, "winsDomino"),
  b("dart-thrower", "Bullseye", "Win a Darts night", "formats", "bronze", "Target", 1, "winsDarts"),
  b("duellist", "Duellist", "Win 3 One v One nights", "formats", "bronze", "Sword", 3, "winsDuel"),
  b("league-leader", "League leader", "Win a Group Play championship", "formats", "gold", "Flag", 1, "winsLeague"),
  b("cpu-first", "Warming up", "Play a game against the computer", "computer", "bronze", "Robot", 1, "cpuGames"),
  b("cpu-ten", "Sparring partner", "Play 10 games against the computer", "computer", "bronze", "Barbell", 10, "cpuGames"),
  b("cpu-fifty", "Practice makes perfect", "Play 50 games against the computer", "computer", "silver", "Brain", 50, "cpuGames"),
  b("cpu-win", "Man over machine", "Beat the computer", "computer", "bronze", "Handshake", 1, "cpuWins"),
  b("cpu-ten-wins", "Machine breaker", "Beat the computer 10 times", "computer", "silver", "Cpu", 10, "cpuWins"),
  b("cpu-streak", "In the zone", "Beat the computer 3 games running", "computer", "silver", "Fire", 3, "cpuStreak"),
  b("cpu-streak-five", "Circuit breaker", "Beat the computer 5 games running", "computer", "gold", "Lightning", 5, "cpuStreak"),
  b("cpu-sharp", "Sharp shooter", "Beat the Sharp computer", "computer", "gold", "Crosshair", 1, "cpuSharpWins"),
  b("cpu-sharp-five", "Giant killer", "Beat the Sharp computer 5 times", "computer", "platinum", "ShieldStar", 5, "cpuSharpWins"),
  b("cpu-four", "Full table", "Beat 4 computers in one game", "computer", "gold", "UsersFour", 1, "cpuFourWins"),
  b("cpu-big-table", "Crowd control", "Beat a table of 3 or more computers 5 times", "computer", "silver", "UsersThree", 5, "cpuTableWins"),
  b("cpu-quick", "Blitz", "Win a game against the computer in 25 moves or fewer", "computer", "silver", "Timer", 1, "cpuFast"),
  b("cpu-ko", "Last one standing", "Win a Knock Out against the computers", "computer", "silver", "Crown", 1, "cpuKo"),
  b("cpu-ko-three", "Knock Out specialist", "Win 3 Knock Outs against the computers", "computer", "gold", "Skull", 3, "cpuKo"),
  b("cpu-group", "Group champion", "Win a Group Play championship against the computers", "computer", "gold", "Flag", 1, "cpuGroup"),
  b("cpu-cup", "Cup holder", "Win a Switch Cup against the computers", "computer", "silver", "Trophy", 1, "cpuCup"),
  b("cpu-darts", "Set and match", "Win a Darts scoring match against the computers", "computer", "silver", "Target", 1, "cpuDarts"),
  b("cpu-dominoes", "Lowest wins", "Win a Dominoes scoring match against the computers", "computer", "silver", "GridFour", 1, "cpuDominoes"),
  b("cpu-every-mode", "Every game type", "Win a Knock Out, Group Play, Switch Cup, Darts and Dominoes match", "computer", "platinum", "Diamond", 5, "cpuModesWon"),
  b("cpu-series-ten", "Tournament regular", "Finish 10 tournaments or matches against the computers", "computer", "silver", "CalendarCheck", 10, "cpuSeries"),
  b("cpu-series-streak", "Tournament run", "Win 3 tournaments or matches in a row", "computer", "gold", "Fire", 3, "cpuSeriesStreak"),
  b("cpu-eight-play", "Full house of eight", "Play a game at a table of 8", "computer", "bronze", "UsersFour", 1, "cpuEightPlayed"),
  b("cpu-eight-win", "Master of eight", "Win a game at a table of 8", "computer", "platinum", "ShieldStar", 1, "cpuEight"),
  b("first-venue", "Home ground", "Record where you played", "travel", "bronze", "MapPin", 1, "venues"),
  b("three-venues", "Regular haunts", "Play at 3 different venues", "travel", "bronze", "MapTrifold", 3, "venues"),
  b("ten-venues", "Venue hopper", "Play at 10 different venues", "travel", "silver", "Compass", 10, "venues"),
  b("first-stamp", "First stamp", "Get your first passport stamp", "travel", "bronze", "Stamp", 1, "countries"),
  b("three-countries", "Jet setter", "Play in 3 countries", "travel", "silver", "Airplane", 3, "countries"),
  b("five-countries", "Globetrotter", "Play in 5 countries", "travel", "gold", "Globe", 5, "countries"),
  b("ten-countries", "World tour", "Play in 10 countries", "travel", "platinum", "GlobeHemisphereWest", 10, "countries"),
  b("home-wins", "Home advantage", "Win 5 nights at your most-played venue", "travel", "silver", "House", 5, "homeWins"),
  b("away-win", "Away win", "Win a night away from your home venue", "travel", "silver", "SuitcaseRolling", 1, "awayWins"),
  b("big-table", "Big table", "Win with 5 or more players", "social", "silver", "UsersThree", 1, "bigTable"),
  b("five-opponents", "Making friends", "Play against 5 different people", "social", "bronze", "Users", 5, "opponents"),
  b("ten-opponents", "Social butterfly", "Play against 10 different people", "social", "silver", "Smiley", 10, "opponents"),
  b("rivalry", "Arch rival", "Play the same person 10 times", "social", "silver", "Sword", 10, "rival"),
];

export interface BadgeProgress extends BadgeDefinition {
  readonly have: number;
  readonly earned: boolean;
}

const ALL_FORMATS = ["domino", "head-to-head", "darts", "knockout", "cup"];

/** Everything every badge needs, measured from saved nights and computer games. Removing a night takes its badges away too. */
export function measureBadges(
  profile: LocalProfile,
  nights: readonly SwitchNightRecord[],
  profiles: readonly LocalProfile[],
  computerGames: readonly ComputerGame[] = [],
): Record<MetricId, number> {
  const ordered = [...nights].sort((a, c) => Date.parse(a.completedAt) - Date.parse(c.completedAt) || a.id.localeCompare(c.id));
  const formats = new Set<string>();
  const wins: Record<string, number> = {};
  const months: Record<string, number> = {};
  const opponents = new Map<string, number>();
  const venues = new Map<string, number>();
  const venueWins = new Map<string, number>();
  const countries = new Set<string>();
  let played = 0;
  let totalWins = 0;
  let streak = 0;
  let best = 0;
  let biggest = 0;
  let grand = 0;
  let weekend = 0;
  let late = 0;
  let placed = 0;
  const placedRecords: SwitchNightRecord[] = [];

  for (const night of ordered) {
    const ids = night.players.map((player) => ({ source: player.id, profile: resolveHistoryPlayerId(player, profiles) }));
    if (!ids.some((entry) => entry.profile === profile.id)) continue;
    played += 1;
    formats.add(night.format);
    for (const entry of ids) if (entry.profile && entry.profile !== profile.id) opponents.set(entry.profile, (opponents.get(entry.profile) ?? 0) + 1);
    const when = new Date(night.completedAt);
    if (when.getHours() < 5) late += 1;
    if (night.place) {
      placed += 1;
      placedRecords.push(night);
      const key = `${night.place.country}:${night.place.name.toLowerCase()}`;
      venues.set(key, (venues.get(key) ?? 0) + 1);
      countries.add(night.place.country);
    }
    const won = ids.some((entry) => entry.profile === profile.id && night.winnerIds.includes(entry.source));
    if (!won) { streak = 0; continue; }
    streak += 1;
    best = Math.max(best, streak);
    totalWins += 1;
    wins[night.format] = (wins[night.format] ?? 0) + 1;
    const month = night.completedAt.slice(0, 7);
    months[month] = (months[month] ?? 0) + 1;
    biggest = Math.max(biggest, night.players.length);
    if (["cup", "knockout", "league"].includes(night.format) && night.players.length >= 5) grand += 1;
    if (when.getDay() === 0 || when.getDay() === 6) weekend += 1;
    if (night.place) {
      const key = `${night.place.country}:${night.place.name.toLowerCase()}`;
      venueWins.set(key, (venueWins.get(key) ?? 0) + 1);
    }
  }

  const homeKey = [...venues.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
  const homeWins = homeKey ? venueWins.get(homeKey) ?? 0 : 0;
  const awayWins = [...venueWins.entries()].filter(([key]) => key !== homeKey).reduce((total, [, count]) => total + count, 0);

  const mine = computerGames.filter((game) => game.playerId === profile.id).sort((a, c) => Date.parse(a.playedAt) - Date.parse(c.playedAt));
  let cpuStreak = 0;
  let cpuBest = 0;
  for (const game of mine) {
    if (game.won) { cpuStreak += 1; cpuBest = Math.max(cpuBest, cpuStreak); } else cpuStreak = 0;
  }
  const cpuWon = mine.filter((game) => game.won);
  const finished = seriesGames(mine);
  const seriesWon = (mode: string) => finished.filter((game) => gameMode(game) === mode && game.series?.won).length;
  let seriesStreak = 0;
  let seriesBest = 0;
  for (const game of finished) {
    if (game.series?.won) { seriesStreak += 1; seriesBest = Math.max(seriesBest, seriesStreak); } else seriesStreak = 0;
  }
  const modesWon = ["knockout", "group", "cup", "darts", "dominoes"].filter((mode) => seriesWon(mode) > 0).length;
  return {
    played, wins: totalWins, streak: best, formats: formats.size, allFormats: ALL_FORMATS.filter((format) => formats.has(format)).length,
    winsCup: wins.cup ?? 0, winsKnockout: wins.knockout ?? 0, winsDomino: wins.domino ?? 0, winsDarts: wins.darts ?? 0, winsDuel: wins["head-to-head"] ?? 0, winsLeague: wins.league ?? 0,
    monthWins: Math.max(0, ...Object.values(months)), bigTable: biggest >= 5 ? 1 : 0, trophies: totalWins, grandTrophy: grand, weekendWins: weekend, lateNights: late,
    opponents: opponents.size, rival: Math.max(0, ...opponents.values()),
    cpuGames: mine.length, cpuWins: cpuWon.length, cpuStreak: cpuBest,
    cpuSharpWins: cpuWon.filter((game) => game.level === "sharp").length, cpuRelaxedWins: cpuWon.filter((game) => game.level === "relaxed").length,
    cpuFourWins: cpuWon.filter((game) => game.opponents >= 4).length, cpuTableWins: cpuWon.filter((game) => game.opponents >= 3).length,
    cpuFast: cpuWon.filter((game) => game.moves <= 25).length,
    cpuKo: seriesWon("knockout"), cpuGroup: seriesWon("group"), cpuCup: seriesWon("cup"), cpuDarts: seriesWon("darts"), cpuDominoes: seriesWon("dominoes"),
    cpuModesWon: modesWon, cpuSeries: finished.length, cpuSeriesStreak: seriesBest,
    cpuEightPlayed: mine.filter((game) => game.opponents >= 7).length, cpuEight: cpuWon.filter((game) => game.opponents >= 7).length,
    venues: venues.size, countries: countries.size, homeWins, awayWins, placedNights: placed,
  };
}

export function deriveBadges(
  profile: LocalProfile,
  nights: readonly SwitchNightRecord[],
  profiles: readonly LocalProfile[],
  computerGames: readonly ComputerGame[] = [],
): BadgeProgress[] {
  const metrics = measureBadges(profile, nights, profiles, computerGames);
  return BADGES.map((badge) => ({ ...badge, have: Math.min(metrics[badge.metric], badge.need), earned: metrics[badge.metric] >= badge.need }));
}

/** Passport stamps: one per country played in, with the nights and venues behind it. */
export interface PassportStamp {
  readonly country: string;
  readonly nights: number;
  readonly wins: number;
  readonly venues: readonly string[];
  readonly first: string;
  readonly last: string;
}

export function derivePassport(profile: LocalProfile, nights: readonly SwitchNightRecord[], profiles: readonly LocalProfile[]): PassportStamp[] {
  const stamps = new Map<string, { nights: number; wins: number; venues: Set<string>; first: string; last: string }>();
  for (const night of [...nights].sort((a, c) => Date.parse(a.completedAt) - Date.parse(c.completedAt))) {
    if (!night.place) continue;
    const ids = night.players.map((player) => ({ source: player.id, profile: resolveHistoryPlayerId(player, profiles) }));
    if (!ids.some((entry) => entry.profile === profile.id)) continue;
    const entry = stamps.get(night.place.country) ?? { nights: 0, wins: 0, venues: new Set<string>(), first: night.completedAt, last: night.completedAt };
    entry.nights += 1;
    entry.venues.add(night.place.name);
    entry.last = night.completedAt;
    if (ids.some((item) => item.profile === profile.id && night.winnerIds.includes(item.source))) entry.wins += 1;
    stamps.set(night.place.country, entry);
  }
  return [...stamps.entries()].map(([country, entry]) => ({ country, nights: entry.nights, wins: entry.wins, venues: [...entry.venues], first: entry.first, last: entry.last }))
    .sort((a, c) => Date.parse(a.first) - Date.parse(c.first));
}
