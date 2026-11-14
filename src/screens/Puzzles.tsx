import { useMemo, useState } from 'react';
import { ArrowRight, CaretLeft, CheckCircle, Fire, Trophy, XCircle } from '@phosphor-icons/react';
import { cue } from '../feedback';
import { trackFeature } from '../switch/telemetry';
import { badgeFor, checkAnswer, legalCardsFor, loadProgress, puzzles, recordResult, saveProgress, type PuzzleProgress } from '../switch/puzzles';
import type { CardId } from '../switch/types';
import { CardImage, suitNames } from '../ui';

const penaltyText = (kind: string | undefined, cards?: number) =>
  kind === 'draw-two' ? `A two is active: ${cards} cards to pick up.` : kind === 'black-king' ? `A black king is active: ${cards} cards to pick up.` : kind === 'miss-turn' ? 'An eight is active: you miss a turn.' : '';

export default function Puzzles({ onBack, onTutorial }: { onBack: () => void; onTutorial: () => void }) {
  const [progress, setProgress] = useState<PuzzleProgress>(loadProgress);
  const next = useMemo(() => puzzles.findIndex((puzzle) => !progress.solved.includes(puzzle.id)), [progress.solved]);
  const [index, setIndex] = useState(() => (next < 0 ? 0 : next));
  const [picked, setPicked] = useState<CardId[]>([]);
  const [result, setResult] = useState<ReturnType<typeof checkAnswer> | null>(null);
  const puzzle = puzzles[index];
  const badge = badgeFor(progress);
  const legal = legalCardsFor(puzzle);

  function toggle(card: CardId) {
    if (result) return;
    setPicked((current) => (current.includes(card) ? current.filter((entry) => entry !== card) : [...current, card]));
  }
  function check() {
    const outcome = checkAnswer(puzzle, picked);
    const updated = recordResult(progress, puzzle.id, outcome.correct);
    setResult(outcome); setProgress(updated); saveProgress(updated);
    cue(outcome.correct ? 'good' : 'bad');
    if (outcome.correct && !progress.solved.includes(puzzle.id)) trackFeature('puzzle_solved');
  }
  function advance() {
    setPicked([]); setResult(null);
    setIndex((current) => (current + 1) % puzzles.length);
  }

  return <section className="puzzles" aria-labelledby="puzzle-title">
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Rules</button>
    <p className="eyebrow">PUZZLE {index + 1} OF {puzzles.length}</p>
    <h1 id="puzzle-title">What can you play?</h1>
    <div className="puzzle-badge"><Trophy size={20} weight="fill" /><span><strong>{badge.name}</strong><small>{badge.next}</small></span><em aria-label={`Streak ${progress.streak}`}><Fire size={15} weight="fill" aria-hidden="true" /> {progress.streak}</em></div>
    <div className="puzzle-card">
      <h2>{puzzle.title}</h2>
      <div className="puzzle-pile"><CardImage code={puzzle.top} /><p>Top card. Current suit: <b>{suitNames[puzzle.suit]}</b>.{puzzle.penalty ? <> {penaltyText(puzzle.penalty.kind, 'cards' in puzzle.penalty ? puzzle.penalty.cards : undefined)}</> : null}</p></div>
      <p className="puzzle-ask">Tap every card in your hand that is legal to play.</p>
      <div className="puzzle-hand" role="group" aria-label="Your hand">
        {puzzle.hand.map((card) => {
          const state = result ? (legal.includes(card) ? (picked.includes(card) ? 'right' : 'missed') : picked.includes(card) ? 'wrong' : '') : picked.includes(card) ? 'picked' : '';
          return <button key={card} className={state} aria-pressed={picked.includes(card)} aria-label={`${card}${state ? ' ' + state : ''}`} onClick={() => toggle(card)}><CardImage code={card} /></button>;
        })}
      </div>
      {result
        ? <div className={'puzzle-result ' + (result.correct ? 'good' : 'bad')} role="status">
          {result.correct ? <CheckCircle size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}
          <div><strong>{result.correct ? 'Spot on.' : 'Not quite.'}</strong><p>{puzzle.why}</p></div>
        </div>
        : null}
      {result
        ? <button className="primary" onClick={advance}>Next puzzle <ArrowRight size={18} /></button>
        : <button className="primary" disabled={!picked.length} onClick={check}>Check my answer</button>}
    </div>
    <button className="secondary" onClick={onTutorial}>Practise in a full guided game</button>
  </section>;
}
