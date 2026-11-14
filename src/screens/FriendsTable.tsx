import { useEffect, useState } from 'react';
import { ArrowRight, CaretLeft, UsersThree } from '@phosphor-icons/react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { LEVEL_NAMES, type ComputerLevel } from '../switch/ai';
import { cleanTableCode, clearSeat, createTable, joinTable, loadSeat, lookupTable, saveSeat, type RoomSummary } from '../switch/onlineRoom';
import { readClub } from '../switch/clubStore';
import { getMeId } from '../switch/computerLog';
import { getProfiles } from '../switch/profiles';
import { FeltHeader } from '../ui';

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
};

/** PLAY WITH FRIENDS: start a private table or join one with a code. Computers fill any empty seats. */
export default function FriendsTable({ initialCode = '', onBack, onSeated }: Props) {
  const keyboard = useKeyboard();
  const [view, setView] = useState<'menu' | 'create' | 'join'>(initialCode ? 'join' : 'menu');
  const [name, setName] = useState(rememberedName);
  const [seats, setSeats] = useState(4);
  const [level, setLevel] = useState<ComputerLevel>('standard');
  const [code, setCode] = useState(cleanTableCode(initialCode));
  const [found, setFound] = useState<RoomSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const kept = loadSeat();

  // As soon as a full code is in, look the table up so the person can see who is already there.
  useEffect(() => {
    setFound(null);
    if (view !== 'join' || code.length !== 6) return;
    let alive = true;
    lookupTable(code).then((summary) => { if (alive) { setFound(summary); setProblem(summary.open ? '' : summary.status === 'lobby' ? 'That table is full.' : 'That game has already started.'); } })
      .catch((reason: Error) => { if (alive) setProblem(reason.message); });
    return () => { alive = false; };
  }, [view, code]);

  const cleanName = name.trim().slice(0, 20);
  const remember = () => { try { window.localStorage.setItem(NAME_KEY, cleanName); } catch { /* the name lasts for this visit */ } };

  async function create() {
    if (!cleanName || busy) return;
    keyboard.hide(); setBusy(true); setProblem(''); remember();
    try {
      const made = await createTable(cleanName, seats, level);
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
      <div className="lobby-group" role="group" aria-label="Seats at the table">
        <h2>How many seats?</h2>
        <div className="seg seven">{[2, 3, 4, 5, 6, 7, 8].map((count) => <button key={count} aria-pressed={seats === count} className={seats === count ? 'active' : ''} onClick={() => setSeats(count)} aria-label={`${count} seats`}><b>{count}</b></button>)}</div>
        <p className="lobby-note">Your guests take seats as they join. Any seat still empty when you start is played by a computer.{seats >= 7 ? ' Seven or eight players use two decks.' : ''}</p>
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
        <KeyboardInput aria-label="Table code" className="code-input" placeholder="ABC234" value={code} autoCapitalize="characters" autoCorrect="off" spellCheck={false} onChange={(event) => { setProblem(''); setCode(cleanTableCode(event.target.value)); }} /></label>
      {found && <p className="friends-found" role="status"><strong>{found.seats.filter((seat) => seat.kind === 'human').map((seat) => seat.name).join(', ')}</strong> {found.seats.filter((seat) => seat.kind === 'human').length === 1 ? 'is' : 'are'} at this table. {found.open ? `${found.capacity - found.seats.length} ${found.capacity - found.seats.length === 1 ? 'seat is' : 'seats are'} free.` : ''}</p>}
      {nameField}
      {problem && <p className="lobby-note center" role="alert">{problem}</p>}
      <button className="primary deal-button" disabled={!cleanName || code.length !== 6 || busy || (found !== null && !found.open)} onClick={join}>{busy ? 'Joining…' : 'Take a seat'}<ArrowRight size={18} /></button>
      {kept && <button className="text-link" onClick={() => { clearSeat(); setProblem(''); }}>Forget my old table ({kept.code})</button>}
    </div>}
  </section>;
}
