import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, CheckCircle, HandPalm, Lightbulb, ShareNetwork, Smiley, SortAscending } from '@phosphor-icons/react';
import { BottomSheet } from '../mobile';
import { cardIdLabel } from '../switch/cards';
import { explainUnplayable } from '../switch/coach';
import { isLegalTablePlay, tableLegalMoves, tablePlaces, type TableState } from '../switch/table';
import type { CardId, GameAction, GameState, Suit } from '../switch/types';
import { cue } from '../feedback';
import { logComputerGame } from '../switch/logGame';
import { drawTiming, planTurn, REDUCED, SPEEDS, stepDuration, visibleAt, type Step } from '../switch/presentation';
import { readSpeed } from '../switch/activeTable';
import { clearSeat, loadSeat, REACTIONS, reactionOf, tableInvite, useRoom, type RoomView } from '../switch/onlineRoom';
import { sortHand } from '../switch/sortHand';
import { CardImage, CardShower, rank, suitNames, suitSymbols } from '../ui';
import { describe, ordinal } from './TableGame';
import RealCards from './RealCards';
import { FeltHeader } from '../ui';

type Showing = { id: number; before: TableState; after: TableState; action: GameAction; steps: Step[]; at: number; line: string };

const reduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; } };
const pickups = (state: TableState) => (state.pendingPenalty && state.pendingPenalty.kind !== 'miss-turn' ? state.pendingPenalty.cards : 0);

type Props = { onLeave: () => void; onOpenCards: () => void; onStartNight: () => void };

/** A private table with friends and family: the waiting room, the game, and the result. The server owns the game; this screen shows it. */
export default function OnlineTable({ onLeave, onOpenCards, onStartNight }: Props) {
  const [seat] = useState(loadSeat);
  const room = useRoom(seat);
  const { view, gone } = room;
  if (!seat) return <Gone message="You are not sitting at a table." onLeave={onLeave} />;
  if (gone) return <Gone message="This table has ended, or your seat there is no longer valid." onLeave={() => { clearSeat(); onLeave(); }} />;
  if (!view) return <section className="friends-table" role="status"><FeltHeader compact title="Taking your seat." intro={`Table ${seat.code}…`} cards={['AS', 'KH']} /></section>;
  if (view.status === 'lobby' || !view.game) return <WaitingRoom view={view} room={room} onLeave={() => { clearSeat(); onLeave(); }} />;
  return <Game key={view.gameNo} view={view} room={room} onExit={onLeave} onLeave={() => { clearSeat(); onLeave(); }} onOpenCards={onOpenCards} onStartNight={onStartNight} />;
}

function Gone({ message, onLeave }: { message: string; onLeave: () => void }) {
  return <section className="friends-table"><FeltHeader compact title="No table here." intro={message} cards={['AS', 'KH']} /><button className="primary" onClick={onLeave}>Back to Play</button></section>;
}

type Room = ReturnType<typeof useRoom>;

function WaitingRoom({ view, room, onLeave }: { view: RoomView; room: Room; onLeave: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const host = view.seats.find((entry) => entry.host)?.name ?? 'Someone';
  const people = view.seats.filter((entry) => entry.kind === 'human');
  const free = view.capacity - view.seats.length;
  const invite = tableInvite(view.code, host);

  async function share() {
    try {
      if (navigator.share) { await navigator.share({ text: invite }); return; }
      await navigator.clipboard.writeText(invite);
      setNote('Invitation copied. Paste it into a message.');
    } catch { /* the share sheet was closed */ }
  }
  async function start() {
    setBusy(true); setNote('');
    try { await room.send('start'); } catch (reason) { setNote(reason instanceof Error ? reason.message : 'Could not start.'); }
    finally { setBusy(false); }
  }

  return <section className="friends-table waiting-room" aria-labelledby="waiting-title">
    <FeltHeader compact id="waiting-title" title={view.you.host ? 'Your table is ready.' : `You are at ${host}’s table.`} intro="Share the code. When everyone is here, the host deals." cards={['QH', 'KS']} />
    <div className="table-code" aria-label={`Table code ${view.code.split('').join(' ')}`}><small>Table code</small><b data-testid="table-code">{view.code}</b></div>
    <button className="secondary share-button" onClick={share}><ShareNetwork size={18} weight="bold" />Invite friends</button>
    <ul className="waiting-seats" aria-label="Who is here">
      {people.map((entry, index) => <li key={index} className={entry.you ? 'me' : ''}><strong>{entry.you ? `${entry.name} (you)` : entry.name}</strong>{entry.host && <em>Host</em>}</li>)}
      {Array.from({ length: Math.max(0, free) }, (_, index) => <li key={`free-${index}`} className="free"><span>{view.seats.length + index < view.capacity ? 'Open seat' : ''}</span></li>)}
    </ul>
    <p className="lobby-note center">{view.capacity} seats. Any seat still empty when the game starts is played by a computer ({view.level === 'relaxed' ? 'Easy' : view.level === 'sharp' ? 'Hard' : 'Medium'}).</p>
    {room.error && <p className="lobby-note center" role="status">{room.error}</p>}
    {note && <p className="lobby-note center" role="status">{note}</p>}
    {view.you.host
      ? <button className="primary deal-button" onClick={start} disabled={busy || !view.canStart} data-testid="start-online">{view.seats.length < 2 ? 'Waiting for a friend…' : `Deal ${people.length === 1 ? 'me in' : `${people.length} players in`}`}<ArrowRight size={18} /></button>
      : <p className="lobby-note center" role="status">Waiting for {host} to start the game…</p>}
    <button className="text-link" onClick={onLeave}>Leave this table</button>
  </section>;
}

type GameProps = { view: RoomView; room: Room; onExit: () => void; onLeave: () => void; onOpenCards: () => void; onStartNight: () => void };

function Game({ view, room, onExit, onLeave, onOpenCards, onStartNight }: GameProps) {
  const names = useMemo(() => view.seats.map((entry) => (entry.you ? 'You' : entry.name)), [view.seats.map((entry) => entry.name).join('|')]);
  const seats = view.seats.length;
  const opponents = seats - 1;
  const [game, setGame] = useState<TableState>(view.game!);
  const [showing, setShowing] = useState<Showing | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [staged, setStaged] = useState<CardId[]>([]);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [warn, setWarn] = useState('');
  const [hint, setHint] = useState(false);
  const [flash, setFlash] = useState<CardId[]>([]);
  const [called, setCalledState] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Record<number, { n: number; id: string }>>({});
  const [, setTick] = useState(0);
  const timings = useMemo(() => (reduced() ? REDUCED : SPEEDS[readSpeed()]), []);
  const showId = useRef(0);
  const busy = useRef(false);
  const gameRef = useRef(game); gameRef.current = game;
  const showingRef = useRef<Showing | null>(null); showingRef.current = showing;
  const appliedN = useRef(Math.max(0, ...(view.moves ?? []).map((move) => move.n)));
  const seenReaction = useRef(Math.max(0, ...(view.reactions ?? []).map((entry) => entry.n)));
  const calledRef = useRef(false);
  const calledBeforeFinal = useRef(false);
  const logged = useRef<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const flyRef = useRef<HTMLSpanElement>(null);
  const setCalled = (value: boolean) => { calledRef.current = value; setCalledState(value); };
  const push = (line: string) => setRecent((current) => [...current.slice(-3), line]);

  const shown = showing ? visibleAt(showing.before, showing.after, showing.steps, showing.at) : visibleAt(game, game, [], 0);
  const visible = shown;
  const yourMove = !showing && game.status === 'playing' && game.turn === 0;
  const hand = showing && showing.before.turn === 0 && showing.action.type === 'draw' ? showing.before.hands[0] : game.hands[0];
  const pending = game.pendingPenalty;
  const missTurn = pending?.kind === 'miss-turn';
  const pendingDraw = pickups(game);
  const legal = yourMove ? tableLegalMoves(game, 0) : [];
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = hand.filter(canPlay);
  const finished = game.status === 'won' && !showing;
  const youWon = game.winner === 0;
  const lastCalled = called || view.seats[0].lastCardCalled;

  /** Shows one turn from the server: the cards land in order, then the effect, exactly as at the computer table. */
  function show(before: TableState, action: GameAction, after: TableState, missedCall: boolean, auto: boolean) {
    showId.current += 1;
    const steps = planTurn(before, action, after, names, { think: false, missedCall });
    let line = describe(before, after, names[before.turn], action);
    if (before.turn !== 0 && after.status === 'playing' && after.hands[before.turn].length === 1) line += ` ${names[before.turn]} says "Last Card".`;
    if (missedCall) line += `${before.turn === 0 ? ' You had' : ` ${names[before.turn]} had`} not said "Last Card", so two cards are picked up.`;
    if (auto) line += ' The computer played this move for them.';
    setGame(after);
    setShowing({ id: showId.current, before, after, action, steps, at: 0, line });
  }

  // Takes in what the server says, one turn at a time. A view that carries several turns at once is shown as it stands.
  useEffect(() => {
    if (showing || !view.game) return;
    const fresh = (view.moves ?? []).filter((move) => move.n > appliedN.current);
    if (!fresh.length) return;
    appliedN.current = fresh[fresh.length - 1].n;
    const before = gameRef.current;
    const move = fresh[0];
    if (fresh.length === 1 && move.type !== 'spot' && before.turn === move.seat) {
      const action: GameAction = move.type === 'play' ? { type: 'play', cards: [...move.cards], ...(move.chosenSuit ? { chosenSuit: move.chosenSuit } : {}) } : move.type === 'draw' ? { type: 'draw' } : { type: 'accept-missed-turn' };
      show(before, action, view.game, move.missedLastCard, move.auto);
    } else {
      if (fresh.length === 1 && move.type === 'spot') { cue('penalty'); push(`${names[move.seat]} did not say "Last Card" in time, so ${move.seat === 0 ? 'you pick' : 'they pick'} up two cards.`); }
      else push(`${fresh.length} moves were played.`);
      busy.current = false;
      setGame(view.game);
    }
    if (move.seat === 0) setCalled(false);
  }, [view, showing]);

  // Walks through the steps of the turn being shown.
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

  // Cards slide from the deck to whoever is picking up.
  useLayoutEffect(() => {
    const step = visible.drawing;
    if (!step || timings.flight <= 0) return;
    const section = sectionRef.current;
    const pile = section?.querySelector<HTMLElement>('.draw-pile');
    const target = step.seat === 0 ? section?.querySelector<HTMLElement>('.player-hand') : section?.querySelector<HTMLElement>(`[data-seat="${step.seat}"]`);
    const back = pile?.querySelector('img');
    if (!pile || !target || !back) return;
    const { trip, stagger, shown: count } = drawTiming(step.count, step.penalty === true, timings);
    const from = pile.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const scale = from.width / (pile.offsetWidth || 1) || 1;
    const dx = (end.left + end.width / 2 - (from.left + from.width / 2)) / scale;
    const dy = (end.top + end.height / 2 - (from.top + from.height / 2)) / scale;
    const fliers: HTMLElement[] = [];
    const animations: Animation[] = [];
    for (let index = 0; index < count; index += 1) {
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

  // Reactions from around the table appear beside the sender for a few seconds.
  useEffect(() => {
    const fresh = (view.reactions ?? []).filter((entry) => entry.n > seenReaction.current);
    if (!fresh.length) return;
    seenReaction.current = fresh[fresh.length - 1].n;
    setBubbles((current) => { const next = { ...current }; fresh.forEach((entry) => { next[entry.seat] = { n: entry.n, id: entry.id }; }); return next; });
    fresh.forEach((entry) => window.setTimeout(() => setBubbles((current) => (current[entry.seat]?.n === entry.n ? Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== entry.seat)) : current)), 3600));
  }, [view]);

  // The countdown is the server's clock, shown once a second.
  useEffect(() => {
    if (!view.clock || view.status !== 'playing') return;
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 500);
    return () => window.clearInterval(timer);
  }, [view.clock?.seat, view.status]);

  // A finished game is logged once, under the table's own game id, so it is a stat like every other game.
  useEffect(() => {
    const result = view.result;
    if (!result || logged.current === result.gameId) return;
    logged.current = result.gameId;
    const humans = result.seats.filter((entry) => entry.kind === 'human').map((entry) => entry.name);
    logComputerGame({
      id: result.gameId, opponents, level: view.level, won: result.winner === 0, place: result.seats[0].place, moves: gameRef.current.move,
      rivals: result.seats.slice(1).map((entry) => ({ name: entry.name, place: entry.place, ...(entry.kind === 'human' ? { human: true } : {}) })),
      online: { code: view.code, humans, autoMoves: result.seats[0].autoMoves },
    });
  }, [view.result]);

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

  /** Sends your move. The table answers with the new state, and the turn is then shown like any other. */
  async function submit(action: GameAction) {
    busy.current = true;
    try {
      await room.send('move', { action, lastCard: action.type === 'play' && action.cards.length === hand.length ? calledBeforeFinal.current : calledRef.current, expect: view.seq });
      calledBeforeFinal.current = false;
      window.setTimeout(() => { if (!showingRef.current) busy.current = false; }, 1500);
    } catch (reason) {
      busy.current = false;
      cue('bad');
      setWarn(reason instanceof Error ? reason.message : 'That move did not reach the table.');
      window.setTimeout(() => setWarn(''), 5000);
    }
  }

  function chooseCard(card: CardId) {
    if (!yourMove || busy.current) return;
    setWarn('');
    if (staged.includes(card)) { setStaged((current) => current.filter((item) => item !== card)); return; }
    if (!staged.length) {
      if (!canPlay(card)) { refuse([card], explainUnplayable(card, projection())); return; }
      calledBeforeFinal.current = hand.length === 1 && calledRef.current;
      setStaged([card]);
      return;
    }
    if (rank(card) !== rank(staged[0])) { refuse([card], `Cards played together must be the same number or picture, so the ${cardIdLabel(card)} cannot join.`); return; }
    if (staged.length + 1 === hand.length) calledBeforeFinal.current = calledRef.current;
    setStaged((current) => [...current, card]);
  }

  function commit(cards: CardId[], chosenSuit?: Suit) {
    const before = gameRef.current;
    if (busy.current || before.status !== 'playing' || before.turn !== 0) return;
    const action: GameAction = { type: 'play', cards, ...(chosenSuit ? { chosenSuit } : {}) };
    if (!isLegalTablePlay(before, action)) return;
    cue('play');
    setStaged([]); setHint(false);
    void submit(action);
  }

  function playStaged() {
    if (!staged.length || busy.current) return;
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
    if (!isLegalTablePlay(game, { type: 'play', cards: staged })) { refuse([...staged], 'Those cards cannot be played in that order. Try a different order, or play fewer cards.'); return; }
    commit(staged);
  }

  function pickUp() {
    if (!yourMove || busy.current) return;
    cue(pendingDraw ? 'penalty' : 'draw');
    setStaged([]); setHint(false); setCalled(false);
    void submit(missTurn ? { type: 'accept-missed-turn' } : { type: 'draw' });
  }

  function callLastCard() {
    if (game.status !== 'playing' || lastCalled) return;
    cue('good');
    setCalled(true);
    // Said after choosing the final card it is too late (ruling 26): the table is only told when it still counts.
    if (staged.length > 0 && staged.length === hand.length) return;
    room.send('call').catch(() => { /* the next move carries the call too */ });
  }

  function react(id: string) {
    setReactOpen(false);
    room.send('react', { id }).catch((reason: Error) => { setWarn(reason.message); window.setTimeout(() => setWarn(''), 3000); });
  }

  const hintText = pending?.kind === 'draw-two' ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.`
    : pending?.kind === 'black-king' ? `Play another black king, or a red king to cancel 5, or pick up ${pendingDraw}.`
    : missTurn ? 'Play another eight to pass the missed turn, or accept it.'
    : legalCards.length ? `You can play ${legalCards.map(cardIdLabel).join(', ')}. You may also pick up one card instead.` : 'You have no legal card. Pick up one card.';

  const host = view.seats.find((entry) => entry.host);
  const bubbleFor = (index: number) => {
    const bubble = bubbles[index];
    const reaction = bubble ? reactionOf(bubble.id) : null;
    return bubble && reaction ? <span key={bubble.n} className="reaction-bubble" role="status" data-testid="reaction-bubble">{reaction.emoji ?? reaction.text}<i className="sr-only">{names[index]}: {reaction.text}</i></span> : null;
  };

  if (finished) {
    const result = view.result;
    const places = tablePlaces(game);
    const order = [...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b);
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${view.code}-${view.gameNo}` : null} />
      <div className="completion">
        <CheckCircle size={60} weight="light" />
        <h1>{youWon ? <>You won the<br />table.</> : <>{names[game.winner ?? 0]} won<br />this one.</>}</h1>
        <p>{youWon ? 'You beat everyone at the table.' : `You finished ${ordinal(places[0])} of ${seats} with ${game.hands[0].length} card${game.hands[0].length === 1 ? '' : 's'} left.`}</p>
        <ol className="place-list" aria-label="Final places">{order.map((seatIndex) => <li key={seatIndex} className={seatIndex === 0 ? 'me' : ''}><b>{ordinal(places[seatIndex])}</b><span>{names[seatIndex]}</span><em>{game.hands[seatIndex].length === 0 ? 'Out' : `${game.hands[seatIndex].length} left`}</em></li>)}</ol>
        {result && result.seats[0].autoMoves > 0 && <p className="record-line">The computer played {result.seats[0].autoMoves} {result.seats[0].autoMoves === 1 ? 'move' : 'moves'} for you while you were away.</p>}
        <p className="record-line" role="status">Logged in your history, like every game.</p>
        {view.you.host
          ? <button className="primary" onClick={() => { room.send('again').catch((reason: Error) => setWarn(reason.message)); }}><ArrowCounterClockwise size={18} />Deal again</button>
          : <p className="lobby-note center" role="status">Waiting for {host?.name ?? 'the host'} to deal again…</p>}
        {warn && <p className="lobby-note center" role="alert">{warn}</p>}
        <button className="secondary" onClick={() => setReactOpen(true)}><Smiley size={18} />Say something</button>
        <button className="secondary" onClick={onLeave}>Leave the table</button>
        <RealCards onStartNight={onStartNight} />
        <button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button>
      </div>
      <ReactionSheet open={reactOpen} onOpenChange={setReactOpen} onPick={react} />
    </section>;
  }

  const clock = view.clock;
  const now = room.serverNow();
  let clockNote = '';
  if (clock && !clock.computer && game.status === 'playing' && !showing) {
    const secs = clock.autoAt !== undefined ? Math.max(0, Math.ceil((clock.autoAt - now) / 1000)) : 0;
    const quiet = clock.nudgeAt !== undefined && now >= clock.nudgeAt;
    if (clock.seat === 0) clockNote = clock.away ? 'You have been away, so the computer is playing your moves. Make a move to take over again.' : quiet ? `Your turn is taking a while. The computer will play your move in ${secs} seconds.` : '';
    else clockNote = clock.away ? `${names[clock.seat]} is away. The computer is playing their moves.` : quiet ? `${names[clock.seat]} has gone quiet. The computer will play their move in ${secs} seconds.` : '';
  }

  const activeName = names[visible.active];
  const status = yourMove ? 'YOUR MOVE' : visible.active === 0 ? 'YOU PLAY' : `${activeName.toUpperCase()} TO PLAY`;
  const pile = visible.discardPile.slice(-3);
  const drawingNow = visible.drawing;
  const drawingTiming = drawTiming(drawingNow?.count ?? 0, drawingNow?.penalty === true, timings);
  const ouchFor = (seatIndex: number) => drawingNow?.ouch && drawingNow.seat === seatIndex
    ? <span key={`ouch-${showing?.id}`} className="ouch" aria-hidden="true" data-testid="ouch" style={{ animationDelay: `${Math.round(drawingTiming.trip)}ms` }}>Ouch!</span> : null;
  const notice = warn || (visible.announce ? visible.announce.text + '.'
    : visible.flying ? `${activeName === 'You' ? 'You play' : `${activeName} plays`} ${cardIdLabel(visible.flying.card)}${visible.flying.count > 1 ? ` (${visible.flying.index + 1} of ${visible.flying.count})` : ''}.`
    : visible.drawing ? `${activeName === 'You' ? 'You pick' : `${activeName} picks`} up ${visible.drawing.count} card${visible.drawing.count === 1 ? '' : 's'}.`
    : yourMove ? (recent.length === 0 ? `${names[game.dealer]} dealt. It is your move.` : recent[recent.length - 1]) : recent[recent.length - 1] ?? `${names[game.dealer]} dealt.`);

  return <section ref={sectionRef} className="tutorial game-tutorial table-game online-game" aria-label={`Online table ${view.code}`} data-active-seat={visible.active} data-showing={showing ? 'yes' : 'no'}>
    <div className={'turn-banner ' + (visible.active === 0 ? 'you' : 'computer')}>
      <span className="turn-dot" aria-hidden="true" />
      <span className="turn-status" aria-live="polite" data-testid="turn-status">{status}</span>
      <em className="dealer-chip" aria-label={`Dealer: ${names[game.dealer]}`}>Dealer · {names[game.dealer]}</em>
      <button onClick={onExit}>Exit</button>
    </div>
    {room.error && <p className="clock-note" role="status">Lost touch with the table. Trying again…</p>}
    {clockNote && <p className="clock-note" role="status" data-testid="clock-note">{clockNote}</p>}
    <div className={`seat-row seats-${opponents}${opponents > 4 ? ' many' : ''}`} role="list" aria-label="Players at the table">
      {names.slice(1).map((name, index) => {
        const seatIndex = index + 1;
        const count = visible.handCounts[seatIndex];
        const active = visible.active === seatIndex;
        const info = view.seats[seatIndex];
        return <div role="listitem" key={seatIndex} data-seat={seatIndex} className={'seat' + (active ? ' turn' : '') + (game.dealer === seatIndex ? ' dealer' : '') + (info.kind === 'human' ? ' person' : '')} aria-label={`${name} has ${count} card${count === 1 ? '' : 's'}${game.dealer === seatIndex ? ', dealer' : ''}${active ? ', playing now' : ''}`}>
          <span className="seat-name">{name}{game.dealer === seatIndex && <i className="dealer-pip" title="Dealer">D</i>}</span>
          <span className="seat-fan" aria-hidden="true">{Array.from({ length: Math.min(5, count) }, (_, i) => <CardImage code="back" key={i} />)}</span>
          <strong className={count === 1 ? 'last' : ''}>{`${count} card${count === 1 ? '' : 's'}`}</strong>{ouchFor(seatIndex)}
          <span className="seat-state" aria-hidden="true">{info.away ? 'Away' : active ? 'Playing' : count === 1 ? 'Last card' : info.kind === 'human' ? 'Friend' : ' '}</span>
          {bubbleFor(seatIndex)}
        </div>;
      })}
    </div>
    <div className="game-table">
      <button className="draw-pile" onClick={pickUp} disabled={!yourMove || !!staged.length || missTurn} aria-label={missTurn ? 'Draw pile unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Draw a card'}><CardImage code="back" />{drawingNow?.penalty && <span key={`count-${showing?.id}`} className="draw-count" aria-hidden="true" data-testid="draw-count" style={{ animationDuration: `${drawingTiming.total}ms` }}>+{drawingNow.count}</span>}<span>{!yourMove ? 'Deck' : missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : legalCards.length ? 'Pick up instead' : 'Draw'}</span></button>
      <div className="discard-pile">
        <span className="pile-wrap" data-testid="discard-pile" data-top={pile[pile.length - 1]} data-order={visible.discardPile.slice(-6).join(' ')}>
          {pile.map((card, index) => <span key={card + index} className={'pile-card depth-' + (pile.length - 1 - index)}><CardImage code={card} /></span>)}
          {visible.flying && <span ref={flyRef} key={`fly-${showing?.id}-${visible.flying.index}`} className="pile-card flying" data-testid="flying-card" data-card={visible.flying.card}><CardImage code={visible.flying.card} /></span>}
        </span>
        <span>Suit <b className={visible.currentSuit === 'H' || visible.currentSuit === 'D' ? 'red' : ''}>{suitSymbols[visible.currentSuit]} {suitNames[visible.currentSuit]}</b></span>
        {seats > 2 && <span className="direction" aria-label={`Play goes ${visible.direction === 1 ? 'clockwise' : 'anticlockwise'}`}>{visible.direction === 1 ? <ArrowClockwise size={14} weight="bold" /> : <ArrowCounterClockwise size={14} weight="bold" />}{visible.direction === 1 ? 'Clockwise' : 'Anticlockwise'}</span>}
      </div>
      {visible.announce && <div key={`${showing?.id}-${showing?.at}`} className={'table-announce ' + visible.announce.tone} data-testid="table-announce" aria-hidden="true">{visible.announce.text}</div>}
    </div>
    <p className={'game-notice' + (warn && yourMove ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{notice}</p>
    {recent.length > 1 && <ul className="move-log" aria-label="Recent moves">{recent.slice(0, -1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
    <div className={'your-seat' + (visible.active === 0 ? ' turn' : '')} data-seat="0">
      {ouchFor(0)}
      {bubbleFor(0)}
      {yourMove && <span className="your-move-tag" aria-hidden="true">Your move</span>}
      {yourMove && missTurn && <div className="miss-turn-action"><strong>An eight was played</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you miss this turn.'}</p><button className="primary" onClick={pickUp}>Accept missed turn <ArrowRight size={18} /></button></div>}
      {staged.length === 0 && <div className="game-actions"><button className={'hint-button ' + (hint ? 'active' : '')} onClick={() => setHint((current) => !current)} disabled={!yourMove}><Lightbulb size={19} weight={hint ? 'fill' : 'regular'} />{hint ? 'Hide hint' : 'Show hint'}</button><button className="pace-button" onClick={() => setReactOpen(true)} aria-label="Send a reaction"><Smiley size={16} />React</button><button className="pace-button sort-button" onClick={() => setGame((current) => ({ ...current, hands: current.hands.map((cards, seatIndex) => (seatIndex === 0 ? sortHand(cards) : cards)) }))}><SortAscending size={16} />Sort</button></div>}
      {hint && yourMove && <p className="game-hint"><Lightbulb size={17} />{hintText}</p>}
      <div className="hand-row"><span>{hand.length} in hand</span><button className={'last-card-button' + (lastCalled ? ' called' : '')} onClick={callLastCard} aria-pressed={lastCalled} data-testid="last-card-button" aria-label={lastCalled ? 'Last Card called' : 'Call Last Card'}><HandPalm size={20} weight={lastCalled ? 'fill' : 'regular'} /><span>{lastCalled ? 'Called' : 'Last Card'}</span></button></div>
      <div className={'player-hand' + (hand.length > 10 ? ' dense' : '') + (hand.length > 8 ? ' two-rows' : '')} style={{ '--n': hand.length, '--per': Math.ceil(hand.length / 2) } as CSSProperties} aria-label="Your hand">
        {hand.map((card, index) => <button key={card} style={{ '--i': 0, zIndex: index + 1 } as CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={(hint && yourMove && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!yourMove} aria-label={staged.includes(card) ? `Deselect ${cardIdLabel(card)}` : `Select ${cardIdLabel(card)}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}
      </div>
      {staged.length > 0 && <div className="multi-action"><p>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected. They land in the order you tapped them, and the last one sets the suit.`}</p><button className="primary" onClick={playStaged} disabled={!yourMove}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>}
    </div>
    {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); commit(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
    <ReactionSheet open={reactOpen} onOpenChange={setReactOpen} onPick={react} />
  </section>;
}

/** The only way to talk at the table: eighteen friendly reactions. */
function ReactionSheet({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (id: string) => void }) {
  return <BottomSheet open={open} onOpenChange={onOpenChange} title="Say something" description="Everyone at the table sees it for a few seconds." snap={0.75}>
    <div className="reaction-grid" role="group" aria-label="Reactions">{REACTIONS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id}>{entry.emoji && <span className="reaction-emoji" aria-hidden="true">{entry.emoji}</span>}<span>{entry.text}</span></button>)}</div>
  </BottomSheet>;
}
