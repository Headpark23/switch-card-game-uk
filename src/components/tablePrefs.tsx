import { useEffect, useState } from 'react';
import { ChatCircleDots, ListBullets } from '@phosphor-icons/react';
import type { Suit } from '../switch/engine/types';
import { suitNames, suitSymbols } from './ui';

/** Per-phone switches for the table: card move descriptions, speech bubbles, and always-sorted hand. */
const KEYS = { moves: 'switchTableMoves', talk: 'switchTableBubbles', autoSort: 'switchAutoSort' } as const;

function read(key: string): boolean {
  try { return window.localStorage.getItem(key) !== '0'; } catch { return true; }
}

/** Remember whether the player prefers their hand kept sorted from the deal (off until turned on). */
export function readAutoSort(): boolean {
  try { return window.localStorage.getItem(KEYS.autoSort) === '1'; } catch { return false; }
}

export function saveAutoSort(on: boolean): void {
  try { window.localStorage.setItem(KEYS.autoSort, on ? '1' : '0'); } catch { /* storage blocked */ }
}

export function useTablePrefs() {
  const [moves, setMovesState] = useState(() => read(KEYS.moves));
  const [talk, setTalkState] = useState(() => read(KEYS.talk));
  const save = (key: string, on: boolean) => { try { window.localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage blocked: the choice lasts for this game */ } };
  return {
    moves, talk,
    setMoves: (on: boolean) => { save(KEYS.moves, on); setMovesState(on); },
    setTalk: (on: boolean) => { save(KEYS.talk, on); setTalkState(on); },
  };
}

/** Two small buttons in the turn banner. */
export function TableToggles({ prefs }: { prefs: ReturnType<typeof useTablePrefs> }) {
  return <span className="table-toggles">
    <button className={'table-toggle' + (prefs.moves ? ' on' : '')} onClick={() => prefs.setMoves(!prefs.moves)} aria-pressed={prefs.moves} aria-label={prefs.moves ? 'Card move descriptions are on. Turn off' : 'Card move descriptions are off. Turn on'} title="Card move descriptions" data-testid="toggle-moves"><ListBullets size={16} weight={prefs.moves ? 'fill' : 'regular'} aria-hidden="true" /></button>
    <button className={'table-toggle' + (prefs.talk ? ' on' : '')} onClick={() => prefs.setTalk(!prefs.talk)} aria-pressed={prefs.talk} aria-label={prefs.talk ? 'Speech bubbles are on. Turn off' : 'Speech bubbles are off. Turn on'} title="Speech bubbles" data-testid="toggle-bubbles"><ChatCircleDots size={16} weight={prefs.talk ? 'fill' : 'regular'} aria-hidden="true" /></button>
  </span>;
}

/**
 * The suit in play: quiet small text all the time, and a big badge that pops up for a few seconds when an ace is played
 * (owner request, 16 Nov 2026). `aceKey` is set while an ace's effect is on the table.
 */
export function SuitBadge({ suit, aceKey }: { suit: Suit; aceKey: string | null }) {
  const [popped, setPopped] = useState<string | null>(null);
  useEffect(() => {
    if (!aceKey) return;
    setPopped(aceKey);
    // Not cleared when the ace's effect line ends: the pop-up outlasts it by design.
    window.setTimeout(() => setPopped((current) => (current === aceKey ? null : current)), 3500);
  }, [aceKey]);
  const red = suit === 'H' || suit === 'D';
  return <>
    <span className="suit-line">Suit <b className={red ? 'red' : ''}>{suitSymbols[suit]} {suitNames[suit]}</b></span>
    {popped && <span key={popped} className={'suit-badge' + (red ? ' red' : '')} data-testid="suit-badge" data-suit={suit} role="status" aria-label={`Suit in play: ${suitNames[suit]}`}>
      <i aria-hidden="true">{suitSymbols[suit]}</i><b>{suitNames[suit]}</b>
    </span>}
  </>;
}
