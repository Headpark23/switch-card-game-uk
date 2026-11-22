import { useEffect, useMemo, useState } from 'react';
import { ArrowCounterClockwise, CaretLeft, ChatCircleText, FastForward, Pause, Play } from '@phosphor-icons/react';
import { getReplay, replayFrames, type ReplayReaction } from '../switch/gameReplay';
import { cardIdLabel } from '../switch/cards';
import { reactionOf } from '../switch/reactions';
import { CardImage, FeltHeader, suitNames, suitSymbols } from '../ui';
import { ReactionFace } from './ReactionSticker';
import { Bubble } from './tableTalk';

const SPEEDS = [{ x: 1, label: '1×' }, { x: 2, label: '2×' }, { x: 4, label: 'Fast' }, { x: 8, label: 'Blitz' }] as const;
/** How long a move and a remark stay on screen at normal speed. */
const MOVE_MS = 900;
const TALK_MS = 1300;

const longDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * A finished game played back at speed: the cards landing, everyone's hand growing and shrinking with every card face up,
 * the running stats, and every remark at the moment it was made.
 */
export default function ReplayScreen({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const replay = useMemo(() => getReplay(gameId), [gameId]);
  const frames = useMemo(() => (replay ? replayFrames(replay) : []), [replay]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);

  const last = frames.length - 1;
  useEffect(() => {
    if (!playing || at >= last) { if (at >= last) setPlaying(false); return; }
    const next = frames[at + 1]?.event;
    const timer = window.setTimeout(() => setAt((current) => Math.min(last, current + 1)), (next?.k === 'r' ? TALK_MS : MOVE_MS) / speed);
    return () => window.clearTimeout(timer);
  }, [playing, at, speed, last, frames]);

  if (!replay || !frames.length) {
    return <section className="replay-screen">
      <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Back</button>
      <FeltHeader compact title="No replay for this one." intro="Replays are kept on this phone for your last 30 games, from the day replays began." cards={['JH', 'QS']} />
    </section>;
  }

  const frame = frames[at];
  const names = replay.names;
  const peak = Math.max(7, ...frames.flatMap((entry) => entry.counts));
  // A remark stays beside its sender for a moment after it is made.
  const bubbleBySeat = new Map<number, { reaction: ReplayReaction; n: number }>();
  for (let index = Math.max(1, at - 2); index <= at; index += 1) {
    const event = frames[index].event;
    if (event?.k === 'r' && event.seat !== null) bubbleBySeat.set(event.seat, { reaction: event, n: index });
  }
  const winner = replay.winner ?? null;
  const done = at >= last;
  const totalMoves = frames[last].move;

  return <section className="replay-screen" aria-label="Game replay">
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Back</button>
    <FeltHeader compact title="The replay." intro={`${longDate(replay.startedAt)} · ${replay.online ? 'Online' : 'Against the computer'} · ${names.length} players${winner !== null ? ` · ${names[winner] === 'You' ? 'You won' : `${names[winner]} won`}` : ''}`} cards={frame.pile.length ? [frame.pile[frame.pile.length - 1]] : ['back']} />

    <div className="replay-table" data-testid="replay-table">
      <div className={`replay-seats seats-${names.length}`} role="list" aria-label="Players">
        {names.map((name, seat) => {
          const count = frame.counts[seat] ?? 0;
          const bubble = bubbleBySeat.get(seat);
          const moving = frame.event?.k === 'm' && frame.event.seat === seat;
          return <div key={seat} role="listitem" className={'replay-seat' + (moving ? ' moving' : '') + (count === 0 ? ' out' : '') + (done && winner === seat ? ' winner' : '')} aria-label={`${name}: ${count} card${count === 1 ? '' : 's'}`}>
            <strong>{name}</strong>
            <span className="replay-count">{count === 0 ? 'Out' : count}</span>
            <span className="replay-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (count / peak) * 100)}%` }} /></span>
            {bubble && <Bubble key={bubble.n} n={bubble.n} id={bubble.reaction.id} name={name} />}
          </div>;
        })}
      </div>
      <div className="replay-centre">
        <span className="replay-pile" data-testid="replay-pile">{frame.pile.map((card, index) => <span key={card + index} className={'pile-card depth-' + (frame.pile.length - 1 - index)}><CardImage code={card} /></span>)}</span>
        <span className="replay-suit">Suit <b className={frame.suit === 'H' || frame.suit === 'D' ? 'red' : ''}>{suitSymbols[frame.suit]} {suitNames[frame.suit]}</b></span>
      </div>
      <p className="replay-line" aria-live="polite" data-testid="replay-line">{frame.line}</p>
    </div>

    {/* Every hand face up, so you can see how each player played: what they held, what they kept and what they picked up. */}
    {frame.hands
      ? <div className="replay-hands" role="list" aria-label="Every player's hand, face up" data-testid="replay-hands">
        {names.map((name, seat) => {
          const hand = frame.hands![seat] ?? [];
          const moving = frame.event?.k === 'm' && frame.event.seat === seat;
          return <div key={seat} role="listitem" className={'replay-hand' + (moving ? ' moving' : '') + (hand.length === 0 ? ' out' : '')} data-seat={seat} aria-label={`${name}'s hand: ${hand.length === 0 ? 'no cards' : hand.map((card) => cardIdLabel(card)).join(', ')}`}>
            <strong>{name}</strong>
            <span className="rh-cards">{hand.length === 0
              ? <em>Out</em>
              : hand.map((card) => <span key={card} className={'rh-card' + (moving && frame.drew.includes(card) ? ' fresh' : '')} data-card={card}><CardImage code={card} /></span>)}</span>
          </div>;
        })}
      </div>
      : <p className="replay-note" data-testid="replay-no-hands">This game was recorded before hands were kept, so only the number of cards each player held is shown.</p>}

    <div className="replay-controls">
      <button className="replay-play" onClick={() => { if (done) setAt(0); setPlaying((current) => (done ? true : !current)); }} aria-label={playing ? 'Pause' : done ? 'Play again' : 'Play'} data-testid="replay-play">{playing ? <Pause size={22} weight="fill" /> : done ? <ArrowCounterClockwise size={22} weight="bold" /> : <Play size={22} weight="fill" />}</button>
      <div className="replay-speeds" role="group" aria-label="Replay speed">{SPEEDS.map((option) => <button key={option.x} className={speed === option.x ? 'active' : ''} aria-pressed={speed === option.x} onClick={() => setSpeed(option.x)}>{option.x === 8 && <FastForward size={13} weight="fill" />}{option.label}</button>)}</div>
    </div>
    <label className="replay-scrub" data-scroll-drag="ignore">
      <span>Move {frame.move} of {totalMoves}</span>
      <input type="range" min={0} max={last} value={at} onChange={(event) => { setPlaying(false); setAt(Number(event.target.value)); }} aria-label="Jump to a moment in the game" />
    </label>

    <h2 className="replay-heading">The stats so far</h2>
    <div className="replay-stats" role="table" aria-label="Stats so far">
      <div role="row" className="head"><span role="columnheader">Player</span><span role="columnheader">Holding</span><span role="columnheader">Played</span><span role="columnheader">Picked up</span><span role="columnheader">Hits</span><span role="columnheader">Said</span></div>
      {names.map((name, seat) => {
        const tally = frame.tally[seat];
        return <div role="row" key={seat} className={name === 'You' ? 'me' : ''}><span role="cell">{name}</span><span role="cell">{tally.cards}</span><span role="cell">{tally.played}</span><span role="cell">{tally.pickedUp}</span><span role="cell">{tally.penaltiesDealt}</span><span role="cell">{tally.reactions}</span></div>;
      })}
    </div>
    <p className="replay-note">Hits are penalty pick-ups dealt to someone else with a two or a king.</p>

    <h2 className="replay-heading">Table talk</h2>
    {frame.said.length === 0
      ? <p className="replay-note">{replay.events.some((event) => event.k === 'r') ? 'Nothing said yet. Keep watching.' : 'Nobody said a word this game.'}</p>
      : <ol className="replay-talk" aria-label="What was said">{[...frame.said].reverse().slice(0, 8).map((entry, index) => <li key={`${entry.t}-${index}`}>{reactionOf(entry.id)?.sticker ? <ReactionFace id={entry.id} size={30} /> : <i className="replay-quote" aria-hidden="true"><ChatCircleText size={20} weight="fill" /></i>}<span><strong>{entry.from}</strong><small>{reactionOf(entry.id)?.text}</small></span></li>)}</ol>}
  </section>;
}
