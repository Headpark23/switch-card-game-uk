/**
 * Every computer's own voice (owner decisions, 15 Nov 2026): the words each one says, shared by the phones
 * (`src/switch/reactions.ts`) and the online server (`api/_room.js`) so the two can never disagree. The server stores
 * only an id; the words live here.
 *
 * The Beatles speak in their own recognisable voices. Where a line is a real quip from a 1963-65 press conference,
 * the film A Hard Day's Night, the Royal Variety Performance or the rooftop concert, it is kept as they said it (see
 * `docs/BANTER-SOURCES.md` for who said what, and which lines are only in their spirit). Spoken quips only: no song
 * lyrics. Ziggy, Bowie and Marley are written in the same way.
 *
 * Each computer has, in its own words:
 *   gloat, sulk, tease, win, lose, reply  what it says about itself and the game (as `reactions.ts` always had)
 *   user                                   digs at the person it is playing
 *   any                                    digs at any other computer
 *   at.<Name>                              digs at one particular computer, who may hit back with its own `at` line
 * Ids are `<name>-<kind>-<n>` and `<name>-at-<other>-<n>` (for example `john-gloat-2`, `paul-at-john-1`), from 1.
 * Lines are nine words or fewer so they sit in a speech bubble.
 */

import { cardEntries } from "./cardTalk.js";
import { MORE_VOICES } from "./voicesMore.js";

export const VOICE_MOODS = Object.freeze(["gloat", "sulk", "tease", "win", "lose", "reply"]);

const BASE_VOICES = Object.freeze({
  John: {
    gloat: ["Why not!", "Flattered? You're flattened.", "You're joking! Is that all?", "You ought to see a doctor about that."],
    sulk: ["Oh, do me a favour!", "I'm not sulking. I'm thinking. Quietly.", "The end, daddy-o."],
    tease: ["One card left. Retiring next week.", "One left. Count the money, boys.", "Almost there. Try to look surprised."],
    win: ["Count the money!", "Rattle your jewellery, the rest of you.", "I hope we passed the audition."],
    lose: ["It must be the weather.", "Next week I'll let you win.", "That win will not last long."],
    reply: ["Turn left at Greenland.", "Do me a favour!", "You're joking!"],
    user: ["Absolute fruitcake, you.", "Harmless. Utterly harmless.", "You're joking! Is that a hand?"],
    any: ["Do me a favour, lad.", "Count the money, mate.", "Oh, grow a personality."],
    at: {
      Paul: ["Paul's very sweet. Like a Mars bar.", "That's just our Paul, that is."],
      George: ["Still the dressing gown, George?", "Do me a favour, George."],
      Ringo: ["Mocker, Ringo? Drummer, more like.", "Ringo, Ringo. Always the real star."],
    },
  },
  Paul: {
    gloat: ["Oh aye! That's right.", "Marvellous. Absolutely marvellous.", "Sorry, mate. Nothing personal!", "Lovely card. Shame about the timing."],
    sulk: ["No comment!", "Oh, that's just not on!", "Oh, I don't know, you know..."],
    tease: ["One card left! I'm nearly there!", "I think I've got this!", "Nearly there, lads. Smile!"],
    win: ["Thank you, thank you, goodnight!", "Oh aye, that's right. Marvellous.", "Told you I'd get there."],
    lose: ["Fair play, mate. Well played.", "I never saw myself losing, you know.", "There's always the next round."],
    reply: ["I'm sorry, I didn't catch that.", "I just sort of play.", "Well, I haven't seen myself do that."],
    user: ["Aw, bless. Is that your hand?", "Now now, play nice, love.", "You're all right, you. Terrible, but all right."],
    any: ["Cheeky! I like it.", "Aw, you're all right, you.", "Marvellous, lads. Really."],
    at: {
      John: ["Thank you, John. Truly. Thank you.", "You're a good influence, John."],
      George: ["Go and sail your yacht, George.", "Steady on, George. Smile!"],
      Ringo: ["Any minute now, Ringo, lad?", "Oh, Ringo. Bless him."],
    },
  },
  George: {
    gloat: ["I'll sail off on my yacht.", "I don't like your tie.", "Crummy players, really. All of you."],
    sulk: ["We're not very good, I mean.", "Naturally, it can't go on forever.", "Oh. How nice. Truly."],
    tease: ["Nearly there. Naturally.", "No screams, please.", "One card. Quietly confident."],
    win: ["Usually we have to cut it four ways.", "Hm. Rather good, that.", "I hoped so. And it was."],
    lose: ["Arthur. Honestly.", "Hm. I expected that, actually.", "I don't like your tie. Either."],
    reply: ["Arthur. That's all I'll say.", "No screams, please.", "Well, we feel flattered."],
    user: ["I don't like your tie.", "Crummy player, really. No offence.", "We're not very good either. You, worse."],
    any: ["Hm. Noted.", "Bold. Misguided, but bold.", "Yawn."],
    at: {
      John: ["Very witty, John. Yawn.", "Flattened, John? Not yet."],
      Paul: ["Eyes open, Paul? Or asleep?", "Marvellous, Paul. Do tell us more."],
      Ringo: ["Hair-don't? Hand-don't, Ringo.", "Arthur, Ringo. Honestly."],
    },
  },
  Ringo: {
    gloat: ["Fancy a game tonight? You'll lose!", "Just came for the money!", "I win eight days a week!"],
    sulk: ["It's been a hard day's night.", "My fingers have got blisters!", "Not another blooming card!"],
    tease: ["Any minute now!", "One card left. I'm nearly there!", "Nearly out! Eight days a week, me!"],
    win: ["Peace and love, everybody!", "I haven't won... oh, I have!", "Will you buy our records?"],
    lose: ["Oh well. Tomorrow never knows.", "I haven't won yet.", "Easy come, easy go."],
    reply: ["I'm not a mod. I'm a mocker.", "That's a hair-don't!", "Have you ever tried talking to two hundred people?"],
    user: ["Practice a couple of hours a day, mate.", "Hair-don't, mate. Hand-don't.", "Fancy losing again tonight, mate?"],
    any: ["I'm a mocker, me.", "Oi! Do you buy our records?", "Steady on, mate."],
    at: {
      John: ["John, you're a mocker too.", "Oi, John! No comment!"],
      Paul: ["Oi Paul, how's the Mars bar?", "Oh aye, Paul. That's right."],
      George: ["George, mate. Arthur. Honestly.", "No screams, George? Shame."],
    },
  },
  Ziggy: {
    gloat: ["Too fabulous for this table.", "Earthlings. Always so predictable.", "Glitter beats grit, darlings."],
    sulk: ["Even stars must fall.", "Such cruelty, down on Earth.", "Hold my glitter. I'm hurt."],
    tease: ["One card. Cue the lightning.", "Almost there, little earthlings.", "The spiders are coming."],
    win: ["Instant star. Just add water and stir.", "Take a bow, earthlings.", "Stardust, darlings. Pure stardust."],
    lose: ["Tonight, the stars are shy.", "Well played, earthling. Briefly.", "I'll be back. Brighter."],
    reply: ["Oh, you're adorable, earthling.", "Mind the glitter.", "Fabulous. Do continue."],
    user: ["Earthling, that hand is tragic.", "Do take notes, little earthling.", "How sweet. Such a dull little planet."],
    any: ["Spare me, darling. I'm glittering.", "Beam me up, this is dull.", "Cosmic bore, you."],
    at: {
      Bowie: ["Darling, I invented that costume.", "Ch-ch-changes? Try some consistency."],
    },
  },
  Bowie: {
    gloat: ["Another face, same winner.", "Turn and face the strange.", "Oh, what a performance."],
    sulk: ["This is not the plan.", "Dreadfully out of character, that.", "Ground control, we have problems."],
    tease: ["I promise it won't be boring.", "Final act, darlings.", "Watch closely. Costume change coming."],
    win: ["Tomorrow belongs to those who hear it.", "No encore needed. Bravo, me.", "Another character, another victory."],
    lose: ["A fine plot twist. Ugh.", "Exit stage left, sulking.", "Reinvention begins. Right now."],
    reply: ["How terribly theatrical of you.", "Darling, I've worn better.", "Lovely costume. Awful play."],
    user: ["Darling, that hand is a costume crime.", "Do try a new character.", "Lovely effort. Truly. Bless."],
    any: ["How terribly theatrical of you.", "Darling, I've worn better.", "Do change. Please."],
    at: {
      Ziggy: ["Ziggy, dear. Back in your spaceship.", "Do put some clothes on, Ziggy."],
    },
  },
  Marley: {
    gloat: ["Easy now. Plenty more coming.", "Smooth like sunshine, that one.", "Relax, friend. I've got this."],
    sulk: ["No stress. Cards come round.", "Ah well. Positive vibes only.", "Pain today, laughter tomorrow."],
    tease: ["One card. Staying relaxed.", "Nearly home. Nice and easy.", "Sunshine's coming for you."],
    win: ["Money is just numbers. Wins are better.", "Sun's shining on me, friends.", "Sweet. Peace and a win."],
    lose: ["Respect. Enjoy that win.", "Nice one. Next round's mine.", "No bad blood. Just sunshine."],
    reply: ["Easy, friend. Breathe.", "Peace, my friend. Peace.", "Love the confidence. Truly."],
    user: ["Relax, friend. It's only a hand.", "Smile, friend. You're losing.", "Bless you, friend. Truly. Not good."],
    any: ["Peace, brother. Take a breath.", "Easy now, brother. Easy.", "No stress. Just poor cards."],
    at: {},
  },
});

/** The first lines in this file, then the longer lists in `_voicesMore.js` appended after them, so ids never move. */
export const VOICES = Object.freeze(Object.fromEntries(Object.entries(BASE_VOICES).map(([name, voice]) => {
  const more = MORE_VOICES[name] ?? {};
  const merged = { at: {} };
  for (const kind of [...VOICE_MOODS, "user", "any"]) merged[kind] = [...voice[kind], ...(more[kind] ?? [])];
  for (const other of new Set([...Object.keys(voice.at), ...Object.keys(more.at ?? {})])) merged.at[other] = [...(voice.at[other] ?? []), ...(more.at?.[other] ?? [])];
  return [name, merged];
})));

const slug = (name) => name.toLowerCase();

/** The id of a computer's line. `kind` is a mood, "user" or "any"; for a line at one computer use `voiceAtId`. */
export const voiceId = (name, kind, n) => `${slug(name)}-${kind}-${n}`;
export const voiceAtId = (name, other, n) => `${slug(name)}-at-${slug(other)}-${n}`;

/** Every line as { id, text }, for the reaction list. */
export function voiceEntries() {
  const entries = [];
  for (const [name, voice] of Object.entries(VOICES)) {
    for (const kind of [...VOICE_MOODS, "user", "any"]) voice[kind].forEach((text, index) => entries.push({ id: voiceId(name, kind, index + 1), text }));
    for (const [other, lines] of Object.entries(voice.at)) lines.forEach((text, index) => entries.push({ id: voiceAtId(name, other, index + 1), text }));
  }
  // What they say about the cards: plays, hits, mistakes and great shots (`_cardTalk.js`).
  return [...entries, ...cardEntries()];
}

export const voiceIds = () => voiceEntries().map((entry) => entry.id);

const ids = (name, kind, lines, weight) => Array.from({ length: weight }, () => lines.map((_, index) => voiceId(name, kind, index + 1))).flat();

/**
 * What `name` might say in a mood, as ids with weights built in (a more likely line appears more often).
 * `target` is who the remark is for: "user" (the person at the table), the name of another computer, or nothing.
 *  - its own mood lines always count (weight 3);
 *  - a dig at the user is added when it is gloating, teasing, winning or answering (weight 4);
 *  - a dig at one computer is added when gloating, winning, losing, answering or hitting back, using the lines aimed at
 *    that computer if there are some (weight 5) and its dig-at-anyone lines otherwise (weight 3).
 */
export function voicePool(name, mood, target) {
  const voice = VOICES[name];
  if (!voice) return [];
  const pool = ids(name, mood, voice[mood], 3);
  if (target === "user" && ["gloat", "tease", "win", "reply"].includes(mood)) pool.push(...ids(name, "user", voice.user, 4));
  if (target && target !== "user" && ["gloat", "sulk", "win", "lose", "reply"].includes(mood)) {
    const aimed = Object.entries(voice.at).find(([other]) => other.toLowerCase() === target.toLowerCase())?.[1];
    if (aimed) pool.push(...Array.from({ length: 5 }, () => aimed.map((_, index) => voiceAtId(name, target, index + 1))).flat());
    else if (mood !== "sulk") pool.push(...ids(name, "any", voice.any, 3));
  }
  return pool;
}

/** Whether `name` has lines aimed at the computer `other`, which it can hit back with. */
export const hasAimedLines = (name, other) => Object.keys(VOICES[name]?.at ?? {}).some((key) => key.toLowerCase() === other.toLowerCase());

/** The lines `name` has aimed at the computer `other`: what it hits back with. Empty if there are none. */
export function aimedIds(name, other) {
  const entry = Object.entries(VOICES[name]?.at ?? {}).find(([key]) => key.toLowerCase() === other.toLowerCase());
  return entry ? entry[1].map((_, index) => voiceAtId(name, entry[0], index + 1)) : [];
}
