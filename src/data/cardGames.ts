export interface CardGame {
  id: string;
  name: string;
  category: 'Family' | 'Tricks' | 'Shedding' | 'Melds' | 'Pub Classic';
  tagline: string;
  players: string;
  deck: string;
  scoringType: 'low-wins' | 'high-wins' | 'first-out';
  targetScoreDesc: string;
  overview: string;
  setup: string[];
  howToPlay: string[];
  scoringDetails: string[];
  keyRules: { title: string; desc: string }[];
  goldenTip: string;
  isPremium?: boolean;
}

export const TOP_10_GAMES: CardGame[] = [
  {
    id: 'switch',
    name: 'Switch (UK)',
    category: 'Shedding',
    tagline: 'The fast-paced British shedding favourite with power cards.',
    players: '2–6 players',
    deck: 'Single 52-card deck',
    scoringType: 'first-out',
    targetScoreDesc: 'First player to legally shed all cards wins the round.',
    overview: 'Players race to empty their hands by matching the suit or rank of the top card on the discard pile. Power cards trigger chain reactions: pick-ups, skipped turns, reverses, and wild suit switches.',
    setup: [
      'Deal 7 cards face down to each player.',
      'Place remaining deck face down as the draw pile.',
      'Turn top card over to start the discard pile (re-draw if it is a power card).'
    ],
    howToPlay: [
      'Play one card matching the current suit or rank, or play a matching rank set.',
      'Aces are wild on ordinary cards and allow you to declare the next suit.',
      'Twos force next player to pick up 2 cards (stacks with other 2s).',
      'Black Kings force next player to pick up 5 cards (stackable, red Kings cancel).',
      'Eights skip the next player’s turn.',
      'Must announce “Last Card” when down to one card, or face a 2-card penalty.'
    ],
    scoringDetails: [
      'First player to shed all cards wins 5 points.',
      'Optional Domino scoring: Winner scores face value of all cards remaining in opponents’ hands.',
      'Optional Knockout: Last player holding cards each round is eliminated.'
    ],
    keyRules: [
      { title: 'Black Kings Stack', desc: 'Each black king adds 5 cards. Two black kings mean 10 cards. Red kings cancel them one-for-one.' },
      { title: 'Finishing Rule', desc: 'You cannot finish on a 7 (means play again) or a Jack in 2-player games.' },
      { title: 'Last Card Call', desc: 'Must say “Last Card” before play moves on, or pick up 2 penalty cards.' }
    ],
    goldenTip: 'Hold onto an Ace or Red King until late in the round—they are your ultimate insurance policies!'
  },
  {
    id: 'rummy',
    name: 'British Rummy',
    category: 'Melds',
    tagline: 'The classic British family & pub game: meld runs, lay off cards, and shout RUMMY!',
    players: '2–6 players',
    deck: 'Standard 52-card pack (2 packs for 5+ players)',
    scoringType: 'low-wins',
    targetScoreDesc: 'Lowest penalty score across hands wins (or first to 100 points in Gin format).',
    overview: 'The quintessential British living room card game. Players collect cards into sets of matching ranks (three 8s) or consecutive runs in the same suit (4-5-6 of Hearts). You can lay down melds, add cards to your opponents’ melds (“laying off”), and call “RUMMY!” if you shed your entire hand in one single turn for double points.',
    setup: [
      'Deal 7 cards each (10 cards each in a 2-player game).',
      'Place remaining cards face down as the stock pile.',
      'Turn the top card face up to start the discard pile (the “waste”).'
    ],
    howToPlay: [
      'Draw the top card from either the face-down stock or the top face-up discard.',
      'Meld valid combinations face up on your turn: Sets (3 or 4 cards of the same rank) or Runs (3+ consecutive cards in the same suit).',
      'Lay off: After melding, you can add matching cards to anyone’s existing meld on the table.',
      'Discard one unwanted card face up onto the waste pile to end your turn.',
      'Going Out: Shed all cards in hand to end the round. If you lay down your entire hand in a single turn without having melded before, announce “RUMMY!”'
    ],
    scoringDetails: [
      'The player who goes out scores 0 penalty points (or collects points from opponents).',
      'All other players score penalty points for cards left in hand:',
      'Picture cards (Kings, Queens, Jacks): 10 points each.',
      'Aces: 1 point (or 11 if played high in a run like Q-K-A).',
      'Number cards (2 to 10): Face pip value.',
      'Going “Rummy” Bonus: If the winner goes out in one complete turn, opponents’ penalty points are doubled!'
    ],
    keyRules: [
      { title: 'The “Rummy” Shout', desc: 'Shedding all cards in a single move earns double points from opponents.' },
      { title: 'Laying Off Cards', desc: 'In British Rummy, you can play off opponents’ sets and runs once your initial meld is down.' },
      { title: 'Aces Can Be High or Low', desc: 'Aces can lead A-2-3 or anchor Q-K-A, but cannot wrap around (K-A-2 is invalid).' }
    ],
    goldenTip: 'Hold your combinations secretly in hand until you can lay them all down in one go to catch opponents with a full hand of penalty points!'
  },
  {
    id: 'hearts',
    name: 'Black Maria (UK Hearts)',
    category: 'Tricks',
    tagline: 'The classic British trick-avoidance game: dodge Hearts and the dreaded Black Maria.',
    players: '3–4 players',
    deck: 'Standard 52-card pack',
    scoringType: 'low-wins',
    targetScoreDesc: 'Lowest penalty score wins when any player reaches 50 or 100 points.',
    overview: 'The traditional British pub and parlour game that inspired American Hearts. Players aim to avoid winning penalty cards in tricks. Every Heart carries 1 penalty point, but the supreme danger is the Queen of Spades—the infamous “Black Maria”—carrying 13 points.',
    setup: [
      'In a 4-player game, deal 13 cards to each player. In a 3-player game, remove the 2 of Clubs and deal 17 cards each.',
      'Passing rule: Before the opening lead, each player passes 3 unwanted cards face down to the player on their left.'
    ],
    howToPlay: [
      'The player holding the 2 of Clubs (or player left of dealer) leads the first trick.',
      'Must follow suit if you hold a card of the led suit. If void in the suit, you may discard any card.',
      'Highest card of the suit led wins the trick and leads the next trick.',
      'Hearts cannot be led until Hearts have been “broken” (discarded on a trick where someone couldn’t follow suit).'
    ],
    scoringDetails: [
      'Each Heart taken in tricks: 1 penalty point.',
      'The Black Maria (Queen of Spades): 13 penalty points.',
      'Traditional UK Pub Option: Ace of Spades (3 pts) and King of Spades (2 pts) can also carry penalties if agreed.',
      'Hitting the Moon / Slam: If one player wins ALL penalty cards in a single round, they score 0 while every opponent takes 26 penalty points!'
    ],
    keyRules: [
      { title: 'Strict Follow Suit', desc: 'You must play the suit led if you have it in hand. Only discard when completely void.' },
      { title: 'The Black Maria Danger', desc: 'The Queen of Spades is 13 points—watch the King and Ace of Spades closely!' },
      { title: 'Breaking Hearts', desc: 'Hearts cannot be led on early tricks until a Heart has been discarded.' }
    ],
    goldenTip: 'Play your high Spades (Ace and King) early while you still hold low Spades, so you don’t get trapped taking the Queen later.'
  },
  {
    id: 'spades',
    name: 'Spades',
    category: 'Tricks',
    tagline: 'Partnership strategy: bid your tricks accurately and master the trump suit.',
    players: '4 players (2 pairs)',
    deck: 'Standard 52-card deck',
    scoringType: 'high-wins',
    targetScoreDesc: 'First partnership to reach 500 points wins.',
    overview: 'Partners sit opposite each other. Each round begins with bids predicting how many tricks your team will win. Spades are always the trump suit. Precision bidding is key—overbidding causes penalties, while taking extra tricks accumulates “bags”.',
    setup: [
      'Deal 13 cards to each player.',
      'Each player bids their anticipated trick count in order, starting left of dealer.'
    ],
    howToPlay: [
      'Combined bids form the team target (e.g. 4 + 3 = 7 tricks).',
      'Player left of dealer leads first. Must follow suit if possible; otherwise trump with a Spade or discard.',
      'Spades cannot be led until Spades are “broken” or lead player holds only Spades.',
      'Highest Spade wins the trick, or highest card of the suit led if no Spades were played.'
    ],
    scoringDetails: [
      'Making Bid: 10 points per trick bid (e.g. 7 bid = 70 points).',
      'Overtricks (Bags): +1 point per extra trick. Every 10 bags accumulated costs a 100-point penalty!',
      'Failing Bid (Set): Lose 10 points per trick bid (e.g. bid 7, won 6 = -70 points).',
      'Nil Bid: Successfully winning zero tricks awards 100 bonus points; failing loses 100.'
    ],
    keyRules: [
      { title: 'Spades are Always Trump', desc: 'Spades outrank all cards of other suits regardless of numerical value.' },
      { title: 'Sandbagging Penalty', desc: 'Accumulating 10 bags triggers a steep 100-point penalty.' },
      { title: 'Blind Nil Option', desc: 'Bidding Nil without looking at cards earns 200 points (or -200 if failed).' }
    ],
    goldenTip: 'Communicate with your partner through card play—lead low cards to signal weakness or high cards to clear the way.'
  },
  {
    id: 'cribbage',
    name: 'Cribbage',
    category: 'Pub Classic',
    tagline: 'Traditional British pub favourite: peg your points to 121 on the board.',
    players: '2 players',
    deck: 'Standard 52-card deck + Cribbage board (or app scorekeeper)',
    scoringType: 'high-wins',
    targetScoreDesc: 'First player to peg 121 points wins immediately.',
    overview: 'One of the oldest and most beloved card games in the UK. Players score points during the play (“pegging”) and by grouping cards into combinations of 15, pairs, runs, and flushes in their hands and the dealer’s “crib”.',
    setup: [
      'Deal 6 cards each.',
      'Each player discards 2 cards face down into the dealer’s extra hand (the “Crib”).',
      'Non-dealer cuts the deck to reveal the starter card (the “cut”).'
    ],
    howToPlay: [
      'Take turns playing cards face up, keeping a running total up to 31.',
      'Score points during pegging: make exactly 15 (2 pts), pairs (2 pts), 3-of-a-kind (6 pts), runs of 3+ (1 pt/card), or hit exactly 31 (2 pts).',
      'Say “Go” if you cannot play without exceeding 31; opponent scores 1 pt.',
      'After all cards played, score hands: non-dealer first, then dealer, then dealer scores the Crib.'
    ],
    scoringDetails: [
      'Combinations of 15: 2 points each.',
      'Pairs: 2 points (3 of a kind = 6, 4 of a kind = 12).',
      'Runs: 1 point per card (e.g. 7-8-9 = 3 points).',
      'Jack of cut suit (“His Nobs”): 1 point.',
      'Jack turned up on cut (“His Heels”): Dealer immediately scores 2 points.'
    ],
    keyRules: [
      { title: 'Never Exceed 31', desc: 'Running play resets to 0 once 31 is reached or both players call Go.' },
      { title: 'The Crib belongs to Dealer', desc: 'Dealer alternates each hand—discard safe cards into your opponent’s crib!' },
      { title: 'Muggins Rule (Optional)', desc: 'If an opponent overlooks points in their hand, you can call Muggins and claim them!' }
    ],
    goldenTip: 'When discarding to your opponent’s crib, avoid giving them 5s, consecutive cards like 7-8, or pairs.'
  },
  {
    id: 'crazy8s',
    name: 'Crazy Eights',
    category: 'Family',
    tagline: 'The fast and frantic family shedding game where Eights change the rules.',
    players: '2–5 players',
    deck: 'Standard 52-card deck',
    scoringType: 'low-wins',
    targetScoreDesc: 'Lowest penalty score across rounds wins (first out gets 0).',
    overview: 'The global ancestor of Uno! Players race to get rid of all their cards by matching the top card’s suit or rank. All Eights are wild and can be dropped at any time to switch the current suit.',
    setup: [
      'Deal 5 cards each (7 cards each if only 2 players).',
      'Place remaining cards face down as the draw pile.',
      'Turn the top card face up to start the discard pile (re-turn if it is an 8).'
    ],
    howToPlay: [
      'Play a card matching the suit or rank of the discard pile.',
      'Play an Eight at any time and declare the new suit that must be followed.',
      'If you cannot play, draw from the stockpile until you get a playable card (or draw max 3 depending on house rules).',
      'First player to shed all cards wins the round.'
    ],
    scoringDetails: [
      'Winner of the round scores 0 points.',
      'Other players score penalty points for cards remaining in hand:',
      'Each 8 = 50 points; Kings, Queens, Jacks, 10s = 10 points; Aces = 1 point; Number cards = Face value.'
    ],
    keyRules: [
      { title: 'Eights are Wild', desc: 'An 8 can be played anytime, regardless of suit or number showing.' },
      { title: 'Declare Suit Immediately', desc: 'You must state the new suit loudly as soon as your 8 lands.' },
      { title: 'Running Out of Stock', desc: 'Turn over discard pile (except top card) to form a new stockpile.' }
    ],
    goldenTip: 'Save an 8 for your very last turn so you are guaranteed to legally finish regardless of what suit is left!'
  },
  {
    id: 'pontoon',
    name: 'Pontoon (21)',
    category: 'Pub Classic',
    tagline: 'The traditional British card game: twist, stick, and hit 21 without going bust.',
    players: '2–8 players',
    deck: 'Standard 52-card deck',
    scoringType: 'high-wins',
    targetScoreDesc: 'Highest chip count or points after set rounds wins.',
    overview: 'The UK cousin of Blackjack with unique terminology and special hands. Players aim to get card totals closer to 21 than the banker without going over. A natural Ace + 10/Picture card is a “Pontoon” and beats all normal hands!',
    setup: [
      'Choose a banker (or rotate dealer each round).',
      'Banker deals one card face down to each player and one to themselves.',
      'Players place their bets, then banker deals a second card.'
    ],
    howToPlay: [
      'Aces count as 1 or 11. Face cards count as 10. Number cards count at face value.',
      'Check cards: If you hold an Ace and a 10-value card, declare “Pontoon” immediately!',
      'Otherwise, choose your action in turn:',
      '“Twist” (draw a free card face up), “Buy” (increase stake to draw a card face down), or “Stick” (stand with 15–21).',
      'If total exceeds 21, player is “Bust” and loses their stake.',
      'Banker then plays their hand to beat remaining players.'
    ],
    scoringDetails: [
      'Hand Rankings (Highest to lowest):',
      '1. Pontoon (Ace + 10-card) — Pays 2 to 1.',
      '2. Five-Card Trick (5 cards totaling 21 or under) — Pays 2 to 1.',
      '3. Normal 21, 20, 19, etc. — Pays 1 to 1.',
      'Banker wins all ties!'
    ],
    keyRules: [
      { title: 'Must Have 15 to Stick', desc: 'You cannot stick on a total under 15; you must continue to twist or buy.' },
      { title: 'Five-Card Trick', desc: 'Holding 5 cards totaling 21 or fewer beats any 3-card or 4-card 21!' },
      { title: 'Banker Wins Ties', desc: 'If player and banker have equal value, the banker wins.' }
    ],
    goldenTip: 'With soft hands (holding an Ace counted as 11), twist fearlessly—the Ace can always revert to counting as 1 if you overshoot!'
  },
  {
    id: 'whist',
    name: 'Whist',
    category: 'Tricks',
    tagline: 'The mother of all partnership trick games—pure, elegant strategy.',
    players: '4 players (2 pairs)',
    deck: 'Standard 52-card deck',
    scoringType: 'high-wins',
    targetScoreDesc: 'First team to 5 points (Short Whist) or 7 points (Long Whist) wins.',
    overview: 'The grandmaster of British card games that gave birth to Bridge and Spades. Two partnerships face off in 13 tricks. The dealer turns up the final card to determine the trump suit for the hand. No bidding—pure card memory and technique.',
    setup: [
      'Partners sit opposite each other.',
      'Deal all 52 cards (13 each).',
      'Dealer turns the very last card face up—its suit is Trump for the entire round!'
    ],
    howToPlay: [
      'Player left of dealer leads the first trick.',
      'Must follow suit if you hold a card of the led suit; otherwise play any card or trump.',
      'Highest trump card wins the trick, or highest card of the suit led if no trumps were played.',
      'Winner of the trick leads the next.'
    ],
    scoringDetails: [
      'Teams must win more than 6 tricks (the “book”) to score points.',
      'Score 1 point for each trick won beyond 6 (e.g. 9 tricks = 3 points).',
      'First partnership to reach 5 points wins the game.'
    ],
    keyRules: [
      { title: 'Strict Follow Suit', desc: 'Failing to follow suit when able (reneging) loses 3 tricks as penalty.' },
      { title: 'Trumps Beat Anything', desc: 'Even a 2 of trumps beats an Ace of any non-trump suit.' },
      { title: 'No Talking Between Partners', desc: 'Partners must not discuss cards or signal each other.' }
    ],
    goldenTip: 'Count the trumps as they are played! Knowing how many trumps remain on the table gives your team total control.'
  },
  {
    id: 'canasta',
    name: 'Canasta',
    category: 'Melds',
    tagline: 'The thrilling South American rummy game of wild cards and 7-card melds.',
    players: '4 players (2 pairs)',
    deck: 'Two standard 52-card decks + 4 Jokers (108 cards total)',
    scoringType: 'high-wins',
    targetScoreDesc: 'First partnership to reach 5,000 points wins the match.',
    overview: 'A famous partnership meld game where teams build sets of 7 or more cards of the same rank (called a Canasta). Jokers and Twos are wild. Taking the discard pile can turn the entire game around in a single dramatic move!',
    setup: [
      'Deal 11 cards to each player.',
      'Place remaining cards face down as stock.',
      'Turn the top card face up to begin the discard pile.'
    ],
    howToPlay: [
      'Draw 2 cards from stock (or pick up the whole discard pile under legal conditions).',
      'Meld cards by laying down 3 or more of the same rank on the table.',
      'Build towards a Canasta: a complete meld of 7 cards of the same rank.',
      'Discard 1 card face up onto the discard pile to end your turn.',
      'Going out: A team must have at least one complete Canasta before any partner can shed their last card.'
    ],
    scoringDetails: [
      'Natural Canasta (7 cards, no wild cards): 500 bonus points.',
      'Mixed Canasta (7 cards, with wild cards): 300 bonus points.',
      'Going Out Bonus: 100 points.',
      'Red Threes: 100 points each (or 800 for all 4).',
      'Card values in melds add points; unmelded cards in hand subtract points.'
    ],
    keyRules: [
      { title: 'Wild Cards', desc: 'All Jokers (worth 50 pts) and Twos (worth 20 pts) are wild.' },
      { title: 'Freezing the Discard Pile', desc: 'A wild card or Black 3 placed on the discard pile freezes it from being picked up without a natural pair.' },
      { title: 'Opening Meld Requirements', desc: 'Your team’s first meld in a hand must meet a minimum point score (50, 90, or 120 pts depending on cumulative score).' }
    ],
    goldenTip: 'Freezing the discard pile prevents opponents from taking massive piles while giving your team time to collect natural pairs.'
  },
  {
    id: 'cheat',
    name: 'Cheat (I Doubt It)',
    category: 'Family',
    tagline: 'The hilarious family bluffing game: lie with confidence or call out cheats!',
    players: '3–8 players',
    deck: 'Standard 52-card deck (or 2 decks for 6+ players)',
    scoringType: 'first-out',
    targetScoreDesc: 'First player to legally empty their hand wins the game.',
    overview: 'A riotous party game where lying is not only allowed—it is required! Players play cards face down while claiming what they are (Aces, Twos, Threes...). Anyone at the table can shout “CHEAT!” if they suspect a bluff.',
    setup: [
      'Deal all cards equally to players. Some players may receive one card more than others.'
    ],
    howToPlay: [
      'Player left of dealer begins by playing one or more Aces face down into the center, announcing: “Two Aces” (or however many).',
      'Next player must play and announce Twos, then Threes, Fours, through to Kings, then cycling back to Aces.',
      'You DO NOT have to tell the truth—you can lay down three Jacks while claiming they are Fours!',
      'Before the next player plays, ANY player can shout “CHEAT!” or “I DOUBT IT!”',
      'The played cards are turned over: If player was lying, they pick up the ENTIRE center pile. If they told the truth, the accuser picks up the pile!'
    ],
    scoringDetails: [
      'First player to shed all their cards with no successful Cheat challenge wins the round.',
      'In league scoring: Winner gets 5 points, second 3 points, others 0.'
    ],
    keyRules: [
      { title: 'Anyone Can Accuse', desc: 'Any player sitting at the table can shout Cheat at any time before the next card is laid.' },
      { title: 'Final Card Challenge', desc: 'When someone plays their last card, accusing them is free of hesitation—if you let them pass, they win!' },
      { title: 'Cycle of Ranks', desc: 'Ranks must progress sequentially: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A...' }
    ],
    goldenTip: 'Keep a poker face! Play multiple cards at once when you actually hold the real cards so opponents fall for your trap and accuse you.'
  }
];

export const PREMIUM_20_EXPANSION_GAMES = [
  { id: 'bridge', name: 'Bridge (Contract)', category: 'Tricks', desc: 'The world championship partnership mind sport.' },
  { id: 'euchre', name: 'Euchre', category: 'Tricks', desc: 'Fast, lively American and Aussie trump trick game.' },
  { id: 'pinochle', name: 'Pinochle', category: 'Melds', desc: '48-card double deck trick-and-meld classic.' },
  { id: 'president', name: 'President (Scum / Kings)', category: 'Shedding', desc: 'Social hierarchy party shedding ladder.' },
  { id: 'yaniv', name: 'Yaniv', category: 'Melds', desc: 'The thrilling backpacker low-card claim game.' },
  { id: 'oh-hell', name: 'Oh Hell! (Blackout)', category: 'Tricks', desc: 'Exact bid prediction trick game with expanding hands.' },
  { id: 'gin-standard', name: 'Oklahoma Gin', category: 'Melds', desc: 'Rummy variant where the upcard limits knocking deadwood.' },
  { id: 'belote', name: 'Belote', category: 'Tricks', desc: 'France’s favourite 32-card national trick game.' },
  { id: 'briscola', name: 'Briscola', category: 'Tricks', desc: 'Classic Italian trump-taking tactical game.' },
  { id: 'scopa', name: 'Scopa', category: 'Pub Classic', desc: 'Captivating Italian fishing game: sweep the table clean.' },
  { id: 'sheepshead', name: 'Sheepshead (Schafkopf)', category: 'Tricks', desc: 'Bavarian traditional trump and partner deduction.' },
  { id: 'skat', name: 'Skat', category: 'Tricks', desc: 'Germany’s premier 3-player trick-taking game.' },
  { id: 'klaverjas', name: 'Klaverjas', category: 'Tricks', desc: 'The great Dutch trick game played in every cafe.' },
  { id: 'marjolet', name: 'Marjolet', category: 'Melds', desc: 'Fast-paced two-player French meld competition.' },
  { id: 'spit', name: 'Spit / Speed', category: 'Shedding', desc: 'High-adrenaline simultaneous real-time shedding race.' },
  { id: 'durak', name: 'Durak', category: 'Shedding', desc: 'The fierce Eastern European game of defenders and attackers.' },
  { id: 'bezique', name: 'Bézique', category: 'Melds', desc: 'Victorian England’s favourite 64-card royal marriage game.' },
  { id: 'solitaire-golf', name: 'Golf Solitaire', category: 'Family', desc: 'Head-to-head competitive low-stroke solitaire clearing.' },
  { id: 'barbu', name: 'Barbu', category: 'Tricks', desc: 'The ultimate 7-contract French student card decathlon.' },
  { id: 'twenty-nine', name: 'Twenty-Nine (29)', category: 'Tricks', desc: 'Popular South Asian bidding and trump-hunting game.' },
];
