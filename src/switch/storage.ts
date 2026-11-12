export const SCOREKEEPER_STORAGE_KEY = "switchScoreKeeper";

export interface StoredPlayer {
  readonly id: string;
  readonly name: string;
}

export interface ScorekeeperState {
  readonly schemaVersion: 1;
  readonly selectedFormat: string | null;
  readonly players: readonly StoredPlayer[];
  readonly scores: Readonly<Record<string, number>>;
  readonly target: number;
  readonly extensions: Readonly<Record<string, unknown>>;
}

export type LoadResult = {
  readonly status: "empty" | "loaded" | "unreadable";
  readonly state: ScorekeeperState;
  readonly originalRaw: string | null;
};

const KNOWN_KEYS = new Set(["schemaVersion", "selectedFormat", "format", "mode", "players", "playerNames", "scores", "target", "extensions"]);

function emptyState(): ScorekeeperState {
  return { schemaVersion: 1, selectedFormat: null, players: [], scores: {}, target: 100, extensions: {} };
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function migrateScorekeeper(input: unknown): ScorekeeperState {
  const source = recordOf(input);
  if (!source) return emptyState();

  const rawPlayers = Array.isArray(source.players)
    ? source.players
    : Array.isArray(source.playerNames)
      ? source.playerNames
      : [];
  const players: StoredPlayer[] = [];
  const scores: Record<string, number> = {};
  const scoreRecord = recordOf(source.scores) ?? {};

  rawPlayers.forEach((entry, index) => {
    const player = recordOf(entry);
    const rawName = typeof entry === "string" ? entry : player?.name;
    if (typeof rawName !== "string" || rawName.trim() === "") return;
    const id = typeof player?.id === "string" && player.id ? player.id : `legacy-${index + 1}`;
    players.push({ id, name: rawName });
    const score = finiteNonNegative(player?.score) ?? finiteNonNegative(scoreRecord[id]) ?? finiteNonNegative(scoreRecord[rawName]);
    if (score !== null) scores[id] = score;
  });

  for (const [key, value] of Object.entries(scoreRecord)) {
    const score = finiteNonNegative(value);
    if (score !== null && !(key in scores)) scores[key] = score;
  }

  const inheritedExtensions = recordOf(source.extensions) ?? {};
  const extensions: Record<string, unknown> = { ...inheritedExtensions };
  for (const [key, value] of Object.entries(source)) {
    if (!KNOWN_KEYS.has(key)) extensions[key] = value;
  }

  const selected = source.selectedFormat ?? source.format ?? source.mode;
  const target = finiteNonNegative(source.target);
  return {
    schemaVersion: 1,
    selectedFormat: typeof selected === "string" ? selected : null,
    players,
    scores,
    target: target && Number.isSafeInteger(target) ? target : 100,
    extensions,
  };
}

export function loadScorekeeper(raw: string | null): LoadResult {
  if (raw === null) return { status: "empty", state: emptyState(), originalRaw: null };
  try {
    return { status: "loaded", state: migrateScorekeeper(JSON.parse(raw)), originalRaw: raw };
  } catch {
    return { status: "unreadable", state: emptyState(), originalRaw: raw };
  }
}

/**
 * Saves the scorekeeper. By default extensions already in storage are kept, so unknown legacy
 * fields survive. Pass `replaceExtensions` when the caller holds the complete set and has removed
 * keys on purpose (for example clearing the night in progress); otherwise they would come back.
 */
export function saveScorekeeper(currentRaw: string | null, state: ScorekeeperState, options: { replaceExtensions?: boolean } = {}): string {
  let extensions = { ...state.extensions };
  if (currentRaw !== null && !options.replaceExtensions) {
    try {
      extensions = { ...migrateScorekeeper(JSON.parse(currentRaw)).extensions, ...extensions };
    } catch {
      // An explicit save is the only time unreadable data may be replaced.
    }
  }
  return JSON.stringify({ ...state, schemaVersion: 1, extensions });
}
