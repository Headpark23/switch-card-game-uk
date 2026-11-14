import { useState } from 'react';
import { ArrowRight, BookOpen, Lightning, Robot } from '@phosphor-icons/react';
import { readActiveTable, readSpeed, saveSpeed } from '../switch/activeTable';
import { SPEED_NAMES, type Speed } from '../switch/presentation';
import { COMPUTER_NAMES } from '../switch/presentation';
import type { ComputerLevel } from '../switch/ai';
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/computerLog';
import { readClub } from '../switch/clubStore';
import { MODES, modeInfo, validateSetup, type PlayMode, type SeriesSetup } from '../switch/series';
import { CardImage, FeltHeader, MiniFan } from '../ui';

const LEVELS: readonly { id: ComputerLevel; name: string; note: string }[] = [
  { id: 'relaxed', name: 'Relaxed', note: 'Makes friendly mistakes' },
  { id: 'standard', name: 'Standard', note: 'Plays sensibly' },
  { id: 'sharp', name: 'Sharp', note: 'Plays to beat you' },
];
const KEY = 'switchTable';

type Choice = { opponents: number; level: ComputerLevel; mode: PlayMode; setsToWin: 3 | 5; limit: number };
const DEFAULT_CHOICE: Choice = { opponents: 1, level: 'standard', mode: 'single', setsToWin: 3, limit: 100 };
const MODE_CARDS: Record<PlayMode, string[]> = { single: ['AS', 'KH'], knockout: ['KS', 'KC'], group: ['QH', 'QD', 'JS'], cup: ['10H', '10S'], darts: ['7S', '7H'], dominoes: ['6C', '6D', '6S'] };
const LIMIT_CHIPS = [50, 100, 150, 200];

/** The fewest computers a way of playing needs, so the picker never offers a table it cannot run. */
const fewestComputers = (mode: PlayMode) => modeInfo(mode).minPlayers - 1;

export function loadTableChoice(): Choice {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null') as Partial<Choice> | null;
    const mode = MODES.find((entry) => entry.id === saved?.mode)?.id ?? 'single';
    const opponents = saved && Number.isInteger(saved.opponents) && saved.opponents! >= 1 && saved.opponents! <= 7 ? Math.max(saved.opponents!, fewestComputers(mode)) : Math.max(1, fewestComputers(mode));
    const level = LEVELS.find((entry) => entry.id === saved?.level)?.id ?? 'standard';
    const limit = Number.isInteger(saved?.limit) && saved!.limit! >= 10 && saved!.limit! <= 999 ? saved!.limit! : DEFAULT_CHOICE.limit;
    return { opponents, level, mode, setsToWin: saved?.setsToWin === 5 ? 5 : 3, limit };
  } catch { return DEFAULT_CHOICE; }
}

type Props = {
  onDeal: (opponents: number, level: ComputerLevel) => void;
  onStartSeries: (setup: SeriesSetup) => void;
  onResume: () => void;
  onMe: () => void;
  onLearn: () => void;
};

/** PLAY: the competitive game against 1 to 7 computers, as a single game or a tournament. Guided practice lives in Learn the Rules, apart from this. */
export default function PlayLobby({ onDeal, onStartSeries, onResume, onMe, onLearn }: Props) {
  const [choice, setChoice] = useState(loadTableChoice);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [active] = useState(readActiveTable);
  const club = readClub();
  const record = summariseComputerGames(getComputerGames(club).filter((game) => game.playerId === getMeId(club)));
  const set = (next: Partial<Choice>) => {
    const merged = { ...choice, ...next };
    merged.opponents = Math.max(merged.opponents, fewestComputers(merged.mode));
    setChoice(merged);
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)); window.localStorage.setItem('switchComputerLevel', merged.level); } catch { /* the choice lasts for this visit */ }
  };
  const pace = (next: Speed) => { setSpeed(next); saveSpeed(next); };
  const setup: SeriesSetup | null = choice.mode === 'single' ? null : { mode: choice.mode, opponents: choice.opponents, level: choice.level, setsToWin: choice.setsToWin, limit: choice.limit };
  const problem = setup ? validateSetup(setup) : null;

  return <section className="play-lobby" aria-labelledby="play-title">
    <FeltHeader compact id="play-title" title="Take a seat." intro="Play Switch against up to seven computers, as a single game or a whole tournament. Every game counts towards your record." cards={['AS', 'KH']} />

    {active && <button className="resume-card" onClick={onResume}><span className="resume-dot" aria-hidden="true" /><span><strong>Resume your game</strong><small>Against {active.opponents === 1 ? 'the computer' : `${active.opponents} computers`} · {LEVELS.find((entry) => entry.id === active.level)?.name} · {active.game.hands[0].length} cards in hand</small></span><ArrowRight size={17} /></button>}

    <div className="lobby-group" role="group" aria-label="Game type">
      <h2>What are we playing?</h2>
      <div className="mode-grid">{MODES.map((entry) => <button key={entry.id} aria-pressed={choice.mode === entry.id} className={choice.mode === entry.id ? 'active' : ''} onClick={() => set({ mode: entry.id })}><MiniFan codes={MODE_CARDS[entry.id]} /><b>{entry.name}</b></button>)}</div>
      <p className="lobby-note" data-testid="mode-note">{modeInfo(choice.mode).blurb}</p>
    </div>

    <div className="lobby-table" aria-label="Your table">
      <div className={`lobby-seats seats-${choice.opponents}`} aria-hidden="true">{Array.from({ length: choice.opponents }, (_, index) => <span key={index} className="lobby-seat"><CardImage code="back" /><i>{COMPUTER_NAMES[index]}</i></span>)}</div>
      <div className="lobby-you" aria-hidden="true"><span>You</span></div>
    </div>

    <div className="lobby-group" role="group" aria-label="Computer opponents">
      <h2>Play against</h2>
      <div className="seg seven">{[1, 2, 3, 4, 5, 6, 7].map((count) => <button key={count} aria-pressed={choice.opponents === count} className={choice.opponents === count ? 'active' : ''} disabled={count < fewestComputers(choice.mode)} onClick={() => set({ opponents: count })} aria-label={`${count} ${count === 1 ? 'opponent' : 'opponents'}`}><b>{count}</b></button>)}</div>
      <p className="lobby-note">
        {choice.opponents === 1 ? 'Head to head. A jack brings play straight back to whoever played it.' : `A table of ${choice.opponents + 1}. Jacks reverse the direction, and the deal passes clockwise.`}
        {choice.opponents >= 6 ? ' Seven or eight players use two decks.' : ''}
        {choice.mode === 'group' ? ` Group Play splits ${choice.opponents + 1} players into two leagues.` : ''}
      </p>
    </div>

    <div className="lobby-group" role="group" aria-label="Difficulty">
      <h2>How good are they?</h2>
      <div className="seg three">{LEVELS.map((entry) => <button key={entry.id} aria-pressed={choice.level === entry.id} className={choice.level === entry.id ? 'active' : ''} onClick={() => set({ level: entry.id })}><b>{entry.name}</b><small>{entry.note}</small></button>)}</div>
    </div>

    {choice.mode === 'darts' && <div className="lobby-group" role="group" aria-label="Sets to win">
      <h2>Sets to win the match</h2>
      <div className="seg three compact">{([3, 5] as const).map((sets) => <button key={sets} aria-pressed={choice.setsToWin === sets} className={choice.setsToWin === sets ? 'active' : ''} onClick={() => set({ setsToWin: sets })}><b>First to {sets}</b></button>)}</div>
      <p className="lobby-note">Win a game to win a leg. Three legs take a set.</p>
    </div>}

    {choice.mode === 'dominoes' && <div className="lobby-group" role="group" aria-label="Losing number">
      <h2>Pick your number</h2>
      <div className="limit-stepper">
        <button aria-label="Lower the number by 10" onClick={() => set({ limit: Math.max(10, choice.limit - 10) })}>−</button>
        <output aria-live="polite" data-testid="domino-limit">{choice.limit}</output>
        <button aria-label="Raise the number by 10" onClick={() => set({ limit: Math.min(999, choice.limit + 10) })}>+</button>
      </div>
      <div className="seg four compact">{LIMIT_CHIPS.map((value) => <button key={value} aria-pressed={choice.limit === value} className={choice.limit === value ? 'active' : ''} onClick={() => set({ limit: value })}><b>{value}</b></button>)}</div>
      <p className="lobby-note">After every game the cards left in each hand add to that player's total: ace 1 up to king 13. The first to reach {choice.limit} loses. The lowest total wins.</p>
    </div>}

    {problem && <p className="lobby-note center" role="alert">{problem}</p>}
    <button className="primary deal-button" disabled={!!problem} onClick={() => (setup ? onStartSeries(setup) : onDeal(choice.opponents, choice.level))}><Lightning size={20} weight="fill" />{setup ? `Start ${modeInfo(choice.mode).name}` : active ? 'Deal a new game' : 'Deal me in'}</button>
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
