import { useState } from 'react';
import { ArrowRight, BookOpen, Check, Lightning, Robot, Shuffle, UsersThree } from '@phosphor-icons/react';
import { readActiveTable, readSpeed, saveSpeed } from '../switch/store/activeTable';
import { SPEED_NAMES, type Speed } from '../switch/stats/presentation';
import { LEVEL_NAMES, LEVEL_NOTES, type ComputerLevel } from '../switch/ai/ai';
import { PERSONALITIES, TACTICS, tacticWeights, type TacticId } from '../switch/ai/computerTactics';

/** One line saying what a computer leans on at this level. Easy computers use no tactics at all. */
function leansOn(level: ComputerLevel, personality: string): string {
  if (level === 'relaxed') return 'No tactics on Easy: just friendly play.';
  const weights = tacticWeights(level, personality);
  const favourites = (Object.keys(TACTICS) as TacticId[]).filter((tactic) => weights[tactic] >= 1.2).sort((a, b) => weights[b] - weights[a]).slice(0, 2);
  return favourites.length ? `Leans on ${favourites.map((tactic) => TACTICS[tactic].name.toLowerCase()).join(' and ')}.` : 'An even mix of tactics.';
}
import { getComputerGames, getMeId, summariseComputerGames } from '../switch/store/computerLog';
import { readClub } from '../switch/store/clubStore';
import { loadSeat } from '../switch/sync/onlineRoom';
import { ROUND_CHOICES, roundsLabel, roundsNote, chooseComputers, COMPUTER_MODES, COMPUTER_NAMES_IN_ORDER, MAX_COMPUTERS, MATCH_BEST_OF, MATCH_FIRST_TO, matchCountFor, matchLabel, modeInfo, validateSetup, type MatchType, type PlayMode, type SeriesSetup } from '../switch/formats/series';
import { CardImage, FeltHeader, MiniFan } from '../components/ui';
import { deriveLegends } from '../components/LegendsCard';

const LEVELS: readonly { id: ComputerLevel; name: string; note: string }[] = [
  { id: 'relaxed', name: LEVEL_NAMES.relaxed, note: LEVEL_NOTES.relaxed },
  { id: 'standard', name: LEVEL_NAMES.standard, note: LEVEL_NOTES.standard },
  { id: 'sharp', name: LEVEL_NAMES.sharp, note: LEVEL_NOTES.sharp },
];
const KEY = 'switchTable';

type Choice = { picks: string[]; opponents: number; level: ComputerLevel; mode: PlayMode; setsToWin: 3 | 5; limit: number; matchType: MatchType; games: number; roundsToWin: number };
/** "Games" with one game is an ordinary single game: the default, and what an older saved "single" becomes. */
const DEFAULT_CHOICE: Choice = { picks: [], opponents: 1, level: 'standard', mode: 'match', setsToWin: 3, limit: 100, matchType: 'first', games: 1, roundsToWin: 1 };
const MODE_CARDS: Record<PlayMode, string[]> = { single: ['AS', 'KH'], match: ['AS', 'AH', 'AD'], lastout: ['KS', 'KH', 'KD'], knockout: ['KS', 'KC'], group: ['QH', 'QD', 'JS'], cup: ['10H', '10S'], darts: ['7S', '7H'], dominoes: ['6C', '6D', '6S'] };
const LIMIT_CHIPS = [50, 100, 150, 200];

/** The fewest computers a way of playing needs, so the picker never offers a table it cannot run. */
const fewestComputers = (mode: PlayMode) => modeInfo(mode).minPlayers - 1;

export function loadTableChoice(): Choice {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null') as Partial<Choice> | null;
    const mode = COMPUTER_MODES.find((entry) => entry.id === saved?.mode)?.id ?? 'match';
    const matchType: MatchType = saved?.matchType === 'best' ? 'best' : 'first';
    const games = matchCountFor(matchType, Number.isInteger(saved?.games) ? saved!.games! : 1);
    const opponents = saved && Number.isInteger(saved.opponents) && saved.opponents! >= 1 && saved.opponents! <= MAX_COMPUTERS ? Math.max(saved.opponents!, fewestComputers(mode)) : Math.max(1, fewestComputers(mode));
    const level = LEVELS.find((entry) => entry.id === saved?.level)?.id ?? 'standard';
    const limit = Number.isInteger(saved?.limit) && saved!.limit! >= 10 && saved!.limit! <= 999 ? saved!.limit! : DEFAULT_CHOICE.limit;
    const picks = Array.isArray(saved?.picks) ? saved!.picks!.filter((name, index, all) => (COMPUTER_NAMES_IN_ORDER as readonly string[]).includes(name) && all.indexOf(name) === index).slice(0, opponents) : [];
    const roundsToWin = Number.isInteger(saved?.roundsToWin) && saved!.roundsToWin! >= 1 && saved!.roundsToWin! <= ROUND_CHOICES.length ? saved!.roundsToWin! : 1;
    return { picks, opponents, level, mode, setsToWin: saved?.setsToWin === 5 ? 5 : 3, limit, matchType, games, roundsToWin };
  } catch { return DEFAULT_CHOICE; }
}

type Props = {
  onDeal: (opponents: number, level: ComputerLevel, computers?: string[]) => void;
  onStartSeries: (setup: SeriesSetup) => void;
  onResume: () => void;
  onMe: () => void;
  onLearn: () => void;
  onFriends: () => void;
};

/** PLAY: the competitive game against 1 to 5 computers, as a single game or a tournament. Guided practice lives in Learn the Rules, apart from this. */
export default function PlayLobby({ onDeal, onStartSeries, onResume, onMe, onLearn, onFriends }: Props) {
  const [choice, setChoice] = useState(loadTableChoice);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [active] = useState(readActiveTable);
  const club = readClub();
  const kept = loadSeat();
  const myGames = getComputerGames(club).filter((game) => game.playerId === getMeId(club));
  const record = summariseComputerGames(myGames);
  const legendsBeaten = deriveLegends(myGames).filter((item) => item.beaten).length;
  const set = (next: Partial<Choice>) => {
    const merged = { ...choice, ...next };
    merged.opponents = Math.max(merged.opponents, fewestComputers(merged.mode));
    merged.picks = merged.picks.slice(0, merged.opponents);
    setChoice(merged);
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)); window.localStorage.setItem('switchComputerLevel', merged.level); } catch { /* the choice lasts for this visit */ }
  };
  const pace = (next: Speed) => { setSpeed(next); saveSpeed(next); };
  const singleGame = choice.mode === 'match' && choice.games === 1;
  /** The computers you will face: the ones you picked, with any other seats left to chance. Nothing picked is a surprise table. */
  const deal = () => chooseComputers(choice.opponents, choice.picks);
  const setup: SeriesSetup | null = singleGame || choice.mode === 'single' ? null
    : { mode: choice.mode as SeriesSetup['mode'], opponents: choice.opponents, level: choice.level, setsToWin: choice.setsToWin, limit: choice.limit, ...(choice.mode === 'match' ? { matchType: choice.matchType, games: choice.games } : {}), ...(choice.mode === 'lastout' && choice.roundsToWin > 1 ? { roundsToWin: choice.roundsToWin } : {}) };
  const problem = setup ? validateSetup(setup) : null;
  const pickMatchType = (next: MatchType) => set({ matchType: next, games: matchCountFor(next, choice.games) });
  const startLabel = choice.mode === 'match' ? matchLabel(choice.matchType, choice.games) : choice.mode === 'lastout' && choice.roundsToWin > 1 ? `Last One Out · ${roundsLabel(choice.roundsToWin).toLowerCase()}` : modeInfo(choice.mode).name;

  return <section className="play-lobby" aria-labelledby="play-title">
    <FeltHeader compact id="play-title" title="Take a seat." intro="Play Switch against up to five computers, as a single game or a whole tournament. Every game counts towards your record." cards={['AS', 'KH']} />

    {active && <button className="resume-card" onClick={onResume}><span className="resume-dot" aria-hidden="true" /><span><strong>Resume your game</strong><small>Against {active.opponents === 1 ? 'the computer' : `${active.opponents} computers`} · {LEVELS.find((entry) => entry.id === active.level)?.name} · {active.game.hands[0].length} cards in hand</small></span><ArrowRight size={17} /></button>}

    <button className="friends-entry" onClick={onFriends} data-testid="play-friends"><UsersThree size={24} weight="fill" /><span><strong>{kept ? `Back to your table (${kept.code})` : 'Play with friends'}</strong><small>{kept ? 'Your friends and family are waiting.' : 'A private table for family and friends, anywhere. Start one or join with a code.'}</small></span><ArrowRight size={16} /></button>

    <div className="lobby-cols">
    <div className="lobby-setup">
    <div className="lobby-group" role="group" aria-label="Game type">
      <h2>What are we playing?</h2>
      <div className="mode-grid">{COMPUTER_MODES.map((entry) => <button key={entry.id} aria-label={entry.name} aria-describedby={`mode-blurb-${entry.id}`} aria-pressed={choice.mode === entry.id} className={choice.mode === entry.id ? 'active' : ''} onClick={() => set({ mode: entry.id })}><MiniFan codes={MODE_CARDS[entry.id]} /><span className="mode-text"><b>{entry.name}</b><small id={`mode-blurb-${entry.id}`}>{entry.blurb}</small></span></button>)}</div>
      <details className="mode-detail mode-detail-fold" data-testid="mode-detail" aria-live="polite">
        <summary>
          <span className="mode-fold-head">
            <h3>How {modeInfo(choice.mode).name} plays</h3>
            <p className="mode-short" data-testid="mode-note">{modeInfo(choice.mode).blurb}</p>
          </span>
          <span className="mode-fold-cue" aria-hidden="true">Details</span>
        </summary>
        <div className="mode-detail-body">
          {modeInfo(choice.mode).how.map((line, index) => <p key={index}>{line}</p>)}
          <p className="mode-scoring"><strong>Scoring.</strong> {modeInfo(choice.mode).scoring}</p>
        </div>
      </details>
    </div>

    <div className="lobby-table" aria-label="Your table">
      <div className={`lobby-seats seats-${choice.opponents}`} aria-hidden="true">{Array.from({ length: choice.opponents }, (_, index) => <span key={index} className="lobby-seat"><CardImage code="back" /><i>{choice.picks[index] ?? '?'}</i></span>)}</div>
      <div className="lobby-you" aria-hidden="true"><span>You</span></div>
    </div>

    <div className="lobby-group" role="group" aria-label="Computer opponents">
      <h2>Play against</h2>
      <div className="seg five">{Array.from({ length: MAX_COMPUTERS }, (_, index) => index + 1).map((count) => <button key={count} aria-pressed={choice.opponents === count} className={choice.opponents === count ? 'active' : ''} disabled={count < fewestComputers(choice.mode)} onClick={() => set({ opponents: count })} aria-label={`${count} ${count === 1 ? 'opponent' : 'opponents'}`}><b>{count}</b></button>)}</div>
      <p className="lobby-note">
        {choice.opponents === 1 ? 'Head to head. A jack brings play straight back to whoever played it.' : `A table of ${choice.opponents + 1}. Jacks reverse the direction, and the deal passes clockwise.`}
        {choice.mode === 'group' ? ` Group Play splits ${choice.opponents + 1} players into two leagues.` : ''}
      </p>
    </div>

    <div className="lobby-group" role="group" aria-label="Difficulty">
      <h2>How good are they?</h2>
      <div className="seg three">{LEVELS.map((entry) => <button key={entry.id} aria-pressed={choice.level === entry.id} className={choice.level === entry.id ? 'active' : ''} onClick={() => set({ level: entry.id })}><b>{entry.name}</b><small>{entry.note}</small></button>)}</div>
    </div>

    {choice.mode === 'match' && <div className="lobby-group" role="group" aria-label="Number of games">
      <h2>How many games?</h2>
      <div className="seg two compact">{([['first', 'First to'], ['best', 'Best of']] as const).map(([id, label]) => <button key={id} aria-pressed={choice.matchType === id} className={choice.matchType === id ? 'active' : ''} onClick={() => pickMatchType(id)}><b>{label}</b></button>)}</div>
      <div className="seg five compact">{(choice.matchType === 'best' ? MATCH_BEST_OF : MATCH_FIRST_TO).map((count) => <button key={count} aria-pressed={choice.games === count} className={choice.games === count ? 'active' : ''} onClick={() => set({ games: count })} aria-label={`${choice.matchType === 'best' ? 'Best of' : 'First to'} ${count}`}><b>{count}</b></button>)}</div>
      <p className="lobby-note" data-testid="match-note">{matchLabel(choice.matchType, choice.games)}.{choice.games === 1 ? ' One game of Switch: first out wins.' : choice.matchType === 'best' ? ' Most wins takes it, and it stops as soon as nobody can catch the leader.' : ' Every game is ordinary Switch.'}</p>
    </div>}

    {choice.mode === 'lastout' && <div className="lobby-group" role="group" aria-label="Rounds to win">
      <h2>How many rounds?</h2>
      <div className="seg five compact">{ROUND_CHOICES.map((count) => <button key={count} aria-pressed={choice.roundsToWin === count} className={choice.roundsToWin === count ? 'active' : ''} onClick={() => set({ roundsToWin: count })} aria-label={count === 1 ? 'One-off game' : `First to ${count} round wins`}><b>{count === 1 ? 'One-off' : `First to ${count}`}</b></button>)}</div>
      <p className="lobby-note" data-testid="rounds-note">{roundsNote(choice.roundsToWin)}</p>
    </div>}

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

    <div className="lobby-group" role="group" aria-label="Who you are playing">
      <h2>Who do you want to play?</h2>
      <p className="lobby-note" data-testid="picker-note">{choice.picks.length === 0 ? `Surprise me: ${choice.opponents === 1 ? 'a computer is' : `${choice.opponents} computers are`} drawn at random.` : choice.picks.length >= choice.opponents ? `Your table is set: ${choice.picks.join(', ')}.` : `${choice.picks.join(', ')} picked. ${choice.opponents - choice.picks.length} more ${choice.opponents - choice.picks.length === 1 ? 'seat is' : 'seats are'} drawn at random.`}</p>
      <div className="pick-actions"><button aria-pressed={choice.picks.length === 0} className={choice.picks.length === 0 ? 'active' : ''} onClick={() => set({ picks: [] })}><Shuffle size={16} weight="bold" />Pick at random</button></div>
      <details className="pick-fold" open={choice.picks.length > 0}>
        <summary>{choice.picks.length > 0 ? `Change your picked computers (${choice.picks.length}/${choice.opponents})` : 'Choose specific computers'}</summary>
        <ul className="personalities pickable">{PERSONALITIES.map((personality) => {
          const picked = choice.picks.includes(personality.name);
          const full = !picked && choice.picks.length >= choice.opponents;
          return <li key={personality.id}><button aria-pressed={picked} disabled={full} className={picked ? 'active' : ''} aria-label={`${picked ? 'Remove' : 'Pick'} ${personality.name}`} onClick={() => set({ picks: picked ? choice.picks.filter((name) => name !== personality.name) : [...choice.picks, personality.name] })}>
            <span className="personality-top"><strong>{personality.name}</strong><em>{personality.title}</em>{picked && <Check size={16} weight="bold" className="picked-tick" />}</span>
            <span>{personality.blurb}</span>
            <small>{leansOn(choice.level, personality.id)}</small>
          </button></li>;
        })}</ul>
      </details>
    </div>

    </div>
    <div className="lobby-side">
    {problem && <p className="lobby-note center" role="alert">{problem}</p>}
    <button className="primary deal-button" disabled={!!problem} onClick={() => (setup ? onStartSeries({ ...setup, computers: deal() }) : onDeal(choice.opponents, choice.level, choice.picks.length ? deal() : undefined))}><Lightning size={20} weight="fill" />{setup ? `Start ${startLabel}` : active ? 'Deal a new game' : 'Deal me in'}</button>
    {active && <p className="lobby-note center">Dealing a new game drops the unfinished one without counting it.</p>}

    <div className="lobby-group" role="group" aria-label="Computer pace">
      <h2>Pace of play</h2>
      <div className="seg three compact">{(['quick', 'natural', 'relaxed'] as const).map((id) => <button key={id} aria-pressed={speed === id} className={speed === id ? 'active' : ''} onClick={() => pace(id)}><b>{SPEED_NAMES[id]}</b></button>)}</div>
      <p className="lobby-note">How long each computer pauses and how slowly cards travel. A pause only, so you can follow the play.</p>
    </div>

    <button className="record-strip" onClick={onMe} aria-label={record.games ? `Your record against the computer: ${record.wins} wins from ${record.games} games` : 'Your record against the computer'}><Robot size={20} weight="fill" /><span><strong>{record.games ? `${record.wins} won of ${record.games}` : 'No games yet'}</strong><small>{record.games ? `${Math.round(record.winRate * 100)}% win rate · ${legendsBeaten}/${PERSONALITIES.length} legends beaten${record.currentStreak > 1 ? ` · ${record.currentStreak} in a row` : ''}` : `12 legends to beat. Your wins and streaks appear here.`}</small></span><ArrowRight size={16} /></button>

    <button className="learn-aside" onClick={onLearn}><BookOpen size={18} weight="bold" /><span><strong>Still learning?</strong><small>Practise with hints in Learn the Rules. Practice games are never counted.</small></span><ArrowRight size={14} /></button>
    </div>
    </div>
  </section>;
}
