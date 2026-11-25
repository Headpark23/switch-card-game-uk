import { createDeck, rankOf, suitOf } from '../engine/cards';
import { isNormallyPlayable, isPlayableDuringPenalty, type PlayContext } from '../engine/rules';
import type { CardId, PendingPenalty, Suit } from '../engine/types';

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
  { id: 'p4', title: 'Facing a black king', top: 'KS', suit: 'S', penalty: { kind: 'black-king', units: 1, cards: 5 }, hand: ['KC', '2S', 'KH', 'AS', '9S', 'KD'], why: 'You can pass the five on with the black king of clubs, or take the five off with a red king (you pick up nothing). Nothing else counts.' },
  { id: 'p5', title: 'Facing an eight', top: '8C', suit: 'C', penalty: { kind: 'miss-turn' }, hand: ['8H', '9C', 'AC', 'KS', '8D', '3C'], why: 'To avoid missing your turn you must play another eight. Matching the suit is not enough.' },
  { id: 'p6', title: 'Number beats suit', top: '9D', suit: 'D', penalty: null, hand: ['9S', '2D', 'JC', '9C', 'KH', '7S'], why: 'Both nines match the number, and the 2 of diamonds matches the suit.' },
  { id: 'p7', title: 'After an ace, the suit is chosen', top: 'AH', suit: 'C', penalty: null, hand: ['5C', 'AD', '5H', 'QC', '10S', 'JD'], why: 'The ace changed the suit to clubs. Hearts no longer matter; clubs do, and an ace is always wild.' },
  { id: 'p8', title: 'Kings are just cards until a penalty', top: '5H', suit: 'H', penalty: null, hand: ['KD', 'KS', '5C', '2H', '8D', 'AS'], why: 'The 5 of clubs matches the number, the 2 of hearts matches the suit, and the ace is wild. With no penalty active, the kings match nothing here.' },
  { id: 'p9', title: 'Doubling a two', top: '2H', suit: 'H', penalty: { kind: 'draw-two', cards: 2 }, hand: ['2D', '2S', '2C', '9H', 'KC', 'AD'], why: 'Every two stacks, adding two more cards. Only twos are legal here.' },
  { id: 'p10', title: 'A busy hand', top: 'QS', suit: 'S', penalty: null, hand: ['QH', 'JS', '3C', 'AH', '8S', 'QD'], why: 'Queens match the number, spades match the suit, and the ace is wild. Only the 3 of clubs is stuck.' },
  { id: 'p11', title: 'Which one is stuck?', top: '6C', suit: 'C', penalty: null, hand: ['6D', '9C', 'KS', '6H', 'JD', 'QH'], why: 'The sixes match the number and clubs match the suit, so the 9 of clubs is fine. The king of spades, jack of diamonds and queen of hearts do not match.' },
  { id: 'p12', title: 'Facing two black kings', top: 'KC', suit: 'C', penalty: { kind: 'black-king', units: 2, cards: 10 }, hand: ['KS', 'KD', '2C', 'KH', 'AC', '9C'], why: 'Ten cards are on the line. Another black king passes it on, and each red king takes 5 off, but you still pick up what is left.' },
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

/* --------------------------------------------------------------------------
   Daily Hand Puzzle ("Today's Hand"): one fresh, rules-verified hand per day
   -------------------------------------------------------------------------- */
const DAILY_KEY = 'switchDailyPuzzle';
const DAILY_EPOCH_UTC = Date.UTC(2026, 10, 1); // 1 Nov 2026 = Day #1
const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

export interface DailyPuzzle {
  readonly dateKey: string;
  readonly dayNumber: number;
  readonly puzzle: Puzzle;
}

export interface DailyProgress {
  readonly solvedDates: readonly string[];
  readonly lastDate: string | null;
  readonly lastTries: number;
  readonly streak: number;
  readonly best: number;
}

export function dateKeyFor(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic daily hand built from a real shuffled 52-card deck and verified by the rules engine. */
export function dailyPuzzleFor(now: Date = new Date()): DailyPuzzle {
  const dateKey = dateKeyFor(now);
  const utcDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.max(1, Math.floor((utcDay - DAILY_EPOCH_UTC) / 86_400_000) + 1);
  const deck = createDeck().map((c) => c.id);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rand = seededRandom(dayNumber * 7919 + attempt * 1013 + 37);
    const pool = [...deck];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const top = pool[0];
    const hand = pool.slice(1, 7);
    const r = rankOf(top);
    let suit: Suit = suitOf(top);
    let penalty: PendingPenalty | null = null;
    let title = 'Today’s hand';
    let why = 'Match the current suit or the number on top. Aces are wild on ordinary cards.';

    if (r === '2' && rand() < 0.75) {
      penalty = { kind: 'draw-two', cards: rand() < 0.3 ? 4 : 2 };
      title = 'Facing a two';
      why = 'A two penalty is active, so only another two can stack and pass it on.';
    } else if (r === 'K' && (suit === 'S' || suit === 'C') && rand() < 0.8) {
      const units = rand() < 0.25 ? 2 : 1;
      penalty = { kind: 'black-king', units, cards: units === 2 ? 10 : 5 };
      title = units === 2 ? 'Facing two black kings' : 'Facing a black king';
      why = 'A black king passes five more on; a red king takes five off the pile. Nothing else plays.';
    } else if (r === '8' && rand() < 0.75) {
      penalty = { kind: 'miss-turn' };
      title = 'Facing an eight';
      why = 'An eight is active: only another eight can pass the missed turn on.';
    } else if (r === 'A') {
      suit = SUITS[Math.floor(rand() * 4)];
      title = 'After a wild ace';
      why = 'The ace changed the suit in play. Match the chosen suit, or play another ace.';
    }

    const candidate: Puzzle = { id: `daily-${dateKey}`, title, top, suit, penalty, hand, why };
    const legal = legalCardsFor(candidate);
    if (legal.length >= 1 && legal.length <= 4) {
      return { dateKey, dayNumber, puzzle: candidate };
    }
  }

  return { dateKey, dayNumber, puzzle: puzzles[(dayNumber - 1) % puzzles.length] };
}

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DAILY_KEY) ?? 'null');
    if (raw && Array.isArray(raw.solvedDates)) {
      return {
        solvedDates: raw.solvedDates.filter((d: unknown) => typeof d === 'string'),
        lastDate: typeof raw.lastDate === 'string' ? raw.lastDate : null,
        lastTries: Number(raw.lastTries) || 0,
        streak: Number(raw.streak) || 0,
        best: Number(raw.best) || 0,
      };
    }
  } catch { /* fall through */ }
  return { solvedDates: [], lastDate: null, lastTries: 0, streak: 0, best: 0 };
}

export function saveDailyProgress(progress: DailyProgress): void {
  try { window.localStorage.setItem(DAILY_KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}

export function recordDailyResult(progress: DailyProgress, dateKey: string, tries: number, correct: boolean): DailyProgress {
  if (!correct || progress.solvedDates.includes(dateKey)) return progress;
  const yesterday = new Date(`${dateKey}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const streak = progress.lastDate === yKey ? progress.streak + 1 : 1;
  return {
    solvedDates: [...progress.solvedDates.slice(-90), dateKey],
    lastDate: dateKey,
    lastTries: tries,
    streak,
    best: Math.max(progress.best, streak),
  };
}

export function dailyShareText(dayNumber: number, tries: number, streak: number): string {
  const tryLabel = tries === 1 ? '1st try' : `${tries} tries`;
  const streakNote = streak > 1 ? ` · ${streak}-day streak` : '';
  return `Switch Daily #${dayNumber} ♠♥♣♦\nSolved on ${tryLabel}${streakNote}\nhttps://switchcardgame.co.uk`;
}
