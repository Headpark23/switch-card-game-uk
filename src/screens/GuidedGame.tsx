import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, CheckCircle, HandPalm, Lightbulb } from '@phosphor-icons/react';
import { chooseComputerAction, type ComputerLevel } from '../switch/ai';

/** How long one card takes to travel, and the gap between cards of a set. Slow enough to follow by eye. */
const FLIGHT_MS = 1300;
const FLIGHT_GAP_MS = 550;
type Flight = { cards: CardId[]; from: 'you' | 'computer'; origins: { x: number; y: number }[]; at: number; consumed: boolean };
let lastComputerPlay: CardId[] = [];

const LEVELS: ComputerLevel[] = ['relaxed', 'standard', 'sharp'];
const LEVEL_NOTE: Record<ComputerLevel, string> = { relaxed: 'makes friendly mistakes', standard: 'plays sensibly', sharp: 'plays to beat you' };
function readLevel(): ComputerLevel { try { const v = localStorage.getItem('switchComputerLevel'); return LEVELS.includes(v as ComputerLevel) ? v as ComputerLevel : 'standard'; } catch { return 'standard'; } }
let computerLevel: ComputerLevel = readLevel();
import { cardIdLabel } from '../switch/cards';
import { applyAction, createInitialGame, drawCards, legalMoves, isLegalPlay } from '../switch/rules';
import type { CardId, GameState, Suit } from '../switch/types';
import { explainEffect, explainOptions, explainPickup, explainUnplayable } from '../switch/coach';
import { adviseMove } from '../switch/tactics';
import { explainLesson, explainPickupLesson, explainStart, type Lesson } from '../switch/lessons';
import { cue, feedbackEnabled, setFeedbackEnabled } from '../feedback';
import RealCards from './RealCards';
import { ShareButton } from '../ShareButton';
import { challengeShareCard } from '../switch/club';
import { CardImage, CardShower, CoachPanel, isRedKing, rank, suit, suitNames, suitSymbols } from '../ui';
import { testDeckRequested, testGameFromUrl } from './devDecks';
import { logComputerGame } from '../switch/logGame';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';

const YOUR_TURN_NOTICE = 'Your turn. Play a legal card, or pick up one to save your cards for later.';

type View = {
  engine: GameState;
  notice: string;
  /** Plain-English explanation of the last move. */
  meaning: string | null;
  /** The full teaching card for the last move. */
  lesson: Lesson | null;
  hint: boolean;
  /** You are down to one card and have not yet said (or skipped) "Last Card". */
  awaitingLastCard: boolean;
  /** Who dealt this game. The other player goes first. */
  dealer: 'you' | 'computer';
};

/** The deal alternates game after game, so nobody has to remember whose turn it is to deal. */
let lastDealer: 'you' | 'computer' | null = null;

const GUIDE_KEY = 'switchGuidance';

/** The opening lesson is always shown; full turn-by-turn coaching is opt-in. */
function guidanceDefault(): boolean {
  const requested = new URLSearchParams(window.location.search).get('guide');
  if (requested !== null) return requested === '1';
  try { return window.localStorage.getItem(GUIDE_KEY) === 'on'; } catch { return false; }
}

function openingView(): View {
  const fixed = import.meta.env.DEV ? testGameFromUrl() : null;
  const dealer: 'you' | 'computer' = fixed ? (fixed.turn === 'player' ? 'computer' : 'you') : lastDealer ? (lastDealer === 'you' ? 'computer' : 'you') : Math.random() < 0.5 ? 'you' : 'computer';
  lastDealer = dealer;
  const engine = fixed ?? createInitialGame(Math.random, dealer === 'you' ? 'computer' : 'player');
  return {
    engine,
    dealer,
    notice: (dealer === 'you' ? 'You dealt. ' : 'The computer dealt. ') + (engine.turn === 'player' ? YOUR_TURN_NOTICE : 'The computer goes first.'),
    meaning: null,
    lesson: explainStart(engine, engine.turn === 'player' ? 'you' : 'computer'),
    hint: false,
    awaitingLastCard: false,
  };
}

function describePlay(before: GameState, after: GameState, cards: readonly CardId[], actor: 'you' | 'computer', aceSuit?: Suit) {
  const who = actor === 'you' ? 'You' : 'Computer';
  const cardRank = rank(cards[0]);
  let notice = cards.length === 1 ? `${who} played ${cards[0]}.` : `${who} played ${cards.length} ${cardRank}s together.`;
  const wasKing = before.pendingPenalty?.kind === 'black-king';
  if (after.pendingPenalty?.kind === 'draw-two') notice += ` ${after.pendingPenalty.cards} cards are now at stake.`;
  else if (after.pendingPenalty?.kind === 'black-king') {
    notice += wasKing && cards.some(isRedKing)
      ? ` A red king cancels 5; ${after.pendingPenalty.cards} cards are still at stake.`
      : ` ${after.pendingPenalty.cards} cards are now at stake.`;
  } else if (wasKing && cards.some(isRedKing)) notice += ' The red king cancels the penalty.';
  else if (cardRank === '8') notice += ' An eight can pass the skipped turn.';
  else if (cardRank === '7') notice += ' A seven means play again.';
  else if (cardRank === 'J') notice += cards.length % 2 ? ' The reverse sends play back to the same player.' : ' The even number of reverses keeps play moving.';
  else if (cardRank === 'A') notice += ` The suit is now ${suitNames[aceSuit || suit(cards[cards.length - 1])]}.`;
  return notice;
}

function penaltyCards(state: GameState) {
  return state.pendingPenalty && state.pendingPenalty.kind !== 'miss-turn' ? state.pendingPenalty.cards : 0;
}

function computerStep(view: View): View {
  const { engine } = view;
  if (engine.status !== 'playing' || engine.turn !== 'computer') return view;

  const action = chooseComputerAction(engine, Math.random, computerLevel);
  const next = applyAction(engine, action);

  if (action.type === 'play') {
    lastComputerPlay = [...action.cards];
    if (next.status === 'won') {
      return { ...view, engine: next, hint: false, meaning: null, lesson: null, notice: 'The computer played its last card. Try another game and use the hints when you need them.' };
    }
    let notice = describePlay(engine, next, action.cards, 'computer', action.chosenSuit);
    let meaning = explainEffect(engine, next, action.cards, 'computer', action.chosenSuit);
    if (engine.pendingPenalty?.kind === 'miss-turn' && next.pendingPenalty?.kind === 'miss-turn') {
      notice = `The computer had an eight (${action.cards[0]}), so it passes the missed turn back to you. Counter with an eight of your own, or miss your turn.`;
      meaning = 'It answered your eight with one of its own. That is allowed, and the missed turn is now yours.';
    }
    if (next.computerHand.length === 1) notice += ' Computer says “Last Card”.';
    return { ...view, engine: next, notice, meaning, lesson: explainLesson(engine, next, action.cards, 'computer', action.chosenSuit), hint: false };
  }

  if (action.type === 'accept-missed-turn') {
    return { ...view, engine: next, hint: false, lesson: explainPickupLesson(engine, 'computer', 0), meaning: 'It had no eight to pass the missed turn on, so you play again.', notice: 'The computer cannot counter the eight and misses its turn.' };
  }
  const count = penaltyCards(engine) || 1;
  return { ...view, engine: next, hint: false, lesson: explainPickupLesson(engine, 'computer', count), meaning: explainPickup(engine, 'computer', count), notice: `The computer picks up ${count} card${count === 1 ? '' : 's'}. Your turn.` };
}

type Props = {
  onExit: () => void;
  onOpenCards: () => void;
  onStartNight: () => void;
  onOpenPuzzles: () => void;
  /** Lets the page reset its scroll position when the game ends. */
  onStatusChange: (status: 'playing' | 'won' | 'lost') => void;
};

export default function GuidedGame({ onExit, onOpenCards, onStartNight, onOpenPuzzles, onStatusChange }: Props) {
  const [soundOn, setSoundOn] = useState(feedbackEnabled);
  const [level, setLevel] = useState<ComputerLevel>(() => { computerLevel = readLevel(); return computerLevel; });
  const [view, setView] = useState<View>(openingView);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [staged, setStaged] = useState<CardId[]>([]);
  const [flash, setFlash] = useState<CardId[]>([]);
  const [warn, setWarn] = useState('');
  const flight = useRef<Flight | null>(null);
  const pileRef = useRef<HTMLSpanElement | null>(null);
  const layerRef = useRef<HTMLSpanElement | null>(null);
  const fanRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const [guide, setGuide] = useState(guidanceDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const shown = useRef<Lesson | null>(null);
  // Who made the last move, so the card can fly in from the right place.
  const previous = useRef<GameState | null>(null);
  const lastMover = useRef<'deal' | 'you' | 'computer'>('deal');
  const { engine, awaitingLastCard } = view;

  const mover: 'deal' | 'you' | 'computer' = previous.current && previous.current.move !== view.engine.move
    ? (previous.current.turn === 'player' ? 'you' : 'computer')
    : lastMover.current;
  useEffect(() => { lastMover.current = mover; previous.current = view.engine; });

  const outcome: 'playing' | 'won' | 'lost' = engine.status === 'playing' ? 'playing' : engine.winner === 'player' ? 'won' : 'lost';
  const yourTurn = awaitingLastCard || engine.turn === 'player';
  const advice = useMemo(() => (engine.status === 'playing' && engine.turn === 'player' && !awaitingLastCard ? adviseMove(engine) : null), [engine, awaitingLastCard]);
  // The pick stays hidden until asked for: Show hint, automatic guidance, or opening the coach this turn.
  const [pickSeenAt, setPickSeenAt] = useState(-1);
  useEffect(() => { if (sheetOpen) setPickSeenAt(engine.move); }, [sheetOpen, engine.move]);
  const pickShown = view.hint || guide || pickSeenAt === engine.move;
  const pending = engine.pendingPenalty;
  const pendingDraw = penaltyCards(engine);

  useEffect(() => onStatusChange(outcome), [outcome, onStatusChange]);
  // Every finished game goes in the log, so practice shows up in stats, streaks and badges.
  const logged = useRef(false);
  useEffect(() => {
    if (outcome === 'playing' || logged.current) return;
    logged.current = true;
    logComputerGame({ opponents: 1, level, won: outcome === 'won', place: outcome === 'won' ? 1 : 2, moves: engine.move });
  }, [outcome, level, engine.move]);
  useEffect(() => { if (outcome === 'won') cue('win'); else if (outcome === 'lost') cue('bad'); }, [outcome]);

  useLayoutEffect(() => {
    const reset = () => {
      const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
      if (screen) screen.scrollTop = 0;
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [engine.move, outcome, aceChoice]);

  // Coaching never covers the table by itself: the quiet strip is always there, and a full card opens only when the player turns guidance on or taps the strip.
  useEffect(() => {
    if (!guide || outcome !== 'playing' || awaitingLastCard || !view.lesson || shown.current === view.lesson) return;
    shown.current = view.lesson;
    setSheetOpen(true);
  }, [guide, outcome, awaitingLastCard, view.lesson]);

  useEffect(() => {
    if (outcome !== 'playing' || awaitingLastCard || engine.turn !== 'computer' || sheetOpen) return;
    const pending = flight.current && !flight.current.consumed ? 0 : flight.current ? Math.max(0, flight.current.at + (flight.current.cards.length - 1) * FLIGHT_GAP_MS + FLIGHT_MS - Date.now()) : 0;
    const timer = setTimeout(() => {
      const next = computerStep(viewRef.current);
      if (lastComputerPlay.length) { noteFlight(lastComputerPlay, 'computer'); lastComputerPlay = []; }
      else if (next.engine.computerHand.length > viewRef.current.engine.computerHand.length) flyDraw(next.engine.computerHand.length - viewRef.current.engine.computerHand.length, 'computer');
      setView(next);
    }, 900 + pending);
    return () => clearTimeout(timer);
  }, [outcome, awaitingLastCard, engine.turn, engine.move, sheetOpen]);

  useLayoutEffect(() => {
    const trip = flight.current;
    const top = pileRef.current;
    if (!trip || trip.consumed || !top || Date.now() - trip.at > 4000) return;
    if (engine.discardPile[engine.discardPile.length - 1] !== trip.cards[trip.cards.length - 1]) return;
    trip.consumed = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const fly = (el: HTMLElement, index: number, last: boolean) => {
      const box = el.getBoundingClientRect();
      const scale = box.width / (el.offsetWidth || 1) || 1;
      const dx = (trip.origins[index].x - (box.left + box.width / 2)) / scale;
      const dy = (trip.origins[index].y - (box.top + box.height / 2)) / scale;
      const small = trip.from === 'computer' ? 0.42 : 0.78;
      const spin = (trip.from === 'computer' ? 14 : -14) + (index % 2 ? 6 : -6);
      const anim = el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${small})`, opacity: 0.95, offset: 0 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) rotate(${spin * 0.3}deg) scale(${(small + 1.15) / 2})`, opacity: 1, offset: 0.55 },
        { transform: 'translate(0, 0) rotate(-3deg) scale(1)', opacity: 1, offset: 1 },
      ], { duration: FLIGHT_MS, delay: index * FLIGHT_GAP_MS, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'backwards' });
      if (!last) anim.onfinish = () => { el.style.display = 'none'; };
    };
    const layer = layerRef.current;
    const extra = layer ? Array.from(layer.children) as HTMLElement[] : [];
    extra.forEach((el, index) => fly(el, index, false));
    fly(top, trip.cards.length - 1, true);
  }, [engine.move, engine.discardPile]);

  function toggleGuide() {
    const next = !guide;
    setGuide(next);
    if (!next) setSheetOpen(false);
    try { window.localStorage.setItem(GUIDE_KEY, next ? 'on' : 'off'); } catch { /* the choice lasts for this game only */ }
  }

  const legal = legalMoves(engine);
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = engine.playerHand.filter(canPlay);

  function matchingCardLabel(card: CardId): string {
    const label = cardIdLabel(card);
    if (staged.includes(card)) return `Deselect ${label}, number ${staged.indexOf(card) + 1} in your play`;
    if (!staged.length) return `Select ${label}${canPlay(card) ? ', legal move' : ', not currently playable'}`;
    if (rank(card) === rank(staged[0])) return `Select ${label} as another matching card`;
    const rankName = cardIdLabel(staged[0]).split(' of ')[0].toLowerCase();
    const plural = rankName === 'six' ? 'sixes' : rankName === 'two' ? 'twos' : `${rankName}s`;
    return `${label}, choose only matching ${plural}`;
  }

  const say = (notice: string) => setView((current) => ({ ...current, notice }));

  function afterYourPlay(before: GameState, after: GameState, cards: readonly CardId[], aceSuit?: Suit) {
    const notice = describePlay(before, after, cards, 'you', aceSuit);
    const meaning = explainEffect(before, after, cards, 'you', aceSuit);
    const lesson = explainLesson(before, after, cards, 'you', aceSuit);
    if (after.status === 'won') {
      setView((current) => ({
        ...current, engine: after, hint: false, meaning: null, lesson: null,
        notice: cards.length > 1 ? 'You played your matching set legally — you win!' : 'You played your last card legally — you win!',
      }));
      return;
    }
    if (after.playerHand.length === 1) {
      cue('last-card');
      setView((current) => ({ ...current, engine: after, hint: false, meaning, lesson, awaitingLastCard: true, notice: 'One card left. Say “Last Card” before play continues.' }));
      return;
    }
    setView((current) => ({ ...current, engine: after, hint: false, meaning, lesson, notice }));
  }

  function playSet(cards: CardId[], aceSuit?: Suit) {
    cue('play');
    noteFlight(cards, 'you');
    const before = engine;
    const after = applyAction(before, { type: 'play', cards, ...(aceSuit ? { chosenSuit: aceSuit } : {}) });
    afterYourPlay(before, after, cards, aceSuit);
  }

  function refuse(cards: CardId[], reason: string) {
    cue('bad');
    setFlash(cards);
    setWarn(reason);
    window.setTimeout(() => setFlash((current) => (current === cards ? [] : current)), 1100);
    window.setTimeout(() => setWarn((current) => (current === reason ? '' : current)), 6000);
  }

  function chooseCard(card: CardId) {
    if (!yourTurn || outcome !== 'playing' || awaitingLastCard) return;
    setWarn('');
    if (staged.includes(card)) { setStaged((current) => current.filter((item) => item !== card)); return; }
    if (!staged.length) {
      if (!canPlay(card)) { refuse([card], explainUnplayable(card, engine)); return; }
      setStaged([card]);
      return;
    }
    if (rank(card) !== rank(staged[0])) {
      const first = cardIdLabel(staged[0]).split(' of ')[0].toLowerCase();
      refuse([card], `Cards played together must be the same number or picture. You started with ${first === "six" ? "sixes" : first === "two" ? "twos" : first + "s"}, so the ${cardIdLabel(card)} cannot join.`);
      return;
    }
    setStaged((current) => [...current, card]);
  }

  function noteFlight(cards: readonly CardId[], from: 'you' | 'computer') {
    const origins = cards.map((card) => {
      const el = from === 'you' ? document.querySelector<HTMLElement>(`[data-card="${card}"]`) : fanRef.current;
      const box = el?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
    });
    flight.current = { cards: [...cards], from, origins, at: Date.now(), consumed: false };
  }

  /** Card backs slide from the draw pile to whoever picked up, so a pick-up is as visible as a play. */
  function flyDraw(count: number, to: 'you' | 'computer') {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const pile = document.querySelector<HTMLElement>('.draw-pile');
    const target = to === 'you' ? document.querySelector<HTMLElement>('.player-hand') : fanRef.current;
    const back = pile?.querySelector('img');
    if (!pile || !target || !back) return;
    const from = pile.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const scale = from.width / (pile.offsetWidth || 1) || 1;
    const dx = (end.left + end.width / 2 - (from.left + from.width / 2)) / scale;
    const dy = (end.top + end.height / 2 - (from.top + from.height / 2)) / scale;
    for (let index = 0; index < Math.min(count, 5); index += 1) {
      const flier = document.createElement('span');
      flier.className = 'draw-flier';
      flier.setAttribute('aria-hidden', 'true');
      flier.appendChild(back.cloneNode() as HTMLElement);
      pile.appendChild(flier);
      const anim = flier.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(${to === 'you' ? 8 : -8}deg) scale(.9)`, opacity: 1, offset: 0.65 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(.7)`, opacity: 0, offset: 1 },
      ], { duration: 1000, delay: index * 260, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'backwards' });
      anim.onfinish = () => flier.remove();
      anim.oncancel = () => flier.remove();
    }
  }

  function playStaged() {
    if (!staged.length) return;
    if (!canPlay(staged[0])) { refuse([staged[0]], explainUnplayable(staged[0], engine)); return; }
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
    if (!isLegalPlay(engine, { type: 'play', cards: staged })) {
      refuse([...staged], staged.length === engine.playerHand.length && (rank(staged[staged.length - 1]) === '7' || rank(staged[staged.length - 1]) === 'J')
        ? 'You cannot finish on a seven or a jack in this two-player game. Change the order or keep a card back.'
        : 'Those cards cannot be played in that order. Try a different order, or play fewer cards.');
      return;
    }
    playSet(staged);
    setStaged([]);
  }

  function drawOrResolve() {
    if (!yourTurn || outcome !== 'playing') return;
    cue(pendingDraw ? 'penalty' : 'draw');
    const count = pendingDraw || 1;
    if (pending?.kind !== 'miss-turn') flyDraw(count, 'you');
    const next = applyAction(engine, pending?.kind === 'miss-turn' ? { type: 'accept-missed-turn' } : { type: 'draw' });
    setView((current) => ({
      ...current, engine: next, hint: false,
      lesson: explainPickupLesson(engine, 'you', count),
      meaning: pending?.kind === 'miss-turn' ? 'You had no eight to pass it on, so you miss this turn and the computer plays next.' : explainPickup(engine, 'you', count),
      notice: pending?.kind === 'miss-turn' ? 'You cannot counter with an eight, so you miss this turn.' : `You pick up ${count} card${count === 1 ? '' : 's'}. Computer’s turn.`,
    }));
  }

  function answerLastCard(said: boolean) {
    cue(said ? 'good' : 'penalty');
    setView((current) => {
      if (said) return { ...current, awaitingLastCard: false, notice: '“Last Card!” — called in time.', engine: { ...current.engine, move: current.engine.move + 1 } };
      const penalised = drawCards(current.engine, 2, 'player');
      return { ...current, awaitingLastCard: false, notice: 'You forgot “Last Card” and pick up two penalty cards.', engine: { ...penalised, move: penalised.move + 1 } };
    });
  }

  const restart = () => { logged.current = false; shown.current = null; setSheetOpen(false); setView(openingView()); setAceChoice(null); setStaged([]); };

  const gameHint = pending?.kind === 'draw-two'
    ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.`
    : pending?.kind === 'black-king'
      ? `Play another black king to add 5 and pass on ${pendingDraw + 5}, play a red king to cancel 5, or pick up ${pendingDraw}.`
      : pending?.kind === 'miss-turn'
        ? 'Play another eight to pass the missed turn. If you have none, you must miss your turn.'
        : legalCards.length
          ? `You can play ${legalCards.join(', ')}. Aces are wild on ordinary cards. You may also pick up one card instead and save a useful card for later.`
          : 'You have no legal card. Pick up one card and the computer will play.';

  const topCard = engine.discardPile[engine.discardPile.length - 1];
  const cardsInGame = [...engine.playerHand, ...engine.computerHand, ...engine.drawPile, ...engine.discardPile];
  const deckDescription = `${cardsInGame.length}-card game with ${new Set(cardsInGame).size} unique cards`;
  const missTurn = pending?.kind === 'miss-turn';

  return <section className="tutorial game-tutorial" aria-label={deckDescription}><CardShower trigger={outcome === 'won' ? `won-${engine.move}` : null} />{outcome !== 'playing'
    ? <div className="completion"><CheckCircle size={60} weight="light" /><h1>{outcome === 'won' ? <>You beat the<br />computer.</> : <>The computer<br />won this one.</>}</h1><p>{view.notice}</p>{(() => { const mine = getComputerGames(readClub()).filter((game) => game.playerId === getMeId(readClub())); const record = summariseComputerGames(mine); return record.games ? <p className="record-line" role="status">Logged. Against the computer you have won {record.wins} of {record.games} ({Math.round(record.winRate * 100)}%).</p> : null; })()}<button className="primary" onClick={restart}><ArrowCounterClockwise size={18} />Play another guided game</button>{outcome === 'won' && <ShareButton label="Challenge a friend" build={challengeShareCard} />}<RealCards onStartNight={onStartNight} /><button className="secondary" onClick={onOpenPuzzles}>Try the rules puzzles <ArrowRight size={18} /></button><button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button></div>
    : <>
      <div className={'turn-banner ' + (yourTurn ? 'you' : 'computer')} aria-live="polite"><span className="turn-dot" aria-hidden="true" /><span>GUIDED GAME · {yourTurn ? 'YOUR TURN' : 'COMPUTER TURN'}</span><em className="dealer-chip" aria-label={`Dealer: ${view.dealer === 'you' ? 'you' : 'the computer'}`}>Dealer · {view.dealer === 'you' ? 'You' : 'Computer'}</em><button onClick={onExit}>Exit game</button></div>
      <div className="opponent" aria-label={`Computer has ${engine.computerHand.length} cards`}><span>COMPUTER</span><div key={engine.computerHand.length} ref={fanRef} className="opp-fan">{engine.computerHand.slice(0, 5).map((_, i) => <CardImage code="back" key={i} />)}</div><strong>{engine.computerHand.length} card{engine.computerHand.length === 1 ? '' : 's'}</strong></div>
      <div className="game-table"><button className={'draw-pile' + (pickShown && advice && !advice.cards.length ? ' coach-pick' : '')} onClick={drawOrResolve} disabled={!yourTurn || awaitingLastCard || !!staged.length || missTurn} aria-label={missTurn ? 'Draw pile unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Draw a card'}><CardImage code="back" /><span>{missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : legalCards.length ? 'Pick up instead' : 'Draw'}</span></button><div className="discard-pile"><span className="pile-wrap"><span key={`${engine.move}-${topCard}`} ref={pileRef} className={'pile-card from-' + mover}><CardImage code={topCard} /></span><span key={`layer-${engine.move}`} ref={layerRef} className="flight-layer" aria-hidden="true">{flight.current && !flight.current.consumed && Date.now() - flight.current.at < 4000 && flight.current.cards[flight.current.cards.length - 1] === topCard ? flight.current.cards.slice(0, -1).map((code) => <span className="flying-card" key={code}><CardImage code={code} /></span>) : null}</span></span><span>Current suit <b className={(engine.currentSuit === 'H' || engine.currentSuit === 'D') ? 'red' : ''}>{suitSymbols[engine.currentSuit]} {suitNames[engine.currentSuit]}</b></span></div></div>
      <p className={'game-notice' + (warn && yourTurn ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{!yourTurn ? 'Computer is choosing a card…' : warn || view.notice}</p>
      {!awaitingLastCard && <CoachPanel footer={<><button className="text-link" onClick={() => { const next = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]; computerLevel = next; setLevel(next); try { localStorage.setItem('switchComputerLevel', next); } catch { /* storage unavailable */ } }}>Computer: {level[0].toUpperCase() + level.slice(1)}, {LEVEL_NOTE[level]}. Tap to change</button><button className="text-link" onClick={toggleGuide}>{guide ? 'Turn off automatic guidance cards' : 'Show a guidance card every turn'}</button><button className="text-link" onClick={() => { const next = !soundOn; setFeedbackEnabled(next); setSoundOn(next); if (next) cue('good'); }}>{soundOn ? 'Mute sounds and vibration' : 'Turn on sounds and vibration'}</button></>} open={sheetOpen} onOpenChange={setSheetOpen} advice={yourTurn ? advice : null} revealPick={pickShown} inlineTrigger={false} compact sheetOptions={yourTurn ? explainOptions(engine) : []} lesson={view.lesson} meaning={view.meaning} options={yourTurn && !missTurn ? explainOptions(engine) : []} />}
      {yourTurn && missTurn && !awaitingLastCard && <div className="miss-turn-action"><strong>The computer played an eight</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you must miss this turn.'}</p><button className="primary" onClick={drawOrResolve}>Accept missed turn <ArrowRight size={18} /></button></div>}
      {awaitingLastCard
        ? <div className="last-card-call"><HandPalm size={27} /><strong>One card remaining</strong><p>Say “Last Card” now. Forgetting costs two cards.</p><button className="primary" onClick={() => answerLastCard(true)}>Say “Last Card”</button><button className="text-link" onClick={() => answerLastCard(false)}>Continue without saying it</button></div>
        : <>{staged.length === 0 && <div className="game-actions"><button className={'hint-button ' + (view.hint ? 'active' : '')} onClick={() => setView((current) => ({ ...current, hint: !current.hint }))} disabled={!yourTurn}><Lightbulb size={19} weight={view.hint ? 'fill' : 'regular'} />{view.hint ? 'Hide hint' : 'Show hint'}</button>{view.lesson && (!yourTurn || !advice || advice.kind === 'accept') && <button className="why-button" onClick={() => setSheetOpen(true)}>Why &amp; tactics</button>}<span>{engine.playerHand.length} cards in your hand</span></div>}{view.hint && <p className="game-hint"><Lightbulb size={17} />{gameHint}</p>}<div className={'player-hand' + (engine.playerHand.length > 10 ? ' dense' : '') + (engine.playerHand.length > 8 ? ' two-rows' : '')} style={{ '--n': engine.playerHand.length, '--per': Math.ceil(engine.playerHand.length / 2) } as React.CSSProperties} aria-label="Your hand">{engine.playerHand.map((card, index) => <button key={card} style={{ '--i': mover === 'deal' ? index : 0, zIndex: index + 1 } as React.CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={((view.hint || guide) && yourTurn && canPlay(card) ? 'playable ' : '') + (pickShown && advice?.cards.includes(card) ? 'coach-pick ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!yourTurn} aria-label={matchingCardLabel(card)}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}</div>{staged.length > 0 && <div className="multi-action"><p>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected, played in the order you tapped them. The last card sets the suit.`}</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>}</>}
      {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={(chosen === 'H' || chosen === 'D') ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); setStaged([]); playSet(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
    </>}</section>;
}
