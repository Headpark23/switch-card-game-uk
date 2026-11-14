import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, CheckCircle, HandPalm, Lightbulb, SortAscending, Timer } from '@phosphor-icons/react';
import type { ComputerLevel } from '../switch/ai';
import { cardIdLabel } from '../switch/cards';
import { explainUnplayable } from '../switch/coach';
import { applyTableAction, createTable, dealTo, isLegalTablePlay, penaliseMissedLastCard, tableLegalMoves, tablePlaces, type TableState } from '../switch/table';
import { chooseTableAction } from '../switch/tableAi';
import type { CardId, GameAction, GameState, Suit } from '../switch/types';
import { cue } from '../feedback';
import { logComputerGame } from '../switch/logGame';
import { useTableTelemetry } from '../switch/useTableTelemetry';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { drawTiming, planTurn, REDUCED, SPEED_NAMES, SPEEDS, stepDuration, visibleAt, type Speed, type Step } from '../switch/presentation';
import { clearActiveTable, newTableGameId, readSpeed, saveActiveTable, saveSpeed, type ActiveTable } from '../switch/activeTable';
import { CardImage, CardShower, rank, suit, suitNames, suitSymbols } from '../ui';
import RealCards from './RealCards';
import type { PlayMode } from '../switch/series';
import { sortHand } from '../switch/sortHand';

import { COMPUTER_NAMES } from '../switch/presentation';
export { COMPUTER_NAMES };
const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;
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
function describe(before: TableState, after: TableState, who: string, action: GameAction): string {
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
  if (cards.length === before.hands[before.turn].length && after.status === 'playing') {
    return `${text}, but that cannot win the game, so ${who === 'You' ? 'you pick' : `${who} picks`} up one card.`;
  }
  return text + '.';
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

/** One turn being shown: the engine's result is already decided; the steps reveal it in order. */
type Showing = { id: number; before: TableState; after: TableState; action: GameAction; steps: Step[]; at: number; line: string };

/** How long a computer waits before spotting that you did not say "Last Card". */
const CALL_GRACE = 1600;

/** When this game is one of a tournament's games, the series screen runs the show: it names the seats and decides what happens next. */
export type SeriesGame = { title: string; seriesId: string; mode: PlayMode; onFinished: (table: TableState, gameId: string) => void };

type Props = { opponents: number; level: ComputerLevel; resume?: ActiveTable | null; seatNames?: string[]; series?: SeriesGame; onExit: () => void; onOpenCards: () => void; onStartNight: () => void; onChange: () => void };

export default function TableGame({ opponents, level, resume = null, seatNames, series, onExit, onOpenCards, onStartNight, onChange }: Props) {
  const seats = opponents + 1;
  const names = useMemo(() => seatNames ?? ['You', ...COMPUTER_NAMES.slice(0, opponents)], [opponents, seatNames]);
  const [gameId, setGameId] = useState(() => resume?.id ?? newTableGameId());
  const [game, setGame] = useState<TableState>(() => resume?.game ?? createTable(seats, Math.random, pickDealer(seats)));
  const [showing, setShowing] = useState<Showing | null>(null);
  const [recent, setRecent] = useState<string[]>(() => (resume ? ['Game resumed where you left it.'] : []));
  const [staged, setStaged] = useState<CardId[]>([]);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [warn, setWarn] = useState('');
  const [hint, setHint] = useState(false);
  // "Last Card" is the player's own job: the button is always there, nothing prompts for it, and forgetting costs two cards.
  const [lastCalled, setLastCalledState] = useState(() => resume?.lastCardCalled ?? false);
  const calledRef = useRef(lastCalled);
  const setLastCalled = (value: boolean) => { calledRef.current = value; setLastCalledState(value); };
  const [flash, setFlash] = useState<CardId[]>([]);
  const [speed, setSpeedState] = useState<Speed>(readSpeed);
  const timings = useMemo(() => (prefersReducedMotion() ? REDUCED : SPEEDS[speed]), [speed]);
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

  const shown = showing ? visibleAt(showing.before, showing.after, showing.steps, showing.at) : visibleAt(game, game, [], 0);
  const visible = shown;
  const yourMove = !showing && game.status === 'playing' && game.turn === 0;
  const canAct = yourMove;
  const hand = showing && showing.before.turn === 0 && showing.action.type === 'draw' ? showing.before.hands[0] : game.hands[0];
  const pending = game.pendingPenalty;
  const missTurn = pending?.kind === 'miss-turn';
  const pendingDraw = pickups(game);
  const legal = yourMove ? tableLegalMoves(game, 0) : [];
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = hand.filter(canPlay);
  const places = game.status === 'won' ? tablePlaces(game) : [];
  const youWon = game.winner === 0;
  const finished = game.status === 'won' && !showing;

  const push = (line: string) => setRecent((current) => [...current.slice(-3), line]);

  function show(before: TableState, action: GameAction, after: TableState, think: boolean, missedCall = false) {
    stats.onMove(before, action, after);
    showId.current += 1;
    const steps = planTurn(before, action, after, names, { think, missedCall });
    let line = describe(before, after, names[before.turn], action);
    if (before.turn !== 0 && after.status === 'playing' && after.hands[before.turn].length === 1) line += ` ${names[before.turn]} says "Last Card".`;
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
      if (before.hands[0].length === 1 && !calledRef.current) {
        cue('penalty');
        before = dealTo(before, 0, 2);
        setGame(before);
        push(`${names[before.turn]} spotted that you did not say "Last Card". You pick up two cards.`);
      }
      const action = chooseTableAction(before, Math.random, level);
      show(before, action, applyTableAction(before, action), true);
    }, exposed ? timings.highlight + CALL_GRACE : timings.highlight);
    return () => window.clearTimeout(timer);
  }, [showing, game.status, game.turn, game.move, lastCalled, level, timings]);

  // An unfinished game is kept so it can be resumed; a finished one is logged once, under its own id, and forgotten.
  useEffect(() => {
    // A game inside a tournament is never saved for resuming; the tournament screen owns what happens next.
    if (game.status === 'playing') { if (!series) saveActiveTable({ id: gameId, opponents, level, game, awaitingLastCard: false, lastCardCalled: lastCalled }); return; }
    if (logged.current === gameId) return;
    logged.current = gameId;
    // Every game counts: your place in this one is logged under its game type, whatever the tournament does with it.
    logComputerGame({ id: gameId, opponents, level, won: game.winner === 0, place: tablePlaces(game)[0], moves: game.move, ...(series ? { mode: series.mode, seriesId: series.seriesId } : {}) });
    stats.onFinish({ won: game.winner === 0, place: tablePlaces(game)[0], moves: game.move });
    if (!series) clearActiveTable();
  }, [game, lastCalled, gameId, opponents, level]);

  useEffect(() => { if (finished) cue(youWon ? 'win' : 'bad'); }, [finished, youWon]);

  function refuse(cards: CardId[], reason: string) {
    cue('bad');
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
      setStaged([card]);
      return;
    }
    if (rank(card) !== rank(staged[0])) { refuse([card], `Cards played together must be the same number or picture, so the ${cardIdLabel(card)} cannot join.`); return; }
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
    const missed = emptied && !calledRef.current;
    if (missed) { cue('penalty'); after = penaliseMissedLastCard(after, 0); }
    // The call is used up by an emptied hand (a pickup means saying it again) and by any play that leaves two or more.
    if (emptied || after.hands[0].length > 1) setLastCalled(false);
    show(before, action, after, false, missed);
    setStaged([]);
    setHint(false);
  }

  function playStaged() {
    if (!staged.length || busy.current) return;
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
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
  }

  function again() {
    busy.current = false;
    setShowing(null);
    setRecent([]); setStaged([]); setAceChoice(null); setHint(false); setLastCalled(false);
    setGameId(newTableGameId());
    setGame(createTable(seats, Math.random, pickDealer(seats)));
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

  if (finished && series) {
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${gameId}` : null} />
      <div className="completion">
        <CheckCircle size={56} weight="light" />
        <h1>{youWon ? <>You won<br />this game.</> : <>{names[game.winner ?? 0]} won<br />this game.</>}</h1>
        <p>{series.title}. You finished {ordinal(places[0])} of {seats} with {hand.length} card{hand.length === 1 ? '' : 's'} left.</p>
        <ol className="place-list" aria-label="Places in this game">{[...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b).map((seat) => <li key={seat} className={seat === 0 ? 'me' : ''}><b>{ordinal(places[seat])}</b><span>{names[seat]}</span><em>{game.hands[seat].length} left</em></li>)}</ol>
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
        <button className="primary" onClick={again}><ArrowCounterClockwise size={18} />Deal again</button>
        <button className="secondary" onClick={onChange}>Change the table</button>
        <RealCards onStartNight={onStartNight} />
        <button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button>
      </div>
    </section>;
  }

  const activeName = names[visible.active];
  const status = yourMove ? 'YOUR MOVE' : visible.thinking ? `${activeName.toUpperCase()} IS CHOOSING` : visible.active === 0 ? 'YOU PLAY' : `${activeName.toUpperCase()} TO PLAY`;
  const pile = visible.discardPile.slice(-3);
  const drawingNow = visible.drawing;
  const drawingTiming = drawTiming(drawingNow?.count ?? 0, drawingNow?.penalty === true, timings);
  const ouchFor = (seat: number) => drawingNow?.ouch && drawingNow.seat === seat
    ? <span key={`ouch-${showing?.id}`} className="ouch" aria-hidden="true" data-testid="ouch" style={{ animationDelay: `${Math.round(drawingTiming.trip)}ms` }}>Ouch!</span> : null;
  const notice = warn || (visible.announce ? visible.announce.text + '.'
    : visible.thinking ? `${activeName} is choosing a move…`
    : visible.flying ? `${activeName === 'You' ? 'You play' : `${activeName} plays`} ${cardIdLabel(visible.flying.card)}${visible.flying.count > 1 ? ` (${visible.flying.index + 1} of ${visible.flying.count})` : ''}.`
    : visible.drawing ? `${activeName === 'You' ? 'You pick' : `${activeName} picks`} up ${visible.drawing.count} card${visible.drawing.count === 1 ? '' : 's'}.`
    : yourMove ? (recent.length === 0 ? `${names[game.dealer]} dealt. You play first.` : recent[recent.length - 1]) : recent[recent.length - 1] ?? `${names[game.dealer]} dealt.`);

  return <section ref={sectionRef} className="tutorial game-tutorial table-game" aria-label={series ? series.title : `Game against ${opponents === 1 ? 'the computer' : `${opponents} computers`}`} data-active-seat={visible.active} data-showing={showing ? 'yes' : 'no'}>
    <div className={'turn-banner ' + (visible.active === 0 ? 'you' : 'computer')}>
      <span className="turn-dot" aria-hidden="true" />
      <span className="turn-status" aria-live="polite" data-testid="turn-status">{status}</span>
      <em className="dealer-chip" aria-label={`Dealer: ${names[game.dealer]}`}>Dealer · {names[game.dealer]}</em>
      <button onClick={onExit}>Exit</button>
    </div>
    {series && <p className="series-strip" data-testid="series-strip">{series.title}</p>}
    <div className={`seat-row seats-${opponents}${opponents > 4 ? ' many' : ''}`} role="list" aria-label="Players at the table">
      {names.slice(1).map((name, index) => {
        const seat = index + 1;
        const count = visible.handCounts[seat];
        const active = visible.active === seat;
        return <div role="listitem" key={name} data-seat={seat} className={'seat' + (active ? ' turn' : '') + (game.dealer === seat ? ' dealer' : '')} aria-label={`${name} has ${count} card${count === 1 ? '' : 's'}${game.dealer === seat ? ', dealer' : ''}${active ? ', playing now' : ''}`}>
          <span className="seat-name">{name}{game.dealer === seat && <i className="dealer-pip" title="Dealer">D</i>}</span>
          <span className="seat-fan" aria-hidden="true">{Array.from({ length: Math.min(5, count) }, (_, i) => <CardImage code="back" key={i} />)}</span>
          <strong className={count === 1 ? 'last' : ''}>{count} card{count === 1 ? '' : 's'}</strong>{ouchFor(seat)}
          <span className="seat-state" aria-hidden="true">{active ? (visible.thinking ? <><i className="think-dots"><b /><b /><b /></i>Choosing</> : 'Playing') : count === 1 ? 'Last card' : ' '}</span>
        </div>;
      })}
    </div>
    <div className="game-table">
      <button className="draw-pile" onClick={pickUp} disabled={!canAct || !!staged.length || missTurn} aria-label={missTurn ? 'Draw pile unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Draw a card'}><CardImage code="back" />{drawingNow?.penalty && <span key={`count-${showing?.id}`} className="draw-count" aria-hidden="true" data-testid="draw-count" style={{ animationDuration: `${drawingTiming.total}ms` }}>+{drawingNow.count}</span>}<span>{!yourMove ? 'Deck' : missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : legalCards.length ? 'Pick up instead' : 'Draw'}</span></button>
      <div className="discard-pile">
        <span className="pile-wrap" data-testid="discard-pile" data-top={pile[pile.length - 1]} data-order={visible.discardPile.slice(-6).join(' ')}>
          {pile.map((card, index) => <span key={card} className={'pile-card depth-' + (pile.length - 1 - index)}><CardImage code={card} /></span>)}
          {visible.flying && <span ref={flyRef} key={`fly-${showing?.id}-${visible.flying.index}`} className="pile-card flying" data-testid="flying-card" data-card={visible.flying.card}><CardImage code={visible.flying.card} /></span>}
        </span>
        <span>Suit <b className={visible.currentSuit === 'H' || visible.currentSuit === 'D' ? 'red' : ''}>{suitSymbols[visible.currentSuit]} {suitNames[visible.currentSuit]}</b></span>
        {seats > 2 && <span className="direction" aria-label={`Play goes ${visible.direction === 1 ? 'clockwise' : 'anticlockwise'}`}>{visible.direction === 1 ? <ArrowClockwise size={14} weight="bold" /> : <ArrowCounterClockwise size={14} weight="bold" />}{visible.direction === 1 ? 'Clockwise' : 'Anticlockwise'}</span>}
      </div>
      <button className={'last-card-button' + (lastCalled ? ' called' : '')} onClick={callLastCard} aria-pressed={lastCalled} data-testid="last-card-button"><HandPalm size={22} weight={lastCalled ? 'fill' : 'regular'} /><span>{lastCalled ? 'Called' : 'Last Card'}</span></button>
      {visible.announce && <div key={`${showing?.id}-${showing?.at}`} className={'table-announce ' + visible.announce.tone} data-testid="table-announce" aria-hidden="true">{visible.announce.text}</div>}
    </div>
    <p className={'game-notice' + (warn && yourMove ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{notice}</p>
    {recent.length > 1 && <ul className="move-log" aria-label="Recent moves">{recent.slice(0, -1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
    <div className={'your-seat' + (visible.active === 0 ? ' turn' : '')} data-seat="0">
      {ouchFor(0)}
      {yourMove && <span className="your-move-tag" aria-hidden="true">Your move</span>}
      {yourMove && missTurn && <div className="miss-turn-action"><strong>An eight was played</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you miss this turn.'}</p><button className="primary" onClick={pickUp}>Accept missed turn <ArrowRight size={18} /></button></div>}
      <>
          {staged.length === 0 && <div className="game-actions"><button className={'hint-button ' + (hint ? 'active' : '')} onClick={() => setHint((current) => !current)} disabled={!canAct}><Lightbulb size={19} weight={hint ? 'fill' : 'regular'} />{hint ? 'Hide hint' : 'Show hint'}</button><button className="pace-button" onClick={cycleSpeed} aria-label={`Computer pace: ${SPEED_NAMES[speed]}. Tap to change`}><Timer size={16} />{SPEED_NAMES[speed]}</button><button className="pace-button sort-button" onClick={() => setGame((current) => ({ ...current, hands: current.hands.map((cards, seat) => (seat === 0 ? sortHand(cards) : cards)) }))}><SortAscending size={16} />Sort</button><span>{hand.length} in hand</span></div>}
          {hint && yourMove && <p className="game-hint"><Lightbulb size={17} />{hintText}</p>}
          <div className={'player-hand' + (hand.length > 10 ? ' dense' : '') + (hand.length > 8 ? ' two-rows' : '')} style={{ '--n': hand.length, '--per': Math.ceil(hand.length / 2) } as CSSProperties} aria-label="Your hand">
            {hand.map((card, index) => <button key={card} style={{ '--i': 0, zIndex: index + 1 } as CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={(hint && yourMove && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!canAct} aria-label={staged.includes(card) ? `Deselect ${cardIdLabel(card)}` : `Select ${cardIdLabel(card)}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}
          </div>
          {staged.length > 0 && <div className="multi-action"><p>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected. They land in the order you tapped them, and the last one sets the suit.`}</p><button className="primary" onClick={playStaged} disabled={!canAct}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>}
        </>
    </div>
    {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); commit(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
  </section>;
}
