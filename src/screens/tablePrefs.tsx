import { useState } from 'react';
import { ChatCircleDots, ListBullets } from '@phosphor-icons/react';
import type { Suit } from '../switch/types';
import { suitNames, suitSymbols } from '../ui';

/** Two per-phone switches for the table: card move descriptions and speech bubbles (owner request, 16 Nov 2026). New keys, on by default. */
const KEYS = { moves: 'switchTableMoves', talk: 'switchTableBubbles' } as const;

function read(key: string): boolean {
  try { return window.localStorage.getItem(key) !== '0'; } catch { return true; }
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

/** The suit in play, big enough to read across the table. It pops when it changes (an ace). */
export function SuitBadge({ suit }: { suit: Suit }) {
  const red = suit === 'H' || suit === 'D';
  return <span key={suit} className={'suit-badge' + (red ? ' red' : '')} data-testid="suit-badge" data-suit={suit} role="status" aria-label={`Suit in play: ${suitNames[suit]}`}>
    <i aria-hidden="true">{suitSymbols[suit]}</i><b>{suitNames[suit]}</b>
  </span>;
}
