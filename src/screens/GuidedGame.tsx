import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, CheckCircle, HandPalm, Lightbulb } from '@phosphor-icons/react';
import { chooseComputerAction } from '../switch/ai';
import { applyAction, createInitialGame, drawCards, legalMoves } from '../switch/rules';
import type { CardId, GameState, Suit } from '../switch/types';
import { explainEffect, explainOptions, explainPickup, explainUnplayable } from '../switch/coach';
import { CardImage, CoachPanel, isRedKing, rank, suit, suitNames, suitSymbols } from '../ui';
import { testGameFromUrl } from './devDecks';

const YOUR_TURN_NOTICE = 'Your turn. Play a legal card, or pick up one to save your cards for later.';

type View = {
  engine: GameState;
  notice: string;
  /** Plain-English explanation of the last move. */
  meaning: string | null;
  hint: boolean;
  /** You are down to one card and have not yet said (or skipped) "Last Card". */
  awaitingLastCard: boolean;
};

function openingView(): View {
  const fixed = import.meta.env.DEV ? testGameFromUrl() : null;
  const engine = fixed ?? createInitialGame(Math.random, Math.random() < 0.5 ? 'player' : 'computer');
  return {
    engine,
    notice: engine.turn === 'player' ? YOUR_TURN_NOTICE : 'The computer goes first.',
    meaning: null,
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

  const action = chooseComputerAction(engine, Math.random);
  const next = applyAction(engine, action);

  if (action.type === 'play') {
    if (next.status === 'won') {
      return { ...view, engine: next, hint: false, meaning: null, notice: 'The computer played its last card. Try another game and use the hints when you need them.' };
    }
    let notice = describePlay(engine, next, action.cards, 'computer', action.chosenSuit);
    let meaning = explainEffect(engine, next, action.cards, 'computer', action.chosenSuit);
    if (engine.pendingPenalty?.kind === 'miss-turn' && next.pendingPenalty?.kind === 'miss-turn') {
      notice = `The computer had an eight (${action.cards[0]}), so it passes the missed turn back to you. Counter with an eight of your own, or miss your turn.`;
      meaning = 'It answered your eight with one of its own. That is allowed, and the missed turn is now yours.';
    }
    if (next.computerHand.length === 1) notice += ' Computer says “Last Card”.';
    return { ...view, engine: next, notice, meaning, hint: false };
  }

  if (action.type === 'accept-missed-turn') {
    return { ...view, engine: next, hint: false, meaning: 'It had no eight to pass the missed turn on, so you play again.', notice: 'The computer cannot counter the eight and misses its turn.' };
  }
  const count = penaltyCards(engine) || 1;
  return { ...view, engine: next, hint: false, meaning: explainPickup(engine, 'computer', count), notice: `The computer picks up ${count} card${count === 1 ? '' : 's'}. Your turn.` };
}

type Props = {
  onExit: () => void;
  onOpenCards: () => void;
  /** Lets the page reset its scroll position when the game ends. */
  onStatusChange: (status: 'playing' | 'won' | 'lost') => void;
};

export default function GuidedGame({ onExit, onOpenCards, onStatusChange }: Props) {
  const [view, setView] = useState<View>(openingView);
  const [aceChoice, setAceChoice] = useState<CardId[] | null>(null);
  const [staged, setStaged] = useState<CardId[]>([]);
  const { engine, awaitingLastCard } = view;

  const outcome: 'playing' | 'won' | 'lost' = engine.status === 'playing' ? 'playing' : engine.winner === 'player' ? 'won' : 'lost';
  const yourTurn = awaitingLastCard || engine.turn === 'player';
  const pending = engine.pendingPenalty;
  const pendingDraw = penaltyCards(engine);

  useEffect(() => onStatusChange(outcome), [outcome, onStatusChange]);

  useLayoutEffect(() => {
    const reset = () => {
      const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
      if (screen) screen.scrollTop = 0;
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [engine.move, outcome, aceChoice]);

  useEffect(() => {
    if (outcome !== 'playing' || awaitingLastCard || engine.turn !== 'computer') return;
    const timer = setTimeout(() => setView((current) => computerStep(current)), 650);
    return () => clearTimeout(timer);
  }, [outcome, awaitingLastCard, engine.turn, engine.move]);

  const legal = legalMoves(engine);
  const canPlay = (card: CardId) => legal.some((action) => action.type === 'play' && action.cards.length === 1 && action.cards[0] === card);
  const legalCards = engine.playerHand.filter(canPlay);

  const say = (notice: string) => setView((current) => ({ ...current, notice }));

  function afterYourPlay(before: GameState, after: GameState, cards: readonly CardId[], aceSuit?: Suit) {
    const notice = describePlay(before, after, cards, 'you', aceSuit);
    const meaning = explainEffect(before, after, cards, 'you', aceSuit);
    if (after.status === 'won') {
      setView((current) => ({
        ...current, engine: after, hint: false, meaning: null,
        notice: cards.length > 1 ? 'You played your matching set legally — you win!' : 'You played your last card legally — you win!',
      }));
      return;
    }
    if (after.playerHand.length === 1) {
      setView((current) => ({ ...current, engine: after, hint: false, meaning, awaitingLastCard: true, notice: 'One card left. Say “Last Card” before play continues.' }));
      return;
    }
    setView((current) => ({ ...current, engine: after, hint: false, meaning, notice }));
  }

  function playSet(cards: CardId[], aceSuit?: Suit) {
    const before = engine;
    const after = applyAction(before, { type: 'play', cards, ...(aceSuit ? { chosenSuit: aceSuit } : {}) });
    afterYourPlay(before, after, cards, aceSuit);
  }

  function chooseCard(card: CardId) {
    if (!yourTurn || outcome !== 'playing' || awaitingLastCard) return;
    if (staged.length) {
      if (rank(card) !== rank(staged[0])) { say('Cards played together must have the same number or picture.'); return; }
      setStaged((current) => (current.includes(card) ? current.filter((item) => item !== card) : [...current, card]));
      return;
    }
    if (!canPlay(card)) {
      setView((current) => ({ ...current, hint: true, notice: explainUnplayable(card, engine) }));
      return;
    }
    if (rank(card) === 'A') { setStaged([]); setAceChoice([card]); return; }
    if (pending?.kind === 'black-king') { setStaged([]); playSet([card]); return; }
    if (engine.playerHand.filter((item) => rank(item) === rank(card)).length > 1) {
      setStaged([card]);
      say(`You have matching ${rank(card)}s. Pick any others to play together. The last card you pick sets the suit. Then confirm.`);
      return;
    }
    playSet([card]);
  }

  function playStaged() {
    if (!staged.length) return;
    if (!canPlay(staged[0])) { say('Start with a card that can legally follow the current card.'); return; }
    if (rank(staged[0]) === 'A') { setAceChoice(staged); return; }
    playSet(staged);
    setStaged([]);
  }

  function drawOrResolve() {
    if (!yourTurn || outcome !== 'playing') return;
    const count = pendingDraw || 1;
    const next = applyAction(engine, pending?.kind === 'miss-turn' ? { type: 'accept-missed-turn' } : { type: 'draw' });
    setView((current) => ({
      ...current, engine: next, hint: false,
      meaning: pending?.kind === 'miss-turn' ? 'You had no eight to pass it on, so you miss this turn and the computer plays next.' : explainPickup(engine, 'you', count),
      notice: pending?.kind === 'miss-turn' ? 'You cannot counter with an eight, so you miss this turn.' : `You pick up ${count} card${count === 1 ? '' : 's'}. Computer’s turn.`,
    }));
  }

  function answerLastCard(said: boolean) {
    setView((current) => {
      if (said) return { ...current, awaitingLastCard: false, notice: '“Last Card!” — called in time.', engine: { ...current.engine, move: current.engine.move + 1 } };
      const penalised = drawCards(current.engine, 2, 'player');
      return { ...current, awaitingLastCard: false, notice: 'You forgot “Last Card” and pick up two penalty cards.', engine: { ...penalised, move: penalised.move + 1 } };
    });
  }

  const restart = () => { setView(openingView()); setAceChoice(null); setStaged([]); };

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

  return <section className="tutorial game-tutorial" aria-label={deckDescription}>{outcome !== 'playing'
    ? <div className="completion"><CheckCircle size={60} weight="light" /><p className="eyebrow">{outcome === 'won' ? 'GAME WON' : 'GOOD PRACTICE'}</p><h1>{outcome === 'won' ? <>You beat the<br />computer.</> : <>The computer<br />won this one.</>}</h1><p>{view.notice}</p><button className="primary" onClick={restart}><ArrowCounterClockwise size={18} />Play another guided game</button><button className="secondary" onClick={onOpenCards}>Open card guide <ArrowRight size={18} /></button></div>
    : <>
      <div className={'turn-banner ' + (yourTurn ? 'you' : 'computer')} aria-live="polite"><span className="turn-dot" aria-hidden="true" /><span>GUIDED GAME · {yourTurn ? 'YOUR TURN' : 'COMPUTER TURN'}</span><button onClick={onExit}>Exit game</button></div>
      <div className="opponent" aria-label={`Computer has ${engine.computerHand.length} cards`}><span>COMPUTER</span><div>{engine.computerHand.slice(0, 5).map((_, i) => <CardImage code="back" key={i} />)}</div><strong>{engine.computerHand.length} card{engine.computerHand.length === 1 ? '' : 's'}</strong></div>
      <div className="game-table"><button className="draw-pile" onClick={drawOrResolve} disabled={!yourTurn || awaitingLastCard || !!staged.length || missTurn} aria-label={missTurn ? 'Draw pile unavailable while resolving the eight' : pendingDraw ? `Pick up ${pendingDraw} cards` : legalCards.length ? 'Pick up one card instead of playing' : 'Draw a card'}><CardImage code="back" /><span>{missTurn ? 'Eight played' : pendingDraw ? `Pick up ${pendingDraw}` : legalCards.length ? 'Pick up instead' : 'Draw'}</span></button><div className="discard-pile"><CardImage code={topCard} /><span>Current suit <b className={(engine.currentSuit === 'H' || engine.currentSuit === 'D') ? 'red' : ''}>{suitSymbols[engine.currentSuit]} {suitNames[engine.currentSuit]}</b></span></div></div>
      <p className="game-notice" aria-live="polite">{!yourTurn ? 'Computer is choosing a card…' : view.notice}</p>
      {!awaitingLastCard && <CoachPanel meaning={view.meaning} options={yourTurn && !missTurn ? explainOptions(engine) : []} />}
      {yourTurn && missTurn && !awaitingLastCard && <div className="miss-turn-action"><strong>The computer played an eight</strong><p>{legalCards.some((card) => rank(card) === '8') ? 'Play an eight to pass the missed turn, or accept it.' : 'You have no eight to counter with, so you must miss this turn.'}</p><button className="primary" onClick={drawOrResolve}>Accept missed turn <ArrowRight size={18} /></button></div>}
      {awaitingLastCard
        ? <div className="last-card-call"><HandPalm size={27} /><strong>One card remaining</strong><p>Say “Last Card” now. Forgetting costs two cards.</p><button className="primary" onClick={() => answerLastCard(true)}>Say “Last Card”</button><button className="text-link" onClick={() => answerLastCard(false)}>Continue without saying it</button></div>
        : <><div className="game-actions"><button className={'hint-button ' + (view.hint ? 'active' : '')} onClick={() => setView((current) => ({ ...current, hint: !current.hint }))} disabled={!yourTurn}><Lightbulb size={19} weight={view.hint ? 'fill' : 'regular'} />{view.hint ? 'Hide hint' : 'Show hint'}</button><span>{engine.playerHand.length} cards in your hand</span></div>{view.hint && <p className="game-hint"><Lightbulb size={17} />{gameHint}</p>}<div className={'player-hand' + (engine.playerHand.length > 10 ? ' dense' : '')} aria-label="Your hand">{engine.playerHand.map((card) => <button key={card} onClick={() => chooseCard(card)} className={(view.hint && canPlay(card) ? 'playable ' : '') + (staged.includes(card) ? 'selected' : '')} disabled={!yourTurn} aria-label={`Play ${card}${canPlay(card) ? ', legal move' : ', not currently playable'}`}><CardImage code={card} /></button>)}</div>{staged.length > 0 && <div className="multi-action"><p>{staged.length} matching card{staged.length === 1 ? '' : 's'} selected</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={() => setStaged([])}>Cancel selection</button></div>}</>}
      {aceChoice && <div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S', 'H', 'D', 'C'] as Suit[]).map((chosen) => <button key={chosen} className={(chosen === 'H' || chosen === 'D') ? 'red' : ''} onClick={() => { const cards = aceChoice; setAceChoice(null); setStaged([]); playSet(cards, chosen); }}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={() => setAceChoice(null)}>Cancel</button></div>}
    </>}</section>;
}
