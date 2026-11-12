import { rankOf, suitOf } from "./cards";
import { legalMoves } from "./rules";
import type { CardId, GameState, Suit } from "./types";

/**
 * Teaching cards for the tutorial: one full lesson for every move. Each lesson says what
 * happened, the rule behind it, why it matters now, and a tip. Like the coach, it only
 * reads game state, so the same shape can teach any game with legal moves.
 */
export interface Lesson {
  readonly title: string;
  readonly cards: readonly CardId[];
  readonly happened: string;
  readonly rule: string;
  readonly why: string;
  readonly tip: string;
}

type Side = "you" | "computer";

const SUITS: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RANKS: Record<string, string> = {
  A: "ace", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
  "8": "eight", "9": "nine", "10": "ten", J: "jack", Q: "queen", K: "king",
};

const actor = (side: Side) => (side === "you" ? "You" : "The computer");
const them = (side: Side) => (side === "you" ? "the computer" : "you");
const cardName = (card: CardId) => `${RANKS[rankOf(card)]} of ${SUITS[suitOf(card)]}`;
const isBlackKing = (card: CardId) => card === "KS" || card === "KC";

/** The lesson for a card (or set) that was just played. */
export function explainLesson(before: GameState, after: GameState, cards: readonly CardId[], side: Side, aceSuit?: Suit): Lesson {
  const first = cards[0];
  const rank = rankOf(first);
  const who = actor(side);
  const next = them(side);
  const nextCap = next === "you" ? "You" : "The computer";
  const happened = cards.length === 1 ? `${who} played the ${cardName(first)}.` : `${who} played ${cards.length} ${RANKS[rank]}s together.`;
  const wasPenalty = before.pendingPenalty;
  const penalty = after.pendingPenalty;
  const suitNow = SUITS[after.currentSuit];
  const base = { cards: cards.slice(0, 4), happened };

  if (rank === "2") {
    return {
      ...base,
      title: "A two: pick up two",
      rule: "A two makes the next player pick up 2 cards, unless they play another two. Each two adds 2 to the pile of cards waiting to be picked up.",
      why: penalty?.kind === "draw-two"
        ? `${wasPenalty ? "The stack is now" : "That starts a penalty of"} ${penalty.cards} cards. ${nextCap} can pass it on with another two, or pick the cards up.`
        : "The penalty has been settled.",
      tip: "Keeping a two in your hand protects you from someone else's two. Stack yours only if it leaves you a good card to finish with.",
    };
  }
  if (rank === "K") {
    const black = isBlackKing(first);
    return {
      ...base,
      title: black ? "A black king: pick up five" : "A red king: cancel a black king",
      rule: black
        ? "A black king makes the next player pick up 5 cards. Another black king passes it on and adds 5 more."
        : "A red king cancels one black king, which takes 5 cards off the penalty. You need one red king for each black king.",
      why: penalty?.kind === "black-king" ? `${penalty.cards} cards are now waiting for ${next} to pick up.` : "With the penalty cancelled, play goes back to normal.",
      tip: black
        ? "Black kings are the heaviest cards in the game. Save them for when the other player is close to winning."
        : "Hold a red king as insurance. It turns a painful penalty into nothing.",
    };
  }
  if (rank === "8") {
    const countered = wasPenalty?.kind === "miss-turn";
    return {
      ...base,
      title: countered ? "An eight answers an eight" : "An eight: miss a turn",
      rule: "An eight makes the next player miss a turn. They can play an eight of their own to pass the missed turn on.",
      why: countered
        ? `${who} passed the missed turn straight back, so ${next} must answer with an eight or miss out.`
        : `${nextCap} miss${next === "you" ? "" : "es"} a turn unless ${next === "you" ? "you hold" : "it holds"} an eight.`,
      tip: "An eight is best when the other player has few cards left. Two eights in a row can keep the whole turn in your hands.",
    };
  }
  if (rank === "7") {
    return {
      ...base,
      title: "A seven: play again",
      rule: "After a seven you play another card straight away. You cannot finish the game on a seven, because you still have to play again.",
      why: `${who} ${side === "you" ? "play" : "plays"} again. The pile still needs ${SUITS[after.currentSuit]} or a seven.`,
      tip: "A seven is a free move. Use it to get rid of a spare card and set up the suit you hold most of.",
    };
  }
  if (rank === "J") {
    const odd = cards.length % 2 === 1;
    return {
      ...base,
      title: odd ? "A jack: reverse the order" : "Two jacks cancel out",
      rule: "A single jack reverses the direction of play. Two jacks reverse it twice, so nothing changes. With two players, a reverse brings play straight back to the person who played it.",
      why: odd ? `In a two-player game ${side === "you" ? "you play" : "the computer plays"} again.` : "The reverses cancel, so play moves on to the next player as normal.",
      tip: "With two players a jack works like a seven. Remember that you cannot finish on one.",
    };
  }
  if (rank === "A") {
    const chosen = SUITS[aceSuit ?? suitOf(cards[cards.length - 1])];
    return {
      ...base,
      title: "An ace: wild",
      rule: "An ace can be played on any ordinary card, whatever its suit, and the person who plays it chooses the next suit. It cannot interrupt a black king, two or eight.",
      why: `The suit is now ${chosen}, so ${next === "you" ? "you need" : "the computer needs"} ${chosen} or another ace.`,
      tip: "Choose the suit you hold the most of. Saving an ace for a moment when you are stuck is often stronger than playing it early.",
    };
  }
  if (cards.length > 1) {
    return {
      ...base,
      title: "A matching set",
      rule: "You may play two or more cards of the same number together. The first card must match the suit or number of the pile, and the last card you play sets the suit.",
      why: `Playing ${cards.length} cards at once empties your hand faster. The suit is now ${suitNow}.`,
      tip: "Order the set so the last card is the suit you hold most of. It sets up your next turn.",
    };
  }
  const topBefore = before.discardPile[before.discardPile.length - 1];
  const matchedSuit = suitOf(first) === before.currentSuit;
  return {
    ...base,
    title: matchedSuit ? "A suit match" : "A number match",
    rule: "Play a card that matches the suit or the number of the card on top of the pile.",
    why: matchedSuit
      ? `It matched the suit (${SUITS[before.currentSuit]}), so the suit stays ${suitNow}.`
      : `It matched the number (${RANKS[rankOf(topBefore)]}), so the suit changes to ${suitNow}.`,
    tip: matchedSuit
      ? "Matching the suit keeps the pile on a suit you hold. Matching a number changes it. Use that to steer the game."
      : "Matching the number is how you change suit. Pick the card that moves the pile onto a suit you hold plenty of.",
  };
}

/** The lesson for picking up cards, or for missing a turn. */
export function explainPickupLesson(before: GameState, side: Side, count: number): Lesson {
  const who = actor(side);
  const verb = side === "you" ? "pick up" : "picks up";
  const penalty = before.pendingPenalty;

  if (penalty?.kind === "miss-turn") {
    return {
      title: "Missing a turn",
      cards: [],
      happened: `${who} could not answer the eight and ${side === "you" ? "miss" : "misses"} a turn.`,
      rule: "When an eight is played, the next player misses their turn unless they can play an eight of their own.",
      why: `${side === "you" ? "The computer plays" : "You play"} again straight away.`,
      tip: "Keep an eight in your hand when you can. It turns a lost turn into a counter-attack.",
    };
  }
  if (penalty?.kind === "draw-two" || penalty?.kind === "black-king") {
    const isTwo = penalty.kind === "draw-two";
    return {
      title: `Picking up ${count}`,
      cards: [],
      happened: `${who} ${verb} ${count} cards.`,
      rule: isTwo
        ? "When a two is played you must pick up 2 cards for each two in the stack, unless you can play another two."
        : "When a black king is played you must pick up 5 cards for each black king in the stack, unless you can play another black king or a red king.",
      why: "The penalty is settled and play moves on. The cards join the hand, so it is a bigger hand to empty.",
      tip: "Sometimes picking up is the right choice, especially when answering would cost you a card you need later.",
    };
  }
  const couldPlay = legalMoves(before).some((action) => action.type === "play");
  return {
    title: couldPlay ? "Choosing to pick up" : "Nothing to play",
    cards: [],
    happened: `${who} ${verb} one card.`,
    rule: "On a normal turn you may pick up one card instead of playing, even if you have a legal card. If nothing matches, picking up is your only move.",
    why: couldPlay
      ? "Picking up when you could play is a tactic. It keeps a strong card such as an ace or a king in your hand."
      : `Nothing matched ${SUITS[before.currentSuit]} or the top number, so a card came from the pile.`,
    tip: "Look at your hand before you pick up. If you hold several cards of one suit, an ace can bring the pile onto that suit.",
  };
}

/** The first card of the game: what is on the pile, and how a turn works. */
export function explainStart(state: GameState, side: Side): Lesson {
  const top = state.discardPile[state.discardPile.length - 1];
  return {
    title: "Game on",
    cards: [top],
    happened: `The starting card is the ${cardName(top)}. ${side === "you" ? "You play first." : "The computer plays first."}`,
    rule: "On your turn, play a card that matches the suit or the number of the card on top of the pile. If you cannot, or would rather not, pick up one card.",
    why: `Right now the pile needs ${SUITS[state.currentSuit]} or a ${RANKS[rankOf(top)]}. Power cards (twos, eights, sevens, jacks, kings and aces) change how the game flows.`,
    tip: "The first player to empty their hand wins. Real card nights work exactly like this, so try it with a pack of cards on the table next.",
  };
}
