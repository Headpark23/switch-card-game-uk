import { CaretLeft, CheckCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { fetchShare, reportJoined, type JoinedPlayer, type NightSnapshot } from '../switch/shareNight';
import { collectResults, forgetJoin, loadJoined, myNames, rememberJoin, rememberWho } from '../switch/joinedNights';
import { readClub } from '../switch/clubStore';
import type { SwitchNightRecord } from '../switch/history';
import { CardShower } from '../ui';

const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

/** Friend side: enter a code (or open a link), say which player you are, and watch the scoreboard refresh. Saved results land in your own history. */
export default function WatchNight({ initialCode, initialAs = '', onBack }: { initialCode: string; initialAs?: string; onBack: () => void }) {
  const keyboard = useKeyboard();
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [snapshot, setSnapshot] = useState<NightSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [error, setError] = useState('');
  // undefined: not answered yet. null: only watching. A name: that player on the host's scoreboard.
  const [as, setAs] = useState<string | null | undefined>(() => loadJoined().find((item) => item.code === initialCode.trim().toUpperCase())?.as);
  const [results, setResults] = useState<SwitchNightRecord[]>([]);
  const [joined, setJoined] = useState<JoinedPlayer[] | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const choose = (name: string | null) => { rememberJoin(code, name); if (name) rememberWho(name); setAs(name); };

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const load = () => fetchShare(code).then((result) => { if (alive) { setSnapshot(result.snapshot); setResults(result.results); setJoined(result.joined); setUpdatedAt(result.updatedAt); setError(''); } }).catch((reason) => { if (alive) { setError(reason instanceof Error ? reason.message : 'Could not load that night.'); } });
    load();
    const timer = window.setInterval(load, 8000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [code]);

  // A link sent "to Martin" names the player, so opening it joins as that player with nothing to answer.
  useEffect(() => {
    if (!snapshot || as !== undefined || !initialAs) return;
    const match = (snapshot.players ?? []).find((name) => same(name, initialAs));
    if (match) { rememberJoin(code, match); rememberWho(match); setAs(match); }
  }, [snapshot, as, code, initialAs]);

  // Tell the host this player has arrived, and keep telling until the host's screen has it (a dropped signal must not hide it).
  useEffect(() => {
    if (!as || !snapshot || joined === null || joined.some((entry) => same(entry.name, as))) return;
    reportJoined(code, as).catch(() => { /* offline: sent again with the next refresh */ });
  }, [as, snapshot, joined, code]);

  // If this phone's owner is already on the scoreboard by name (or by a name they have used before), there is nothing to ask.
  useEffect(() => {
    if (!snapshot || as !== undefined) return;
    if (initialAs && (snapshot.players ?? []).some((name) => same(name, initialAs))) return; // the link already says who they are
    const mine = myNames(readClub());
    const match = (snapshot.players ?? []).find((name) => mine.some((known) => same(name, known)));
    if (match) { rememberJoin(code, match); setAs(match); }
  }, [snapshot, as, code, initialAs]);

  // Every result the host has saved goes straight into this phone's history.
  useEffect(() => {
    if (!as || !results.length) return;
    const added = collectResults(as, results);
    if (added.length) setJustSaved(added[added.length - 1].id);
  }, [as, results]);

  function join() { keyboard.hide(); const next = input.trim().toUpperCase(); if (next.length === 8) { window.location.assign(`/?club=${next}`); return; } setSnapshot(null); setResults([]); setJoined(null); setError(''); setAs(loadJoined().find((item) => item.code === next)?.as); setCode(next); }
  // Nights shared by an older version of the app carry no player list, so fall back to the scoreboard names.
  const players = snapshot?.players?.length ? snapshot.players : (snapshot?.lines ?? []).map((line) => line.label.replace(/^\d+\.\s*/, ''));
  const latest = results[0];
  const iWon = !!(latest && as && latest.players.some((player) => same(player.name, as) && latest.winnerIds.includes(player.id)));

  return <section className="watch-night" aria-labelledby="watch-title">
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Home</button>
    
    <h1 id="watch-title">{snapshot ? snapshot.title : 'Join a night'}</h1>
    {!snapshot && <form className="join-form" onSubmit={(event) => { event.preventDefault(); join(); }}>
      <label><span>Night code</span><KeyboardInput aria-label="Night code" autoCapitalize="characters" maxLength={8} placeholder="Night code or club code" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} /></label>
      <button className="primary" type="submit" disabled={input.trim().length < 6 || input.trim().length === 7}>{input.trim().length === 8 ? 'Join club' : 'Watch'}</button>
    </form>}
    {error && <p className="score-error" role="alert">{error}</p>}
    {snapshot && <>
      <CardShower trigger={justSaved && iWon ? justSaved : null} />
      {as === undefined && <div className="watch-who" role="group" aria-label="Which player are you?">
        <strong>Which one are you?</strong>
        <span>Pick your name and every result from this night is saved to your own history and stats.</span>
        <div className="player-tokens">{players.map((name) => <button key={name} onClick={() => choose(name)}>{name}</button>)}</div>
        <button className="text-link" onClick={() => choose(null)}>I am just watching</button>
      </div>}
      {as && <p className="watch-as"><CheckCircle size={17} weight="fill" /><span>Playing as <b>{as}</b>. Results save to your history automatically.</span><button className="text-link" onClick={() => { forgetJoin(code); setAs(undefined); }}>Change</button></p>}
      {as === null && <p className="watch-as"><span>Just watching. Nothing is saved to your history.</span><button className="text-link" onClick={() => { forgetJoin(code); setAs(undefined); }}>I am playing</button></p>}
      {results.length > 0 && <ul className="watch-results" aria-label="Saved results">{results.slice(0, 5).map((night) => <li key={night.id}><strong>{night.title}: {night.outcome}</strong><span>{night.formatLabel} · {new Date(night.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{as ? ' · saved to your history' : ''}</span></li>)}</ul>}
      <p className="watch-host">{snapshot.host ? `${snapshot.host} is keeping score.` : 'The host is keeping score.'} You are watching, so only {snapshot.host ?? 'the host'} can change the scores.</p>
      <p className="watch-status" role="status">{snapshot.status}</p>
      <ol className="watch-lines" aria-label="Scoreboard">{snapshot.lines.map((line, index) => <li key={index} className={line.lead ? 'lead' : ''}><span>{line.label}</span><strong>{line.value}</strong></li>)}</ol>
      <p className="dash-note">Updates every few seconds · last change {new Date(updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</p>
      <button className="text-link" onClick={() => { setSnapshot(null); setResults([]); setJoined(null); setAs(undefined); setCode(''); setInput(''); }}>Join a different night</button>
    </>}
  </section>;
}
