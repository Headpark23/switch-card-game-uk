/**
 * Table talk that is about the cards (owner decision, 15 Nov 2026): what each computer says about the card it has just
 * played, the card played at it, a mistake, a great shot. Shared by the phones and the online server, like `_voices.js`.
 *
 *   play.<moment>   a computer's own play: two, blackKing, redKing, eight, seven, jack, ace, set (three or four of a
 *                   number), counter (answering a pending penalty), stack (a pile of 6 or more waiting for someone),
 *                   finish (the winning play)
 *   hit.<kind>      what it says when that card is played at it: two, blackKing, eight, stack
 *   mistake         its own mistake (forgetting to say "Last Card")
 *   caught.<what>   catching someone else's mistake: lastCard, illegal (a card that cannot be played)
 *   great           a great shot by somebody else: grudging praise, envy, a dig
 *
 * Ids are `<name>-play-<moment>-<n>`, `<name>-hit-<kind>-<n>`, `<name>-mistake-<n>`, `<name>-caught-<what>-<n>`,
 * `<name>-great-<n>`. The Beatles use their own recognisable quips where one fits (`docs/BANTER-SOURCES.md`) and
 * song titles as puns ("Taxman" on a black king, "Hello, goodbye" on an eight), never lyrics. Nine words or fewer.
 */

import { MORE_CARD_VOICES } from "./_cardTalkMore.js";

export const PLAY_MOMENTS = Object.freeze(["two", "blackKing", "redKing", "eight", "seven", "jack", "ace", "set", "counter", "stack", "finish"]);
export const HIT_KINDS = Object.freeze(["two", "blackKing", "eight", "stack"]);
export const CAUGHT_KINDS = Object.freeze(["lastCard", "illegal"]);

const BASE_CARD_VOICES = Object.freeze({
  John: {
    play: {
      two: ["Pick up two. Do try to enjoy it.", "A two. Terribly subtle, I know."],
      blackKing: ["Black king. Five cards. Why not!", "Five cards. Do try to look surprised."],
      redKing: ["Red king. Five off. I'm generous.", "Taken off. Flattened, in fact."],
      eight: ["Miss a turn. Have a lie-down.", "Eight. Do sit quietly, won't you."],
      seven: ["Seven. Again. I'm so spoilt.", "Lucky seven. Again, please."],
      jack: ["Everybody back. Turn left at Greenland.", "Jack. Back you go, lads."],
      ace: ["Ace. Suit's mine. Rattle your jewellery.", "Ace. Pick a suit. Mine, obviously."],
      set: ["Three at once. Show-off? Me? Never.", "Come together, cards. Right now."],
      counter: ["Not today, lad. Back it goes.", "Do me a favour. Pass that on."],
      stack: ["That pile's grown nicely. Not for me.", "Count the cards, boys. All of them."],
      finish: ["Count the money. That's the game.", "I hope we've passed the audition."],
    },
    hit: {
      two: ["Two? Oh, how terribly kind.", "A two. On me. You're joking!"],
      blackKing: ["Five cards? You're joking!", "Black king on me? Fruitcake."],
      eight: ["Skipped? Marvellous. A rest.", "Miss a turn? Do me a favour!"],
      stack: ["All of that? Oh, brilliant.", "That's a lot of cards. Thanks."],
    },
    mistake: ["Forgot Last Card. It's the weather.", "Oops. Nobody saw that. Nobody.", "I haven't got a nice memory."],
    caught: { lastCard: ["Last Card, love. It's two words.", "Forgot something? Fruitcake.", "Two cards. Count the money."], illegal: ["You can't play that. You're joking!", "Do me a favour. Try another."] },
    great: ["Hm. Not bad. For you.", "Show-off. Do me a favour.", "Alright. You've passed the audition."],
  },
  Paul: {
    play: {
      two: ["Two for you, mate. Nothing personal!", "A little two. Lovely, isn't it?"],
      blackKing: ["Black king! Five. No hard feelings.", "Five for you, mate. Smile!"],
      redKing: ["Red king. Five off. Marvellous!", "Yesterday's pile? Gone. Lovely."],
      eight: ["Hello, goodbye! Miss a turn.", "Eight! Take a breather, mate."],
      seven: ["Lucky seven! Again, please.", "Seven. Go again. Aren't I good?"],
      jack: ["Back you go. Ob-la-di, ob-la-da!", "Jack! Turning it round, lads."],
      ace: ["Ace! Hearts, I think. Always hearts.", "Ace. My suit now. Cheers!"],
      set: ["Look at that lot! Lovely stuff.", "Oh aye! Three at once."],
      counter: ["Not so fast, mate. Back it goes!", "Hey Jude, pick that up."],
      stack: ["That's a pile. Don't look at me!", "Oof, big stack. Hope it's not yours."],
      finish: ["Thank you, thank you, goodnight!", "Oh aye! That's the end, lads."],
    },
    hit: {
      two: ["Two? Cheeky! I'd have done it too.", "Oh, a two. Charming. Cheers!"],
      blackKing: ["Five? Oh, mate. Bit harsh.", "Black king! Come on, give us a chance!"],
      eight: ["Skipped! Oh, you're a hard one.", "Miss a turn? Ooh. Cheeky."],
      stack: ["Help! Mate, that's a lot of cards.", "That's a mountain! Honestly."],
    },
    mistake: ["Forgot Last Card. No comment!", "Oh dear. Did anyone see that? No?", "I just sort of... forgot. Sorry!"],
    caught: { lastCard: ["Last Card, mate. We all forget. Not me.", "Oh, bless. Forgot the magic words.", "Two cards for you! Lovely."], illegal: ["Close, love. Not quite legal.", "Oh, bless. Try another, mate."] },
    great: ["Oh aye, that's right! Marvellous.", "Cheeky! I like that. Well played.", "Now that's what I call a shot."],
  },
  George: {
    play: {
      two: ["Pick up two. I did warn you. Quietly.", "Two cards. Naturally."],
      blackKing: ["Taxman. Five cards, please.", "Black king. The taxman cometh."],
      redKing: ["Red king. A rebate. Don't spend it.", "Five off. The taxman gives back, occasionally."],
      eight: ["Miss a turn. I'm sorry. Not very.", "Eight. Sit quietly. It's good for you."],
      seven: ["Seven. Again. I'll be quick.", "A seven. Naturally. Again."],
      jack: ["I'm a good driver. Reversing now.", "Jack. Back you go. Mind the mirror."],
      ace: ["Ace. Suit's mine. Don't mind me.", "Ace. Quietly choosing. Thank you."],
      set: ["Individually crummy. Together? Rather good.", "Three at once. Don't tell the others."],
      counter: ["Not today. Pick it up yourself.", "Returned to sender. Very politely."],
      stack: ["That's quite a pile. Not mine.", "Oh, that's grown. How awkward. For someone."],
      finish: ["Oh. That's nice. I've won.", "Quiet win. The best kind."],
    },
    hit: {
      two: ["Two. Typical. Just typical.", "Hm. A two. How original."],
      blackKing: ["Taxman got me. Always does.", "Five cards. Naturally. Naturally."],
      eight: ["Skipped. Hm. Peace and quiet.", "Miss a turn? Well. Nobody noticed."],
      stack: ["That's rather a lot of cards.", "Oh. That's not nice. At all."],
    },
    mistake: ["Forgot Last Card. Hm. Noted.", "I'll pretend that didn't happen.", "A lapse. It happens. Rarely."],
    caught: { lastCard: ["Last Card. It's quite short, really.", "Forgot? How terribly sad. Pick up.", "I did warn you. Silently."], illegal: ["Not legal. I wouldn't have played that.", "Hm. Wrong card. Bold, though."] },
    great: ["Hm. Rather good, that.", "Unexpected. Nicely done.", "Crummy players? Not you. Today."],
  },
  Ringo: {
    play: {
      two: ["Two cards! Pick 'em up, mate!", "A little two! Sorry! Not sorry!"],
      blackKing: ["Black king! Five! Eek, sorry!", "Five cards! I'm a mocker, me."],
      redKing: ["Red king! Five off! Peace and love!", "Pile gone! Ooh, I did that?"],
      eight: ["Eight days a week! Miss a turn.", "Eight! You're skipped. Don't pass me by!"],
      seven: ["Seven! Again! Ooh, lucky me!", "Another go! I love a seven."],
      jack: ["Jack! Everybody turn round! Wheee!", "Backwards we go! Yellow submarine style!"],
      ace: ["Ace! Pick a suit! Any suit!", "Ace! Hearts. No. Spades. Er..."],
      set: ["Three at once! I'm a mocker!", "Ooh, lots! I meant to do that!"],
      counter: ["Not today! Pick that up yourself!", "Ha! Back at ya, mate!"],
      stack: ["That's a big pile! Not mine! Yet!", "Ooh, that's gone up! Who's it for?"],
      finish: ["I've gone out! Have I? I have!", "That's me done! Peace and love!"],
    },
    hit: {
      two: ["Not another blooming two!", "A two? That's a hard day's night."],
      blackKing: ["Five! I've got blisters on me fingers!", "Five cards! Where's me hands?!"],
      eight: ["Skipped! Don't pass me by!", "Miss a turn? I was ready!"],
      stack: ["That's a mountain! Help!", "Cor, I'll need a bigger hand!"],
    },
    mistake: ["I forgot Last Card! Tomorrow never knows.", "Oops! Did I say it? No.", "Silly me. Practice a couple of hours."],
    caught: { lastCard: ["You forgot! I do that all the time!", "Last Card, mate! Oh, bless.", "Two cards! What are you doing tonight?"], illegal: ["Oi! That's not allowed, mate!", "Not that one! Silly sausage."] },
    great: ["Ooh! Did you mean that?", "Cor! Show-off! Do it again!", "I wish I'd done that!"],
  },
  Ziggy: {
    play: {
      two: ["Two cards, earthling. Sparkle on.", "A two. Beamed straight to you."],
      blackKing: ["Five years, earthlings. Five cards.", "Five. Darkness before the stardust."],
      redKing: ["Red king. The pile vanishes. Sparkle.", "Poof. Five cards, returned to the stars."],
      eight: ["Miss a turn. Moonage daydream.", "Eight. Gaze at the stars, darling."],
      seven: ["Seven! Again. The stars align.", "Lucky seven. Beam me back."],
      jack: ["Jack! Reverse the spiders.", "Direction changed. Gravity is optional."],
      ace: ["Ace! My suit. Like glitter, darling.", "Ace of space. Choose wisely. Me."],
      set: ["A constellation, darlings. Behold.", "Stars in a row. Fabulous."],
      counter: ["Returned to Earth, darling.", "Not tonight. Send it back, spiders."],
      stack: ["Such a big pile! Mind the glitter.", "Cosmic pile-up. Who's brave?"],
      finish: ["Ziggy played cards. Ziggy won.", "Stardust, darlings. The end."],
    },
    hit: {
      two: ["Two? On Ziggy? Unthinkable.", "Earthlings. Always the two."],
      blackKing: ["Five cards? Rock and roll suicide.", "Black king! Ouch. My glitter."],
      eight: ["Skipped? I was about to shine.", "Miss a turn? Darling, no."],
      stack: ["Such cruelty. Such a pile.", "Earthlings, spare my glitter."],
    },
    mistake: ["Forgot Last Card. Stars do that.", "A lapse. Cosmic interference.", "Nobody saw. Spiders won't tell."],
    caught: { lastCard: ["Forgot Last Card? Tragic, earthling.", "Two cards. Cosmic justice.", "Oh dear. Caught in the spotlight."], illegal: ["Darling, that's not a legal card.", "Earthling, try another. Gently."] },
    great: ["Oh! Almost stellar. Almost.", "Brilliant. Don't let it go to your head.", "A shooting star, that one."],
  },
  Bowie: {
    play: {
      two: ["Two cards. Pick up, darling.", "A two. Costume change for you."],
      blackKing: ["Five cards. Under pressure, are we?", "Black king. Five. Do keep up."],
      redKing: ["Red king. Five off. Reinvention!", "Gone. Like a character I've outgrown."],
      eight: ["Miss a turn. Wait in the wings.", "Eight. Exit stage left, darling."],
      seven: ["Seven. Encore! Encore!", "Again. I do love an encore."],
      jack: ["Ch-ch-ch-changes! Reverse!", "Turn and face the strange. Reversing."],
      ace: ["Ace. New suit, new persona.", "Ace. Suit change. Costume change."],
      set: ["Let's dance, cards! All at once.", "A full chorus line. Bravo."],
      counter: ["Rebel, rebel. Back it goes.", "Not tonight, darling. Return to sender."],
      stack: ["Under pressure! What a pile.", "That's a lot of drama. Not mine."],
      finish: ["Ashes to ashes. I'm out.", "Fame! That's the end of me."],
    },
    hit: {
      two: ["Two? A shabby costume, that.", "On me? How terribly rude."],
      blackKing: ["Five cards? Life on Mars, that.", "Ground control, I'm in trouble."],
      eight: ["Skipped? I was mid-performance!", "Miss a turn? The audacity."],
      stack: ["Under pressure. Dreadfully so.", "That pile is an insult. Frankly."],
    },
    mistake: ["Forgot Last Card. Out of character.", "A slip. Even stars forget lines.", "Cut that scene. Please."],
    caught: { lastCard: ["Forgot your line, darling. Two cards.", "Last Card. Missed your cue.", "Oh, what a lapse. Bless."], illegal: ["Wrong card, darling. Wrong costume.", "That's not in the script."] },
    great: ["Heroes, just for one move.", "Oh, that was good. Annoyingly.", "Bravo. A star turn."],
  },
  Marley: {
    play: {
      two: ["Two cards, friend. No worries.", "Easy now. Two cards, my friend."],
      blackKing: ["I shot the sheriff. Five cards.", "Five cards. Stir it up, friend."],
      redKing: ["Red king. Take five off. One love.", "Pile gone. Good vibes only."],
      eight: ["Miss a turn. Take a breath, friend.", "Eight. Rest a while. Positive vibration."],
      seven: ["Seven. Again. Sun's shining.", "Another go. Nice and easy."],
      jack: ["Exodus! Back the other way.", "Jack. Reverse. Roll with it."],
      ace: ["Ace. Natural mystic. My suit.", "Ace. Pick a suit, easy."],
      set: ["Three little birds. All at once.", "One love! Everybody together."],
      counter: ["Get up, stand up. Back it goes.", "Not today, friend. Send it back."],
      stack: ["Big pile, friend. Stay calm.", "Stir it up. Who takes it?"],
      finish: ["Redemption! All out. Peace.", "Out! One love, everyone."],
    },
    hit: {
      two: ["Two? Could you be loved? Evidently not.", "No stress. Just two cards."],
      blackKing: ["Five cards? No woman, no cry.", "Black king. Easy. Breathe."],
      eight: ["Skipped? I'll rest. Peace.", "Miss a turn? Nice and easy."],
      stack: ["Big pile. Still no stress.", "Such a mountain. Positive vibes."],
    },
    mistake: ["Forgot Last Card. No stress.", "Oops. Everything's gonna be alright.", "Slip. Positive vibes, friend."],
    caught: { lastCard: ["Forgot Last Card, friend. Two cards.", "No stress. Pick up two.", "Oh dear. Easy lesson, friend."], illegal: ["Easy, friend. Not that card.", "Wrong card. Breathe. Try again."] },
    great: ["Respect. That was smooth, friend.", "One love for that move.", "Nice. Real nice. Annoyingly nice."],
  },
});

/** The first lines above, then the longer lists in `_cardTalkMore.js` appended after them, so ids never move. */
export const CARD_VOICES = Object.freeze(Object.fromEntries(Object.entries(BASE_CARD_VOICES).map(([name, voice]) => {
  const more = MORE_CARD_VOICES[name];
  if (!more) return [name, voice];
  const join = (a, b) => [...a, ...(b ?? [])];
  const group = (base, extra, kinds) => Object.fromEntries(kinds.map((kind) => [kind, join(base[kind], extra[kind])]));
  return [name, {
    play: group(voice.play, more.play, PLAY_MOMENTS),
    hit: group(voice.hit, more.hit, HIT_KINDS),
    mistake: join(voice.mistake, more.mistake),
    caught: group(voice.caught, more.caught, CAUGHT_KINDS),
    great: join(voice.great, more.great),
  }];
})));

const slug = (name) => name.toLowerCase();
const find = (name) => CARD_VOICES[Object.keys(CARD_VOICES).find((key) => key.toLowerCase() === String(name).toLowerCase())];
const numbered = (name, stem, lines) => lines.map((_, index) => `${slug(name)}-${stem}-${index + 1}`);

/** Every card-talk line as { id, text }, for the reaction list. */
export function cardEntries() {
  const entries = [];
  const add = (name, stem, lines) => lines.forEach((text, index) => entries.push({ id: `${slug(name)}-${stem}-${index + 1}`, text }));
  for (const [name, voice] of Object.entries(CARD_VOICES)) {
    for (const moment of PLAY_MOMENTS) add(name, `play-${moment}`, voice.play[moment]);
    for (const kind of HIT_KINDS) add(name, `hit-${kind}`, voice.hit[kind]);
    add(name, "mistake", voice.mistake);
    for (const what of CAUGHT_KINDS) add(name, `caught-${what}`, voice.caught[what]);
    add(name, "great", voice.great);
  }
  return entries;
}

export const playPool = (name, moment) => { const v = find(name); return v ? numbered(name, `play-${moment}`, v.play[moment]) : []; };
export const hitPool = (name, kind) => { const v = find(name); return v ? numbered(name, `hit-${kind}`, v.hit[kind]) : []; };
export const mistakePool = (name) => { const v = find(name); return v ? numbered(name, "mistake", v.mistake) : []; };
export const caughtPool = (name, what) => { const v = find(name); return v ? numbered(name, `caught-${what}`, v.caught[what]) : []; };
export const greatPool = (name) => { const v = find(name); return v ? numbered(name, "great", v.great) : []; };

/* ── What a play was ── */

const rankOf = (code) => String(code).replace(/'$/, "").slice(0, -1);
const suitOf = (code) => String(code).replace(/'$/, "").slice(-1);
/** The most dramatic first. */
const PRIORITY = ["finish", "set", "stack", "counter", "blackKing", "redKing", "two", "eight", "jack", "ace", "seven"];
/** The plays that earn a "great shot" from the rest of the table. */
const GREAT = new Set(["finish", "set", "stack", "counter"]);

/**
 * What was notable about a play, most dramatic first. `cards` are the card codes laid down; `pendingBefore` and
 * `pendingAfter` are the table's pending penalty before and after (`{ kind: "draw-two" | "black-king" | "miss-turn", cards? }`
 * or null); `won` is whether this play won the game for whoever made it.
 */
export function momentsOf({ cards = [], pendingBefore = null, pendingAfter = null, won = false }) {
  const ranks = cards.map(rankOf);
  const found = new Set();
  if (won) found.add("finish");
  if (cards.length >= 3 && ranks.every((rank) => rank === ranks[0])) found.add("set");
  const answering = pendingBefore && ((pendingBefore.kind === "draw-two" && ranks.includes("2")) || (pendingBefore.kind === "black-king" && ranks.includes("K")) || (pendingBefore.kind === "miss-turn" && ranks.includes("8")));
  if (answering) found.add("counter");
  if (pendingAfter && ((pendingAfter.kind === "draw-two" && pendingAfter.cards >= 6) || (pendingAfter.kind === "black-king" && pendingAfter.cards >= 10))) found.add("stack");
  if (ranks.includes("K")) found.add(cards.some((code, index) => ranks[index] === "K" && "SC".includes(suitOf(code))) ? "blackKing" : "redKing");
  if (ranks.includes("2")) found.add("two");
  if (ranks.includes("8")) found.add("eight");
  if (ranks.includes("J")) found.add("jack");
  if (ranks.includes("A")) found.add("ace");
  if (ranks.includes("7")) found.add("seven");
  return PRIORITY.filter((moment) => found.has(moment));
}

/** The kind of attack a play made on the next player, if any (it picks the `hit` line they answer with). */
export function attackOf(moments, pendingAfter) {
  if (!pendingAfter) return null;
  return ["stack", "two", "blackKing", "eight"].find((kind) => moments.includes(kind)) ?? null;
}

/**
 * Who says what about a play or a mistake. `ctx` says how to look at the table: `seats` (every seat number),
 * `isComputer(seat)` and `nameOf(seat)`. Returns candidates { seat, ids, odds, answer? }, best first; the caller
 * rolls for each (scaled by how chatty that computer is), says the first that comes up, and lets `answer` hit back.
 * Events: { kind: "play", seat, cards, pendingBefore, pendingAfter, won, next } and { kind: "mistake", seat, what }
 * with `what` of "lastCard" or "illegal" (a computer only ever forgets Last Card).
 */
export function cardCandidates(event, ctx) {
  const out = [];
  const computers = ctx.seats.filter((seat) => ctx.isComputer(seat));
  const others = (except) => computers.filter((seat) => seat !== except);
  if (event.kind === "play") {
    const moments = momentsOf(event);
    if (!moments.length) return out;
    const attack = attackOf(moments, event.pendingAfter);
    const victim = attack && event.next !== undefined && event.next !== event.seat && ctx.isComputer(event.next) ? event.next : null;
    if (ctx.isComputer(event.seat)) {
      out.push({ seat: event.seat, ids: playPool(ctx.nameOf(event.seat), moments[0]), odds: moments.some((moment) => GREAT.has(moment)) ? 0.8 : 0.45, ...(victim !== null ? { answer: { seat: victim, ids: hitPool(ctx.nameOf(victim), attack), odds: 0.7 } } : {}) });
    } else if (victim !== null) out.push({ seat: victim, ids: hitPool(ctx.nameOf(victim), attack), odds: 0.5 });
    if (moments.some((moment) => GREAT.has(moment))) others(event.seat).forEach((seat) => out.push({ seat, ids: greatPool(ctx.nameOf(seat)), odds: 0.55 / Math.max(1, others(event.seat).length) }));
  } else if (event.kind === "mistake") {
    if (ctx.isComputer(event.seat) && event.what === "lastCard") out.push({ seat: event.seat, ids: mistakePool(ctx.nameOf(event.seat)), odds: 0.9 });
    others(event.seat).forEach((seat) => out.push({ seat, ids: caughtPool(ctx.nameOf(seat), event.what), odds: 0.7 / Math.max(1, others(event.seat).length) }));
  }
  return out.filter((candidate) => candidate.ids.length);
}
