import { useState } from 'react';
import { ArrowRight, Cards, HandPalm, Lightbulb, UsersThree } from '@phosphor-icons/react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { applyTableAction, createTable, drawForSeat, MAX_SEATS, MIN_SEATS, tableLegalMoves, type TableState } from '../switch/table';
import type { CardId, Suit } from '../switch/types';
import { CardImage, rank, suitNames, suitSymbols } from '../ui';

type Phase = 'setup' | 'cover' | 'turn' | 'won';

type Props = {
  onExit: () => void;
  onScore: () => void;
  /** Lets the page reset its scroll position whenever the screen changes. */
  onStatusChange: (key: string) => void;
};

function uniqueNames(raw: readonly string[], seats: number): string[] {
  const used = new Map<string, number>();
  return Array.from({ length: seats }, (_, index) => {
    const base = raw[index]?.trim() || `Player ${index + 1}`;
    const count = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function cardWord(count: number) {
  return `${count} card${count === 1 ? '' : 's'}`;
}

function describePlay(name: string, before: TableState, after: TableState, cards: readonly CardId[], aceSuit?: Suit): string {
  const first = rank(cards[0]);
  let text = cards.length === 1 ? `${name} played ${cards[0]}.` : `${name} played ${cards.length} ${first}s together.`;
  const penalty = after.pendingPenalty;
  if (penalty?.kind === 'draw-two' || penalty?.kind === 'black-king') text += ` ${cardWord(penalty.cards)} are now at stake.`;
  else if (penalty?.kind === 'miss-turn') text += ' The next player misses a turn unless they play an eight.';
  else if (before.pendingPenalty?.kind === 'black-king') text += ' The red king cancels the penalty.';
  else if (first === '7') text += ' A seven means play again.';
  else if (first === 'J') text += after.direction !== before.direction ? ' Play reverses direction.' : ' Direction stays the same.';
  else if (first === 'A' && aceSuit) text += ` The suit is now ${suitNames[aceSuit]}.`;
  return text;
}

export default function PassAndPlay({ onExit, onScore, onStatusChange }: Props) {
  const keyboard = useKeyboard();
  const [seats, setSeats] = useState(3);
  const [rawNames, setRawNames] = useState<string[]>(Array(MAX_SEATS).fill(''));
  const [players, setPlayers] = useState<string[]>([]);
  const [phase, setPhaseState] = useState<Phase>('setup');
  const [table, setTable] = useState<TableState | null>(null);
  const [notice, setNotice] = useState('');
  const [lastActor, setLastActor] = useState<number | null>(null);
  const [staged, setStaged] = useState<CardId[]>([]);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);

  function setPhase(next: Phase, move = 0) {
    setPhaseState(next);
    onStatusChange(`${next}-${move}`);
  }

  function deal(firstSeat = Math.floor(Math.random() * seats), names = players) {
    keyboard.hide();
    const resolved = names.length === seats && phase !== 'setup' ? names : uniqueNames(rawNames, seats);
    const next = createTable(seats, Math.random, firstSeat);
    setPlayers(resolved);
    setTable(next);
    setStaged([]);
    setAceChoice(null);
    setLastActor(null);
    setNotice(`${resolved[next.turn]} goes first.`);
    setPhase('cover');
  }

  if (phase === 'setup' || !table) {
    return <section className="pass-play" aria-labelledby="pass-title">
      <button className="text-link" onClick={onExit}>← Modes</button>
      <p className="eyebrow">PASS AND PLAY</p>
      <h1 id="pass-title">One phone.<br />Everyone plays.</h1>
      <p className="intro">Pass the phone around the table. Each player sees only their own hand, and a cover screen hides it in between.</p>
      <div className="count-control"><span>Players</span><button aria-label="Fewer players" disabled={seats <= MIN_SEATS} onClick={() => setSeats(seats - 1)}>−</button><strong>{seats}</strong><button aria-label="More players" disabled={seats >= MAX_SEATS} onClick={() => setSeats(seats + 1)}>+</button></div>
      <div className="player-fields">{Array.from({ length: seats }, (_, index) => <label key={index}><span>Player {index + 1}</span><KeyboardInput value={rawNames[index]} placeholder={`Player ${index + 1}`} onChange={(event) => setRawNames((current) => current.map((item, at) => (at === index ? event.target.value : item)))} /></label>)}</div>
      <button className="primary score-start" onClick={() => deal()}>Deal the cards <ArrowRight size={18} /></button>
      <p className="house-note">Standard Switch rules apply. With three or more players a jack reverses direction and can be your last card.</p>
    </section>;
  }

  const current = table.turn;
  const name = players[current];
  const hand = table.hands[current];
  const legal = tableLegalMoves(table);
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const pending = table.pendingPenalty;
  const pendingDraw = pending && pending.kind !== 'miss-turn' ? pending.cards : 0;
  const missTurn = pending?.kind === 'miss-turn';
  const topCard = table.discardPile[table.discardPile.length - 1];

  function commit(next: TableState, message: string, actor: number) {
    setStaged([]);
    setAceChoice(null);
    setTable(next);
    setNotice(message);
    if (next.status === 'won') { setPhase('won', next.move); return; }
    if (next.turn === actor) { setPhase('turn', next.move); return; }
    setLastActor(actor);
    setPhase('cover', next.move);
  }

  function play(cards: CardId[], aceSuit?: Suit) {
    if (!table) return;
    const next = applyTableAction(table, { type: 'play', cards, ...(aceSuit ? { chosenSuit: aceSuit } : {}) });
    commit(next, next.status === 'won' ? `${name} played their last card.` : describePlay(name, table, next, cards, aceSuit), current);
  }

  function chooseCard(card: CardId) {
    if (staged.length) {
      if (rank(card) !== rank(staged[0])) { setNotice('Cards played together must have the same number or picture.'); return; }
      setStaged((now) => (now.includes(card) ? now.filter((item) => item !== card) : [...now, card]));
      return;
    }
    if (!canPlay(card)) { setNotice('That card cannot follow the current card. Legal cards are highlighted.'); return; }
    if (rank(card) === 'A') { setAceChoice([card]); return; }
    if (pending?.kind !== 'black-king' && hand.filter((item) => rank(item) === rank(card)).length > 1) {
      setStaged([card]);
      setNotice(`You have matching ${rank(card)}s. Pick any others to play together. The last card you pick sets the suit. Then confirm.`);
      return;
    }
    play([card]);
  }

  function playStaged() {
    if (!staged.length) return;
    if (!canPlay(staged[0])) { setNotice('Start with a card that can legally follow the current card.'); return; }
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
    play(staged);
  }

  function drawOrResolve() {
    if (!table) return;
    const count = pendingDraw || 1;
    const next = applyTableAction(table, missTurn ? { type: 'accept-missed-turn' } : { type: 'draw' });
    commit(next, missTurn ? `${name} misses a turn.` : `${name} picked up ${cardWord(count)}.`, current);
  }

  function forgotLastCard() {
    if (!table || lastActor === null) return;
    const penalised = drawForSeat(table, lastActor, 2);
    setTable({ ...penalised, move: penalised.move + 1 });
    setNotice(`${players[lastActor]} forgot “Last Card” and picks up two cards.`);
    setLastActor(null);
  }

  if (phase === 'won') {
    const winner = table.winner ?? current;
    return <section className="pass-play completion" aria-label="Game over">
      <p className="eyebrow">GAME OVER</p>
      <h1>{players[winner]} wins.</h1>
      <p>{notice} Everyone else was still holding cards: {table.hands.map((cards, seat) => seat === winner ? null : `${players[seat]} ${cardWord(cards.length)}`).filter(Boolean).join(', ')}.</p>
      <button className="primary" onClick={() => deal((winner + 1) % players.length, players)}>Play again <ArrowRight size={18} /></button>
      <button className="secondary" onClick={onScore}>Score this night <ArrowRight size={18} /></button>
      <button className="text-link" onClick={onExit}>Back to modes</button>
    </section>;
  }

  const seatStrip = <ul className="seat-strip" aria-label="Players and cards held">{players.map((player, seat) => <li key={seat} className={seat === current ? 'active' : ''}><span>{player}</span><strong>{cardWord(table.hands[seat].length)}</strong></li>)}</ul>;

  if (phase === 'cover') {
    const lastHeld = lastActor !== null ? table.hands[lastActor].length : 0;
    return <section className="pass-play cover-screen" aria-label="Pass the phone">
      <p className="eyebrow">PASS THE PHONE</p>
      <h1>{name}, you’re up.</h1>
      <p className="game-notice" aria-live="polite">{notice}</p>
      {lastActor !== null && lastHeld === 1 && <div className="last-card-call"><HandPalm size={27} /><strong>{players[lastActor]} has one card left</strong><p>Did they say “Last Card”? If not, they pick up two.</p><button className="secondary" onClick={forgotLastCard}>{players[lastActor]} forgot — pick up 2</button></div>}
      {seatStrip}
      <p className="direction-note">Play is going {table.direction === 1 ? 'clockwise ↻' : 'anticlockwise ↺'}.</p>
      <button className="primary score-start" onClick={() => setPhase('turn', table.move)}>I’m {name} — show my hand <ArrowRight size={18} /></button>
      <button className="text-link" onClick={onExit}>End game</button>
    </section>;
  }

  return <section className="pass-play table-turn" aria-label={`${name}'s turn`}>
    <div className="lesson-meta"><span>{name.toUpperCase()}’S TURN</span><button onClick={onExit}>End game</button></div>
    {seatStrip}
    <div className="game-table"><button className="draw-pile" onClick={drawOrResolve} disabled={!!staged.length} aria-label={missTurn ? 'Accept missed turn' : pendingDraw ? `Pick up ${pendingDraw} cards` : 'Draw a card'}><CardImage code="back" /><span>{missTurn ? 'Miss a turn' : pendingDraw ? `Pick up ${pendingDraw}` : 'Pick up one'}</span></button><div className="discard-pile"><CardImage code={topCard} /><span>Current suit <b className={table.currentSuit === 'H' || table.currentSuit === 'D' ? 'red' : ''}>{suitSymbols[table.currentSuit]} {suitNames[table.currentSuit]}</b></span></div></div>
    <p className="game-notice" aria-live="polite">{notice}</p>
    {pending && <p className="game-hint"><Lightbulb size={17} />{pending.kind === 'draw-two' ? `Play another two to pass on ${pendingDraw + 2}, or pick up ${pendingDraw}.` : pending.kind === 'black-king' ? `Play a black king to add 5, a red king to cancel 5, or pick up ${pendingDraw}.` : 'Play an eight to pass the missed turn, or accept it.'}</p>}
    <div className="game-actions"><span><Cards size={16} /> {cardWord(hand.length)} in your hand</span><span><UsersThree size={16} /> {table.direction === 1 ? 'Clockwise ↻' : 'Anticlockwise ↺'}</span></div>
    <div className="player-hand" aria-label="Your hand">{hand.map((card) => <button key={card} onClick={() => chooseCard(card)} className={(canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected' : '')} aria-label={`Play ${card}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} /></button>)}</div>
    {staged.length > 0 && <div className="multi-action"><p>{staged.length} matching card{staged.length === 1 ? '' : 's'} selected</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Cancel selection</button></div>}
    {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={chosen === 'H' || chosen === 'D' ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); play(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
  </section>;
}
