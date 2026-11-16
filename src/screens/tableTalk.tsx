import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../mobile';
import { Fire } from '@phosphor-icons/react';
import { SAYINGS, SPICY_SAYINGS, STICKERS, reactionOf, setSpicyTalk, spicyTalk } from '../switch/reactions';
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

type Spoken = { n: number; id: string; leaving?: boolean };

/** How long a remark stays up: long enough to read it (about 2 seconds, then a third of a second a word). */
export function readingMs(id: string, scale = 1): number {
  const reaction = reactionOf(id);
  if (!reaction) return 0;
  const words = reaction.sticker ? 3 : reaction.text.split(/\s+/).length;
  return Math.round(Math.min(6500, 2300 + words * 380) * scale);
}

/**
 * Who said what, beside their seat. Remarks float in one at a time and stay up long enough to read, so one never sits on
 * top of another: the next waits its turn (owner decision, 16 Nov 2026). What you say yourself jumps the queue.
 * `holdMs` is the usual 3600 for a human pace; a smaller number (a fast game) shortens every wait in proportion.
 */
export function useBubbles(holdMs = 3600) {
  const [bubbles, setBubbles] = useState<Record<number, Spoken>>({});
  const counter = useRef(0);
  const queue = useRef<{ seat: number; id: string; n: number }[]>([]);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const scale = holdMs / 3600;
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  function next() {
    const item = queue.current.shift();
    if (!item) { busy.current = false; return; }
    busy.current = true;
    const hold = readingMs(item.id, scale);
    setBubbles({ [item.seat]: { n: item.n, id: item.id } });
    // A short fade before it goes, then a breath, then the next remark.
    later(() => setBubbles((current) => (current[item.seat]?.n === item.n ? { [item.seat]: { n: item.n, id: item.id, leaving: true } } : current)), Math.max(0, hold - 320));
    later(() => { setBubbles((current) => (current[item.seat]?.n === item.n ? {} : current)); later(next, Math.round(260 * scale)); }, hold);
  }
  function say(seat: number, id: string, { priority = false }: { priority?: boolean } = {}) {
    counter.current += 1;
    const item = { seat, id, n: counter.current };
    // Never let a backlog build: the table only needs the latest couple of remarks.
    if (priority) queue.current.unshift(item); else queue.current.push(item);
    if (queue.current.length > 3) queue.current.splice(priority ? 3 : 0, queue.current.length - 3);
    if (!busy.current) next();
  }
  return { bubbles, say };
}

/** The bubble itself: a sticker or a saying, with the words always there for a screen reader. */
export function Bubble({ id, name, n, leaving }: { id: string; name: string; n: number; leaving?: boolean }) {
  const reaction = reactionOf(id);
  if (!reaction) return null;
  return <span key={n} className={'reaction-bubble' + (reaction.sticker ? ' sticker' : '') + (leaving ? ' leaving' : '')} role="status" data-testid="reaction-bubble" data-reaction-shown={id}>
    {reaction.sticker ? <Sticker id={reaction.sticker} size={46} /> : reaction.text}
    <i className="sr-only">{name}: {reaction.text}</i>
  </span>;
}

/** Spicy talk on or off for this phone, kept in step everywhere it is shown. */
export function useSpicy(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(spicyTalk);
  return [on, (next) => { setSpicyTalk(next); setOn(next); }];
}

/** The only way to talk at the table: ten cheeky sayings, eight stickers and, if you ask for them, thirty-seven spicy ones. */
export function ReactionSheet({ open, onOpenChange, onPick, description = 'Everyone at the table sees it for a few seconds.' }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (id: string) => void; description?: string }) {
  const [spicy, setSpicy] = useSpicy();
  return <BottomSheet open={open} onOpenChange={onOpenChange} title="Say something" description={description} snap={0.8}>
    <div className="reaction-picker">
      <div className="reaction-stickers" role="group" aria-label="Stickers">{STICKERS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id} aria-label={entry.text}>{entry.sticker && <Sticker id={entry.sticker} size={48} />}<span>{entry.text}</span></button>)}</div>
      <div className="reaction-grid" role="group" aria-label="Sayings">{SAYINGS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id}><span>{entry.text}</span></button>)}</div>
      <button className={'spicy-toggle' + (spicy ? ' on' : '')} role="switch" aria-checked={spicy} data-testid="spicy-toggle" onClick={() => setSpicy(!spicy)}>
        <Fire size={20} weight="fill" aria-hidden="true" />
        <span><b>Spicy talk {spicy ? 'on' : 'off'}</b><small>{spicy ? 'You swear and see swearing. Phones with it off see a clean version.' : 'Turn on for pub swearing, always bleeped out (F#~k, b@stard). Adults only.'}</small></span>
      </button>
      {spicy && <div className="reaction-grid spicy" role="group" aria-label="Spicy sayings">{SPICY_SAYINGS.map((entry) => <button key={entry.id} onClick={() => onPick(entry.id)} data-reaction={entry.id}><span>{entry.text}</span></button>)}</div>}
    </div>
  </BottomSheet>;
}
