import { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, CaretLeft, CheckCircle, Fire, ShareNetwork, Trophy, XCircle } from '@phosphor-icons/react';
import { cue } from '../services/feedback';
import { trackFeature } from '../switch/stats/telemetry';
import {
  badgeFor,
  checkAnswer,
  dailyPuzzleFor,
  dailyShareText,
  legalCardsFor,
  loadDailyProgress,
  loadProgress,
  puzzles,
  recordDailyResult,
  recordResult,
  saveDailyProgress,
  saveProgress,
  type DailyProgress,
  type PuzzleProgress,
} from '../switch/ai/puzzles';
import type { CardId } from '../switch/engine/types';
import { CardImage, suitNames } from '../components/ui';

const penaltyText = (kind: string | undefined, cards?: number) =>
  kind === 'draw-two' ? `A two is active: ${cards} cards to pick up.` : kind === 'black-king' ? `A black king is active: ${cards} cards to pick up.` : kind === 'miss-turn' ? 'An eight is active: you miss a turn.' : '';

export default function Puzzles({
  onBack,
  onTutorial,
  backLabel = 'Back',
  initialMode = 'pack',
}: {
  onBack: () => void;
  onTutorial: () => void;
  backLabel?: string;
  initialMode?: 'pack' | 'daily';
}) {
  const [mode, setMode] = useState<'pack' | 'daily'>(initialMode);
  const [progress, setProgress] = useState<PuzzleProgress>(loadProgress);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(loadDailyProgress);
  const daily = useMemo(() => dailyPuzzleFor(), []);
  const next = useMemo(() => puzzles.findIndex((puzzle) => !progress.solved.includes(puzzle.id)), [progress.solved]);
  const [index, setIndex] = useState(() => (next < 0 ? 0 : next));
  const [picked, setPicked] = useState<CardId[]>([]);
  const [result, setResult] = useState<ReturnType<typeof checkAnswer> | null>(null);
  const [dailyTries, setDailyTries] = useState(0);
  const [shareNote, setShareNote] = useState('');

  const isDaily = mode === 'daily';
  const dailySolved = dailyProgress.solvedDates.includes(daily.dateKey);
  const puzzle = isDaily ? daily.puzzle : puzzles[index];
  const badge = badgeFor(progress);
  const legal = legalCardsFor(puzzle);

  function switchMode(nextMode: 'pack' | 'daily') {
    setMode(nextMode);
    setPicked([]);
    setResult(null);
    setShareNote('');
  }

  function toggle(card: CardId) {
    if (result && (!isDaily || result.correct)) return;
    setResult(null);
    setPicked((current) => (current.includes(card) ? current.filter((entry) => entry !== card) : [...current, card]));
  }

  function check() {
    const outcome = checkAnswer(puzzle, picked);
    setResult(outcome);
    cue(outcome.correct ? 'good' : 'bad');
    if (isDaily) {
      const tries = dailyTries + 1;
      setDailyTries(tries);
      if (outcome.correct) {
        const updated = recordDailyResult(dailyProgress, daily.dateKey, tries, true);
        setDailyProgress(updated);
        saveDailyProgress(updated);
        trackFeature('puzzle_solved');
      }
    } else {
      const updated = recordResult(progress, puzzle.id, outcome.correct);
      setProgress(updated);
      saveProgress(updated);
      if (outcome.correct && !progress.solved.includes(puzzle.id)) trackFeature('puzzle_solved');
    }
  }

  function advance() {
    setPicked([]);
    setResult(null);
    setIndex((current) => (current + 1) % puzzles.length);
  }

  async function shareDaily() {
    const tries = dailyProgress.lastDate === daily.dateKey && dailyProgress.lastTries > 0 ? dailyProgress.lastTries : Math.max(1, dailyTries);
    const text = dailyShareText(daily.dayNumber, tries, dailyProgress.streak);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote('Copied! Paste it into your group chat.');
    } catch {
      setShareNote('Could not share right now.');
    }
  }

  return (
    <section className="puzzles" aria-labelledby="puzzle-title">
      <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />{backLabel}</button>
      <h1 id="puzzle-title">What can you play?</h1>

      <div className="puzzle-mode-tabs" role="tablist" aria-label="Puzzle mode">
        <button role="tab" aria-selected={isDaily} className={isDaily ? 'active' : ''} onClick={() => switchMode('daily')}>
          <CalendarCheck size={16} weight={isDaily ? 'fill' : 'bold'} />
          <span>Daily Hand #{daily.dayNumber}</span>
          {dailySolved && <i className="daily-done-dot" aria-label="Solved" />}
        </button>
        <button role="tab" aria-selected={!isDaily} className={!isDaily ? 'active' : ''} onClick={() => switchMode('pack')}>
          <Trophy size={16} weight={!isDaily ? 'fill' : 'bold'} />
          <span>All {puzzles.length} Puzzles</span>
        </button>
      </div>

      {isDaily ? (
        <div className="puzzle-badge" data-testid="daily-status">
          <CalendarCheck size={20} weight="fill" />
          <span>
            <strong>{dailySolved ? 'Solved today!' : `Daily Hand #${daily.dayNumber}`}</strong>
            <small>{dailySolved ? 'Come back tomorrow for a fresh hand.' : 'Same tricky hand for everyone today.'}</small>
          </span>
          <em aria-label={`Daily streak ${dailyProgress.streak}`}><Fire size={15} weight="fill" aria-hidden="true" /> {dailyProgress.streak}</em>
        </div>
      ) : (
        <>
          <p className="puzzle-count">Puzzle {index + 1} of {puzzles.length}</p>
          <div className="puzzle-badge"><Trophy size={20} weight="fill" /><span><strong>{badge.name}</strong><small>{badge.next}</small></span><em aria-label={`Streak ${progress.streak}`}><Fire size={15} weight="fill" aria-hidden="true" /> {progress.streak}</em></div>
        </>
      )}

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
        {result && (
          <div className={'puzzle-result ' + (result.correct ? 'good' : 'bad')} role="status">
            {result.correct ? <CheckCircle size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}
            <div><strong>{result.correct ? 'Spot on.' : isDaily ? 'Not quite — adjust your cards and try again.' : 'Not quite.'}</strong><p>{puzzle.why}</p></div>
          </div>
        )}
        {isDaily ? (
          (result?.correct || dailySolved) ? (
            <div className="daily-share">
              <button className="primary" onClick={shareDaily}><ShareNetwork size={18} weight="bold" />Share today&apos;s result</button>
              {shareNote && <p className="share-note" role="status">{shareNote}</p>}
              <button className="secondary" onClick={() => switchMode('pack')}>Try the 12-puzzle pack <ArrowRight size={16} /></button>
            </div>
          ) : (
            <><button className="primary" disabled={!picked.length} onClick={check} aria-describedby="puzzle-hint">Check my answer</button>{!picked.length && <p className="puzzle-hint" id="puzzle-hint">Tap a card to answer.</p>}</>
          )
        ) : result ? (
          <button className="primary" onClick={advance}>Next puzzle <ArrowRight size={18} /></button>
        ) : (
          <><button className="primary" disabled={!picked.length} onClick={check} aria-describedby="puzzle-hint">Check my answer</button>{!picked.length && <p className="puzzle-hint" id="puzzle-hint">Tap a card to answer.</p>}</>
        )}
      </div>
      <button className="secondary" onClick={onTutorial}>Practise in a full guided game</button>
    </section>
  );
}
