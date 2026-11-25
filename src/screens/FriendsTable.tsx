import { useEffect, useState } from 'react';
import { ArrowRight, CaretLeft, Check, Shuffle, UsersThree } from '@phosphor-icons/react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { LEVEL_NAMES, type ComputerLevel } from '../switch/ai/ai';
import { PERSONALITIES } from '../switch/ai/computerTactics';
import { cleanTableCode, clearSeat, createTable, joinTable, loadSeat, lookupTable, saveSeat, type RoomSummary } from '../switch/sync/onlineRoom';
import { readClub } from '../switch/store/clubStore';
import { getMeId } from '../switch/store/computerLog';
import { getProfiles } from '../switch/store/profiles';
import { FeltHeader, MiniFan } from '../components/ui';
import { ROUND_CHOICES, roundsNote, MATCH_BEST_OF, MATCH_FIRST_TO, matchLabel, modeInfo, ONLINE_MAX_PLAYERS, ONLINE_MODES, type MatchType, type PlayMode } from '../switch/formats/series';
import { onlineModeBlurb, ONLINE_MODE_CARDS } from '../switch/sync/onlineRoom';
import { fetchShare } from '../switch/sync/shareNight';
import { readCode, type CodeKind } from '../switch/sync/joinCode';

const LEVELS: readonly ComputerLevel[] = ['relaxed', 'standard', 'sharp'];
const NAME_KEY = 'switchOnlineName';

function myName(): string {
  try {
    const club = readClub();
    const name = getProfiles(club).find((profile) => profile.id === getMeId(club))?.name ?? '';
    return name.toLowerCase() === 'you' ? '' : name;
  } catch { return ''; }
}
function rememberedName(): string {
  try { return window.localStorage.getItem(NAME_KEY) || myName(); } catch { return ''; }
}

type Props = {
  /** A code from an invitation link or typed in; opens the join form already filled in. */
  initialCode?: string;
  onBack: () => void;
  /** A seat has been taken: go and sit at the table. */
  onSeated: () => void;
  /** The code turned out to be a scored night or a club, not a table: go there instead. */
  onOpenCode?: (kind: CodeKind, code: string) => void;
};

/** Bigger online nights split onto several tables of up to 6 (rulings 32 and 38). */
const BIG_NIGHTS = [8, 10, 12, 14, 16];

/** PLAY WITH FRIENDS: start a private table or join one with a code. Computers fill any empty seats. */
export default function FriendsTable({ initialCode = '', onBack, onSeated, onOpenCode }: Props) {
  const keyboard = useKeyboard();
  const [view, setView] = useState<'menu' | 'create' | 'join'>(initialCode ? 'join' : 'menu');
  const [name, setName] = useState(rememberedName);
  const [seats, setSeats] = useState(4);
  const [level, setLevel] = useState<ComputerLevel>('standard');
  const [mode, setMode] = useState<PlayMode>('match');
  const [matchType, setMatchType] = useState<MatchType>('first');
  const [games, setGames] = useState<number>(1);
  const pickMatchType = (next: MatchType) => { setMatchType(next); setGames((current) => (next === 'best' ? (current === 2 ? 3 : MATCH_BEST_OF.includes(current as never) ? current : 3) : MATCH_FIRST_TO.includes(current as never) ? current : Math.min(5, Math.ceil(current / 2)))); };
  const [setsToWin, setSetsToWin] = useState<3 | 5>(3);
  const [roundsToWin, setRoundsToWin] = useState(1);
  const [limit, setLimit] = useState(100);
  /** Computers the host wants at the table. Empty means a surprise: any empty seat is drawn at random. */
  const [picks, setPicks] = useState<string[]>([]);
  /** Guests take the other seats, so the computers can fill at most all but two (you and one friend). */
  const maxPicks = Math.max(0, seats - 2);
  const picked = picks.slice(0, maxPicks);
  const fewest = modeInfo(mode).minPlayers;
  const most = ONLINE_MAX_PLAYERS[mode];
  const pickMode = (next: PlayMode) => { setMode(next); setSeats((current) => Math.min(ONLINE_MAX_PLAYERS[next], Math.max(current, modeInfo(next).minPlayers))); };
  const [code, setCode] = useState(readCode(initialCode).code.slice(0, 6));
  const [found, setFound] = useState<RoomSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const kept = loadSeat();

  // Opening the same invitation again (a second tap on the link, or the app reopening on it) must take you back to your seat.
  // Joining a second time would fail, because your own name is already at the table.
  useEffect(() => { if (initialCode && kept && kept.code === readCode(initialCode).code.slice(0, 6)) onSeated(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // As soon as a full code is in, look the table up so the person can see who is already there.
  useEffect(() => {
    setFound(null);
    if (view !== 'join' || code.length !== 6) return;
    let alive = true;
    lookupTable(code).then((summary) => { if (alive) { setFound(summary); setProblem(summary.open ? '' : summary.status === 'lobby' ? 'That table is full.' : 'That game has already started.'); } })
      .catch((reason: Error) => {
        if (!alive) return;
        // Not a table? It may be a scored night with the same kind of code, which opens on its own screen.
        fetchShare(code).then(() => { if (alive && onOpenCode) onOpenCode('night', code); else if (alive) setProblem(reason.message); }).catch(() => { if (alive) setProblem(reason.message); });
      });
    return () => { alive = false; };
  }, [view, code]);

  const cleanName = name.trim().slice(0, 20);
  const remember = () => { try { window.localStorage.setItem(NAME_KEY, cleanName); } catch { /* the name lasts for this visit */ } };

  async function create() {
    if (!cleanName || busy) return;
    keyboard.hide(); setBusy(true); setProblem(''); remember();
    try {
      const made = await createTable(cleanName, seats, level, { mode, ...(picked.length ? { computers: picked } : {}), ...(mode === 'match' ? { matchType, games } : {}), ...(mode === 'darts' ? { setsToWin } : {}), ...(mode === 'lastout' && roundsToWin > 1 ? { roundsToWin } : {}), ...(mode === 'dominoes' ? { limit } : {}) });
      saveSeat({ code: made.code, token: made.token, name: cleanName });
      onSeated();
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : 'Could not start the table.'); }
    finally { setBusy(false); }
  }

  async function join() {
    if (!cleanName || code.length !== 6 || busy) return;
    keyboard.hide(); setBusy(true); setProblem(''); remember();
    try {
      const joined = await joinTable(code, cleanName);
      saveSeat({ code: joined.code, token: joined.token, name: cleanName });
      onSeated();
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : 'Could not join that table.'); }
    finally { setBusy(false); }
  }

  const nameField = <label className="friends-field"><span>Your name at the table</span>
    <KeyboardInput aria-label="Your name at the table" placeholder="Your name" value={name} maxLength={20} onChange={(event) => setName(event.target.value)} /></label>;

  return <section className="friends-table" aria-labelledby="friends-title">
    <button className="text-link back-link" onClick={view === 'menu' ? onBack : () => { keyboard.hide(); setView('menu'); setProblem(''); }}><CaretLeft size={15} weight="bold" />{view === 'menu' ? 'Play' : 'Play with friends'}</button>
    <FeltHeader compact id="friends-title" title="Play with friends." intro="A private table for your family and friends, anywhere. No accounts. Computers fill any empty seats. Every game counts towards your record." cards={['QH', 'KS']} />

    {view === 'menu' && <div className="friends-menu">
      {kept && <button className="resume-card" onClick={onSeated}><span className="resume-dot" aria-hidden="true" /><span><strong>Back to your table</strong><small>Code {kept.code} · sitting as {kept.name}</small></span><ArrowRight size={17} /></button>}
      <button className="friends-choice" onClick={() => setView('create')}><UsersThree size={22} weight="fill" /><span><strong>Start a table</strong><small>Pick the size, then share the code with your guests.</small></span><ArrowRight size={16} /></button>
      <button className="friends-choice" onClick={() => setView('join')}><ArrowRight size={22} weight="bold" /><span><strong>Join with a code</strong><small>Someone sent you a six-letter code or a link.</small></span><ArrowRight size={16} /></button>
      <p className="lobby-note">Tables last a day. Nobody can see your cards but you, and the only chat is a set of friendly reactions.</p>
    </div>}

    {view === 'create' && <div className="friends-form">
      {nameField}
      <div className="lobby-group" role="group" aria-label="Way to play">
        <h2>What are we playing?</h2>
        <div className="mode-grid">{ONLINE_MODES.map((entry) => <button key={entry.id} aria-label={entry.name} aria-describedby={`online-mode-blurb-${entry.id}`} aria-pressed={mode === entry.id} className={mode === entry.id ? 'active' : ''} onClick={() => pickMode(entry.id)}><MiniFan codes={ONLINE_MODE_CARDS[entry.id]} /><span className="mode-text"><b>{entry.name}</b><small id={`online-mode-blurb-${entry.id}`}>{entry.blurb}</small></span></button>)}</div>
        <div className="mode-detail" data-testid="online-mode-detail" aria-live="polite">
          <h3>How {modeInfo(mode).name} plays</h3>
          <p className="mode-short" data-testid="online-mode-note">{onlineModeBlurb(mode, { mode, matchType, games, roundsToWin })}</p>
          {modeInfo(mode).how.map((line, index) => <p key={index}>{line}</p>)}
          <p className="mode-scoring"><strong>Scoring.</strong> {modeInfo(mode).scoring}</p>
        </div>
      </div>
      {mode === 'match' && <div className="lobby-group" role="group" aria-label="How many games">
        <h2>How many games?</h2>
        <div className="seg two compact">{([['first', 'First to'], ['best', 'Best of']] as const).map(([id, label]) => <button key={id} aria-pressed={matchType === id} className={matchType === id ? 'active' : ''} onClick={() => pickMatchType(id)}><b>{label}</b></button>)}</div>
        <div className="seg five compact">{(matchType === 'best' ? MATCH_BEST_OF : MATCH_FIRST_TO).map((count) => <button key={count} aria-pressed={games === count} className={games === count ? 'active' : ''} onClick={() => setGames(count)} aria-label={`${matchType === 'best' ? 'Best of' : 'First to'} ${count}`}><b>{count}</b></button>)}</div>
        <p className="lobby-note" data-testid="match-note">{matchLabel(matchType, games)}.{games === 1 ? ' One game of Switch: first out wins.' : matchType === 'best' ? ' Most wins takes it, and it stops as soon as nobody can catch the leader.' : ' Every game is ordinary Switch.'}</p>
      </div>}
      {mode === 'lastout' && <div className="lobby-group" role="group" aria-label="Rounds to win">
        <h2>How many rounds?</h2>
        <div className="seg five compact">{ROUND_CHOICES.map((count) => <button key={count} aria-pressed={roundsToWin === count} className={roundsToWin === count ? 'active' : ''} onClick={() => setRoundsToWin(count)} aria-label={count === 1 ? 'One-off game' : `First to ${count} round wins`}><b>{count === 1 ? 'One-off' : `First to ${count}`}</b></button>)}</div>
        <p className="lobby-note" data-testid="rounds-note">{roundsNote(roundsToWin)}</p>
      </div>}
      {mode === 'darts' && <div className="lobby-group" role="group" aria-label="Sets to win">
        <h2>Sets to win the match</h2>
        <div className="seg three compact">{([3, 5] as const).map((sets) => <button key={sets} aria-pressed={setsToWin === sets} className={setsToWin === sets ? 'active' : ''} onClick={() => setSetsToWin(sets)}><b>First to {sets}</b></button>)}</div>
      </div>}
      {mode === 'dominoes' && <div className="lobby-group" role="group" aria-label="Losing number">
        <h2>Pick your number</h2>
        <div className="seg four compact">{[50, 100, 150, 200].map((value) => <button key={value} aria-pressed={limit === value} className={limit === value ? 'active' : ''} onClick={() => setLimit(value)}><b>{value}</b></button>)}</div>
        <p className="lobby-note">Cards left in hand add up after every game, ace 1 to king 13. The first to {limit} loses.</p>
      </div>}
      <div className="lobby-group" role="group" aria-label="Seats at the table">
        <h2>How many seats?</h2>
        <div className="seg five">{[2, 3, 4, 5, 6].map((count) => <button key={count} aria-pressed={seats === count} className={seats === count ? 'active' : ''} disabled={count < fewest} onClick={() => setSeats(count)} aria-label={`${count} seats`}><b>{count}</b></button>)}</div>
        {most > 6 && <><p className="seat-row-label">Bigger nights</p><div className={`seg compact ${BIG_NIGHTS.filter((count) => count <= most).length === 5 ? 'five' : 'trio'}`}>{BIG_NIGHTS.filter((count) => count <= most).map((count) => <button key={count} aria-pressed={seats === count} className={seats === count ? 'active' : ''} onClick={() => setSeats(count)} aria-label={`${count} seats`}><b>{count}</b></button>)}</div></>}
        <p className="lobby-note">{fewest > 2 ? `${modeInfo(mode).name} needs at least ${fewest} seats. ` : ''}{most > 6 ? `Up to ${most}: the games are played at the same time, on tables of up to 6. ` : 'Up to 6, everyone in one game. '}Your guests take seats as they join. Any seat still empty when you start is played by a computer.</p>
      </div>
      <div className="lobby-group" role="group" aria-label="Computers at the table">
        <h2>Which computers fill empty seats?</h2>
        {maxPicks === 0 ? <p className="lobby-note">With two seats there is no room for a computer.</p> : <>
          <p className="lobby-note" data-testid="online-picker-note">{picked.length === 0 ? 'Surprise me: any seat still empty when you start is given to a computer drawn at random.' : `${picked.join(', ')} picked (up to ${maxPicks}). Any other empty seat is drawn at random.`}</p>
          <div className="pick-actions"><button aria-pressed={picked.length === 0} className={picked.length === 0 ? 'active' : ''} onClick={() => setPicks([])}><Shuffle size={16} weight="bold" />Pick at random</button></div>
          <ul className="personalities pickable">{PERSONALITIES.map((personality) => {
            const on = picked.includes(personality.name);
            const full = !on && picked.length >= maxPicks;
            return <li key={personality.id}><button aria-pressed={on} disabled={full} className={on ? 'active' : ''} aria-label={`${on ? 'Remove' : 'Pick'} ${personality.name}`} onClick={() => setPicks(on ? picked.filter((name) => name !== personality.name) : [...picked, personality.name])}>
              <span className="personality-top"><strong>{personality.name}</strong><em>{personality.title}</em>{on && <Check size={16} weight="bold" className="picked-tick" />}</span>
              <span>{personality.blurb}</span>
            </button></li>;
          })}</ul>
        </>}
      </div>
      <div className="lobby-group" role="group" aria-label="Computer level">
        <h2>How good are the computers?</h2>
        <div className="seg three">{LEVELS.map((id) => <button key={id} aria-pressed={level === id} className={level === id ? 'active' : ''} onClick={() => setLevel(id)}><b>{LEVEL_NAMES[id]}</b></button>)}</div>
      </div>
      {problem && <p className="lobby-note center" role="alert">{problem}</p>}
      <button className="primary deal-button" disabled={!cleanName || busy} onClick={create}>{busy ? 'Setting up…' : 'Set up the table'}<ArrowRight size={18} /></button>
    </div>}

    {view === 'join' && <div className="friends-form">
      <label className="friends-field"><span>Table code</span>
        <KeyboardInput aria-label="Table code" className="code-input" placeholder="ABC234" value={code} autoCapitalize="characters" autoCorrect="off" spellCheck={false} onChange={(event) => { setProblem(''); const read = readCode(event.target.value); if (read.kind === 'club' && onOpenCode) { onOpenCode('club', read.code); return; } setCode(read.code.slice(0, 6)); }} /></label>
      {found && <p className="friends-found" role="status"><strong>{found.seats.filter((seat) => seat.kind === 'human').map((seat) => seat.name).join(', ')}</strong> {found.seats.filter((seat) => seat.kind === 'human').length === 1 ? 'is' : 'are'} at this table. {found.open ? `${found.capacity - found.seats.length} ${found.capacity - found.seats.length === 1 ? 'seat is' : 'seats are'} free.` : ''}</p>}
      {nameField}
      {problem && <p className="lobby-note center" role="alert">{problem}</p>}
      <button className="primary deal-button" disabled={!cleanName || code.length !== 6 || busy || (found !== null && !found.open)} onClick={join}>{busy ? 'Joining…' : 'Take a seat'}<ArrowRight size={18} /></button>
      {kept && <button className="text-link" onClick={() => { clearSeat(); setProblem(''); }}>Forget my old table ({kept.code})</button>}
    </div>}
  </section>;
}
