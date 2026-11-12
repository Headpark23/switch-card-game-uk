import type { SwitchNightRecord } from "./history";
import { addNight, getHistory } from "./history";
import { getProfiles, putProfiles, type LocalProfile, type ProfileColour } from "./profiles";
import { addNightToSeason, createSeason, getSeasons, putSeasons } from "./seasons";
import type { Player } from "./types";

/** Everything the demo creates carries this id prefix, so it can be removed without touching real data. */
export const SAMPLE_PREFIX = "demo-";

type Extensions = Readonly<Record<string, unknown>>;

const CAST: readonly { name: string; colour: ProfileColour; skill: number }[] = [
  { name: "Alex", colour: "forest", skill: 1.35 },
  { name: "Blair", colour: "gold", skill: 1.0 },
  { name: "Casey", colour: "clay", skill: 0.8 },
  { name: "Dana", colour: "navy", skill: 1.15 },
  { name: "Eli", colour: "forest", skill: 0.7 },
];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idOf = (name: string) => `${SAMPLE_PREFIX}${name.toLowerCase()}`;
const playerOf = (name: string): Player => ({ id: idOf(name), name });

export function hasSampleData(extensions: Extensions): boolean {
  return getProfiles(extensions).some((profile) => profile.id.startsWith(SAMPLE_PREFIX));
}

/** Picks one of the names, weighted by skill. */
function pick(names: readonly string[], random: () => number): string {
  const weights = names.map((name) => CAST.find((member) => member.name === name)?.skill ?? 1);
  let roll = random() * weights.reduce((total, weight) => total + weight, 0);
  for (let index = 0; index < names.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return names[index];
  }
  return names[names.length - 1];
}

function buildNights(now: Date): SwitchNightRecord[] {
  const random = rng(20261107);
  const nights: SwitchNightRecord[] = [];
  const formats = ["domino", "head-to-head", "knockout", "darts", "cup", "domino", "knockout", "head-to-head", "cup", "darts", "domino", "knockout", "head-to-head", "cup", "domino", "knockout", "darts", "head-to-head"] as const;
  const labels = { domino: "Domino", "head-to-head": "One v One", darts: "Darts", knockout: "Knock Out", cup: "Switch Cup" } as const;
  formats.forEach((format, index) => {
    const when = new Date(now.getTime() - (formats.length - index) * 4 * 86_400_000);
    when.setHours(20, 15, 0, 0);
    const names = format === "domino" || format === "head-to-head" || format === "darts"
      ? [...CAST.map((member) => member.name)].sort(() => random() - 0.5).slice(0, 2)
      : [...CAST.map((member) => member.name)].sort(() => random() - 0.5).slice(0, format === "cup" ? 5 : 4);
    const winner = pick(names, random);
    const loser = names.find((name) => name !== winner) as string;
    const outcome = format === "domino" ? `${winner} won ${100 + Math.floor(random() * 30)}–${40 + Math.floor(random() * 50)}`
      : format === "head-to-head" ? `${winner} beat ${loser} ${3 + Math.floor(random() * 2)}–${Math.floor(random() * 3)}`
      : format === "darts" ? `${winner} won ${3}–${Math.floor(random() * 3)} on sets`
      : format === "knockout" ? `${winner} was the last one standing`
      : `${winner} won the Cup`;
    nights.push({
      version: 1,
      id: `${SAMPLE_PREFIX}night-${index + 1}`,
      completedAt: when.toISOString(),
      title: `${labels[format]} night`,
      format,
      formatLabel: labels[format],
      players: names.map(playerOf),
      winnerIds: [idOf(winner)],
      outcome,
      details: [{ heading: "Sample night", lines: [outcome, "Demo data, not a real result."] }],
    });
  });
  return nights;
}

/** Adds a ready-made club: five players, eighteen nights over eleven weeks and a league on top. */
export function addSampleData(extensions: Extensions, now: Date = new Date()): Record<string, unknown> {
  if (hasSampleData(extensions)) return { ...extensions };
  const stamp = new Date(now.getTime() - 80 * 86_400_000).toISOString();
  const profiles: LocalProfile[] = CAST.map((member) => ({ version: 1, id: idOf(member.name), name: member.name, colour: member.colour, createdAt: stamp, archived: false }));
  let next: Record<string, unknown> = putProfiles(extensions, [...getProfiles(extensions), ...profiles]);
  const nights = buildNights(now);
  for (const night of nights) next = addNight(next, night);
  let season = createSeason("Friday Night League (sample)", profiles.map((profile) => profile.id), profiles, { id: `${SAMPLE_PREFIX}season-1`, now: stamp });
  for (const night of [...nights].reverse()) {
    try { season = addNightToSeason(season, night, profiles); } catch { /* a night without two league members is simply not counted */ }
  }
  return putSeasons(next, [...getSeasons(next), season]);
}

export function removeSampleData(extensions: Extensions): Record<string, unknown> {
  const isDemo = (id: string) => id.startsWith(SAMPLE_PREFIX);
  let next: Record<string, unknown> = putProfiles(extensions, getProfiles(extensions).filter((profile) => !isDemo(profile.id)));
  next = { ...next, switchNightHistory: getHistory(next).filter((night) => !isDemo(night.id)) };
  return putSeasons(next, getSeasons(next).filter((season) => !isDemo(season.id)));
}
