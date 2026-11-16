import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, ChatCircleText, CheckCircle, FilmStrip, HandPalm, Lightbulb, SortAscending, Timer } from '@phosphor-icons/react';
import type { ComputerLevel } from '../switch/ai';
import { cardIdLabel } from '../switch/cards';
import { explainUnplayable } from '../switch/coach';
import { applyTableAction, createTable, dealTo, isLegalTablePlay, openingNote, penaliseMissedLastCard, POWER_START_CHANCE, tableLegalMoves, tablePlaces, wentOut, type TableState } from '../switch/table';
import { chooseTableAction } from '../switch/tableAi';
import type { CardId, GameAction, GameState, Suit } from '../switch/types';
import { cue } from '../feedback';
import { logComputerGame } from '../switch/logGame';
import { useTableTelemetry } from '../switch/useTableTelemetry';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { drawTiming, LAST_CARD_GRACE_MS, paceIsHuman, planTurn, REDUCED, SPEED_NAMES, SPEEDS, stepDuration, visibleAt, withThinkingFloor, type Speed, type Step } from '../switch/presentation';
import { clearActiveTable, newTableGameId, readSpeed, saveActiveTable, saveSpeed, type ActiveTable } from '../switch/activeTable';
import { CardImage, CardShower, rank, suit, suitNames, suitSymbols } from '../ui';
import RealCards from './RealCards';
import type { PlayMode } from '../switch/series';
import { sortHand } from '../switch/sortHand';
import { HahaBanner, hahaText, type Haha } from './HahaBanner';
import { attackKind, banterFor, playEvent, reactionOf, type TableEvent } from '../switch/reactions';
import { logReaction, type ReplayMove } from '../switch/gameReplay';
import { GameEnding } from './GameEnding';
import { beginReplay, Bubble, ReactionSheet, useBubbles, useReplayRecorder } from './tableTalk';
import { SuitBadge, TableToggles, useTablePrefs } from './tablePrefs';

import { COMPUTER_NAMES } from '../switch/presentation';
export { COMPUTER_NAMES };
export const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;
const SPEED_ORDER: Speed[] = ['quick', 'natural', 'relaxed'];

/** The deal passes clockwise game after game, so nobody has to remember whose turn it is to deal. */
let lastDealer: number | null = null;
function pickDealer(seats: number): number {
  const dealer = lastDealer === null || lastDealer >= seats ? Math.floor(Math.random() * seats) : (lastDealer + 1) % seats;
  lastDealer = dealer;
  return dealer;
}

function pickups(state: TableState): number {
  return state.pendingPenalty && state.pendingPenalty.kind !== 'miss-turn' ? state.pendingPenalty.cards : 0;
}

/** What a move did, in a few plain words, for the move log. */
export function describe(before: TableState, after: TableState, who: string, action: GameAction): string {
  if (action.type === 'accept-missed-turn') return `${who} miss${who === 'You' ? '' : 'es'} a turn.`;
  if (action.type === 'draw') {
    const count = after.hands[before.turn].length - before.hands[before.turn].length;
    return `${who} pick${who === 'You' ? '' : 's'} up ${count} card${count === 1 ? '' : 's'}.`;
  }
  const cards = action.cards;
  const plays = who === 'You' ? 'play' : 'plays';
  const text = cards.length === 1 ? `${who} ${plays} ${cardIdLabel(cards[0])}` : `${who} ${plays} ${cards.map(cardIdLabel).join(', then ')}`;
  if (rank(cards[0]) === 'A') return `${text}: the suit is ${suitNames[action.chosenSuit ?? suit(cards[cards.length - 1])]}.`;
  // Ruling 19: a seven or jacks as the last cards cannot win. One card comes from the deck and the turn passes.
  if (cards.length === before.hands[before.turn].length && !wentOut(after, before.turn)) {
    return `${text}, but that cannot win the game, so ${who === 'You' ? 'you pick' : `${who} picks`} up one card.`;
  }
  return text + '.';
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

/** One turn being shown: the engine's result is already decided; the steps reveal it in order. */
type Showing = { id: number; before: TableState; after: TableState; action: GameAction; steps: Step[]; at: number; line: string };

/** How long you have to say "Last Card" before a computer spots that you did not: five seconds. */
const callGrace = () => (paceIsHuman() ? LAST_CARD_GRACE_MS : 1600);

/**
 * Now and then a computer forgets to say "Last Card" and is caught, the way people are (owner request, 15 Nov 2026).
 * Easy forgets most, Hard hardly ever. Automated test browsers never forget unless a test sets `switchForgetLastCard` to a chance.
 */
const FORGET_CHANCE: Record<ComputerLevel, number> = { relaxed: 0.15, standard: 0.08, sharp: 0.03 };
function forgetChance(level: ComputerLevel): number {
  try {
    const forced = window.localStorage.getItem('switchForgetLastCard');
    if (forced !== null) return Number(forced) || 0;
  } catch { /* storage blocked: use the normal chance */ }
  return paceIsHuman() ? FORGET_CHANCE[level] ?? 0 : 0;
}

/** When this game is one of a tournament's games, the series screen runs the show: it names the seats and decides what happens next. */
export type SeriesGame = { title: string; seriesId: string; mode: PlayMode; /** League rounds: players leave as they go out and the rest play on until every place is decided (ruling 24). */ playOn?: boolean; onFinished: (table: TableState, gameId: string) => void };

type Props = { opponents: number; level: ComputerLevel; resume?: ActiveTable | null; seatNames?: string[]; series?: SeriesGame; onExit: () => void; onOpenCards: () => void; onStartNight: () => void; onChange: () => void; onReplay?: (gameId: string) => void };

/** Computers keep their banter to one remark every few seconds, however much is happening. */
const BANTER_GAP_MS = 3500;

/** "You" plus `count` computers picked at random from the seven, in a random seating order. */
function randomNames(count: number): string[] {
  const pool = [...COMPUTER_NAMES];
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return ['You', ...pool.slice(0, count)];
}

export default function TableGame({ opponents, level, resume = null, seatNames, series, onExit, onOpenCards, onStartNight, onChange, onReplay }: Props) {
  const seats = opponents + 1;
  // A single game against the computer deals you a random set of opponents; a resumed game keeps the ones it started with.
  const [drawn, setDrawn] = useState<string[]>(() => (resume ? (resume.names && resume.names.length === opponents + 1 ? [...resume.names] : ['You', ...COMPUTER_NAMES.slice(0, opponents)]) : randomNames(opponents)));
  const names = useMemo(() => seatNames ?? drawn, [seatNames, drawn]);
  const [gameId, setGameId] = useState(() => resume?.id ?? newTableGameId());
  const [game, setGame] = useState<TableState>(() => resume?.game ?? createTable(seats, Math.random, pickDealer(seats), { playOn: series?.playOn, powerStartChance: POWER_START_CHANCE }));
  const [showing, setShowing] = useState<Showing | null>(null);
  // The table stays up after the last card so you can see how it ended; this is the game you have read the ending of.
  const [endSeenFor, setEndSeenFor] = useState<string | null>(null);
  const lastPlay = useRef<{ seat: number; cards: CardId[] } | null>(null);
  const [recent, setRecent] = useState<string[]>(() => (resume ? ['Game resumed where you left it.'] : []));
  const [staged, setStaged] = useState<CardId[]>([]);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [warn, setWarn] = useState('');
  const [hint, setHint] = useState(false);
  // "Last Card" is the player's own job: the button is always there, nothing prompts for it, and forgetting costs two cards.
  const [lastCalled, setLastCalledState] = useState(() => resume?.lastCardCalled ?? false);
  const calledRef = useRef(lastCalled);
  /** The computer seat that has just gone down to one card without saying "Last Card". It is caught once its move has been shown. */
  const forgotRef = useRef<number | null>(null);
  /** Whether Last Card had been called at the moment the final card of your hand was selected (ruling 20: it must come first). */
  const calledBeforeFinalRef = useRef(false);
  const setLastCalled = (value: boolean) => { calledRef.current = value; setLastCalledState(value); };
  const [flash, setFlash] = useState<CardId[]>([]);
  const [speed, setSpeedState] = useState<Speed>(readSpeed);
  const timings = useMemo(() => withThinkingFloor(prefersReducedMotion() ? REDUCED : SPEEDS[speed]), [speed]);
  const logged = useRef<string | null>(null);
  // Anonymous counts for the owner's dashboard (who dealt the penalty cards, how the game ended). Never read back by the game.
  const stats = useTableTelemetry(gameId, opponents, level);
  const showId = useRef(0);
  /** Set the moment a move is submitted, so a double tap can never send it twice. Released when the turn has been shown. */
  const busy = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const sectionRef = useRef<HTMLElement>(null);
  const flyRef = useRef<HTMLSpanElement>(null);
  // Table talk: your reactions, the computers' banter, and a recording of the whole game for its replay.
  const [reactOpen, setReactOpen] = useState(false);
  const { bubbles, say } = useBubbles(paceIsHuman() ? 3600 : 1200);
  const prefs = useTablePrefs();
  const [talk, setTalk] = useState<{ seat: number; id: string }[]>([]);
  const computers = useMemo(() => names.map((_, seat) => seat).filter((seat) => seat !== 0), [names]);
  const recorder = useReplayRecorder(gameId, () => beginReplay(gameId, game, names, computers, false));
  const penaltyBy = useRef<number | null>(null);
  const penaltyCard = useRef<'two' | 'blackKing' | 'stack' | undefined>(undefined);
  const queuedBanter = useRef<TableEvent[]>([]);
  const lastBanterAt = useRef(0);

  const shown = showing ? visibleAt(showing.before, showing.after, showing.steps, showing.at) : visibleAt(game, game, [], 0);
  const visible = shown;
  const yourMove = !showing && game.status === 'playing' && game.turn === 0;
  const canAct = yourMove;
  const rawHand = showing && showing.before.turn === 0 && showing.action.type === 'draw' ? showing.before.hands[0] : game.hands[0];
  // Sort is a setting, not a one-off: while it is on, the hand is shown sorted and new cards slot straight in.
  const [sortOn, setSortOn] = useState(false);
  const [haha, setHaha] = useState<Haha>(null);
  const shout = (name: string) => setHaha((current) => ({ id: (current?.id ?? 0) + 1, text: hahaText(name) }));
  const hand = useMemo(() => (sortOn ? sortHand(rawHand) : rawHand), [sortOn, rawHand]);
  const pending = game.pendingPenalty;
  const missTurn = pending?.kind === 'miss-turn';
  const pendingDraw = pickups(game);
  const legal = yourMove ? tableLegalMoves(game, 0) : [];
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = hand.filter(canPlay);
  const places = game.status === 'won' ? tablePlaces(game) : [];
  const youWon = game.winner === 0;
  // A play-on game: once you are out the computers finish the round. Your place is already fixed.
  const youOutAt = game.playOn && game.status === 'playing' ? (game.out ?? []).indexOf(0) + 1 : 0;
  const outAfter = (showing ? showing.before : game).out ?? [];
  const gameOver = game.status === 'won' && !showing;
  // A person gets a proper ending (who won, with what, and what everyone was left holding). Automated runs skip it.
  const showEnding = paceIsHuman() || (() => { try { return window.localStorage.getItem('switchShowEnding') === '1'; } catch { return false; } })();
  const finished = gameOver && (endSeenFor === gameId || !showEnding);
  const ending = gameOver && !finished;

  const push = (line: string) => setRecent((current) => [...current.slice(-3), line]);

  /** Someone at the table says something: the bubble, the replay and the reaction stats all hear it. */
  function speak(seat: number, id: string) {
    if (!reactionOf(id)) return;
    say(seat, id, { priority: seat === 0 });
    setTalk((current) => [...current.slice(-5), { seat, id }]);
    recorder.react({ seat, from: names[seat], id });
    logReaction({ gameId, at: new Date().toISOString(), move: gameRef.current.move, from: names[seat], mine: seat === 0, computer: seat !== 0, online: false, id });
  }

  /** A computer may pass comment on what just happened, as its personality allows and no more than one at a time. */
  function banter(event: TableEvent) {
    const now = Date.now();
    if (now - lastBanterAt.current < BANTER_GAP_MS && event.kind !== 'win') return;
    const remark = banterFor(event, names, computers);
    if (!remark) return;
    lastBanterAt.current = now;
    speak(remark.seat, remark.id);
    // The computer who was just needled may hit back, in its own words, a couple of seconds later.
    const { answer } = remark;
    if (answer) window.setTimeout(() => speak(answer.seat, answer.id), 2600);
  }

  function sayQueued() {
    const events = queuedBanter.current;
    queuedBanter.current = [];
    events.forEach(banter);
  }

  /** What the table saw of a move, for the replay, and anything in it worth a comment. */
  function record(before: TableState, action: GameAction, after: TableState) {
    const seat = before.turn;
    if (action.type === 'play') lastPlay.current = { seat, cards: [...action.cards] };
    const type: ReplayMove['type'] = action.type === 'play' ? 'play' : action.type === 'draw' ? 'draw' : 'miss';
    recorder.move({ seat, type, ...(action.type === 'play' ? { cards: [...action.cards], suit: after.currentSuit } : {}), counts: after.hands.map((cards) => cards.length) });
    const events: TableEvent[] = [];
    // What was played, what it did and who it landed on: the card talk is about the cards.
    if (action.type === 'play') events.push(playEvent(seat, action.cards, before.pendingPenalty, after.pendingPenalty, after.status === 'won' && after.winner === seat, after.status === 'playing' ? after.turn : undefined));
    if (action.type === 'draw' && pickups(before) > 0) events.push({ kind: 'penalty', victim: seat, by: penaltyBy.current, cards: after.hands[seat].length - before.hands[seat].length, card: penaltyCard.current });
    if (action.type === 'play') {
      penaltyCard.current = attackKind(action.cards, before.pendingPenalty, after.pendingPenalty);
      const top = action.cards[action.cards.length - 1];
      penaltyBy.current = rank(top) === '2' || rank(top) === 'K' ? seat : null;
    } else { penaltyBy.current = null; penaltyCard.current = undefined; }
    if (after.status === 'won' && after.winner !== null) events.push({ kind: 'win', winner: after.winner });
    else if (after.status === 'playing' && after.hands[seat].length === 1 && before.hands[seat].length !== 1) events.push({ kind: 'last-card', seat });
    queuedBanter.current.push(...events);
  }

  function show(before: TableState, action: GameAction, after: TableState, think: boolean, missedCall = false) {
    stats.onMove(before, action, after);
    record(before, action, after);
    showId.current += 1;
    const steps = planTurn(before, action, after, names, { think, missedCall });
    let line = describe(before, after, names[before.turn], action);
    if (before.turn !== 0 && after.status === 'playing' && after.hands[before.turn].length === 1 && forgotRef.current !== before.turn) line += ` ${names[before.turn]} says "Last Card".`;
    if (missedCall) line += ' You had not said "Last Card", so you pick up two.';
    setGame(after);
    setShowing({ id: showId.current, before, after, action, steps, at: 0, line });
  }

  // Walks through the steps of the turn being shown, one timer at a time. Leaving the game clears the timer.
  useEffect(() => {
    if (!showing) return;
    if (showing.at >= showing.steps.length) {
      push(showing.line);
      setShowing(null);
      busy.current = false;
      // A computer that went down to one card without saying "Last Card" is caught, and picks up two.
      const forgot = forgotRef.current;
      forgotRef.current = null;
      if (forgot !== null && gameRef.current.status === 'playing' && gameRef.current.hands[forgot]?.length === 1) {
        const caught = dealTo(gameRef.current, forgot, 2);
        shout(names[forgot]);
        cue('penalty');
        push(`${names[forgot]} forgot to say "Last Card" and picks up two cards.`);
        recorder.move({ seat: forgot, type: 'spot', counts: caught.hands.map((cards) => cards.length) });
        queuedBanter.current.push({ kind: 'mistake', seat: forgot, what: 'lastCard' });
        setGame(caught);
      }
      sayQueued();
      return;
    }
    const step = showing.steps[showing.at];
    if (step.kind === 'card' && step.seat !== 0) cue('play');
    const timer = window.setTimeout(() => setShowing((current) => (current && current.id === showing.id ? { ...current, at: current.at + 1 } : current)), stepDuration(step, timings));
    return () => window.clearTimeout(timer);
  }, [showing, timings]);

  // A card in the air travels from the seat that played it to the pile.
  useLayoutEffect(() => {
    const el = flyRef.current;
    const flying = visible.flying;
    if (!el || !flying || timings.flight <= 0) return;
    const origin = sectionRef.current?.querySelector<HTMLElement>(`[data-seat="${flying.seat}"]`);
    if (!origin) return;
    const from = origin.getBoundingClientRect();
    const to = el.getBoundingClientRect();
    const scale = to.width / (el.offsetWidth || 1) || 1;
    const dx = (from.left + from.width / 2 - (to.left + to.width / 2)) / scale;
    const dy = (from.top + from.height / 2 - (to.top + to.height / 2)) / scale;
    const spin = (flying.seat === 0 ? -10 : 12) + (flying.index % 2 ? 5 : -5);
    const animation = el.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${flying.seat === 0 ? 0.85 : 0.5})`, opacity: 0.9 },
      { transform: `rotate(${(flying.index % 3) * 3 - 3}deg) scale(1)`, opacity: 1 },
    ], { duration: timings.flight, easing: 'cubic-bezier(.22,.7,.3,1)', fill: 'both' });
    return () => animation.cancel();
  }, [showing?.id, showing?.at, timings.flight]);

  // Cards slide from the deck to whoever is picking up, one after another. A penalty is slower so it can be followed.
  useLayoutEffect(() => {
    const step = visible.drawing;
    if (!step || timings.flight <= 0) return;
    const section = sectionRef.current;
    const pile = section?.querySelector<HTMLElement>('.draw-pile');
    const target = step.seat === 0 ? section?.querySelector<HTMLElement>('.player-hand') : section?.querySelector<HTMLElement>(`[data-seat="${step.seat}"]`);
    const back = pile?.querySelector('img');
    if (!pile || !target || !back) return;
    const { trip, stagger, shown } = drawTiming(step.count, step.penalty === true, timings);
    const from = pile.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const scale = from.width / (pile.offsetWidth || 1) || 1;
    const dx = (end.left + end.width / 2 - (from.left + from.width / 2)) / scale;
    const dy = (end.top + end.height / 2 - (from.top + from.height / 2)) / scale;
    const fliers: HTMLElement[] = [];
    const animations: Animation[] = [];
    for (let index = 0; index < shown; index += 1) {
      const flier = document.createElement('span');
      flier.className = 'draw-flier';
      flier.setAttribute('aria-hidden', 'true');
      flier.appendChild(back.cloneNode() as HTMLElement);
      pile.appendChild(flier);
      fliers.push(flier);
      animations.push(flier.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(${step.seat === 0 ? 8 : -8}deg) scale(.92)`, opacity: 1, offset: 0.65 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(.7)`, opacity: 0, offset: 1 },
      ], { duration: trip, delay: index * stagger, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'backwards' }));
    }
    return () => { animations.forEach((animation) => animation.cancel()); fliers.forEach((flier) => flier.remove()); };
  }, [showing?.id, showing?.at, timings]);

  // The computers play one after another. Nothing starts while a turn is still being shown. A computer that sees you
  // holding one card without having called "Last Card" gets the chance to spot it, after a fair pause.
  useEffect(() => {
    if (showing || game.status !== 'playing' || game.turn === 0) return;
    const exposed = game.hands[0].length === 1 && !lastCalled;
    const timer = window.setTimeout(() => {
      let before = gameRef.current;
      if (before.status !== 'playing' || before.turn === 0) return;
      // The five seconds you were given to say it also served as the computer's thinking time.
      let spotted = false;
      if (before.hands[0].length === 1 && !calledRef.current) {
        spotted = true;
        shout('You');
        cue('penalty');
        before = dealTo(before, 0, 2);
        setGame(before);
        push(`${names[before.turn]} spotted that you did not say "Last Card". You pick up two cards.`);
        recorder.move({ seat: 0, type: 'spot', counts: before.hands.map((cards) => cards.length) });
        queuedBanter.current.push({ kind: 'spotted', victim: 0, by: before.turn });
      }
      const action = chooseTableAction(before, Math.random, level, { personality: names[before.turn] });
      const result = applyTableAction(before, action);
      const seat = before.turn;
      forgotRef.current = result.status === 'playing' && result.hands[seat].length === 1 && before.hands[seat].length !== 1 && Math.random() < forgetChance(level) ? seat : null;
      show(before, action, result, !spotted);
    }, exposed ? timings.highlight + callGrace() : timings.highlight);
    return () => window.clearTimeout(timer);
  }, [showing, game.status, game.turn, game.move, lastCalled, level, timings]);

  // An unfinished game is kept so it can be resumed; a finished one is logged once, under its own id, and forgotten.
  useEffect(() => {
    // A game inside a tournament is never saved for resuming; the tournament screen owns what happens next.
    if (game.status === 'playing') { if (!series) saveActiveTable({ id: gameId, opponents, level, game, names: drawn, awaitingLastCard: false, lastCardCalled: lastCalled }); return; }
    if (logged.current === gameId) return;
    logged.current = gameId;
    recorder.finish(game.winner);
    // Every game counts: your place in this one is logged under its game type, whatever the tournament does with it.
    logComputerGame({ id: gameId, opponents, level, won: game.winner === 0, place: tablePlaces(game)[0], moves: game.move, rivals: names.slice(1).map((name, index) => ({ name, place: tablePlaces(game)[index + 1] })), ...(series ? { mode: series.mode, seriesId: series.seriesId } : {}) });
    stats.onFinish({ won: game.winner === 0, place: tablePlaces(game)[0], moves: game.move });
    if (!series) clearActiveTable();
  }, [game, lastCalled, gameId, opponents, level]);

  useEffect(() => { if (gameOver) cue(youWon ? 'win' : 'bad'); }, [gameOver, youWon]);

  function refuse(cards: CardId[], reason: string) {
    cue('bad');
    // Someone at the table notices you trying a card that cannot be played.
    if (!busy.current) banter({ kind: 'mistake', seat: 0, what: 'illegal' });
    setFlash(cards);
    setWarn(reason);
    window.setTimeout(() => setFlash((current) => (current === cards ? [] : current)), 1100);
    window.setTimeout(() => setWarn((current) => (current === reason ? '' : current)), 6000);
  }

  const projection = (): GameState => ({
    playerHand: hand, computerHand: game.hands[1] ?? [], drawPile: game.drawPile, discardPile: game.discardPile, currentSuit: game.currentSuit,
    turn: 'player', pendingPenalty: game.pendingPenalty, status: 'playing', winner: null, move: game.move,
  });

  function chooseCard(card: CardId) {
    if (!canAct || busy.current) return;
    setWarn('');
    if (staged.includes(card)) { setStaged((current) => current.filter((item) => item !== card)); return; }
    if (!staged.length) {
      if (!canPlay(card)) { refuse([card], explainUnplayable(card, projection())); return; }
      calledBeforeFinalRef.current = hand.length === 1 && calledRef.current;
      setStaged([card]);
      return;
    }
    if (rank(card) !== rank(staged[0])) { refuse([card], `Cards played together must be the same number or picture, so the ${cardIdLabel(card)} cannot join.`); return; }
    // Selecting the final card of your hand: "Last Card" has to have been said before this tap, not after.
    if (staged.length + 1 === hand.length) calledBeforeFinalRef.current = calledRef.current;
    setStaged((current) => [...current, card]);
  }

  function commit(cards: CardId[], chosenSuit?: Suit) {
    const before = gameRef.current;
    if (busy.current || before.status !== 'playing' || before.turn !== 0) return;
    const action: GameAction = { type: 'play', cards, ...(chosenSuit ? { chosenSuit } : {}) };
    if (!isLegalTablePlay(before, action)) return;
    busy.current = true;
    cue('play');
    let after = applyTableAction(before, action);
    // Playing out your last cards (two tens to win, or a seven that cannot) needs "Last Card" first.
    const emptied = cards.length === before.hands[0].length;
    const missed = emptied && !calledBeforeFinalRef.current;
    if (missed) { cue('penalty'); shout('You'); after = penaliseMissedLastCard(after, 0); }
    // The call is used up by an emptied hand (a pickup means saying it again) and by any play that leaves two or more.
    if (emptied || after.hands[0].length > 1) setLastCalled(false);
    show(before, action, after, false, missed);
    setStaged([]);
    setHint(false);
  }

  function playStaged() {
    if (!staged.length || busy.current) return;
    // An ace played as your last card keeps its own suit (ruling 34), so there is nothing to choose.
    if (rank(staged[0]) === 'A' && staged.length < hand.length) { setAceChoice(staged); return; }
    if (!isLegalTablePlay(game, { type: 'play', cards: staged })) {
      refuse([...staged], 'Those cards cannot be played in that order. Try a different order, or play fewer cards.');
      return;
    }
    commit(staged);
  }

  function pickUp() {
    const before = gameRef.current;
    if (!canAct || busy.current || before.turn !== 0) return;
    busy.current = true;
    cue(pendingDraw ? 'penalty' : 'draw');
    const action: GameAction = missTurn ? { type: 'accept-missed-turn' } : { type: 'draw' };
    show(before, action, applyTableAction(before, action), false);
    setStaged([]);
    setHint(false);
    setLastCalled(false);
  }

  function callLastCard() {
    if (game.status !== 'playing' || lastCalled) return;
    cue('good');
    setLastCalled(true);
    // Ruling 26 (amended): with a single card left, that card is both the first and the final card, so a call made
    // while it is selected, before Play is pressed, still counts.
    if (hand.length === 1) calledBeforeFinalRef.current = true;
  }

  function again() {
    busy.current = false;
    setShowing(null);
    setRecent([]); setStaged([]); setAceChoice(null); setHint(false); setLastCalled(false); setTalk([]);
    penaltyBy.current = null; penaltyCard.current = undefined; queuedBanter.current = [];
    setGameId(newTableGameId());
    if (!seatNames) setDrawn(randomNames(opponents));
    setGame(createTable(seats, Math.random, pickDealer(seats), { playOn: series?.playOn, powerStartChance: POWER_START_CHANCE }));
  }

  /** You are out and only the computers are left: play the rest of the round out in an instant. */
  function skipToResult() {
    let table = gameRef.current;
    for (let guard = 0; guard < 3000 && table.status === 'playing'; guard += 1) {
      const action = chooseTableAction(table, Math.random, level, { personality: names[table.turn] });
      const after = applyTableAction(table, action);
      record(table, action, after);
      table = after;
    }
    // Only the last word is worth saying when the rest of the round was played in an instant.
    queuedBanter.current = queuedBanter.current.filter((event) => event.kind === 'win');
    sayQueued();
    if (table.status === 'playing') return;
    busy.current = false;
    setShowing(null);
    setGame(table);
  }

  function cycleSpeed() {
    const next = SPEED_ORDER[(SPEED_ORDER.indexOf(speed) + 1) % SPEED_ORDER.length];
    saveSpeed(next);
    setSpeedState(next);
  }

  const hintText = pending?.kind === 'draw-two' ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.`
    : pending?.kind === 'black-king' ? `Play another black king, or a red king to cancel 5, or pick up ${pendingDraw}.`
    : missTurn ? 'Play another eight to pass the missed turn, or accept it.'
    : legalCards.length ? `You can play ${legalCards.map(cardIdLabel).join(', ')}. You may also pick up one card instead.` : 'You have no legal card. Pick up one card.';

  if (ending) return <GameEnding game={game} names={names} played={lastPlay.current && lastPlay.current.seat === (game.winner ?? 0) ? lastPlay.current.cards : undefined} onContinue={() => setEndSeenFor(gameId)} />;

  if (finished && series) {
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${gameId}` : null} />
      <div className="completion">
        <CheckCircle size={56} weight="light" />
        <h1>{youWon ? <>You won<br />this game.</> : <>{names[game.winner ?? 0]} won<br />this game.</>}</h1>
        <p>{series.title}. {game.playOn ? `You finished ${ordinal(places[0])} of ${seats}.` : `You finished ${ordinal(places[0])} of ${seats} with ${hand.length} card${hand.length === 1 ? '' : 's'} left.`}</p>
        <ol className="place-list" aria-label="Places in this game">{[...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b).map((seat) => <li key={seat} className={seat === 0 ? 'me' : ''}><b>{ordinal(places[seat])}</b><span>{names[seat]}</span><em>{game.hands[seat].length === 0 ? 'Out' : `${game.hands[seat].length} left`}</em></li>)}</ol>
        <TalkStrip talk={talk} names={names} />
        <button className="primary" data-testid="series-continue" onClick={() => series.onFinished(game, gameId)}>Continue <ArrowRight size={18} /></button>
      </div>
    </section>;
  }

  if (finished) {
    const record = (() => { const club = readClub(); const mine = getComputerGames(club).filter((entry) => entry.playerId === getMeId(club)); return summariseComputerGames(mine); })();
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${gameId}` : null} />
      <div className="completion">
        <CheckCircle size={60} weight="light" />
        <h1>{youWon ? <>You won the<br />table.</> : <>{names[game.winner ?? 0]} won<br />this one.</>}</h1>
        <p>{youWon ? `You beat ${opponents === 1 ? 'the computer' : `${opponents} computers`}.` : `You finished ${ordinal(places[0])} of ${seats} with ${hand.length} card${hand.length === 1 ? '' : 's'} left.`}</p>
        <ol className="place-list" aria-label="Final places">{[...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b).map((seat) => <li key={seat} className={seat === 0 ? 'me' : ''}><b>{ordinal(places[seat])}</b><span>{names[seat]}</span><em>{game.hands[seat].length === 0 ? 'Out' : `${game.hands[seat].length} left`}</em></li>)}</ol>
        {record.games > 0 && <p className="record-line" role="status">Logged. Against the computer you have won {record.wins} of {record.games} ({Math.round(record.winRate * 100)}%).</p>}
        <TalkStrip talk={talk} names={names} />
        <button className="primary" onClick={again}><ArrowCounterClockwise size={18} />Deal again</button>
        {onReplay && <button className="secondary" onClick={() => onReplay(gameId)} data-testid="watch-replay"><FilmStrip size={18} />Watch the replay</button>}
        <button className="secondary" onClick={onChange}>Change the table</button>
        <RealCards onStartNight={onStartNight} />
        <button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button>
      </div>
    </section>;
  }

  /** Both sit directly above the hand, where the hint buttons were, so the cards stay in view and the choice is next to them. */
  const MULTI_ACTION = <div className="multi-action"><p><b>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected`}</b>{staged.length > 1 && <small>They land in the order you tapped them, and the last one sets the suit.</small>}</p><button className="primary" onClick={playStaged} disabled={!canAct}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>;
  const SUIT_CHOOSER = <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice!; setAceChoice(null); commit(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>;

  const activeName = names[visible.active];
  const status = yourMove ? 'YOUR MOVE' : visible.thinking ? `${activeName.toUpperCase()} IS CHOOSING` : visible.active === 0 ? 'YOU PLAY' : `${activeName.toUpperCase()} TO PLAY`;
  const pile = visible.discardPile.slice(-3);
  const drawingNow = visible.drawing;
  const drawingTiming = drawTiming(drawingNow?.count ?? 0, drawingNow?.penalty === true, timings);
  const ouchFor = (seat: number) => drawingNow?.ouch && drawingNow.seat === seat
    ? <span key={`ouch-${showing?.id}`} className="ouch" aria-hidden="true" data-testid="ouch" style={{ animationDelay: `${Math.round(drawingTiming.trip)}ms` }}>Ouch!</span> : null;
  // The description of a move holds steady while the move is shown and stays up while the next player thinks.
  const lastLine = recent[recent.length - 1];
  const notice = warn || (!prefs.moves ? '' : visible.announce ? visible.announce.text + '.'
    : visible.thinking ? (lastLine ?? `${activeName} is choosing a move…`)
    : (visible.flying || visible.drawing) && showing ? showing.line
    : yourMove ? (recent.length === 0 ? (openingNote(game, names) ?? `${names[game.dealer]} dealt.`) + (game.turn === game.dealer ? " You play." : " You play first.") : recent[recent.length - 1]) : recent[recent.length - 1] ?? openingNote(game, names) ?? `${names[game.dealer]} dealt.`);

  return <section ref={sectionRef} className="tutorial game-tutorial table-game" aria-label={series ? series.title : `Game against ${opponents === 1 ? 'the computer' : `${opponents} computers`}`} data-active-seat={visible.active} data-showing={showing ? 'yes' : 'no'}>
    <HahaBanner haha={haha} />
    <div className={'turn-banner ' + (visible.active === 0 ? 'you' : 'computer')}>
      <span className="turn-dot" aria-hidden="true" />
      <span className="turn-status" aria-live="polite" data-testid="turn-status">{status}</span>
      <em className="dealer-chip" aria-label={`Dealer: ${names[game.dealer]}`}>Dealer · {names[game.dealer]}</em>
      <TableToggles prefs={prefs} />
      <button onClick={onExit}>Exit</button>
    </div>
    {series &&<p className="series-strip" data-testid="series-strip">{series.title}</p>}
    <div className={`seat-row seats-${opponents}${opponents > 4 ? ' many' : ''}`} role="list" aria-label="Players at the table">
      {names.slice(1).map((name, index) => {
        const seat = index + 1;
        const count = visible.handCounts[seat];
        const active = visible.active === seat;
        return <div role="listitem" key={name} data-seat={seat} className={'seat' + (active ? ' turn' : '') + (game.dealer === seat ? ' dealer' : '')} aria-label={`${name} has ${count} card${count === 1 ? '' : 's'}${game.dealer === seat ? ', dealer' : ''}${active ? ', playing now' : ''}`}>
          <span className="seat-name">{name}{game.dealer === seat && <i className="dealer-pip" title="Dealer">D</i>}</span>
          <span className="seat-fan" aria-hidden="true">{Array.from({ length: Math.min(5, count) }, (_, i) => <CardImage code="back" key={i} />)}</span>
          <strong className={count === 1 ? 'last' : ''}>{outAfter.includes(seat) ? 'Out' : `${count} card${count === 1 ? '' : 's'}`}</strong>{ouchFor(seat)}
          <span className="seat-state" aria-hidden="true">{outAfter.includes(seat) ? `Out: ${ordinal(outAfter.indexOf(seat) + 1)}` : active ? (visible.thinking ? <><i className="think-dots"><b /><b /><b /></i>Choosing</> : 'Playing') : count === 1 ? 'Last card' : ' '}</span>
          {prefs.talk && bubbles[seat] && <Bubble key={bubbles[seat].n} n={bubbles[seat].n} id={bubbles[seat].id} name={name} leaving={bubbles[seat].leaving} />}
        </div>;
      })}
    </div>
    <div className="game-table">
      <button className="draw-pile" onClick={pickUp} disabled={!canAct || !!staged.length || missTurn} aria-label={missTurn ? 'Pick up unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Pick up a card'}><CardImage code="back" />{drawingNow?.penalty && <span key={`count-${showing?.id}`} className="draw-count" aria-hidden="true" data-testid="draw-count" style={{ animationDuration: `${drawingTiming.total}ms` }}>+{drawingNow.count}</span>}<span>{!yourMove ? 'Deck' : missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : 'Pick up'}</span></button>
      <div className="discard-pile">
        <span className="pile-wrap" data-testid="discard-pile" data-top={pile[pile.length - 1]} data-order={visible.discardPile.slice(-6).join(' ')}>
          {pile.map((card, index) => <span key={card} className={'pile-card depth-' + (pile.length - 1 - index)}><CardImage code={card} /></span>)}
          {visible.flying && <span ref={flyRef} key={`fly-${showing?.id}-${visible.flying.index}`} className="pile-card flying" data-testid="flying-card" data-card={visible.flying.card}><CardImage code={visible.flying.card} /></span>}
        </span>
        <SuitBadge suit={visible.currentSuit} aceKey={visible.announce?.text.startsWith('Ace:') ? `${showing?.id}` : null} />
        {seats > 2 && <span className="direction" aria-label={`Play goes ${visible.direction === 1 ? 'clockwise' : 'anticlockwise'}`}>{visible.direction === 1 ? <ArrowClockwise size={14} weight="bold" /> : <ArrowCounterClockwise size={14} weight="bold" />}{visible.direction === 1 ? 'Clockwise' : 'Anticlockwise'}</span>}
      </div>
      {prefs.moves && visible.announce && <div key={`${showing?.id}-${showing?.at}`} className={'table-announce ' + visible.announce.tone} data-testid="table-announce" aria-hidden="true">{visible.announce.text}</div>}
    </div>
    <p className={'game-notice' + (warn && yourMove ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{notice}</p>
    {prefs.moves && recent.length > 1 && <ul className="move-log" aria-label="Recent moves">{recent.slice(0, -1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
    <div className={'your-seat' + (visible.active === 0 ? ' turn' : '')} data-seat="0">
      {ouchFor(0)}
      {prefs.talk && bubbles[0] && <Bubble key={bubbles[0].n} n={bubbles[0].n} id={bubbles[0].id} name="You" leaving={bubbles[0].leaving} />}
      {yourMove && <span className="your-move-tag" aria-hidden="true">Your move</span>}
      {yourMove && missTurn && <div className="miss-turn-action"><strong>An eight was played</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you miss this turn.'}</p><button className="primary" onClick={pickUp}>Accept missed turn <ArrowRight size={18} /></button></div>}
      {youOutAt > 0 && <div className="out-panel" role="status" data-testid="you-are-out"><strong>You are out: {ordinal(youOutAt)} place.</strong><p>The others play on for the places still to be decided.</p><button className="secondary" onClick={skipToResult}>Skip to the result <ArrowRight size={18} /></button></div>}
      {youOutAt === 0 && <>
          {staged.length === 0 ? <div className="game-actions"><button className={'hint-button ' + (hint ? 'active' : '')} onClick={() => setHint((current) => !current)} disabled={!canAct}><Lightbulb size={19} weight={hint ? 'fill' : 'regular'} />{hint ? 'Hide hint' : 'Show hint'}</button><button className="pace-button" onClick={cycleSpeed} aria-label={`Computer pace: ${SPEED_NAMES[speed]}. Tap to change`}><Timer size={16} />{SPEED_NAMES[speed]}</button><button className="pace-button sort-button" onClick={() => setSortOn((on) => !on)} aria-pressed={sortOn}><SortAscending size={16} weight={sortOn ? 'fill' : 'regular'} />{sortOn ? 'Sorted' : 'Sort'}</button></div> : aceChoice ? SUIT_CHOOSER : MULTI_ACTION}
          {hint && yourMove && <p className="game-hint"><Lightbulb size={17} />{hintText}</p>}
          <div className="hand-row"><span>{hand.length} in hand</span><button className="pace-button react-button" onClick={() => setReactOpen(true)} aria-label="Send a reaction" data-testid="react-button"><ChatCircleText size={17} />React</button><button className={'last-card-button' + (lastCalled ? ' called' : hand.length > 3 ? ' idle' : ' due')} onClick={callLastCard} aria-pressed={lastCalled} data-testid="last-card-button" aria-label={lastCalled ? 'Last Card called' : 'Call Last Card'}><HandPalm size={20} weight={lastCalled ? 'fill' : 'regular'} /><span>{lastCalled ? 'Called' : 'Last Card'}</span></button></div>
          <div className={'player-hand' + (hand.length > 10 ? ' dense' : '') + (hand.length > 5 ? ' two-rows' : '')} style={{ '--n': hand.length, '--per': Math.ceil(hand.length / 2) } as CSSProperties} aria-label="Your hand">
            {hand.map((card, index) => <button key={card} style={{ '--i': 0, zIndex: index + 1 } as CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={(hint && yourMove && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!canAct} aria-label={staged.includes(card) ? `Deselect ${cardIdLabel(card)}` : `Select ${cardIdLabel(card)}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}
          </div>
        </>}
    </div>
    <ReactionSheet open={reactOpen} onOpenChange={setReactOpen} description="The computers hear it, and some of them answer back." onPick={(id) => {
      setReactOpen(false);
      speak(0, id);
      // A computer may answer back once the table is quiet.
      queuedBanter.current.push({ kind: 'reply', to: 0 });
      lastBanterAt.current = 0;
      window.setTimeout(() => { if (!busy.current) sayQueued(); }, paceIsHuman() ? 1400 : 200);
    }} />
  </section>;
}

/** The last few remarks of the game, under the result. */
function TalkStrip({ talk, names }: { talk: readonly { seat: number; id: string }[]; names: readonly string[] }) {
  if (!talk.length) return null;
  return <ul className="talk-strip" aria-label="Table talk">{talk.slice(-3).map((entry, index) => <li key={index}><b>{names[entry.seat]}</b><span>{reactionOf(entry.id)?.text}</span></li>)}</ul>;
}
