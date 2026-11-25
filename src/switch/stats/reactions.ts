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

import { aimedIds, voiceEntries, voicePool, type VoiceMoodName } from "../../../shared/voices.js";
import { attackOf, cardCandidates, caughtPool, hitPool, momentsOf, type CardEvent } from "../../../shared/cardTalk.js";

export type StickerId = "smug-king" | "salty" | "card-shark" | "sweating-ace" | "mic-drop" | "facepalm-jack" | "crying-joker" | "seven-on-fire"
  | "yellow-submarine" | "walrus" | "blue-meanie" | "ziggy-bolt" | "starman" | "major-tom" | "lion" | "one-love";

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

/**
 * The computers' own favourites (owner decision, 15 Nov 2026): the four Beatles (John, Paul, George, Ringo) bring a
 * yellow submarine, a walrus and a blue meanie; Ziggy and Bowie bring Ziggy Stardust, a Starman and Major Tom; Marley
 * brings a lion, one love and his buffalo soldiers. Only computers send these, so the picker does not list them, but
 * the server accepts the ids and every phone can show them (online, in replays and in the reaction log).
 */
export const CHARACTER_STICKERS: readonly Reaction[] = [
  { id: "yellow-submarine", text: "Yellow submarine", sticker: "yellow-submarine" },
  { id: "walrus", text: "I am the walrus", sticker: "walrus" },
  { id: "blue-meanie", text: "Blue Meanie", sticker: "blue-meanie" },
  { id: "ziggy-bolt", text: "Ziggy", sticker: "ziggy-bolt" },
  { id: "starman", text: "Starman", sticker: "starman" },
  { id: "major-tom", text: "Major Tom", sticker: "major-tom" },
  { id: "lion", text: "Lion", sticker: "lion" },
  { id: "one-love", text: "One love", sticker: "one-love" },
];

export const CHARACTER_SAYINGS: readonly Reaction[] = [
  // The Beatles
  { id: "get-back", text: "Get back!" },
  { id: "let-it-be", text: "Let it be" },
  { id: "help", text: "Help!" },
  { id: "dont-let-me-down", text: "Don't let me down" },
  { id: "come-together", text: "Come together" },
  { id: "all-you-need", text: "All you need is love" },
  { id: "twist-and-shout", text: "Twist and shout!" },
  { id: "goo-goo", text: "Goo goo g'joob" },
  { id: "hey-jude", text: "Hey Jude, don't make it bad" },
  { id: "here-comes-the-sun", text: "Here comes the sun" },
  { id: "little-help", text: "A little help from my friends" },
  // David Bowie
  { id: "lets-dance", text: "Let's dance" },
  { id: "ground-control", text: "Ground control to Major Tom" },
  { id: "im-a-starman", text: "I'm a Starman" },
  { id: "rebel-rebel", text: "Rebel, rebel" },
  { id: "changes", text: "Ch-ch-ch-changes" },
  // Bob Marley
  { id: "buffalo-soldier", text: "Buffalo soldier!" },
  { id: "redemption", text: "Redemption!" },
  { id: "get-up-stand-up", text: "Get up, stand up" },
  { id: "one-love-saying", text: "One love" },
  { id: "every-little-thing", text: "Every little thing gonna be alright" },
  { id: "jammin", text: "We're jammin'" },
];

/**
 * Each computer's own voice (owner decisions, 15 Nov 2026): what it says about the game, digs at the person it is
 * playing, digs at the other computers and the lines it hits back with. The words live in `api/_voices.js`, shared
 * with the online server, in the Beatles' own recognisable quips where they said them (`docs/BANTER-SOURCES.md`).
 */
export const VOICE_REACTIONS: readonly Reaction[] = voiceEntries();

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

/** Every reaction the server accepts: the eighteen clean ones, then the spicy ones, then the computers' favourites. */
export const REACTIONS: readonly Reaction[] = [...SAYINGS, ...STICKERS, ...SPICY_SAYINGS, ...CHARACTER_STICKERS, ...CHARACTER_SAYINGS, ...VOICE_REACTIONS];

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

/** What each musical family adds to the base repertoire, mood by mood (it mixes with the base lines, so not every remark is a lyric). */
const THEMES: Readonly<Record<"beatles" | "bowie" | "marley", Readonly<Record<Mood, readonly string[]>>>> = {
  beatles: {
    gloat: ["get-back", "yellow-submarine", "walrus", "come-together"],
    sulk: ["help", "dont-let-me-down", "blue-meanie", "let-it-be"],
    tease: ["twist-and-shout", "come-together", "yellow-submarine"],
    win: ["all-you-need", "twist-and-shout", "yellow-submarine", "here-comes-the-sun"],
    lose: ["let-it-be", "help", "dont-let-me-down", "blue-meanie"],
    reply: ["get-back", "come-together", "walrus"],
  },
  bowie: {
    gloat: ["lets-dance", "im-a-starman", "ziggy-bolt", "rebel-rebel"],
    sulk: ["ground-control", "major-tom", "changes"],
    tease: ["starman", "lets-dance", "im-a-starman"],
    win: ["im-a-starman", "ziggy-bolt", "lets-dance", "starman"],
    lose: ["ground-control", "major-tom", "changes", "rebel-rebel"],
    reply: ["rebel-rebel", "lets-dance", "changes"],
  },
  marley: {
    gloat: ["buffalo-soldier", "lion", "get-up-stand-up"],
    sulk: ["redemption", "every-little-thing", "one-love"],
    tease: ["jammin", "buffalo-soldier", "lion"],
    win: ["jammin", "lion", "get-up-stand-up", "one-love-saying"],
    lose: ["redemption", "every-little-thing", "one-love-saying", "one-love"],
    reply: ["one-love-saying", "get-up-stand-up", "jammin"],
  },
};

const themed = (voice: Banter, theme: keyof typeof THEMES, ...own: string[]): Banter => ({
  chat: voice.chat,
  moods: Object.fromEntries((Object.keys(voice.moods) as Mood[]).map((mood) => [mood, [...voice.moods[mood], ...THEMES[theme][mood], ...(mood === "gloat" || mood === "win" ? own : [])]])) as unknown as Banter["moods"],
});

/** Each computer's voice, to suit the personality they play with (ruling 29), and the band they are named after. */
export const BANTER: Readonly<Record<string, Banter>> = {
  John: themed({ chat: 0.75, moods: { ...BASE, gloat: ["read-em-and-weep", "pick-up-sunshine", "smug-king"], win: ["mic-drop", "smug-king"] } }, "beatles", "goo-goo", "walrus"),
  Paul: themed({ chat: 0.55, moods: { ...BASE, tease: ["not-today-sweetheart", "sweating-yet"], reply: ["behave", "absolute-sausage"] } }, "beatles", "hey-jude", "let-it-be"),
  George: themed({ chat: 0.35, moods: { ...BASE, gloat: ["card-shark"], win: ["card-shark", "mic-drop"], lose: ["lucky-so-and-so"] } }, "beatles", "here-comes-the-sun"),
  Ringo: themed({ chat: 0.5, moods: { ...BASE, sulk: ["salty", "crying-joker", "revenge-is-coming"], reply: ["absolute-sausage", "behave"] } }, "beatles", "little-help", "yellow-submarine"),
  Ziggy: themed({ chat: 0.6, moods: { ...BASE, win: ["seven-on-fire", "mic-drop"], gloat: ["card-shark", "all-youve-got"] } }, "bowie", "ziggy-bolt"),
  Marley: themed({ chat: 0.45, moods: { ...BASE, sulk: ["facepalm-jack", "revenge-is-coming"], tease: ["sweating-ace", "sweating-yet"] } }, "marley", "buffalo-soldier"),
  Bowie: themed({ chat: 0.65, moods: { ...BASE, win: ["smug-king", "mic-drop", "seven-on-fire"], reply: ["who-taught-you", "behave", "all-youve-got"] } }, "bowie", "major-tom"),
  Madonna: { chat: 0.7, moods: { ...BASE, gloat: ["read-em-and-weep", "smug-king", "all-youve-got"], win: ["mic-drop", "smug-king"] } },
  Prince: { chat: 0.55, moods: { ...BASE, gloat: ["card-shark", "smug-king"], win: ["mic-drop", "seven-on-fire"] } },
  Elton: { chat: 0.72, moods: { ...BASE, gloat: ["pick-up-sunshine", "seven-on-fire"], win: ["mic-drop", "seven-on-fire"], reply: ["behave", "absolute-sausage"] } },
  Elvis: { chat: 0.68, moods: { ...BASE, gloat: ["smug-king", "read-em-and-weep"], win: ["smug-king", "mic-drop"], tease: ["sweating-yet", "not-today-sweetheart"] } },
  Cher: { chat: 0.62, moods: { ...BASE, gloat: ["not-today-sweetheart", "card-shark"], sulk: ["revenge-is-coming", "salty"], reply: ["behave", "who-taught-you"] } },
};
const DEFAULT_BANTER: Banter = { chat: 0.5, moods: BASE };
export const banterOf = (name: string): Banter => BANTER[name] ?? DEFAULT_BANTER;

/** What was waiting to be picked up (or missed) before or after a play. */
export type PendingLike = null | { readonly kind: "draw-two" | "black-king" | "miss-turn"; readonly cards?: number };

/** Something worth a comment, in seat numbers (0 is you). */
export type TableEvent =
  | { readonly kind: "penalty"; readonly victim: number; readonly by: number | null; readonly cards: number; /** What hit them: a two, a black king, or a pile of six or more. */ readonly card?: "two" | "blackKing" | "stack" }
  | { readonly kind: "spotted"; readonly victim: number; readonly by: number }
  | { readonly kind: "last-card"; readonly seat: number }
  | { readonly kind: "win"; readonly winner: number }
  | { readonly kind: "reply"; readonly to: number }
  /** A play: the cards laid down and what was pending before and after (see `api/_cardTalk.js`). */
  | { readonly kind: "play"; readonly seat: number; readonly cards: readonly string[]; readonly pendingBefore: PendingLike; readonly pendingAfter: PendingLike; readonly won: boolean; readonly next?: number }
  /** A mistake: forgetting "Last Card", or trying a card that cannot be played. */
  | { readonly kind: "mistake"; readonly seat: number; readonly what: "lastCard" | "illegal" };

export interface Remark { readonly seat: number; readonly id: string; /** Another computer answering a moment later. */ readonly answer?: { readonly seat: number; readonly id: string } }

/** What a phone's play looks like to the table talk (a play, as the engine saw it). */
export const playEvent = (seat: number, cards: readonly string[], pendingBefore: PendingLike, pendingAfter: PendingLike, won: boolean, next?: number): TableEvent => ({ kind: "play", seat, cards, pendingBefore, pendingAfter, won, next });

/** The kind of penalty a play put on the next player, for the `card` of a penalty event. */
export function attackKind(cards: readonly string[], pendingBefore: PendingLike, pendingAfter: PendingLike): "two" | "blackKing" | "stack" | undefined {
  const kind = attackOf(momentsOf({ cards, pendingBefore, pendingAfter }), pendingAfter);
  return kind === "two" || kind === "blackKing" || kind === "stack" ? kind : undefined;
}

/**
 * Which computer, if any, says what about an event. `computers` lists the seats a computer is playing.
 * Most moves pass without a word: each computer speaks only as often as its personality allows. What they say is about
 * the cards: the card they played, the card played at them, a mistake, a great shot (`api/_cardTalk.js`), and digs at
 * the person and at each other (`api/_voices.js`).
 */
interface Candidate { seat: number; mood?: Mood; ids?: readonly string[]; odds: number; target?: string; answer?: { seat: number; ids: readonly string[]; odds: number } }

/** The last lines said at any table, so the computers rarely repeat themselves. */
const RECENT_LINES: string[] = [];
const RECENT_LINES_KEPT = 60;

export function banterFor(event: TableEvent, names: readonly string[], computers: readonly number[], random: () => number = Math.random, spicy: boolean = spicyTalk()): Remark | null {
  const isComputer = (seat: number | null): seat is number => seat !== null && computers.includes(seat);
  const others = (except: number) => computers.filter((seat) => seat !== except);
  /** Who a remark is aimed at: a computer by name, or the person ("user"). */
  const aim = (seat: number | null): string | undefined => (seat === null ? undefined : isComputer(seat) ? names[seat] : "user");
  const candidates: Candidate[] = [];
  const ctx = { seats: names.map((_, seat) => seat), isComputer: (seat: number) => isComputer(seat), nameOf: (seat: number) => names[seat] ?? "" };
  switch (event.kind) {
    case "play":
    case "mistake":
      candidates.push(...cardCandidates(event as unknown as CardEvent, ctx));
      break;
    case "penalty": {
      const hit = event.card && isComputer(event.victim) ? hitPool(names[event.victim] ?? "", event.card) : [];
      const retorts = isComputer(event.by) && isComputer(event.victim) ? aimedIds(names[event.victim] ?? "", names[event.by] ?? "") : [];
      if (isComputer(event.by) && event.by !== event.victim) candidates.push({ seat: event.by, mood: "gloat", odds: Math.min(0.95, 0.45 + event.cards * 0.06), target: aim(event.victim), ...(retorts.length ? { answer: { seat: event.victim, ids: retorts, odds: 0.75 } } : {}) });
      if (isComputer(event.victim)) candidates.push({ seat: event.victim, mood: "sulk", ...(hit.length ? { ids: hit } : {}), odds: Math.min(0.9, 0.35 + event.cards * 0.05), target: isComputer(event.by) ? aim(event.by) : undefined });
      break;
    }
    case "spotted": {
      // Somebody forgot to say "Last Card" and has been caught.
      const caught = isComputer(event.by) ? caughtPool(names[event.by] ?? "", "lastCard") : [];
      if (isComputer(event.by)) candidates.push({ seat: event.by, mood: "gloat", ...(caught.length ? { ids: [...caught, ...caught] } : {}), odds: 0.85, target: aim(event.victim) });
      break;
    }
    case "last-card":
      if (isComputer(event.seat)) candidates.push({ seat: event.seat, mood: "tease", odds: 0.4, target: "user" });
      else others(event.seat).forEach((seat) => candidates.push({ seat, mood: "tease", odds: 0.45 / Math.max(1, others(event.seat).length), target: aim(event.seat) }));
      break;
    case "win": {
      // Someone always has something to say about a win: the winner crows at a loser, a loser grumbles at the winner.
      const losers = computers.filter((seat) => seat !== event.winner);
      if (isComputer(event.winner)) candidates.push({ seat: event.winner, mood: "win", odds: 0.85, target: names.some((_, seat) => !isComputer(seat)) ? "user" : aim(losers[0] ?? null) });
      losers.forEach((seat, index) => candidates.push({ seat, mood: "lose", odds: index === losers.length - 1 ? 1 : 0.7 / losers.length, target: isComputer(event.winner) ? aim(event.winner) : undefined }));
      break;
    }
    case "reply":
      others(event.to).forEach((seat) => candidates.push({ seat, mood: "reply", odds: 0.6 / Math.max(1, others(event.to).length), target: "user" }));
      break;
  }
  const pick = (seat: number, mood: Mood | undefined, ids: readonly string[] | undefined, target: string | undefined): string | null => {
    let pool: readonly string[];
    if (ids && ids.length) pool = ids;
    else {
      const voice = banterOf(names[seat] ?? "");
      const base = mood ? (spicy ? [...voice.moods[mood], ...SPICY_MOODS[mood]] : voice.moods[mood]) : [];
      pool = [...base, ...(mood ? voicePool(names[seat] ?? "", mood as VoiceMoodName, target) : [])];
    }
    if (!pool.length) return null;
    // Nobody repeats a line they said recently while they have anything else to say (owner decision, 16 Nov 2026).
    // When everything has been said lately, the one said longest ago comes back first.
    const age = (id: string) => RECENT_LINES.lastIndexOf(id);
    const oldest = Math.min(...pool.map(age));
    const from = pool.filter((id) => age(id) === oldest);
    const chosen = from[Math.floor(random() * from.length) % from.length];
    RECENT_LINES.push(chosen);
    if (RECENT_LINES.length > RECENT_LINES_KEPT) RECENT_LINES.shift();
    return chosen;
  };
  for (const candidate of candidates) {
    const voice = banterOf(names[candidate.seat] ?? "");
    if (random() >= candidate.odds * (0.5 + voice.chat)) continue;
    const id = pick(candidate.seat, candidate.mood, candidate.ids, candidate.target);
    if (!id) continue;
    // A computer that has just been needled, or had a card played at it, may answer a moment later.
    if (candidate.answer && random() < candidate.answer.odds) {
      const reply = pick(candidate.answer.seat, undefined, candidate.answer.ids, undefined);
      if (reply) return { seat: candidate.seat, id, answer: { seat: candidate.answer.seat, id: reply } };
    }
    return { seat: candidate.seat, id };
  }
  return null;
}
