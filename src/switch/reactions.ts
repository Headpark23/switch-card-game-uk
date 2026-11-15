/**
 * Table talk: the fixed set of reactions anyone at the table can send, and the banter the computers send themselves.
 * Cheeky pub banter, never swearing, innuendo or drink, so the app keeps its 4+ rating. Ten sayings and eight of
 * our own card-character stickers (drawn in `src/screens/ReactionSticker.tsx`). The ids match `api/_room.js`,
 * which only ever stores the id, so no text can be sent between phones.
 */

export type StickerId = "smug-king" | "salty" | "card-shark" | "sweating-ace" | "mic-drop" | "facepalm-jack" | "crying-joker" | "seven-on-fire";

export interface Reaction {
  readonly id: string;
  /** What the reaction says: the saying itself, or the sticker's caption. */
  readonly text: string;
  /** Present for a sticker: which of our drawings to show. */
  readonly sticker?: StickerId;
}

export const SAYINGS: readonly Reaction[] = [
  { id: "read-em-and-weep", text: "Read 'em and weep" },
  { id: "all-youve-got", text: "Is that all you've got?" },
  { id: "sweating-yet", text: "Sweating yet?" },
  { id: "absolute-sausage", text: "Oh, you absolute sausage" },
  { id: "pick-up-sunshine", text: "Pick up, sunshine" },
  { id: "who-taught-you", text: "Who taught you to play?" },
  { id: "lucky-so-and-so", text: "Lucky so-and-so" },
  { id: "not-today-sweetheart", text: "Not today, sweetheart" },
  { id: "revenge-is-coming", text: "Revenge is coming" },
  { id: "behave", text: "Behave!" },
];

export const STICKERS: readonly Reaction[] = [
  { id: "smug-king", text: "Too easy", sticker: "smug-king" },
  { id: "salty", text: "Salty!", sticker: "salty" },
  { id: "card-shark", text: "Card shark", sticker: "card-shark" },
  { id: "sweating-ace", text: "Gulp", sticker: "sweating-ace" },
  { id: "mic-drop", text: "Mic drop", sticker: "mic-drop" },
  { id: "facepalm-jack", text: "Facepalm", sticker: "facepalm-jack" },
  { id: "crying-joker", text: "Boo hoo", sticker: "crying-joker" },
  { id: "seven-on-fire", text: "On fire", sticker: "seven-on-fire" },
];

/** All eighteen, sayings first. */
export const REACTIONS: readonly Reaction[] = [...SAYINGS, ...STICKERS];

export const reactionOf = (id: string): Reaction | undefined => REACTIONS.find((entry) => entry.id === id);

/* ── Computer banter ── */

/** How a computer feels about what just happened. */
export type Mood = "gloat" | "sulk" | "tease" | "win" | "lose" | "reply";

interface Banter {
  /** How likely this computer is to say anything at all, 0 to 1. */
  readonly chat: number;
  readonly moods: Readonly<Record<Mood, readonly string[]>>;
}

const BASE: Banter["moods"] = {
  gloat: ["read-em-and-weep", "pick-up-sunshine", "smug-king", "card-shark"],
  sulk: ["revenge-is-coming", "salty", "crying-joker", "facepalm-jack"],
  tease: ["sweating-yet", "not-today-sweetheart", "sweating-ace"],
  win: ["mic-drop", "read-em-and-weep", "smug-king", "seven-on-fire"],
  lose: ["lucky-so-and-so", "salty", "crying-joker", "revenge-is-coming"],
  reply: ["behave", "absolute-sausage", "all-youve-got", "facepalm-jack"],
};

/** Each computer's voice, to suit the personality they play with (ruling 29). */
export const BANTER: Readonly<Record<string, Banter>> = {
  John: { chat: 0.75, moods: { ...BASE, gloat: ["read-em-and-weep", "pick-up-sunshine", "smug-king"], win: ["mic-drop", "smug-king"] } },
  Paul: { chat: 0.55, moods: { ...BASE, tease: ["not-today-sweetheart", "sweating-yet"], reply: ["behave", "absolute-sausage"] } },
  George: { chat: 0.35, moods: { ...BASE, gloat: ["card-shark"], win: ["card-shark", "mic-drop"], lose: ["lucky-so-and-so"] } },
  Ringo: { chat: 0.5, moods: { ...BASE, sulk: ["salty", "crying-joker", "revenge-is-coming"], reply: ["absolute-sausage", "behave"] } },
  Ziggy: { chat: 0.6, moods: { ...BASE, win: ["seven-on-fire", "mic-drop"], gloat: ["card-shark", "all-youve-got"] } },
  Marley: { chat: 0.45, moods: { ...BASE, sulk: ["facepalm-jack", "revenge-is-coming"], tease: ["sweating-ace", "sweating-yet"] } },
  Bowie: { chat: 0.65, moods: { ...BASE, win: ["smug-king", "mic-drop", "seven-on-fire"], reply: ["who-taught-you", "behave", "all-youve-got"] } },
};
const DEFAULT_BANTER: Banter = { chat: 0.5, moods: BASE };
export const banterOf = (name: string): Banter => BANTER[name] ?? DEFAULT_BANTER;

/** Something worth a comment, in seat numbers (0 is you). */
export type TableEvent =
  | { readonly kind: "penalty"; readonly victim: number; readonly by: number | null; readonly cards: number }
  | { readonly kind: "spotted"; readonly victim: number; readonly by: number }
  | { readonly kind: "last-card"; readonly seat: number }
  | { readonly kind: "win"; readonly winner: number }
  | { readonly kind: "reply"; readonly to: number };

/**
 * Which computer, if any, says what about an event. `computers` lists the seats a computer is playing.
 * Most moves pass without a word: each computer speaks only as often as its personality allows.
 */
export function banterFor(event: TableEvent, names: readonly string[], computers: readonly number[], random: () => number = Math.random): { seat: number; id: string } | null {
  const isComputer = (seat: number | null): seat is number => seat !== null && computers.includes(seat);
  const others = (except: number) => computers.filter((seat) => seat !== except);
  const candidates: { seat: number; mood: Mood; odds: number }[] = [];
  switch (event.kind) {
    case "penalty":
      if (isComputer(event.by) && event.by !== event.victim) candidates.push({ seat: event.by, mood: "gloat", odds: Math.min(0.95, 0.45 + event.cards * 0.06) });
      if (isComputer(event.victim)) candidates.push({ seat: event.victim, mood: "sulk", odds: Math.min(0.9, 0.35 + event.cards * 0.05) });
      break;
    case "spotted":
      if (isComputer(event.by)) candidates.push({ seat: event.by, mood: "gloat", odds: 0.85 });
      break;
    case "last-card":
      if (isComputer(event.seat)) candidates.push({ seat: event.seat, mood: "tease", odds: 0.4 });
      else others(event.seat).forEach((seat) => candidates.push({ seat, mood: "tease", odds: 0.45 / Math.max(1, others(event.seat).length) }));
      break;
    case "win":
      if (isComputer(event.winner)) candidates.push({ seat: event.winner, mood: "win", odds: 0.85 });
      // Someone always has something to say about a win.
      others(event.winner).forEach((seat, index, losers) => candidates.push({ seat, mood: "lose", odds: index === losers.length - 1 ? 1 : 0.7 / losers.length }));
      break;
    case "reply":
      others(event.to).forEach((seat) => candidates.push({ seat, mood: "reply", odds: 0.6 / Math.max(1, others(event.to).length) }));
      break;
  }
  for (const candidate of candidates) {
    const voice = banterOf(names[candidate.seat] ?? "");
    if (random() >= candidate.odds * (0.5 + voice.chat)) continue;
    const pool = voice.moods[candidate.mood];
    if (!pool.length) continue;
    return { seat: candidate.seat, id: pool[Math.floor(random() * pool.length) % pool.length] };
  }
  return null;
}
