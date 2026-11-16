/**
 * More of each computer's voice (owner decision, 16 Nov 2026): the first lines in `_voices.js` repeated too soon, so
 * every mood, every dig at the person and at other computers now has a much longer list. Lines are APPENDED to the
 * originals (`_voices.js` merges them), so every existing id keeps its meaning and the new ones simply follow on.
 *
 * Built from each person's public biography on Wikipedia, turned into card-table banter in their own voice: John's
 * Quarrymen, crosswords, drawings and nonsense books; Paul's left-handed bass, painting, Wings and many aliases;
 * George's gardening, racing cars, HandMade Films and Wilbury alias; Ringo's rings, Dingle, Thomas the Tank Engine and
 * All-Starr Band; Ziggy's red mullet, gold sphere, Spiders and kabuki costumes; Bowie's many personas, Berlin, Goblin
 * King and Major Tom; Marley's Trenchtown, football, BMW and Wailers. Facts and in-spirit lines only, never presented as
 * quotations, no song lyrics, nothing about illness or death. Nine words or fewer. Swearing lives elsewhere (spicy talk).
 */

export const MORE_VOICES = Object.freeze({
  John: {
    gloat: [
      "Draw that one, then. Go on.", "Crossword's harder than your hand.", "Quarrymen played better than you.",
      "Aunt Mimi would've won faster.", "Nonsense? That's my speciality, lad.", "Even without my glasses. Easy.",
      "In my own write. Your loss.", "Bed-in? No. Win-in. Marvellous.",
    ],
    sulk: [
      "Rotten luck. Pass the glasses.", "I can't see a thing. Convenient.", "Mimi would've had words about that.",
      "Hardly the Quarrymen's finest hour.", "I'll write a book about this.", "Is it Tuesday? Feels like Tuesday.",
      "Dreadful. Truly. Next, please.",
    ],
    tease: [
      "One card. Draw it, lads.", "Nearly home. Put the kettle on.", "Final card. Try to look astonished.",
      "One left. Cue the nonsense.", "Any moment now. Hold your breath.", "Quarrymen finish on time. Mostly.",
      "One card, and a crossword clue.",
    ],
    win: [
      "In my own write. And win.", "Quarrymen to the top. Again.", "Put the kettle on. I'm done.",
      "Nonsense wins. Always did.", "A plastic win, and no encore.", "Mimi, I did it. Sort of.",
      "Put that in your book.",
    ],
    lose: [
      "Fine. I'll go and draw something.", "A lost weekend. Back soon.", "I blame the short sight.",
      "Mimi won't hear about this.", "Beaten. By you. Hilarious.", "Right. I'm writing a poem.",
      "Next time I'll do it sitting down.",
    ],
    reply: [
      "Witty. Did you write that down?", "Oh, put it in a book.", "How terribly profound. Yawn.",
      "Say it again with feeling.", "Is that all you've got, lad?", "Quick, someone take a note.",
    ],
    user: [
      "Can you do crosswords, or just cards?", "Needs glasses? That hand does.", "Do try a bit harder, love.",
      "You play like a Tuesday.", "Is that the plan? Fascinating.", "Draw me a better hand.",
      "Mimi would've called that carelessness.", "Quarrymen had more rhythm than you.",
    ],
    any: [
      "Do try, won't you? Go on.", "A hand like a bad poem.", "Cheer up, you sound like a dull crossword.",
      "Terribly clever. Terribly wrong.", "Did you write that yourself?", "Hardly Quarrymen standard, is it?",
    ],
    at: {
      Paul: ["Another Paul pun, was it?", "Keep your bass line away from me.", "Right, Paul. Charm someone else."],
      George: ["Quiet one speaks! Write it down.", "Pass the garden gnome, George.", "Gardening again, George? Riveting."],
      Ringo: ["Ringo, mate. Rings don't win games.", "Drum solo coming, I suppose.", "Steady, Ringo. Octopus is watching."],
      Ziggy: ["Nice hair, Ziggy. Mine's a mop.", "Is that an eyebrow? Where?", "Spiders from Mars? Bit dusty."],
      Bowie: ["New face today, David?", "Changes? Try a haircut.", "A chameleon? I prefer fruitcake."],
      Marley: ["Relax, Bob. It's cards, not peace.", "Bob, pass me a hat.", "Trenchtown's loss is our gain."],
    },
  },
  Paul: {
    gloat: [
      "Left-handed. Right on the money.", "Played that one by ear. Lovely.", "Bass line says I win.",
      "Wings for that one, mate.", "Nothing personal. Just thirty-two number ones.", "Cheers, lads. I was knighted for less.",
      "Sir Paul, if you don't mind.", "Painted that move. Masterpiece, really.",
    ],
    sulk: [
      "Oh dear. Where's me bass?", "I'll go and paint something.", "That hurt, that did. Honestly.",
      "Cheer up, Macca. Cheer up.", "Not me finest hour. Smile!", "Even Wings had off days.",
      "Hm. I need a cup of tea.",
    ],
    tease: [
      "One card, lads. Lovely, isn't it?", "Nearly there. Nothing to see.", "One card. Writing a song about it.",
      "Smile, everyone! I'm nearly out.", "Almost home. Nothing to see here.", "One left. Cheeky grin ready.",
      "Last card. Quick, take a photo!",
    ],
    win: [
      "Oh aye! Knighted, and now this.", "Another number one, lads.", "Lovely. Time for a cup of tea.",
      "Another win, lads. Who knew?", "That's thirty-three. Roughly. Maybe.", "Marvellous. Put it on the wall.",
      "Cheers. I'll paint that later.",
    ],
    lose: [
      "Fair play. I'll write a song.", "Well, it's not Wings' fault.", "Everton lose sometimes too. Ahem.",
      "I'll try left-handed next time.", "You've earned it, mate. Truly.", "Never mind, back to the studio.",
      "That's showbiz, that is.",
    ],
    reply: [
      "Cheeky! I'll let you off.", "Aw, you're all right, you.", "Is that a new alias?",
      "Steady, love. Steady on.", "Lovely manners. Marvellous.", "Oh, you charmer, you.",
    ],
    user: [
      "Sweet. Did you play that by ear?", "Left-handed or right? Either way, tragic.", "Now now, mate. Count to ten.",
      "I'll write a song for you.", "Lovely effort. Honestly. Really.", "Even Grandude plays better.",
      "Aw, go on. Cheer up.", "Your hand's a children's book. Short.",
    ],
    any: [
      "Lovely stuff, lads. Pure class.", "Aw, cheer up, you great lump.", "Nice try, nice try, nice try.",
      "Everton fan, are you? It shows.", "Lovely, lads. Absolutely marvellous.", "That's a proper Thrillington effort.",
    ],
    at: {
      John: ["John, you old fruitcake. Smile.", "Write me a postcard, John.", "John! Still sulking, are we?"],
      George: ["George, do cheer up. Lovely day.", "Quiet one's plotting again, lads.", "Garden gnome beats you, George."],
      Ringo: ["Ringo, lad, count them again.", "Drums can't help you now.", "Ringo, you're a star. Obviously."],
      Ziggy: ["Lovely hair, Ziggy. Bit much.", "Spiders won't help you, mate.", "Aw, Ziggy, cheer up. Smile!"],
      Bowie: ["David, lovely costume. Terrible hand.", "Another persona, Dave? Marvellous.", "Berlin's calling, David. Go on."],
      Marley: ["Bob, mate. Pure sunshine, that.", "Football later, Bob? Everton's ready.", "Peace and love, Bob. Cheers."],
    },
  },
  George: {
    gloat: [
      "Did the gardening. Did the winning.", "Hm. Nice day for it.", "My roses played better.",
      "Quietly confident. Mostly quiet.", "Formula One? No. Formula Win.", "Rather good, that. Don't you think?",
      "Even my sitar was better tuned.", "Wilbury wins. Nelson would approve.",
    ],
    sulk: [
      "Hm. Back to the garden.", "Not ideal. Not ideal at all.", "I'll sit this one out. Quietly.",
      "Lovely. Pass the watering can.", "That's the thing about cards.", "I've had worse days. Possibly.",
      "Oh well. Another ten minutes.",
    ],
    tease: [
      "One card. Don't look so pleased.", "Nearly there. Quietly.", "One card. Put the kettle on.",
      "Last card. A very modest one.", "Almost done. Sort of quietly.", "One left. Gearing up.",
      "Hm. One card. Naturally.",
    ],
    win: [
      "Handmade victory. Quietly mine.", "Hm. Rather good. Wilbury wins.", "A quiet win. Best kind.",
      "Spike Wilbury, signing off.", "All things must pass. This didn't.", "Time to water the roses.",
      "That went rather well, really.",
    ],
    lose: [
      "Well. I'll be in the garden.", "Not Carl Harrison's best day.", "Pass the sitar. I'm done.",
      "Everything can wait. Even losing.", "McLaren would've been faster.", "Hm. Well played. Mostly.",
      "A moment's quiet, please. Thank you.",
    ],
    reply: [
      "Mm. Fascinating. Truly.", "Quiet, now. I'm thinking.", "Pass. Quietly.",
      "Is that so? Hm.", "Not now. I'm tuning.", "Interesting. In a dull way.",
    ],
    user: [
      "Do you garden? You should.", "Tragic. And not very quiet.", "I've had electricians play better.",
      "Hm. Did you enjoy that?", "Hush now, and play better.", "That hand needs weeding.",
      "Sitar's easier than your strategy.", "Try Formula One. Faster, at least.",
    ],
    any: [
      "Quietly impressed. Not very.", "Do keep it down, please.", "Rather loud for a loser.",
      "That's not very Wilbury, is it?", "Hm. I've heard better.", "Gnomes could do that.",
    ],
    at: {
      John: ["John, put the pen down.", "Witty, John. Very witty. Yawn.", "John, you're being loud again."],
      Paul: ["Paul, do shut up. Quietly.", "Left-handed, Paul? Still lost.", "Paul's smiling again. Alarming."],
      Ringo: ["Ringo, you've lost your rings.", "Octopus, Ringo? Where's the garden?", "Steady, Ringo. Quietly now."],
      Ziggy: ["Ziggy, put that sphere away.", "Mullet's not a strategy, Ziggy.", "Spiders in the roses again."],
      Bowie: ["David, you're changing again.", "Persona, persona. All very loud.", "Berlin's quieter than you, David."],
      Marley: ["Bob, a quiet word? Peace.", "Football later, Bob? Quietly.", "Bob. Sunshine. Hm. Nice."],
    },
  },
  Ringo: {
    gloat: [
      "Drum roll, please! I win!", "Played that with me rings on.", "That's Thomas the Tank Engine pace.",
      "Off to the garden. Octopus-style!", "Peace and love, and a win!", "I'm a star, me. Obviously.",
      "Not bad for Dingle, eh?", "Pass me the All-Starr trophy.",
    ],
    sulk: [
      "Blimey. I need a cuppa.", "Blisters again. Honestly.", "Not another blooming one!",
      "I've had worse. In Hamburg.", "Worse things happen in Hamburg, mate.", "Drummer's lot, this is.",
      "Oh, come on. Really?", "Tomorrow never knows. Mostly.",
    ],
    tease: [
      "One card. Cue the drum roll.", "Nearly out. Peace and love!", "One card. I'm a knight, you know.",
      "One left. Don't peek, now!", "Mr Conductor says: one card.", "Almost there. All aboard!",
      "One card, mate. Any minute.",
    ],
    win: [
      "All aboard the Ringo express!", "Peace and love, lads. Winner!", "Sir Ringo wins. Lovely.",
      "Drum roll. Cymbal crash. Me.", "All-Starr win. Take a bow.", "Photograph that. I won!",
      "Back on top again, mate!",
    ],
    lose: [
      "Peace and love. Still.", "It don't come easy, mate.", "I'm the quiet one. Today.",
      "I'll go and narrate a train.", "Back to the drum kit.", "Right. All aboard for next time.",
      "I've been down before, mate.",
    ],
    reply: [
      "Steady, mate. Peace and love.", "Cheek! I'm a knight.", "Oi! That's me rings.",
      "Mocker, me. Not a rocker.", "Cheers, mate. Love you.", "Right, back at you!",
    ],
    user: [
      "Sorry mate. Peace and love though.", "You've got blisters on your brain.", "Count to four. Then try again.",
      "Even Thomas runs faster, mate.", "I've seen better cards in Dingle.", "Keep the beat, mate. Please.",
      "Not bad. For a mocker.", "You play like a metronome. Joke!",
    ],
    any: [
      "Oi! Not on me rings.", "Peace and love, mate. Honest.", "Drums beat cards, mate.",
      "Mr Conductor's taking notes.", "Steady, mate. Octopus watching.", "Oh, bless. Honestly.",
    ],
    at: {
      John: ["John, stop writing about me.", "John, mate, drop the glasses.", "Oi, John! Rings beat pens."],
      Paul: ["Paul, you great mop top.", "Paul, left or right?", "Paul, I'm a knight too."],
      George: ["George, you've gone quiet again.", "Garden gnome, George? Honestly.", "George, pass the sitar. Joke!"],
      Ziggy: ["Ziggy, I'd borrow that mullet.", "Spiders? I've got a drum kit.", "Ziggy, mate. Eyebrows, please."],
      Bowie: ["Bowie, mate. Which one today?", "Goblin King? I'm a conductor.", "Bowie, back to Berlin, mate."],
      Marley: ["Bob, mate. Peace and love!", "Football after, Bob? Joke!", "Bob. Pass the sunshine."],
    },
  },
  Ziggy: {
    gloat: [
      "Gold sphere, gold hand. Obviously.", "Spiders applaud. Quietly, of course.", "Red mullet beats grey mortals.",
      "Kabuki flourish! Observe, darlings.", "Hammersmith Odeon, take a bow.", "Alien talent. Alien win.",
      "Ziggymania strikes again, earthlings.", "Starman descends. You're welcome.",
    ],
    sulk: [
      "My mullet has wilted. Tragic.", "Even the Spiders look away.", "Heddon Street will weep.",
      "Not a good night for aliens.", "My sphere has lost its gleam.", "I shall retire. Dramatically.",
      "I demand a kabuki costume change.",
    ],
    tease: [
      "One card. Cue the Spiders.", "Almost there. The gold sphere glows.", "Last card. Gasp, earthlings.",
      "One left. Hammersmith holds its breath.", "Nearly done. Fabulously, naturally.", "One card. Lightning, please.",
      "Retiring soon. Possibly. Dramatically.",
    ],
    win: [
      "Ziggymania! Take a bow, earthlings.", "Messiah of Mars wins again.", "The Spiders will sing tonight.",
      "Hammersmith Odeon. Last night. Perfect.", "Glitter and gold. Pure triumph.", "Ziggy retire? Never.",
      "Heddon Street plaque, please.",
    ],
    lose: [
      "Retire me. Dramatically, please.", "The Spiders will avenge this.", "A fallen star. Briefly.",
      "My mullet will recover. Eventually.", "I'll shave another eyebrow.", "Time to return to Mars.",
      "Even messiahs fall, darling.",
    ],
    reply: [
      "Darling, you're so Earth.", "Mind the sphere, little earthling.", "Oh, how delightfully mortal.",
      "Mars sends its regards.", "Kabuki flourish. Ignore it.", "Do tilt your head. Fabulous.",
    ],
    user: [
      "Earthling, that's not a hairstyle.", "Not even a spider would play that.", "Do try some glitter, darling.",
      "Kabuki would have folded that.", "How terribly grey, earthling.", "Even the Spiders pity you.",
      "My mullet could do better.", "Take a moment. Admire the sphere.",
    ],
    any: [
      "No sphere, no style, darling.", "Spiders from Mars could do better.", "Even my eyebrows are bored.",
      "Fabulous, in a dusty way.", "Gene Vincent's leg plays better.", "Darling, retire. Gracefully.",
    ],
    at: {
      John: ["John, put the glasses away.", "John, darling. Mop top. Really.", "Nonsense? I'm the nonsense, John."],
      Paul: ["Paul, bass line? Marvellous. Sleepy.", "Paul, dear. Smile less.", "Mop-top Paul, how delightful."],
      George: ["George, put the garden away.", "George, speak up. Starman requests.", "George, a mullet would help."],
      Ringo: ["Ringo, your rings are cute.", "Ringo, darling. All aboard Mars.", "Ringo! Lend me a drumstick."],
      Marley: ["Bob, pass the sunshine. Please.", "Bob, no one's tuffer. Almost.", "Bob. A Spider for a Wailer?"],
    },
  },
  Bowie: {
    gloat: [
      "Thin White Duke, thin white win.", "Halloween Jack approves. Ghoulishly.", "Berlin never played this well.",
      "Goblin King takes the pile.", "Another persona. Another win.", "Pierrot bows. Quietly smug.",
      "Aladdin Sane would be proud.", "Tesla couldn't have done better.",
    ],
    sulk: [
      "Even Major Tom floats off.", "A flop worthy of Tin Machine.", "Brixton sighs. So do I.",
      "This costume doesn't suit me.", "I need a new persona. Now.", "Brixton's heard worse. Barely.",
      "Time for Berlin. Alone, please.",
    ],
    tease: [
      "One card. A new face approaches.", "Almost there. Costume change pending.", "Last card. Pierrot holds his breath.",
      "One left. Goblin King smiles.", "Nearly done. Dress rehearsal over.", "Final scene, darlings. Lights, please.",
      "One card. Enter Halloween Jack.",
    ],
    win: [
      "Goblin King claims the crown.", "Another persona. Another triumph.", "Chameleon wins. Naturally.",
      "Thin White Duke, flawless. Again.", "Berlin approves. Quietly, darlings.", "Take a bow, Jones.",
      "Major Tom lands safely.",
    ],
    lose: [
      "Bromley taught me better than this.", "The Duke has been dethroned.", "Reinvention. Starting right now.",
      "Beckenham called. They want me back.", "Even Pierrot weeps. Briefly.", "A fine rehearsal. Next act.",
      "I'll come back as someone cleverer.",
    ],
    reply: [
      "Terribly dramatic. I approve.", "Lovely costume. Terrible lines.", "Is that your best persona?",
      "Darling, I invented that.", "Try Berlin. Lovely this time.", "Ah. An understudy. Charming.",
    ],
    user: [
      "That hand is pure Tin Machine.", "Even Labyrinth is less confusing.", "Do pick a persona, darling.",
      "A new face might help you.", "Bromley called. You'd lose there.", "Lovely hand. For an understudy.",
      "The Goblin King shall be generous.", "Not even Major Tom floats that.",
    ],
    any: [
      "Dear me. How very Brixton.", "Change faces, darling. Do hurry.", "Costume crime. Call Berlin.",
      "Even the Duke would blush.", "How terribly provincial. Beckenham, perhaps?", "Do try a different mask.",
    ],
    at: {
      John: ["John, darling. Lovely glasses. Lost.", "John, a collaborator? Never again.", "Fruitcake, John? Try a persona."],
      Paul: ["Paul, bass is for the shy.", "Paul, dear. Smile less, perform more.", "Knighted Paul, how terribly formal."],
      George: ["George, a persona might help.", "Garden gnomes aren't a persona.", "George, speak up. Please."],
      Ringo: ["Ringo, drum less, think more.", "Ringo, darling. Rings are a persona.", "All aboard, Ringo. I'll follow."],
      Ziggy: ["Ziggy, that costume is retired.", "Ziggy, you've aged beautifully. Barely.", "Back in the spaceship, Ziggy."],
      Marley: ["Bob, a Wailer in Berlin?", "Bob, no rush. Just win.", "Bob, I'd swap personas. Briefly."],
    },
  },
  Marley: {
    gloat: [
      "Tuff Gong wins. Gently, friend.", "Trenchtown's got style, friend.", "BMW. Bob Marley Wins. Easy.",
      "Nine Mile never lost like this.", "Football taught me that move.", "Sunshine suits me. Always has.",
      "One love, one win, friend.", "Lion's out. Sun's shining.",
    ],
    sulk: [
      "No tears, friend. Easy.", "Rest a while. Cards come round.", "Rest a while. Next game's mine.",
      "Even the lion sits down.", "Football ends. So does this.", "Breathe in. Breathe out. Okay.",
      "Wailers lose sometimes. It's fine.",
    ],
    tease: [
      "One card. Football minute, friend.", "Almost home. Slow and sunny.", "One left. Easy does it.",
      "One card. Nine Mile calling.", "Nearly there. Smile, friend.", "Last card. Peace, everybody.",
      "One card. Trenchtown's proud.",
    ],
    win: [
      "One love! Thank you, friends.", "Tuff Gong takes it. Gently.", "Wailers win. Sunshine everywhere.",
      "Football taught me this. Easy.", "Lion sleeps. Winner smiles.", "Sweet. Peace and a trophy.",
      "Nine Mile to the top.",
    ],
    lose: [
      "Respect. Enjoy that win, friend.", "No bad blood. Just football.", "Trenchtown teaches patience. I'm patient.",
      "Rematch, friend. Peaceful one.", "Wailers will return. Always do.", "Good game. Truly. One love.",
      "Easy come. Easy go.",
    ],
    reply: [
      "Easy now. In through the nose.", "Peace. Truly. Peace.", "Ah, good vibes only.",
      "Smile, friend. It's cards.", "One love, friend. Always.", "No stress. Pass the sun.",
    ],
    user: [
      "Relax, friend. It's only cards.", "Even a Wailer plays faster.", "Football's easier. Try it.",
      "One love, but that hand?", "Smile, friend. You're doing great. Not.", "Trenchtown teaches better strategy.",
      "Sunshine and bad cards. Classic.", "Nine Mile's chickens play better.",
    ],
    any: [
      "Easy, brother. Football's calmer.", "Peace, brother. Peace. Truly.", "Lion's watching. Be gentle.",
      "Pass the sunshine. You need it.", "Good vibes only, brother. Seriously.", "One love, brother. Poor cards.",
    ],
    at: {
      John: ["John, friend. Take off the glasses.", "John, easy. One love.", "John, chill. Have some sunshine."],
      Paul: ["Paul, friend. Left-handed? Good.", "Paul, smile. Always smile.", "Paul, brother. Peace, mate."],
      George: ["George, friend. Quiet suits the garden.", "George, plant the sunshine.", "George, brother. Quiet suits you."],
      Ringo: ["Ringo, brother. All aboard peace.", "Ringo, rings. Lovely. One love.", "Ringo, peace and love. Same."],
      Ziggy: ["Ziggy, brother. Sphere's too bright.", "Ziggy, easy. Sit down.", "Ziggy, one love. Even yours."],
      Bowie: ["Bowie, brother. Which persona today?", "Bowie, relax. One face is plenty.", "Berlin's cold. Come to Jamaica."],
    },
  },
});
