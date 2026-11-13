import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, CheckCircle, HandPalm, Lightbulb, SortAscending } from '@phosphor-icons/react';
import type { ComputerLevel } from '../switch/ai';
import { cardIdLabel } from '../switch/cards';
import { explainUnplayable } from '../switch/coach';
import { applyTableAction, createTable, dealTo, isLegalTablePlay, tableLegalMoves, tablePlaces, type TableState } from '../switch/table';
import { chooseTableAction } from '../switch/tableAi';
import type { CardId, GameState, Suit } from '../switch/types';
import { cue } from '../feedback';
import { logComputerGame } from '../switch/logGame';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { CardImage, CardShower, rank, suit, suitNames, suitSymbols } from '../ui';
import RealCards from './RealCards';
import { sortHand } from '../switch/sortHand';

const NAMES = ['John', 'Paul', 'George', 'Ringo'];
const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;

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

/** What a move did, in a few plain words. */
function describe(before: TableState, after: TableState, who: string, action: { type: string; cards?: readonly CardId[]; chosenSuit?: Suit }): string {
  if (action.type === 'accept-missed-turn') return `${who} miss${who === 'You' ? '' : 'es'} a turn.`;
  if (action.type === 'draw') {
    const count = pickups(before) || 1;
    return `${who} pick${who === 'You' ? '' : 's'} up ${count} card${count === 1 ? '' : 's'}.`;
  }
  const cards = action.cards ?? [];
  const r = rank(cards[0]);
  const plays = who === 'You' ? 'play' : 'plays';
  let text = cards.length === 1 ? `${who} ${plays} ${cards[0]}` : `${who} ${plays} ${cards.length} ${r}s`;
  if (after.pendingPenalty?.kind === 'draw-two' || after.pendingPenalty?.kind === 'black-king') text += `: ${after.pendingPenalty.cards} cards at stake`;
  else if (r === '8') text += ': next player misses a turn';
  else if (r === '7') text += ': play again';
  else if (r === 'J') text += cards.length % 2 === 0 || before.hands.length === 2 ? ': play again' : `: play now goes ${after.direction === 1 ? 'clockwise' : 'anticlockwise'}`;
  else if (r === 'A') text += `: the suit is ${suitNames[action.chosenSuit ?? suit(cards[cards.length - 1])]}`;
  return text + '.';
}

type Props = { opponents: number; level: ComputerLevel; onExit: () => void; onOpenCards: () => void; onStartNight: () => void; onChange: () => void };

export default function TableGame({ opponents, level, onExit, onOpenCards, onStartNight, onChange }: Props) {
  const seats = opponents + 1;
  const names = useMemo(() => ['You', ...NAMES.slice(0, opponents)], [opponents]);
  const [game, setGame] = useState<TableState>(() => createTable(seats, Math.random, pickDealer(seats)));
  const [recent, setRecent] = useState<string[]>([]);
  const [staged, setStaged] = useState<CardId[]>([]);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [warn, setWarn] = useState('');
  const [hint, setHint] = useState(false);
  const [awaitingLastCard, setAwaitingLastCard] = useState(false);
  const [flash, setFlash] = useState<CardId[]>([]);
  const logged = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;

  const yourTurn = game.status === 'playing' && game.turn === 0;
  const hand = game.hands[0];
  const topCard = game.discardPile[game.discardPile.length - 1];
  const pending = game.pendingPenalty;
  const missTurn = pending?.kind === 'miss-turn';
  const pendingDraw = pickups(game);
  const legal = tableLegalMoves(game, 0);
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = hand.filter(canPlay);
  const places = game.status === 'won' ? tablePlaces(game) : [];
  const youWon = game.winner === 0;

  const push = (line: string) => setRecent((current) => [...current.slice(-2), line]);

  // The computers play one after another, each pausing so you can follow what happened.
  useEffect(() => {
    if (game.status !== 'playing' || game.turn === 0 || awaitingLastCard) return;
    const timer = setTimeout(() => {
      const before = gameRef.current;
      const action = chooseTableAction(before, Math.random, level);
      const after = applyTableAction(before, action);
      const who = names[before.turn];
      let line = describe(before, after, who, action);
      if (after.status === 'playing' && after.hands[before.turn].length === 1) line += ` ${who} says "Last Card".`;
      push(line);
      setGame(after);
      if (after.status === 'won') cue('bad');
    }, 1000);
    return () => clearTimeout(timer);
  }, [game.status, game.turn, game.move, awaitingLastCard, level, names]);

  // Every finished game goes in the log.
  useEffect(() => {
    if (game.status !== 'won' || logged.current) return;
    logged.current = true;
    logComputerGame({ opponents, level, won: youWon, place: places[0], moves: game.move });
    if (youWon) cue('win');
  }, [game.status, game.move, opponents, level, youWon, places]);

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
    if (!yourTurn || awaitingLastCard) return;
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
    cue('play');
    const action = { type: 'play' as const, cards, ...(chosenSuit ? { chosenSuit } : {}) };
    const after = applyTableAction(game, action);
    push(describe(game, after, 'You', action));
    setGame(after);
    setStaged([]);
    if (after.status === 'playing' && after.hands[0].length === 1) { cue('last-card'); setAwaitingLastCard(true); }
  }

  function playStaged() {
    if (!staged.length) return;
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
    if (!isLegalTablePlay(game, { type: 'play', cards: staged })) {
      refuse([...staged], staged.length === hand.length && rank(staged[staged.length - 1]) === '7' ? 'You cannot finish on a seven. Keep a card back.' : staged.length === hand.length && rank(staged[staged.length - 1]) === 'J' && seats === 2 ? 'You cannot finish on a jack in a two-player game.' : staged.length === hand.length && rank(staged[staged.length - 1]) === 'J' && staged.length % 2 === 0 ? 'Two or four jacks mean play again, so they cannot be your last cards. Keep a card back.' : 'Those cards cannot be played in that order. Try a different order, or play fewer cards.');
      return;
    }
    commit(staged);
  }

  function pickUp() {
    if (!yourTurn || awaitingLastCard) return;
    cue(pendingDraw ? 'penalty' : 'draw');
    const action = missTurn ? { type: 'accept-missed-turn' as const } : { type: 'draw' as const };
    const after = applyTableAction(game, action);
    push(describe(game, after, 'You', action));
    setGame(after);
    setStaged([]);
  }

  function answerLastCard(said: boolean) {
    cue(said ? 'good' : 'penalty');
    setAwaitingLastCard(false);
    if (!said) {
      setGame((current) => dealTo(current, 0, 2));
      push('You forgot "Last Card" and pick up two penalty cards.');
    } else push('You called "Last Card".');
  }

  function again() {
    logged.current = false;
    setRecent([]); setStaged([]); setAceChoice(null); setHint(false); setAwaitingLastCard(false);
    setGame(createTable(seats, Math.random, pickDealer(seats)));
  }

  const hintText = pending?.kind === 'draw-two' ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.`
    : pending?.kind === 'black-king' ? `Play another black king, or a red king to cancel 5, or pick up ${pendingDraw}.`
    : missTurn ? 'Play another eight to pass the missed turn, or accept it.'
    : legalCards.length ? `You can play ${legalCards.join(', ')}. You may also pick up one card instead.` : 'You have no legal card. Pick up one card.';

  const record = (() => { const club = readClub(); const mine = getComputerGames(club).filter((entry) => entry.playerId === getMeId(club)); return summariseComputerGames(mine); })();

  if (game.status === 'won') {
    return <section className="tutorial game-tutorial table-game" aria-label="Game over">
      <CardShower trigger={youWon ? `won-${game.move}` : null} />
      <div className="completion">
        <CheckCircle size={60} weight="light" />
        <h1>{youWon ? <>You won the<br />table.</> : <>{names[game.winner ?? 0]} won<br />this one.</>}</h1>
        <p>{youWon ? `You beat ${opponents} computers.` : `You finished ${ordinal(places[0])} of ${seats} with ${hand.length} card${hand.length === 1 ? '' : 's'} left.`}</p>
        <ol className="place-list" aria-label="Final places">{[...game.hands.keys()].sort((a, b) => places[a] - places[b] || a - b).map((seat) => <li key={seat} className={seat === 0 ? 'me' : ''}><b>{ordinal(places[seat])}</b><span>{names[seat]}</span><em>{game.hands[seat].length === 0 ? 'Out' : `${game.hands[seat].length} left`}</em></li>)}</ol>
        {record.games > 0 && <p className="record-line" role="status">Logged. Against the computer you have won {record.wins} of {record.games} ({Math.round(record.winRate * 100)}%).</p>}
        <button className="primary" onClick={again}><ArrowCounterClockwise size={18} />Deal again</button>
        <button className="secondary" onClick={onChange}>Change the table</button>
        <RealCards onStartNight={onStartNight} />
        <button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button>
      </div>
    </section>;
  }

  return <section className="tutorial game-tutorial table-game" aria-label={`Game against ${opponents} computers`}>
    <div className={'turn-banner ' + (yourTurn ? 'you' : 'computer')} aria-live="polite"><span className="turn-dot" aria-hidden="true" /><span>{yourTurn ? 'YOUR TURN' : `${names[game.turn].toUpperCase()}'S TURN`}</span><em className="dealer-chip" aria-label={`Dealer: ${names[game.dealer]}`}>Dealer · {names[game.dealer]}</em><button onClick={onExit}>Exit game</button></div>
    <div className="seat-row" role="list" aria-label="Players at the table">
      {names.slice(1).map((name, index) => {
        const seat = index + 1;
        const count = game.hands[seat].length;
        return <div role="listitem" key={name} className={'seat' + (game.turn === seat ? ' turn' : '') + (game.dealer === seat ? ' dealer' : '')} aria-label={`${name} has ${count} cards${game.dealer === seat ? ', dealer' : ''}${game.turn === seat ? ', playing now' : ''}`}>
          <span className="seat-name">{name}{game.dealer === seat && <i className="dealer-pip" title="Dealer">D</i>}</span>
          <span className="seat-fan" aria-hidden="true">{Array.from({ length: Math.min(4, count) }, (_, i) => <CardImage code="back" key={i} />)}</span>
          <strong className={count === 1 ? 'last' : ''}>{count}</strong>
        </div>;
      })}
    </div>
    <div className="game-table">
      <button className="draw-pile" onClick={pickUp} disabled={!yourTurn || awaitingLastCard || !!staged.length || missTurn} aria-label={missTurn ? 'Draw pile unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Draw a card'}><CardImage code="back" /><span>{missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : legalCards.length ? 'Pick up instead' : 'Draw'}</span></button>
      <div className="discard-pile"><span className="pile-wrap"><span key={`${game.move}-${topCard}`} className={'pile-card from-' + (game.turn === 0 ? 'computer' : 'you')}><CardImage code={topCard} /></span></span>
        <span>Current suit <b className={game.currentSuit === 'H' || game.currentSuit === 'D' ? 'red' : ''}>{suitSymbols[game.currentSuit]} {suitNames[game.currentSuit]}</b></span>
        {seats > 2 && <span className="direction" aria-label={`Play goes ${game.direction === 1 ? 'clockwise' : 'anticlockwise'}`}>{game.direction === 1 ? <ArrowClockwise size={14} weight="bold" /> : <ArrowCounterClockwise size={14} weight="bold" />}{game.direction === 1 ? 'Clockwise' : 'Anticlockwise'}</span>}
      </div>
    </div>
    <p className={'game-notice' + (warn && yourTurn ? ' warn' : '')} aria-live="polite" role={warn ? 'alert' : undefined}>{warn || (yourTurn ? (recent.length === 0 ? `${names[game.dealer]} dealt. ${game.turn === 0 ? 'You play first.' : ''}` : recent[recent.length - 1]) : `${names[game.turn]} is choosing…`)}</p>
    {recent.length > 1 && <ul className="move-log" aria-label="Recent moves">{recent.slice(0, -1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
    {yourTurn && missTurn && !awaitingLastCard && <div className="miss-turn-action"><strong>An eight was played</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you miss this turn.'}</p><button className="primary" onClick={pickUp}>Accept missed turn <ArrowRight size={18} /></button></div>}
    {awaitingLastCard
      ? <div className="last-card-call"><HandPalm size={27} /><strong>One card remaining</strong><p>Say "Last Card" now. Forgetting costs two cards.</p><button className="primary" onClick={() => answerLastCard(true)}>Say "Last Card"</button><button className="text-link" onClick={() => answerLastCard(false)}>Continue without saying it</button></div>
      : <>
        {staged.length === 0 && <div className="game-actions"><button className={'hint-button ' + (hint ? 'active' : '')} onClick={() => setHint((current) => !current)} disabled={!yourTurn}><Lightbulb size={19} weight={hint ? 'fill' : 'regular'} />{hint ? 'Hide hint' : 'Show hint'}</button><button className="hint-button sort-button" onClick={() => setGame((current) => ({ ...current, hands: current.hands.map((cards, seat) => (seat === 0 ? sortHand(cards) : cards)) }))}><SortAscending size={17} />Sort</button><span>{hand.length} cards in your hand · you play {game.hands.length > 2 ? `after ${names[(game.direction === 1 ? game.hands.length - 1 : 1)]}` : 'next'}</span></div>}
        {hint && <p className="game-hint"><Lightbulb size={17} />{hintText}</p>}
        <div className={'player-hand' + (hand.length > 10 ? ' dense' : '') + (hand.length > 8 ? ' two-rows' : '')} style={{ '--n': hand.length, '--per': Math.ceil(hand.length / 2) } as CSSProperties} aria-label="Your hand">
          {hand.map((card, index) => <button key={card} style={{ '--i': 0, zIndex: index + 1 } as CSSProperties} data-card={card} onClick={() => chooseCard(card)} className={(hint && yourTurn && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected ' : '') + (flash.includes(card) ? 'illegal' : '')} disabled={!yourTurn} aria-label={staged.includes(card) ? `Deselect ${cardIdLabel(card)}` : `Select ${cardIdLabel(card)}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} />{staged.includes(card) && <i className="order-badge" aria-hidden="true">{staged.indexOf(card) + 1}</i>}</button>)}
        </div>
        {staged.length > 0 && <div className="multi-action"><p>{staged.length === 1 ? '1 card selected' : `${staged.length} cards selected, played in the order you tapped them. The last card sets the suit.`}</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Clear selection</button></div>}
      </>}
    {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); commit(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
  </section>;
}
