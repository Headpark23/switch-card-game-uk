import { useState } from 'react';
import { ArrowRight, BookOpen, Cards, ClockCounterClockwise, Lightning, Robot, UsersThree } from '@phosphor-icons/react';
import type { ComputerLevel } from '../switch/ai';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { CardImage, FeltHeader } from '../ui';

const LEVELS: readonly { id: ComputerLevel; name: string; note: string }[] = [
  { id: 'relaxed', name: 'Relaxed', note: 'Makes friendly mistakes' },
  { id: 'standard', name: 'Standard', note: 'Plays sensibly' },
  { id: 'sharp', name: 'Sharp', note: 'Plays to beat you' },
];
const KEY = 'switchTable';

export function loadTableChoice(): { opponents: number; level: ComputerLevel } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null') as { opponents?: number; level?: string } | null;
    const opponents = saved && Number.isInteger(saved.opponents) && saved.opponents! >= 1 && saved.opponents! <= 4 ? saved.opponents! : 1;
    const level = LEVELS.find((entry) => entry.id === saved?.level)?.id ?? 'standard';
    return { opponents, level };
  } catch { return { opponents: 1, level: 'standard' }; }
}

/** The Play tab: choose who sits at the table and deal. Everything about real-card nights sits underneath. */
export default function PlayLobby({ onDeal, onScore, onQuick, onModes, onMe }: { onDeal: (opponents: number, level: ComputerLevel) => void; onScore: () => void; onQuick: () => void; onModes: () => void; onMe: () => void }) {
  const [choice, setChoice] = useState(loadTableChoice);
  const club = readClub();
  const record = summariseComputerGames(getComputerGames(club).filter((game) => game.playerId === getMeId(club)));
  const set = (next: Partial<typeof choice>) => {
    const merged = { ...choice, ...next };
    setChoice(merged);
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)); window.localStorage.setItem('switchComputerLevel', merged.level); } catch { /* the choice lasts for this visit */ }
  };
  return <section className="play-lobby" aria-labelledby="play-title">
    <FeltHeader compact id="play-title" title="Take a seat." intro="The computer is a good player. Every game is logged." cards={['AS', 'KH']} />

    <div className="lobby-table" aria-label="Your table">
      <div className="lobby-seats" aria-hidden="true">{Array.from({ length: choice.opponents }, (_, index) => <span key={index} className="lobby-seat"><CardImage code="back" /><i>{['John', 'Paul', 'George', 'Ringo'][index]}</i></span>)}</div>
      <div className="lobby-you" aria-hidden="true"><span>You</span></div>
    </div>

    <div className="lobby-group" role="group" aria-label="Computer opponents">
      <h2>Play against</h2>
      <div className="seg">{[1, 2, 3, 4].map((count) => <button key={count} aria-pressed={choice.opponents === count} className={choice.opponents === count ? 'active' : ''} onClick={() => set({ opponents: count })}><b>{count}</b><small>{count === 1 ? 'opponent' : 'opponents'}</small></button>)}</div>
      <p className="lobby-note">{choice.opponents === 1 ? 'Head to head with full coaching: every move explained.' : `A table of ${choice.opponents + 1}. Jacks reverse the direction, and the deal passes clockwise.`}</p>
    </div>

    <div className="lobby-group" role="group" aria-label="Difficulty">
      <h2>How good are they?</h2>
      <div className="seg three">{LEVELS.map((entry) => <button key={entry.id} aria-pressed={choice.level === entry.id} className={choice.level === entry.id ? 'active' : ''} onClick={() => set({ level: entry.id })}><b>{entry.name}</b><small>{entry.note}</small></button>)}</div>
    </div>

    <button className="primary deal-button" onClick={() => onDeal(choice.opponents, choice.level)}><Lightning size={20} weight="fill" />Deal me in</button>

    {record.games > 0 && <button className="record-strip" onClick={onMe} aria-label={`Your record against the computer: ${record.wins} wins from ${record.games} games`}><Robot size={20} weight="fill" /><span><strong>{record.wins} won of {record.games}</strong><small>{Math.round(record.winRate * 100)}% against the computer{record.currentStreak > 1 ? ` · ${record.currentStreak} in a row` : ''}</small></span><ArrowRight size={16} /></button>}

    <h2 className="lobby-sub">Playing with real cards?</h2>
    <p className="lobby-note">Keep the scores, deal and stats for a night at a real table.</p>
    <div className="lobby-actions">
      <button className="primary" onClick={onScore}><UsersThree size={19} weight="bold" />Open the Switch scorekeeper</button>
      <button className="secondary" onClick={onQuick}><ClockCounterClockwise size={18} weight="bold" />Quick night</button>
      <button className="text-link" onClick={onModes}><BookOpen size={16} weight="bold" />Ways to play <ArrowRight size={14} /></button>
      <button className="text-link" onClick={onMe}><Cards size={16} weight="bold" />My games, badges and passport <ArrowRight size={14} /></button>
    </div>
  </section>;
}
