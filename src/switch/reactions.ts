/**
 * Table talk: the fixed set of reactions anyone at the table can send, and the banter the computers send themselves.
 * Ten clean cheeky sayings and eight of our own card-character stickers (drawn in `src/screens/ReactionSticker.tsx`),
 * plus thirty-seven spicy sayings full of pub swearing (owner decision, 15 Nov 2026, revising the 14 Nov "no swearing"
 * rule: groups of people swear at card tables). Every swear word is always masked (F#~k, b@stard, w8nkr, pr1k,
 * r's-hole), so even spicy talk stays family friendly, and a test guards it. Spicy is off until someone turns it on,
 * on their own phone.
 * Every spicy saying has a clean stand-in, and a phone with Spicy off always shows the stand-in, so swearing never
 * reaches someone who has not asked for it. The ids match `api/_room.js`, which only ever stores the id, so no text
 * can be sent between phones.
 */

export type StickerId = "smug-king" | "salty" | "card-shark" | "sweating-ace" | "mic-drop" | "facepalm-jack" | "crying-joker" | "seven-on-fire";

export interface Reaction {
  readonly id: string;
  /** What the reaction says: the saying itself, or the sticker's caption. */
  readonly text: string;
  /** Present for a sticker: which of our drawings to show. */
  readonly sticker?: StickerId;
  /** True for a spicy saying (it swears). Its `text` is the spicy wording; `clean` is what a phone with Spicy off shows. */
  readonly spicy?: boolean;
  readonly clean?: string;
}

/* ── Spicy setting (per phone, never shared) ── */

const SPICY_KEY = "switchSpicyTalk";
let spicyCache: boolean | null = null;

/** Whether this phone shows and offers swearing. Off until someone turns it on. */
export function spicyTalk(): boolean {
  if (spicyCache === null) {
    try { spicyCache = globalThis.localStorage?.getItem(SPICY_KEY) === "1"; } catch { spicyCache = false; }
  }
  return spicyCache;
}

export function setSpicyTalk(on: boolean): void {
  spicyCache = on;
  try { globalThis.localStorage?.setItem(SPICY_KEY, on ? "1" : "0"); } catch { /* private mode: the choice lasts until the app closes */ }
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

/** Pub swearing, mild to proper, always with the swear words masked. Each has a clean stand-in for phones with Spicy off. */
export const SPICY_SAYINGS: readonly Reaction[] = [
  { id: "spicy-bollocks", text: "Oh, b0ll*cks", clean: "Oh, bother", spicy: true },
  { id: "spicy-bugger", text: "Bugg#r!", clean: "Oh, fiddlesticks!", spicy: true },
  { id: "spicy-bloody-hell", text: "Bl**dy h3ll, really?", clean: "Goodness, really?", spicy: true },
  { id: "spicy-sod-off", text: "S*d off, mate", clean: "Off you pop, mate", spicy: true },
  { id: "spicy-jammy", text: "You jammy b@stard", clean: "You jammy so-and-so", spicy: true },
  { id: "spicy-cheating", text: "You cheating b@5tard!", clean: "You cheeky so-and-so!", spicy: true },
  { id: "spicy-pick-up-arse", text: "Pick up, you @rse", clean: "Pick up, you muppet", spicy: true },
  { id: "spicy-shite-hand", text: "What a sh!te hand", clean: "What a rubbish hand", spicy: true },
  { id: "spicy-holy-shit", text: "Holy sh#t", clean: "Holy moly", spicy: true },
  { id: "spicy-piss-off", text: "Oh, p*ss off", clean: "Oh, go on then", spicy: true },
  { id: "spicy-fucking-yes", text: "F#~king yes!", clean: "Yes! Get in!", spicy: true },
  { id: "spicy-for-fucks-sake", text: "For f#~k's sake", clean: "For goodness' sake", spicy: true },
  { id: "spicy-wanker", text: "You absolute w8nkr", clean: "You absolute muppet", spicy: true },
  { id: "spicy-prick", text: "Don't be a pr1k", clean: "Don't be a spoilsport", spicy: true },
  { id: "spicy-arsehole", text: "Total r's-hole move", clean: "Total rotter move", spicy: true },
  { id: "spicy-fk-off", text: "F#~k off, I'm winning", clean: "Off you pop, I'm winning", spicy: true },
  { id: "spicy-what-the-f", text: "What the f#~k was that?", clean: "What on earth was that?", spicy: true },
  { id: "spicy-no-f-way", text: "No f#~king way", clean: "No way at all", spicy: true },
  { id: "spicy-dick-move", text: "That's a d1ck move", clean: "That's a mean move", spicy: true },
  { id: "spicy-twat", text: "Absolute tw@t", clean: "Absolute nitwit", spicy: true },
  { id: "spicy-crap", text: "Total cr@p hand", clean: "Total rubbish hand", spicy: true },
  { id: "spicy-damn", text: "D@mn you", clean: "Drat you", spicy: true },
  { id: "spicy-hell", text: "Go to h3ll", clean: "Go to your room", spicy: true },
  { id: "spicy-git", text: "You smug g!t", clean: "You smug so-and-so", spicy: true },
  { id: "spicy-lucky-bastard", text: "Lucky b@st@rd", clean: "Lucky so-and-so", spicy: true },
  { id: "spicy-shitshow", text: "What a sh!tshow", clean: "What a mess", spicy: true },
  { id: "spicy-bullshit", text: "B*llsh!t", clean: "Fibber!", spicy: true },
  { id: "spicy-pissed", text: "I'm well p*ssed off", clean: "I'm well cross", spicy: true },
  { id: "spicy-f-hell", text: "Oh, f#~king h3ll", clean: "Oh, flipping heck", spicy: true },
  { id: "spicy-dickhead", text: "You d!ckhead", clean: "You plonker", spicy: true },
  { id: "spicy-bellend", text: "Total b3llend", clean: "Total plonker", spicy: true },
  { id: "spicy-tosser", text: "You t0sser", clean: "You rascal", spicy: true },
  { id: "spicy-sodding", text: "S*dding h3ll", clean: "Flipping heck", spicy: true },
  { id: "spicy-bloody-lucky", text: "Bl**dy lucky, that", clean: "Awfully lucky, that", spicy: true },
  { id: "spicy-piss-take", text: "What a p*ss take", clean: "What a cheek", spicy: true },
  { id: "spicy-eat-shit", text: "Eat sh!t", clean: "Eat my dust", spicy: true },
  { id: "spicy-knob", text: "Absolute kn0b", clean: "Absolute plonker", spicy: true },
];

/** Every reaction the server accepts: the eighteen clean ones, then the spicy ones. */
export const REACTIONS: readonly Reaction[] = [...SAYINGS, ...STICKERS, ...SPICY_SAYINGS];

/**
 * A reaction as this phone shows it. A spicy saying reads as its clean stand-in unless Spicy is on, so the same id
 * can be sent to a mixed table and each phone shows only what its owner has asked to see.
 */
export function reactionOf(id: string, spicy: boolean = spicyTalk()): Reaction | undefined {
  const found = REACTIONS.find((entry) => entry.id === id);
  if (!found?.spicy || spicy) return found;
  return { ...found, text: found.clean ?? found.text, spicy: false };
}

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

/** What a computer adds to its repertoire when Spicy is on (it mixes with the clean lines, so not every remark swears). */
const SPICY_MOODS: Readonly<Record<Mood, readonly string[]>> = {
  gloat: ["spicy-sod-off", "spicy-pick-up-arse", "spicy-fk-off", "spicy-eat-shit", "spicy-git", "spicy-dickhead", "spicy-tosser"],
  sulk: ["spicy-bollocks", "spicy-bugger", "spicy-for-fucks-sake", "spicy-cheating", "spicy-what-the-f", "spicy-pissed", "spicy-crap", "spicy-damn", "spicy-sodding", "spicy-bullshit", "spicy-shitshow", "spicy-piss-take"],
  tease: ["spicy-holy-shit", "spicy-bloody-hell", "spicy-no-f-way", "spicy-hell"],
  win: ["spicy-fucking-yes", "spicy-sod-off", "spicy-pick-up-arse", "spicy-eat-shit", "spicy-wanker", "spicy-fk-off"],
  lose: ["spicy-jammy", "spicy-bloody-hell", "spicy-shite-hand", "spicy-piss-off", "spicy-bollocks", "spicy-lucky-bastard", "spicy-bloody-lucky", "spicy-shitshow", "spicy-bullshit", "spicy-crap", "spicy-f-hell"],
  reply: ["spicy-bloody-hell", "spicy-sod-off", "spicy-piss-off", "spicy-prick", "spicy-wanker", "spicy-arsehole", "spicy-dick-move", "spicy-twat", "spicy-bellend", "spicy-knob"],
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
export function banterFor(event: TableEvent, names: readonly string[], computers: readonly number[], random: () => number = Math.random, spicy: boolean = spicyTalk()): { seat: number; id: string } | null {
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
    const pool = spicy ? [...voice.moods[candidate.mood], ...SPICY_MOODS[candidate.mood]] : voice.moods[candidate.mood];
    if (!pool.length) continue;
    return { seat: candidate.seat, id: pool[Math.floor(random() * pool.length) % pool.length] };
  }
  return null;
}
