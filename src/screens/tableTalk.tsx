import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../mobile';
import { SAYINGS, STICKERS, reactionOf } from '../switch/reactions';
import { beginReplay, elapsed, finishReplay, readDraft, saveDraft, withEvent, type GameReplay, type ReplayMove, type ReplayReaction } from '../switch/gameReplay';
import { Sticker } from './ReactionSticker';

/**
 * Records the game being played, move by move and reaction by reaction, so it can be replayed afterwards.
 * A game resumed after the app was closed carries on from its saved draft.
 */
export function useReplayRecorder(id: string, begin: () => GameReplay) {
  const ref = useRef<GameReplay | null>(null);
  if (!ref.current || ref.current.id !== id) ref.current = readDraft(id) ?? begin();
  const keep = (next: GameReplay) => {
    // A reaction after the final card (a "Good game" on the results screen) still belongs to the game.
    ref.current = next.finishedAt ? finishReplay(next, next.winner ?? null, Date.parse(next.finishedAt)) : next;
    if (!next.finishedAt) saveDraft(next);
  };
  return {
    move(move: Omit<ReplayMove, 'k' | 't'>, at?: number) { const replay = ref.current!; keep(withEvent(replay, { k: 'm', t: elapsed(replay, at), ...move })); },
    react(reaction: Omit<ReplayReaction, 'k' | 't'>, at?: number) { const replay = ref.current!; keep(withEvent(replay, { k: 'r', t: elapsed(replay, at), ...reaction })); },
    finish(winner: number | null, at?: number) { const replay = ref.current!; if (!replay.finishedAt) ref.current = finishReplay(replay, winner, at); },
  };
}

export { beginReplay };

/** Who said what, beside their seat, for a few seconds. */
export function useBubbles(holdMs = 3600) {
  const [bubbles, setBubbles] = useState<Record<number, { n: number; id: string }>>({});
  const counter = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  function say(seat: number, id: string) {
    counter.current += 1;
    const n = counter.current;
    setBubbles((current) => ({ ...current, [seat]: { n, id } }));
    timers.current.push(window.setTimeout(() => setBubbles((current) => (current[seat]?.n === n ? Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== seat)) : current)), holdMs));
  }
  return { bubbles, say };
}

/** The bubble itself: a sticker or a saying, with the words always there for a screen reader. */
export function Bubble({ id, name, n }: { id: string; name: string; n: number }) {
  const reaction = reactionOf(id);
  if (!reaction) return null;
  return <span key={n} className={'reaction-bubble' + (reaction.sticker ? ' sticker' : '')} role="status" data-testid="reaction-bubble" data-reaction-shown={id}>
    {reaction.sticker ? <Sticker id={reaction.sticker} size={46} /> : reaction.text}
    <i className="sr-only">{name}: {reaction.text}</i>
  </span>;
}

/** The only way to talk at the table: ten cheeky sayings and eight stickers. */
export function ReactionSheet({ open, onOpenChange, onPick, description = 'Everyone at the table sees it for a few seconds.' }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (id: string) => void; description?: string }) {
  return <BottomSheet open={open} onOpenChange={onOpenChange} title="Say something" description={description} snap={0.8}>
    <div className="reaction-picker">
      <div className="reaction-stickers" role="group" aria-label="Stickers">{STICKERS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id} aria-label={entry.text}>{entry.sticker && <Sticker id={entry.sticker} size={48} />}<span>{entry.text}</span></button>)}</div>
      <div className="reaction-grid" role="group" aria-label="Sayings">{SAYINGS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id}><span>{entry.text}</span></button>)}</div>
    </div>
  </BottomSheet>;
}
