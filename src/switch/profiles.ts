import type { Player } from "./types";

export type ProfileColour = "forest" | "gold" | "clay" | "navy";

export interface LocalProfile {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly colour: ProfileColour;
  readonly createdAt: string;
  readonly archived: boolean;
}

interface EnsureOptions {
  readonly now?: string;
  readonly createId?: () => string;
}

const PROFILE_KEY = "switchProfiles";
const COLOURS: readonly ProfileColour[] = ["forest", "gold", "clay", "navy"];

function normalise(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isProfile(value: unknown): value is LocalProfile {
  return isRecord(value)
    && value.version === 1
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.name === "string"
    && value.name.trim().length > 0
    && typeof value.colour === "string"
    && COLOURS.includes(value.colour as ProfileColour)
    && typeof value.createdAt === "string"
    && !Number.isNaN(Date.parse(value.createdAt))
    && typeof value.archived === "boolean";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cleanName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error("Player names cannot be blank.");
  return clean;
}

export function getProfiles(extensions: Readonly<Record<string, unknown>>): LocalProfile[] {
  const source = extensions[PROFILE_KEY];
  if (!Array.isArray(source)) return [];
  return source.filter(isProfile).map((profile) => clone(profile));
}

export function putProfiles(extensions: Readonly<Record<string, unknown>>, profiles: readonly LocalProfile[]): Record<string, unknown> {
  return { ...extensions, [PROFILE_KEY]: clone(profiles) };
}

export function ensureProfiles(
  extensions: Readonly<Record<string, unknown>>,
  names: readonly string[],
  options: EnsureOptions = {},
): { readonly extensions: Record<string, unknown>; readonly profiles: readonly LocalProfile[]; readonly players: readonly Player[] } {
  const profiles = getProfiles(extensions);
  const players: Player[] = [];
  const now = options.now ?? new Date().toISOString();
  const createId = options.createId ?? (() => `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  for (const rawName of names) {
    const name = cleanName(rawName);
    const matches = profiles.filter((profile) => normalise(profile.name) === normalise(name));
    if (matches.length > 1) throw new Error(`More than one saved profile matches ${name}. Rename one before continuing.`);
    let profile = matches[0];
    if (profile) {
      if (profile.archived) {
        profile = { ...profile, archived: false };
        profiles.splice(profiles.findIndex((entry) => entry.id === profile.id), 1, profile);
      }
    } else {
      profile = { version: 1, id: createId(), name, colour: COLOURS[profiles.length % COLOURS.length], createdAt: now, archived: false };
      profiles.push(profile);
    }
    players.push({ id: profile.id, name: profile.name });
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) throw new Error("Choose a different saved player for every seat.");
  return { extensions: putProfiles(extensions, profiles), profiles: clone(profiles), players };
}

export function renameProfile(extensions: Readonly<Record<string, unknown>>, profileId: string, name: string): Record<string, unknown> {
  const profiles = getProfiles(extensions);
  const profile = profiles.find((entry) => entry.id === profileId);
  if (!profile) throw new Error("That saved player no longer exists.");
  const clean = cleanName(name);
  if (profiles.some((entry) => entry.id !== profileId && !entry.archived && normalise(entry.name) === normalise(clean))) {
    throw new Error(`A player called ${clean} already exists.`);
  }
  return putProfiles(extensions, profiles.map((entry) => entry.id === profileId ? { ...entry, name: clean } : entry));
}

export function archiveProfile(extensions: Readonly<Record<string, unknown>>, profileId: string): Record<string, unknown> {
  const profiles = getProfiles(extensions);
  if (!profiles.some((entry) => entry.id === profileId)) throw new Error("That saved player no longer exists.");
  return putProfiles(extensions, profiles.map((entry) => entry.id === profileId ? { ...entry, archived: true } : entry));
}

export function resolveHistoryPlayerId(player: Player, profiles: readonly LocalProfile[]): string | null {
  if (profiles.some((profile) => profile.id === player.id)) return player.id;
  const matches = profiles.filter((profile) => normalise(profile.name) === normalise(player.name));
  return matches.length === 1 ? matches[0].id : null;
}
