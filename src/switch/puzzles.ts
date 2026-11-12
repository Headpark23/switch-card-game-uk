import { isNormallyPlayable, isPlayableDuringPenalty, type PlayContext } from './rules';
import type { CardId, PendingPenalty, Suit } from './types';

export interface Puzzle {
  readonly id: string;
  readonly title: string;
  readonly top: CardId;
  readonly suit: Suit;
  readonly penalty: PendingPenalty | null;
  readonly hand: readonly CardId[];
  readonly why: string;
}

/** The answer is computed from the real rules, so a puzzle can never disagree with the game. */
export function legalCardsFor(puzzle: Puzzle): CardId[] {
  const context: PlayContext = { discardPile: [puzzle.top], currentSuit: puzzle.suit, pendingPenalty: puzzle.penalty };
  return puzzle.hand.filter((card) => (puzzle.penalty ? isPlayableDuringPenalty(card, context) : isNormallyPlayable(card, context)));
}

export function checkAnswer(puzzle: Puzzle, picked: readonly CardId[]): { correct: boolean; missed: CardId[]; wrong: CardId[] } {
  const legal = legalCardsFor(puzzle);
  const missed = legal.filter((card) => !picked.includes(card));
  const wrong = picked.filter((card) => !legal.includes(card));
  return { correct: !missed.length && !wrong.length, missed, wrong };
}

export const puzzles: readonly Puzzle[] = [
  { id: 'p1', title: 'Match the suit or the number', top: '7H', suit: 'H', penalty: null, hand: ['3H', '7C', '9S', 'KD', '2H', '5C'], why: 'Hearts match the suit; the 7 of clubs matches the number. Everything else fails both tests.' },
  { id: 'p2', title: 'The wild ace', top: '4S', suit: 'S', penalty: null, hand: ['AD', '9H', '6S', 'QC', '4D', '10H'], why: 'The ace is wild on any ordinary card. The 6 of spades matches the suit and the 4 of diamonds matches the number.' },
  { id: 'p3', title: 'Facing a two', top: '2D', suit: 'D', penalty: { kind: 'draw-two', cards: 2 }, hand: ['2S', '9D', 'AH', '2C', 'KD', '5D'], why: 'A two is active, so only another two can stop it. Matching the suit or an ace does not help.' },
  { id: 'p4', title: 'Facing a black king', top: 'KS', suit: 'S', penalty: { kind: 'black-king', units: 1, cards: 5 }, hand: ['KC', '2S', 'KH', 'AS', '9S', 'KD'], why: 'You can pass the five on with the black king of clubs, or cancel with a red king. Nothing else counts.' },
  { id: 'p5', title: 'Facing an eight', top: '8C', suit: 'C', penalty: { kind: 'miss-turn' }, hand: ['8H', '9C', 'AC', 'KS', '8D', '3C'], why: 'To avoid missing your turn you must play another eight. Matching the suit is not enough.' },
  { id: 'p6', title: 'Number beats suit', top: '9D', suit: 'D', penalty: null, hand: ['9S', '2D', 'JC', '9C', 'KH', '7S'], why: 'Both nines match the number, and the 2 of diamonds matches the suit.' },
  { id: 'p7', title: 'After an ace, the suit is chosen', top: 'AH', suit: 'C', penalty: null, hand: ['5C', 'AD', '5H', 'QC', '10S', 'JD'], why: 'The ace changed the suit to clubs. Hearts no longer matter; clubs do, and an ace is always wild.' },
  { id: 'p8', title: 'Kings are just cards until a penalty', top: '5H', suit: 'H', penalty: null, hand: ['KD', 'KS', '5C', '2H', '8D', 'AS'], why: 'The 5 of clubs matches the number, the 2 of hearts matches the suit, and the ace is wild. With no penalty active, the kings match nothing here.' },
  { id: 'p9', title: 'Doubling a two', top: '2H', suit: 'H', penalty: { kind: 'draw-two', cards: 2 }, hand: ['2D', '2S', '2C', '9H', 'KC', 'AD'], why: 'Every two stacks, adding two more cards. Only twos are legal here.' },
  { id: 'p10', title: 'A busy hand', top: 'QS', suit: 'S', penalty: null, hand: ['QH', 'JS', '3C', 'AH', '8S', 'QD'], why: 'Queens match the number, spades match the suit, and the ace is wild. Only the 3 of clubs is stuck.' },
  { id: 'p11', title: 'Which one is stuck?', top: '6C', suit: 'C', penalty: null, hand: ['6D', '9C', 'KS', '6H', 'JD', 'QH'], why: 'The sixes match the number and clubs match the suit, so the 9 of clubs is fine. The king of spades, jack of diamonds and queen of hearts do not match.' },
  { id: 'p12', title: 'Facing two black kings', top: 'KC', suit: 'C', penalty: { kind: 'black-king', units: 2, cards: 10 }, hand: ['KS', 'KD', '2C', 'KH', 'AC', '9C'], why: 'Ten cards are on the line. Another black king passes it on, and each red king cancels one black king.' },
];

const KEY = 'switchPuzzles';
export interface PuzzleProgress { solved: string[]; streak: number; best: number }

export function loadProgress(): PuzzleProgress {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (value && Array.isArray(value.solved)) return { solved: value.solved.filter((id: unknown) => typeof id === 'string'), streak: Number(value.streak) || 0, best: Number(value.best) || 0 };
  } catch { /* fall through */ }
  return { solved: [], streak: 0, best: 0 };
}
export function saveProgress(progress: PuzzleProgress): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}
export function recordResult(progress: PuzzleProgress, id: string, correct: boolean): PuzzleProgress {
  const streak = correct ? progress.streak + 1 : 0;
  return { solved: correct && !progress.solved.includes(id) ? [...progress.solved, id] : progress.solved, streak, best: Math.max(progress.best, streak) };
}
export function badgeFor(progress: PuzzleProgress): { name: string; next: string } {
  const solved = progress.solved.length;
  if (solved >= puzzles.length && progress.best >= 5) return { name: 'Rules master', next: 'You have mastered every puzzle.' };
  if (solved >= 9) return { name: 'Card shark', next: 'Solve all 12 and reach a streak of 5 for Rules master.' };
  if (solved >= 5) return { name: 'Dealer', next: 'Solve 9 puzzles for Card shark.' };
  if (solved >= 1) return { name: 'Rookie', next: 'Solve 5 puzzles for Dealer.' };
  return { name: 'New player', next: 'Solve your first puzzle for Rookie.' };
}
