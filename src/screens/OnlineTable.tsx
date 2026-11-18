import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, CheckCircle, Eye, FilmStrip, HandPalm, Lightbulb, ShareNetwork, Smiley, SortAscending, Trophy } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { useScreenPortal } from '../mobile';
import { cardIdLabel } from '../switch/cards';
import { explainUnplayable } from '../switch/coach';
import { isLegalTablePlay, openingNote, tableLegalMoves, tablePlaces, type TableState } from '../switch/table';
import type { CardId, GameAction, GameState, Suit } from '../switch/types';
import { cue } from '../feedback';
import { logComputerGame, logOnlineNight, logSeriesResult } from '../switch/logGame';
import { getComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { drawTiming, LAST_CARD_GRACE_MS, paceIsHuman, planTurn, REDUCED, SPEEDS, stepDuration, visibleAt, type Step } from '../switch/presentation';
import { readSpeed } from '../switch/activeTable';
import { modeInfo, pendingGames, seriesPlayerName, standings } from '../switch/series';
import { clearSeat, loadSeat, onlineModeBlurb, reactionOf, RoomApiError, tableInvite, tableName, useRoom, type RoomView } from '../switch/onlineRoom';
import { logReaction } from '../switch/gameReplay';
import { GameEnding } from './GameEnding';
import { beginReplay, Bubble, ReactionSheet, useBubbles, useReplayRecorder } from './tableTalk';
import { SuitBadge, TableToggles, useTablePrefs } from './tablePrefs';
import { sortHand } from '../switch/sortHand';
import { HahaBanner, hahaText, type Haha } from './HahaBanner';
import { CardImage, CardShower, FeltHeader, rank, suitNames, suitSymbols } from '../ui';
import { describe, ordinal } from './TableGame';
import RealCards from './RealCards';

type Showing = { id: number; before: TableState; after: TableState; action: GameAction; steps: Step[]; at: number; line: string };

const reduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; } };
const pickups = (state: TableState) => (state.pendingPenalty && state.pendingPenalty.kind !== 'miss-turn' ? state.pendingPenalty.cards : 0);
const modeName = (view: RoomView) => view.mode === 'match' ? 'Match' : modeInfo(view.mode).name;

type Props = { onLeave: () => void; onOpenCards: () => void; onStartNight: () => void; onReplay?: (gameId: string) => void };

/** A private table with friends and family: the waiting room, the games, and the results. The server owns the game; this screen shows it. */
export default function OnlineTable({ onLeave, onOpenCards, onStartNight, onReplay }: Props) {
  const [seat] = useState(loadSeat);
  /** Between your own games you can watch any game being played. Your own game, once dealt, always comes first. */
  const [watch, setWatch] = useState<string | null>(null);
  const room = useRoom(seat, watch);
  const { view, gone } = room;
  useOnlineRecord(view);
  useEffect(() => { if (view?.table?.playing && !view.you.watching) setWatch(null); }, [view?.table?.id, view?.you.watching]);
  if (!seat) return <Gone message="You are not sitting at a table." onLeave={onLeave} />;
  if (gone) return <Gone message="This table has ended, or your seat there is no longer valid." onLeave={() => { clearSeat(); onLeave(); }} />;
  if (!view) return <section className="friends-table" role="status"><FeltHeader compact title="Taking your seat." intro={`Table ${seat.code}…`} cards={['AS', 'KH']} /></section>;
  if (view.status === 'lobby') return <WaitingRoom view={view} room={room} onLeave={() => { clearSeat(); onLeave(); }} />;
  const leave = () => { clearSeat(); onLeave(); };
  if (!view.game) return <><NewsToasts view={view} /><Board view={view} room={room} onWatch={setWatch} onLeave={leave} /></>;
  return <><NewsToasts view={view} /><Game key={view.gameNo} view={view} room={room} onExit={onLeave} onLeave={leave} onOpenCards={onOpenCards} onStartNight={onStartNight} onReplay={onReplay} onWatch={setWatch} /></>;
}

/** Announcements from every game in the room, wherever you are: a game won, a player knocked out, the winner. */
function NewsToasts({ view }: { view: RoomView }) {
  const { screenRef } = useScreenPortal();
  const seen = useRef(Math.max(0, ...view.news.map((entry) => entry.n)));
  const [shown, setShown] = useState<{ n: number; text: string }[]>([]);
  const latest = view.news.at(-1)?.n ?? 0;
  useEffect(() => {
    const fresh = view.news.filter((entry) => entry.n > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].n;
    cue('good');
    setShown((current) => [...current, ...fresh].slice(-3));
    fresh.forEach((entry) => window.setTimeout(() => setShown((current) => current.filter((item) => item.n !== entry.n)), 6500));
  }, [latest]);
  if (!shown.length || !screenRef.current) return null;
  return createPortal(<div className="news-toasts" role="status" aria-live="polite" data-testid="news-toasts">{shown.map((entry) => <p key={entry.n}>{entry.text}</p>)}</div>, screenRef.current);
}

/**
 * Every game you play online is a stat, saved once under the table's own game id. A game you only watched is not
 * yours, so it is not saved. When a tournament ends, how it ended for you is written onto your last game in it.
 */
function useOnlineRecord(view: RoomView | null) {
  const series = useRef<string | null>(null);
  const logged = useRef(new Set<string>());
  // The server keeps every game you played, so one that ended while this phone was closed is still saved.
  const latest = view?.history.at(-1)?.gameId ?? null;
  useEffect(() => {
    if (!view) return;
    for (const entry of view.history) {
      if (logged.current.has(entry.gameId)) continue;
      logged.current.add(entry.gameId);
      const humans = entry.seats.filter((seat) => seat.kind === 'human').map((seat) => seat.name);
      logComputerGame({
        id: entry.gameId, opponents: entry.seats.length - 1, level: view.level, won: entry.winner === 0, place: entry.seats[0].place, moves: entry.moves,
        rivals: entry.seats.slice(1).map((seat) => ({ name: seat.name, place: seat.place, ...(seat.kind === 'human' ? { human: true } : {}) })),
        online: { code: view.code, humans, autoMoves: entry.seats[0].autoMoves },
        ...(entry.seriesId ? { mode: view.mode, seriesId: entry.seriesId } : {}),
      });
      logOnlineNight({ gameId: entry.gameId, code: view.code, mode: view.mode, finishedAt: entry.finishedAt, seats: entry.seats });
    }
  }, [latest, view?.history.length]);
  const result = view?.result ?? null;
  useEffect(() => {
    const run = view?.series;
    if (!run?.over || !run.outcome) return;
    const id = run.state.base.id;
    if (series.current === id) return;
    const mine = getComputerGames(readClub()).filter((game) => game.seriesId === id).sort((a, b) => a.playedAt.localeCompare(b.playedAt)).at(-1);
    if (!mine) return;
    series.current = id;
    logSeriesResult(mine.id, { won: run.outcome.winnerId === run.me, place: run.outcome.order.indexOf(run.me) + 1, players: run.state.base.players.length, games: run.state.base.games });
  }, [view?.series?.over, view?.series?.state.base.id, result?.gameId]);
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
  const what = view.mode === 'single' ? 'a game of Switch' : view.mode === 'match' ? `a game of Switch: ${tableName(view.mode, view.setup, 'Match').toLowerCase()}` : `a game of Switch: ${modeName(view)}`;
  const invite = tableInvite(view.code, host, what);

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
    <p className="table-mode" data-testid="table-mode"><strong>{tableName(view.mode, view.setup, modeName(view))}</strong>{view.setup.setsToWin ? ` · first to ${view.setup.setsToWin} sets` : ''}{view.setup.limit ? ` · first to ${view.setup.limit} loses` : ''}<span>{onlineModeBlurb(view.mode, view.setup)}</span></p>
    <button className="secondary share-button" onClick={share}><ShareNetwork size={18} weight="bold" />Invite friends</button>
    <ul className="waiting-seats" aria-label="Who is here">
      {people.map((entry, index) => <li key={index} className={entry.you ? 'me' : ''}><strong>{entry.you ? `${entry.name} (you)` : entry.name}</strong>{entry.host && <em>Host</em>}</li>)}
      {Array.from({ length: Math.max(0, free) }, (_, index) => <li key={`free-${index}`} className="free"><span>Open seat</span></li>)}
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

type GameProps = { view: RoomView; room: Room; onExit: () => void; onLeave: () => void; onOpenCards: () => void; onStartNight: () => void; onReplay?: (gameId: string) => void; onWatch: (table: string | null) => void };

function Game({ view, room, onExit, onLeave, onOpenCards, onStartNight, onReplay, onWatch }: GameProps) {
  const watching = view.you.watching;
  const names = useMemo(() => view.seats.map((entry) => (entry.you ? 'You' : entry.name)), [view.seats.map((entry) => `${entry.name}${entry.you ? '*' : ''}`).join('|')]);
  const seats = view.seats.length;
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
  const { bubbles, say: sayBubble } = useBubbles();
  const prefs = useTablePrefs();
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
  const sectionRef = useRef<HTMLElement>(null);
  const flyRef = useRef<HTMLSpanElement>(null);
  const setCalled = (value: boolean) => { calledRef.current = value; setCalledState(value); };
  const push = (line: string) => setRecent((current) => [...current.slice(-3), line]);
  // The game is recorded as it is seen from this seat, under the id it is logged by, so it can be replayed from History.
  const gameId = `${view.code}-${view.gameNo}`;
  const recorder = useReplayRecorder(gameId, () => beginReplay(gameId, view.game!, names, view.seats.flatMap((entry, seatIndex) => (entry.kind === 'computer' ? [seatIndex] : [])), true, room.serverNow()));
  /** Who has really said "Last Card": the table announces it only for them (computers always say it). */
  const saidLast = view.seats.map((entry) => entry.lastCardCalled);

  const visible = showing ? visibleAt(showing.before, showing.after, showing.steps, showing.at) : visibleAt(game, game, [], 0);
  const yourMove = !watching && !showing && game.status === 'playing' && game.turn === 0;
  const rawHand = watching ? [] : showing && showing.before.turn === 0 && showing.action.type === 'draw' ? showing.before.hands[0] : game.hands[0];
  // Sort is a setting, not a one-off: while it is on, the hand is shown sorted and new cards slot straight in.
  const [haha, setHaha] = useState<Haha>(null);
  const shout = (name: string) => setHaha((current) => ({ id: (current?.id ?? 0) + 1, text: hahaText(name) }));
  const [sortOn, setSortOn] = useState(false);
  const hand = useMemo(() => (sortOn ? sortHand(rawHand) : rawHand), [sortOn, rawHand]);
  const pending = game.pendingPenalty;
  const missTurn = pending?.kind === 'miss-turn';
  const pendingDraw = pickups(game);
  const legal = yourMove ? tableLegalMoves(game, 0) : [];
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = hand.filter(canPlay);
  const gameOver = game.status === 'won' && !showing;
  // The ending comes first, then the results (owner decision, 16 Nov 2026). Automated runs skip it unless asked.
  const [endSeenFor, setEndSeenFor] = useState<string | null>(null);
  const showEnding = paceIsHuman() || (() => { try { return window.localStorage.getItem('switchShowEnding') === '1'; } catch { return false; } })();
  const endKey = `${view.code}-${view.gameNo}`;
  const finished = gameOver && (endSeenFor === endKey || !showEnding);
  const ending = gameOver && !finished;
  const youWon = !watching && game.winner === 0;
  const lastCalled = called || (!watching && view.seats[0].lastCardCalled);
  const outList = (showing ? showing.before : game).out ?? [];
  const youOutAt = !watching && game.playOn && game.status === 'playing' ? (game.out ?? []).indexOf(0) + 1 : 0;

  /** Shows one turn from the server: the cards land in order, then the effect, exactly as at the computer table. */
  function show(before: TableState, action: GameAction, after: TableState, missedCall: boolean, auto: boolean) {
    showId.current += 1;
    const steps = planTurn(before, action, after, names, { think: false, missedCall, called: saidLast });
    let line = describe(before, after, names[before.turn], action);
    if (names[before.turn] !== 'You' && saidLast[before.turn] && after.status === 'playing' && after.hands[before.turn].length === 1) line += ` ${names[before.turn]} says "Last Card".`;
    if (missedCall) shout(names[before.turn]);
    if (missedCall) line += `${names[before.turn] === 'You' ? ' You had' : ` ${names[before.turn]} had`} not said "Last Card", so two cards are picked up.`;
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
    fresh.forEach((entry) => recorder.move({ seat: entry.seat, type: entry.type === 'accept-missed-turn' ? 'miss' : entry.type, ...(entry.cards.length ? { cards: [...entry.cards] } : {}), ...(entry.chosenSuit ? { suit: entry.chosenSuit } : {}), counts: [...entry.counts], ...(entry.auto ? { auto: true } : {}) }, entry.at));
    if (view.game.status === 'won' && !watching) recorder.finish(view.game.winner, fresh[fresh.length - 1].at);
    const before = gameRef.current;
    const move = fresh[0];
    if (fresh.length === 1 && move.type !== 'spot' && before.turn === move.seat) {
      const action: GameAction = move.type === 'play' ? { type: 'play', cards: [...move.cards], ...(move.chosenSuit ? { chosenSuit: move.chosenSuit } : {}) } : move.type === 'draw' ? { type: 'draw' } : { type: 'accept-missed-turn' };
      show(before, action, view.game, move.missedLastCard, move.auto);
    } else {
      if (fresh.length === 1 && move.type === 'spot') { cue('penalty'); shout(names[move.seat]); push(`${names[move.seat]} did not say "Last Card" in time, so ${names[move.seat] === 'You' ? 'you pick' : 'they pick'} up two cards.`); }
      else push(`${fresh.length} moves were played.`);
      busy.current = false;
      setGame(view.game);
    }
    if (move.seat === 0 && !watching) setCalled(false);
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
    if (step.kind === 'card' && names[step.seat] !== 'You') cue('play');
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
    const mine = flying.seat === 0 && !watching;
    const spin = (mine ? -10 : 12) + (flying.index % 2 ? 5 : -5);
    const animation = el.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${mine ? 0.85 : 0.5})`, opacity: 0.9 },
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
    const target = step.seat === 0 && !watching ? section?.querySelector<HTMLElement>('.player-hand') : section?.querySelector<HTMLElement>(`[data-seat="${step.seat}"]`);
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

  // Reactions appear beside the sender for a few seconds. Someone watching has no seat, so theirs is said in words.
  useEffect(() => {
    const fresh = (view.reactions ?? []).filter((entry) => entry.n > seenReaction.current);
    if (!fresh.length) return;
    seenReaction.current = fresh[fresh.length - 1].n;
    fresh.forEach((entry) => {
      const mine = entry.seat === 0 && !watching;
      const from = mine ? 'You' : entry.name;
      recorder.react({ seat: entry.seat, from, id: entry.id }, entry.at);
      logReaction({ gameId, at: new Date(entry.at).toISOString(), move: gameRef.current.move, from, mine, computer: false, online: true, id: entry.id });
    });
    fresh.filter((entry) => entry.seat === null).forEach((entry) => { const reaction = reactionOf(entry.id); if (reaction) push(`${entry.name} (watching): ${reaction.text}`); });
    const seated = fresh.filter((entry): entry is typeof entry & { seat: number } => entry.seat !== null);
    if (!seated.length) return;
    seated.forEach((entry) => sayBubble(entry.seat, entry.id, { priority: entry.seat === 0 && !watching }));
  }, [view]);

  // The countdowns (a slow player, the next game of a tournament) are the server's clock, shown twice a second.
  useEffect(() => {
    const ticking = (view.clock && view.table?.playing) || view.series?.next?.readyAt;
    if (!ticking) return;
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 500);
    return () => window.clearInterval(timer);
  }, [view.clock?.seat, view.table?.playing, view.series?.next?.readyAt]);

  useEffect(() => { if (gameOver && !watching) cue(youWon ? 'win' : 'bad'); }, [gameOver, youWon]);

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
    if (busy.current || before.status !== 'playing' || before.turn !== 0 || watching) return;
    const action: GameAction = { type: 'play', cards, ...(chosenSuit ? { chosenSuit } : {}) };
    if (!isLegalTablePlay(before, action)) return;
    cue('play');
    setStaged([]); setHint(false);
    void submit(action);
  }

  function playStaged() {
    if (!staged.length || busy.current) return;
    if (rank(staged[0]) === 'A' && staged.length < game.hands[0].length) { setAceChoice(staged); return; }
    if (!isLegalTablePlay(game, { type: 'play', cards: staged })) { refuse([...staged], 'Those cards cannot be played in that order. Try a different order, or play fewer cards.'); return; }
    commit(staged);
  }

  function pickUp() {
    if (!yourMove || busy.current) return;
    cue(pendingDraw ? 'penalty' : 'draw');
    setStaged([]); setHint(false);
    // Accepting a missed turn picks up nothing, so a call already made stands.
    if (!missTurn) setCalled(false);
    void submit(missTurn ? { type: 'accept-missed-turn' } : { type: 'draw' });
  }

  function callLastCard() {
    if (watching || game.status !== 'playing' || lastCalled) return;
    cue('good');
    setCalled(true);
    // Ruling 26 (amended): with a single card left, that card is both the first and the final card, so a call made
    // while it is selected, before Play is pressed, still counts.
    if (hand.length === 1) calledBeforeFinal.current = true;
    // Said after choosing the final card of a set it is too late (ruling 26): the table is only told when it still counts.
    else if (staged.length > 0 && staged.length === hand.length) return;
    void tellTableLastCard();
  }

  /**
   * A call pressed on this phone must reach the table: a dropped or busy request is tried again until the table has it.
   * Until then this phone never reports a miss, so a press can never be beaten by the clock (owner report, 18 Nov 2026).
   */
  const callSending = useRef(false);
  async function tellTableLastCard() {
    if (callSending.current) return;
    callSending.current = true;
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (!calledRef.current) return;
        try { await room.send('call'); return; } catch (reason) {
          // The game has ended or moved on without this seat: there is nothing left to call for.
          if (reason instanceof RoomApiError && [403, 404, 409].includes(reason.status)) return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, attempt < 3 ? 400 : 1000));
      }
      setCalled(false);
      setWarn('Your "Last Card" could not reach the table. Check your connection and press it again.');
    } finally { callSending.current = false; }
  }

  // Your five seconds to say "Last Card" are kept here, on your own phone, from the moment it shows you holding one
  // card. Only when they run out with no call does this phone tell the table, which then makes you pick up two.
  const exposed = !watching && game.status === 'playing' && youOutAt === 0 && game.hands[0]?.length === 1 && !lastCalled;
  const missTimer = useRef(0);
  useEffect(() => {
    if (!exposed) { window.clearTimeout(missTimer.current); missTimer.current = 0; return; }
    if (missTimer.current) return;
    const check = () => {
      if (calledRef.current || callSending.current) { missTimer.current = 0; return; }
      // A move of yours is on its way: it settles the call itself, so look again once it has landed.
      if (busy.current) { missTimer.current = window.setTimeout(check, 500); return; }
      missTimer.current = 0;
      room.send('missed').catch(() => { /* the table spots it on its own clock if this never arrives */ });
    };
    missTimer.current = window.setTimeout(check, LAST_CARD_GRACE_MS);
  }, [exposed]);
  useEffect(() => () => window.clearTimeout(missTimer.current), []);

  function react(id: string) {
    setReactOpen(false);
    room.send('react', { id }).catch((reason: Error) => { setWarn(reason.message); window.setTimeout(() => setWarn(''), 3000); });
  }

  const hintText = pending?.kind === 'draw-two' ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.`
    : pending?.kind === 'black-king' ? `Play another black king, or a red king to cancel 5, or pick up ${pendingDraw}.`
    : missTurn ? 'Play another eight to pass the missed turn, or accept it.'
    : legalCards.length ? `You can play ${legalCards.map(cardIdLabel).join(', ')}. You may also pick up one card instead.` : 'You have no legal card. Pick up one card.';

  /** Both sit directly above the hand, where the hint buttons were, so the cards stay in view and the choice is next to them. */
  const MULTI_ACTION = <div className="multi-action"><p><b>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected`}</b>{staged.length > 1 && <small>They land in the order you tapped them, and the last one sets the suit.</small>}</p><button className="primary" onClick={playStaged} disabled={!yourMove}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>;
  const SUIT_CHOOSER = <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice!; setAceChoice(null); commit(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>;

  const bubbleFor = (index: number) => {
    const bubble = bubbles[index];
    const reaction = bubble ? reactionOf(bubble.id) : null;
    return prefs.talk && bubble && reaction ? <Bubble key={bubble.n} n={bubble.n} id={bubble.id} name={names[index]} leaving={bubble.leaving} /> : null;
  };

  if (ending) {
    const winnerSeat = game.winner ?? 0;
    const lastMove = [...(view.moves ?? [])].reverse().find((move) => move.seat === winnerSeat && move.cards && move.cards.length > 0);
    return <GameEnding game={game} names={names} watching={watching} played={lastMove?.cards ? [...lastMove.cards] : undefined} onContinue={() => setEndSeenFor(endKey)} />;
  }
  if (finished) return <Finished view={view} room={room} game={game} names={names} watching={watching} youWon={youWon} warn={warn} setWarn={setWarn} onReact={() => setReactOpen(true)} onReplay={!watching && onReplay ? () => onReplay(gameId) : undefined} onWatch={onWatch} onLeave={onLeave} onOpenCards={onOpenCards} onStartNight={onStartNight}>
    <ReactionSheet open={reactOpen} onOpenChange={setReactOpen} onPick={react} />
  </Finished>;

  const clock = view.clock;
  const now = room.serverNow();
  let clockNote = '';
  if (clock && !clock.computer && game.status === 'playing' && !showing) {
    const secs = clock.autoAt !== undefined ? Math.max(0, Math.ceil((clock.autoAt - now) / 1000)) : 0;
    const quiet = clock.nudgeAt !== undefined && now >= clock.nudgeAt;
    if (names[clock.seat] === 'You') clockNote = clock.away ? 'You have been away, so the computer is playing your moves. Make a move to take over again.' : quiet ? `Your turn is taking a while. The computer will play your move in ${secs} seconds.` : '';
    else clockNote = clock.away ? `${names[clock.seat]} is away. The computer is playing their moves.` : quiet ? `${names[clock.seat]} has gone quiet. The computer will play their move in ${secs} seconds.` : '';
  }

  const activeName = names[visible.active];
  const status = yourMove ? 'YOUR MOVE' : activeName === 'You' ? 'YOU PLAY' : `${activeName.toUpperCase()} TO PLAY`;
  const pile = visible.discardPile.slice(-3);
  const drawingNow = visible.drawing;
  const drawingTiming = drawTiming(drawingNow?.count ?? 0, drawingNow?.penalty === true, timings);
  const ouchFor = (seatIndex: number) => drawingNow?.ouch && drawingNow.seat === seatIndex
    ? <span key={`ouch-${showing?.id}`} className="ouch" aria-hidden="true" data-testid="ouch" style={{ animationDelay: `${Math.round(drawingTiming.trip)}ms` }}>Ouch!</span> : null;
  const notice = warn || (!prefs.moves ? '' : visible.announce ? visible.announce.text + '.'
    : visible.flying ? `${activeName === 'You' ? 'You play' : `${activeName} plays`} ${cardIdLabel(visible.flying.card)}${visible.flying.count > 1 ? ` (${visible.flying.index + 1} of ${visible.flying.count})` : ''}.`
    : visible.drawing ? `${activeName === 'You' ? 'You pick' : `${activeName} picks`} up ${visible.drawing.count} card${visible.drawing.count === 1 ? '' : 's'}.`
    : yourMove ? (recent.length === 0 ? (openingNote(game, names) ?? `${names[game.dealer]} dealt.`) + " It is your move." : recent[recent.length - 1]) : recent[recent.length - 1] ?? openingNote(game, names) ?? `${names[game.dealer]} dealt.`);
  // Watching, every seat is someone else's, so all of them sit along the top.
  const others = watching ? names.map((name, seatIndex) => ({ name, seatIndex })) : names.slice(1).map((name, index) => ({ name, seatIndex: index + 1 }));

  return <section ref={sectionRef} className={'tutorial game-tutorial table-game online-game' + (watching ? ' watching' : '')} aria-label={`Online table ${view.code}`} data-active-seat={visible.active} data-showing={showing ? 'yes' : 'no'}>
    <HahaBanner haha={haha} />
    <div className={'turn-banner ' + (yourMove || activeName === 'You' ? 'you' : 'computer')}>
      <span className="turn-dot" aria-hidden="true" />
      <span className="turn-status" aria-live="polite" data-testid="turn-status">{status}</span>
      <em className="dealer-chip" aria-label={`Dealer: ${names[game.dealer]}`}>Dealer · {names[game.dealer]}</em>
      <TableToggles prefs={prefs} />
      <button onClick={onExit}>Exit</button>
    </div>
    {view.series && <p className="series-strip" data-testid="series-strip">{modeName(view)} · {view.table?.title}</p>}
    {room.error && <p className="clock-note" role="status">Lost touch with the table. Trying again…</p>}
    {clockNote && <p className="clock-note" role="status" data-testid="clock-note">{clockNote}</p>}
    <div className={`seat-row seats-${others.length}${others.length > 4 ? ' many' : ''}`} role="list" aria-label="Players at the table">
      {others.map(({ name, seatIndex }) => {
        const count = visible.handCounts[seatIndex];
        const active = visible.active === seatIndex;
        const info = view.seats[seatIndex];
        const out = outList.includes(seatIndex);
        return <div role="listitem" key={seatIndex} data-seat={seatIndex} className={'seat' + (active ? ' turn' : '') + (game.dealer === seatIndex ? ' dealer' : '') + (info.kind === 'human' ? ' person' : '')} aria-label={`${name} has ${count} card${count === 1 ? '' : 's'}${game.dealer === seatIndex ? ', dealer' : ''}${active ? ', playing now' : ''}`}>
          <span className="seat-name">{name}{game.dealer === seatIndex && <i className="dealer-pip" title="Dealer">D</i>}</span>
          <span className="seat-fan" aria-hidden="true">{Array.from({ length: Math.min(5, count) }, (_, i) => <CardImage code="back" key={i} />)}</span>
          <strong className={count === 1 ? 'last' : ''}>{out ? 'Out' : `${count} card${count === 1 ? '' : 's'}`}</strong>{ouchFor(seatIndex)}
          <span className="seat-state" aria-hidden="true">{out ? `Out: ${ordinal(outList.indexOf(seatIndex) + 1)}` : info.away ? 'Away' : active ? 'Playing' : count === 1 ? 'Last card' : info.kind === 'human' ? 'Friend' : ' '}</span>
          {bubbleFor(seatIndex)}
        </div>;
      })}
    </div>
    <div className="game-table">
      <button className="draw-pile" onClick={pickUp} disabled={!yourMove || !!staged.length || missTurn} aria-label={watching ? 'Deck' : missTurn ? 'Pick up unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Pick up a card'}><CardImage code="back" />{drawingNow?.penalty && <span key={`count-${showing?.id}`} className="draw-count" aria-hidden="true" data-testid="draw-count" style={{ animationDuration: `${drawingTiming.total}ms` }}>+{drawingNow.count}</span>}<span>{!yourMove ? 'Deck' : missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : 'Pick up'}</span></button>
      <div className="discard-pile">
        <span className="pile-wrap" data-testid="discard-pile" data-top={pile[pile.length - 1]} data-order={visible.discardPile.slice(-6).join(' ')}>
          {pile.map((card, index) => <span key={card + index} className={'pile-card depth-' + (pile.length - 1 - index)}><CardImage code={card} /></span>)}
          {visible.flying && <span ref={flyRef} key={`fly-${showing?.id}-${visible.flying.index}`} className="pile-card flying" data-testid="flying-card" data-card={visible.flying.card}><CardImage code={visible.flying.card} /></span>}
        </span>
        <SuitBadge suit={visible.currentSuit} aceKey={visible.announce?.text.startsWith('Ace:') ? `${showing?.id}` : null} />
        {seats > 2 && <span className="direction" aria-label={`Play goes ${visible.direction === 1 ? 'clockwise' : 'anticlockwise'}`}>{visible.direction === 1 ? <ArrowClockwise size={14} weight="bold" /> : <ArrowCounterClockwise size={14} weight="bold" />}{visible.direction === 1 ? 'Clockwise' : 'Anticlockwise'}</span>}
      </div>
      {prefs.moves && visible.announce && <div key={`${showing?.id}-${showing?.at}`} className={'table-announce ' + visible.announce.tone} data-testid="table-announce" aria-hidden="true">{visible.announce.text}</div>}
    </div>
    <p className={'game-notice' + (warn && yourMove ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{notice}</p>
    {prefs.moves && recent.length > 1 && <ul className="move-log" aria-label="Recent moves">{recent.slice(0, -1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
    {watching
      ? <div className="watch-panel" data-testid="watching" role="status">
        <Eye size={22} weight="bold" />
        <span><strong>You are watching this game</strong><small>{isOut(view) ? 'You are out of this one. Every hand is face down while you watch.' : 'You are not in this game. Every hand is face down while you watch, and your next game is dealt when it comes.'}</small></span>
        <button className="pace-button" onClick={() => setReactOpen(true)} aria-label="Send a reaction"><Smiley size={16} />React</button>
        {view.series && <button className="pace-button" onClick={() => onWatch(null)} data-testid="stop-watching">Standings</button>}
      </div>
      : <div className={'your-seat' + (visible.active === 0 ? ' turn' : '')} data-seat="0">
        {ouchFor(0)}
        {bubbleFor(0)}
        {yourMove && <span className="your-move-tag" aria-hidden="true">Your move</span>}
        {yourMove && missTurn && <div className="miss-turn-action"><strong>An eight was played</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you miss this turn.'}</p><button className="primary" onClick={pickUp}>Accept missed turn <ArrowRight size={18} /></button></div>}
        {youOutAt > 0 && <div className="out-panel" role="status" data-testid="you-are-out"><strong>You are out: {ordinal(youOutAt)} place.</strong><p>The others play on for the places still to be decided.</p></div>}
        {youOutAt === 0 && <>
          {staged.length === 0 ? <div className="game-actions"><button className={'hint-button ' + (hint ? 'active' : '')} onClick={() => setHint((current) => !current)} disabled={!yourMove}><Lightbulb size={19} weight={hint ? 'fill' : 'regular'} />{hint ? 'Hide hint' : 'Show hint'}</button><button className="pace-button" onClick={() => setReactOpen(true)} aria-label="Send a reaction"><Smiley size={16} />React</button><button className="pace-button sort-button" onClick={() => setSortOn((on) => !on)} aria-pressed={sortOn}><SortAscending size={16} weight={sortOn ? 'fill' : 'regular'} />{sortOn ? 'Sorted' : 'Sort'}</button></div> : aceChoice ? SUIT_CHOOSER : MULTI_ACTION}
          {hint && yourMove && <p className="game-hint"><Lightbulb size={17} />{hintText}</p>}
          <div className="hand-row"><span>{hand.length} in hand</span><button className={'last-card-button' + (lastCalled ? ' called' : hand.length > 3 ? ' idle' : ' due')} onClick={callLastCard} aria-pressed={lastCalled} data-testid="last-card-button" aria-label={lastCalled ? 'Last Card called' : 'Call Last Card'}><HandPalm size={20} weight={lastCalled ? 'fill' : 'regular'} /><span>{lastCalled ? 'Called' : 'Last Card'}</span></button></div>
          <div className={'player-hand' + (hand.length > 10 ? ' dense' : '') + (hand.length > 5 ? ' two-rows' : '')} style={{ '--n': hand.length, '--per': Math.ceil(hand.length / 2) } as CSSProperties} aria-label="Your hand">
            {hand.map((card, index) => <button key={card} style={{ '--i': 0, zIndex: index + 1 } as CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={(hint && yourMove && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!yourMove} aria-label={staged.includes(card) ? `Deselect ${cardIdLabel(card)}` : `Select ${cardIdLabel(card)}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}
          </div>
        </>}
      </div>}
    <ReactionSheet open={reactOpen} onOpenChange={setReactOpen} onPick={react} />
  </section>;
}

/** Knocked out of the tournament: a Knock Out you have left, or a Cup or play-off you lost. */
function isOut(view: RoomView): boolean {
  const run = view.series;
  if (!run) return false;
  return !pendingGames(run.state).some((game) => game.playerIds.includes(run.me)) && !run.over;
}

type FinishedProps = { view: RoomView; room: Room; game: TableState; names: readonly string[]; watching: boolean; youWon: boolean; warn: string; setWarn: (text: string) => void; onReact: () => void; onReplay?: () => void; onWatch: (table: string | null) => void; onLeave: () => void; onOpenCards: () => void; onStartNight: () => void; children: React.ReactNode };

/** The end of a game: who won, and in a tournament where everyone stands and what comes next. */
function Finished({ view, room, game, names, watching, youWon, warn, setWarn, onReact, onReplay, onWatch, onLeave, onOpenCards, onStartNight, children }: FinishedProps) {
  const result = view.result;
  const places = tablePlaces(game);
  const order = [...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b);
  const host = view.players.find((entry) => entry.host);
  const run = view.series;
  const deal = (label: string) => view.you.host
    ? <button className="primary" data-testid="deal-next" onClick={() => { room.send('again').catch((reason: Error) => setWarn(reason.message)); }}><ArrowCounterClockwise size={18} />{label}</button>
    : <p className="lobby-note center" role="status">Waiting for {host?.name ?? 'the host'} to deal…</p>;
  const placeList = <ol className="place-list" aria-label="Places in this game">{order.map((seatIndex) => <li key={seatIndex} className={names[seatIndex] === 'You' ? 'me' : ''}><b>{ordinal(places[seatIndex])}</b><span>{names[seatIndex]}</span><em>{game.hands[seatIndex].length === 0 ? 'Out' : `${game.hands[seatIndex].length} left`}</em></li>)}</ol>;
  const extras = <>
    {warn && <p className="lobby-note center" role="alert">{warn}</p>}
    <button className="secondary" onClick={onReact}><Smiley size={18} />Say something</button>
    {onReplay && <button className="secondary" onClick={onReplay} data-testid="watch-replay"><FilmStrip size={18} />Watch the replay</button>}
    <button className="secondary" onClick={onLeave}>Leave the table</button>
  </>;

  if (!run) {
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${view.code}-${view.gameNo}` : null} />
      <div className="completion">
        <CheckCircle size={60} weight="light" />
        <h1>{youWon ? <>You won the<br />table.</> : <>{names[game.winner ?? 0]} won<br />this one.</>}</h1>
        <p>{youWon ? 'You beat everyone at the table.' : `You finished ${ordinal(places[0])} of ${game.hands.length} with ${game.hands[0].length} card${game.hands[0].length === 1 ? '' : 's'} left.`}</p>
        {placeList}
        {result && result.seats[0].autoMoves > 0 && <p className="record-line">The computer played {result.seats[0].autoMoves} {result.seats[0].autoMoves === 1 ? 'move' : 'moves'} for you while you were away.</p>}
        <p className="record-line" role="status">Logged in your history, like every game.</p>
        {deal('Deal again')}
        {extras}
        <RealCards onStartNight={onStartNight} />
        <button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button>
      </div>
      {children}
    </section>;
  }

  const name = (id: string) => (id === run.me ? 'You' : seriesPlayerName(run.state, id));
  const tables = standings(run.state);
  const board = <div className="series-tables online-standings" data-testid="online-standings">{tables.map((table) => <div key={table.heading} className="standings"><h2>{table.heading}</h2><ul>{table.rows.map((row) => <li key={row.id} className={(row.id === run.me ? 'me ' : '') + (row.out ? 'out' : '')}><span>{row.id === run.me ? 'You' : row.name}</span><b>{row.main}</b>{row.note && <small>{row.note}</small>}</li>)}</ul></div>)}</div>;

  if (run.over && run.outcome) {
    const wonIt = run.outcome.winnerId === run.me;
    const myPlace = run.outcome.order.indexOf(run.me) + 1;
    return <section className="series-board online-series-end" aria-labelledby="online-series-title">
      <CardShower trigger={wonIt ? `series-${run.state.base.id}` : null} />
      <FeltHeader compact id="online-series-title" title={wonIt ? 'You won it.' : `${name(run.outcome.winnerId)} won it.`}
        intro={view.mode === 'dominoes' && run.outcome.loserId ? `${name(run.outcome.loserId)} reached ${view.setup.limit} first and ${run.outcome.loserId === run.me ? 'lose' : 'loses'}.` : `${modeName(view)} finished after ${run.state.base.games} games. You came ${ordinal(myPlace)} of ${run.state.base.players.length}.`} cards={['KH', 'AS']} />
      <ol className="place-list" aria-label="Final places" data-testid="series-final">{run.outcome.order.map((id, index) => <li key={id} className={id === run.me ? 'me' : ''}><b>{ordinal(index + 1)}</b><span>{name(id)}</span>{index === 0 && <em><Trophy size={14} weight="fill" /></em>}</li>)}</ol>
      {board}
      <p className="record-line" role="status">Saved in your history and trophies.</p>
      {deal(`Play another ${modeName(view)}`)}
      {extras}
      {children}
    </section>;
  }

  return <section className="series-board online-between" aria-labelledby="online-between-title">
    <CardShower trigger={youWon ? `won-${view.code}-${view.gameNo}` : null} />
    <FeltHeader compact id="online-between-title" title={watching ? `${names[game.winner ?? 0]} won.` : youWon ? 'You won that one.' : `${names[game.winner ?? 0]} won that one.`} intro={`${modeName(view)} · ${view.table?.title ?? 'Game'}`} cards={['QH', 'KS']} />
    {!watching && placeList}
    {watching && <button className="secondary" onClick={() => onWatch(null)}>Back to my table</button>}
    <TournamentBoard view={view} room={room} onWatch={onWatch} />
    {view.you.host && run.waiting > 0 && deal(run.waiting === 1 ? 'Deal the waiting game now' : `Deal the ${run.waiting} waiting games now`)}
    {extras}
    {children}
  </section>;
}

/**
 * Between your games: where everyone stands, every game being played (tap one to watch it), your next game and when
 * it is dealt, and the night's announcements. Games run side by side, so there is always something to watch.
 */
function TournamentBoard({ view, room, onWatch }: { view: RoomView; room: Room; onWatch: (table: string | null) => void }) {
  const run = view.series;
  if (!run) return null;
  const me = view.players.find((entry) => entry.you)?.name;
  const who = (name: string) => (name === me ? 'You' : name);
  const live = view.tables.filter((table) => table.playing && !table.you);
  const next = run.next;
  const secs = next?.readyAt ? Math.max(0, Math.ceil((next.readyAt - room.serverNow()) / 1000)) : null;
  return <>
    {next && <p className="next-game" role="status" data-testid="next-game"><strong>Your next game: {next.title}</strong><span>{next.players.map(who).join(', ')}.</span><em>{secs === null ? 'Dealt once the games before it finish' : secs > 0 ? `Dealt in ${secs} second${secs === 1 ? '' : 's'}` : 'Being dealt…'}</em></p>}
    {!next && !run.over && isOut(view) && <p className="next-game" role="status"><strong>You are out of this one.</strong><span>Watch the others play on. Every result is announced.</span></p>}
    {live.length > 0 && <div className="live-tables" data-testid="live-tables"><h2>Playing now</h2><ul>{live.map((table) => <li key={table.id}><span><strong>{table.title}</strong><small>{table.players.map((player) => `${who(player.name)} ${player.out ? 'out' : player.cards}`).join(' · ')}</small></span><button className="pace-button" onClick={() => onWatch(table.id)} aria-label={`Watch ${table.title}`}><Eye size={16} />Watch</button></li>)}</ul></div>}
    <div className="series-tables online-standings" data-testid="online-standings">{standings(run.state).map((table) => <div key={table.heading} className="standings"><h2>{table.heading}</h2><ul>{table.rows.map((row) => <li key={row.id} className={(row.id === run.me ? 'me ' : '') + (row.out ? 'out' : '')}><span>{row.id === run.me ? 'You' : row.name}</span><b>{row.main}</b>{row.note && <small>{row.note}</small>}</li>)}</ul></div>)}</div>
    {view.news.length > 0 && <div className="news-log"><h2>Announcements</h2><ul aria-label="Announcements">{view.news.slice(-8).reverse().map((entry) => <li key={entry.n}>{entry.text}</li>)}</ul></div>}
  </>;
}

/** A tournament with no game to show you yet (a bye, or waiting for the first round to finish). */
function Board({ view, room, onWatch, onLeave }: { view: RoomView; room: Room; onWatch: (table: string | null) => void; onLeave: () => void }) {
  const [warn, setWarn] = useState('');
  const run = view.series;
  return <section className="series-board online-between" aria-labelledby="online-board-title">
    <FeltHeader compact id="online-board-title" title={`${modeName(view)}.`} intro={run?.live ? `${run.live} game${run.live === 1 ? ' is' : 's are'} being played. Watch any of them while you wait.` : 'Waiting for the next games to be dealt.'} cards={['QH', 'KS']} />
    <TournamentBoard view={view} room={room} onWatch={onWatch} />
    {view.you.host && run && run.waiting > 0 && <button className="primary" data-testid="deal-next" onClick={() => { room.send('again').catch((reason: Error) => setWarn(reason.message)); }}><ArrowCounterClockwise size={18} />Deal the waiting games now</button>}
    {warn && <p className="lobby-note center" role="alert">{warn}</p>}
    <button className="secondary" onClick={onLeave}>Leave the table</button>
  </section>;
}
