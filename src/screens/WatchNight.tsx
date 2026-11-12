import { CaretLeft } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { fetchShare, type NightSnapshot } from '../switch/shareNight';

/** Friend side: enter a code (or open a link) and watch the scoreboard refresh. */
export default function WatchNight({ initialCode, onBack }: { initialCode: string; onBack: () => void }) {
  const keyboard = useKeyboard();
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [snapshot, setSnapshot] = useState<NightSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const load = () => fetchShare(code).then((result) => { if (alive) { setSnapshot(result.snapshot); setUpdatedAt(result.updatedAt); setError(''); } }).catch((reason) => { if (alive) { setError(reason instanceof Error ? reason.message : 'Could not load that night.'); } });
    load();
    const timer = window.setInterval(load, 8000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [code]);

  function join() { keyboard.hide(); setSnapshot(null); setError(''); setCode(input.trim().toUpperCase()); }

  return <section className="watch-night" aria-labelledby="watch-title">
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Home</button>
    
    <h1 id="watch-title">{snapshot ? snapshot.title : 'Join a night'}</h1>
    {!snapshot && <form className="join-form" onSubmit={(event) => { event.preventDefault(); join(); }}>
      <label><span>Night code</span><KeyboardInput aria-label="Night code" autoCapitalize="characters" maxLength={6} placeholder="e.g. K7M2QX" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} /></label>
      <button className="primary" type="submit" disabled={input.trim().length < 6}>Watch</button>
    </form>}
    {error && <p className="score-error" role="alert">{error}</p>}
    {snapshot && <>
      <p className="watch-status" role="status">{snapshot.status}</p>
      <ol className="watch-lines" aria-label="Scoreboard">{snapshot.lines.map((line, index) => <li key={index} className={line.lead ? 'lead' : ''}><span>{line.label}</span><strong>{line.value}</strong></li>)}</ol>
      <p className="dash-note">Updates every few seconds · last change {new Date(updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. This is a read-only view.</p>
      <button className="text-link" onClick={() => { setSnapshot(null); setCode(''); setInput(''); }}>Join a different night</button>
    </>}
  </section>;
}
