import { useState } from 'react';
import { ArrowRight, BookOpen, Lightning, Robot } from '@phosphor-icons/react';
import { readActiveTable, readSpeed, saveSpeed } from '../switch/activeTable';
import { SPEED_NAMES, type Speed } from '../switch/presentation';
import { COMPUTER_NAMES } from '../switch/presentation';
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

/** PLAY: the competitive game against 1 to 4 computers. Guided practice lives in Learn the Rules, apart from this. */
export default function PlayLobby({ onDeal, onResume, onMe, onLearn }: { onDeal: (opponents: number, level: ComputerLevel) => void; onResume: () => void; onMe: () => void; onLearn: () => void }) {
  const [choice, setChoice] = useState(loadTableChoice);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [active] = useState(readActiveTable);
  const club = readClub();
  const record = summariseComputerGames(getComputerGames(club).filter((game) => game.playerId === getMeId(club)));
  const set = (next: Partial<typeof choice>) => {
    const merged = { ...choice, ...next };
    setChoice(merged);
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)); window.localStorage.setItem('switchComputerLevel', merged.level); } catch { /* the choice lasts for this visit */ }
  };
  const pace = (next: Speed) => { setSpeed(next); saveSpeed(next); };
  return <section className="play-lobby" aria-labelledby="play-title">
    <FeltHeader compact id="play-title" title="Take a seat." intro="Play Switch against the computer. Every finished game counts towards your record." cards={['AS', 'KH']} />

    {active && <button className="resume-card" onClick={onResume}><span className="resume-dot" aria-hidden="true" /><span><strong>Resume your game</strong><small>Against {active.opponents === 1 ? 'the computer' : `${active.opponents} computers`} · {LEVELS.find((entry) => entry.id === active.level)?.name} · {active.game.hands[0].length} cards in hand</small></span><ArrowRight size={17} /></button>}

    <div className="lobby-table" aria-label="Your table">
      <div className={`lobby-seats seats-${choice.opponents}`} aria-hidden="true">{Array.from({ length: choice.opponents }, (_, index) => <span key={index} className="lobby-seat"><CardImage code="back" /><i>{COMPUTER_NAMES[index]}</i></span>)}</div>
      <div className="lobby-you" aria-hidden="true"><span>You</span></div>
    </div>

    <div className="lobby-group" role="group" aria-label="Computer opponents">
      <h2>Play against</h2>
      <div className="seg">{[1, 2, 3, 4].map((count) => <button key={count} aria-pressed={choice.opponents === count} className={choice.opponents === count ? 'active' : ''} onClick={() => set({ opponents: count })}><b>{count}</b><small>{count === 1 ? 'opponent' : 'opponents'}</small></button>)}</div>
      <p className="lobby-note">{choice.opponents === 1 ? 'Head to head. A jack brings play straight back to whoever played it.' : `A table of ${choice.opponents + 1}. Jacks reverse the direction, and the deal passes clockwise.`}</p>
    </div>

    <div className="lobby-group" role="group" aria-label="Difficulty">
      <h2>How good are they?</h2>
      <div className="seg three">{LEVELS.map((entry) => <button key={entry.id} aria-pressed={choice.level === entry.id} className={choice.level === entry.id ? 'active' : ''} onClick={() => set({ level: entry.id })}><b>{entry.name}</b><small>{entry.note}</small></button>)}</div>
    </div>

    <button className="primary deal-button" onClick={() => onDeal(choice.opponents, choice.level)}><Lightning size={20} weight="fill" />{active ? 'Deal a new game' : 'Deal me in'}</button>
    {active && <p className="lobby-note center">Dealing a new game drops the unfinished one without counting it.</p>}

    <div className="lobby-group" role="group" aria-label="Computer pace">
      <h2>Pace of play</h2>
      <div className="seg three compact">{(['quick', 'natural', 'relaxed'] as const).map((id) => <button key={id} aria-pressed={speed === id} className={speed === id ? 'active' : ''} onClick={() => pace(id)}><b>{SPEED_NAMES[id]}</b></button>)}</div>
      <p className="lobby-note">How long each computer pauses and how slowly cards travel. A pause only, so you can follow the play.</p>
    </div>

    <button className="record-strip" onClick={onMe} aria-label={record.games ? `Your record against the computer: ${record.wins} wins from ${record.games} games` : 'Your record against the computer'}><Robot size={20} weight="fill" /><span><strong>{record.games ? `${record.wins} won of ${record.games}` : 'No games yet'}</strong><small>{record.games ? `${Math.round(record.winRate * 100)}% against the computer${record.currentStreak > 1 ? ` · ${record.currentStreak} in a row` : ''} · best run ${record.bestStreak}` : 'Your wins, streaks and form will appear here.'}</small></span><ArrowRight size={16} /></button>

    <button className="learn-aside" onClick={onLearn}><BookOpen size={18} weight="bold" /><span><strong>Still learning?</strong><small>Practise with hints in Learn the Rules. Practice games are never counted.</small></span><ArrowRight size={14} /></button>
  </section>;
}
