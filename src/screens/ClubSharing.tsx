import { useEffect, useState } from 'react';
import { ArrowsClockwise, CheckCircle, UsersThree } from '@phosphor-icons/react';
import { useConfirm } from '../Confirm';
import { KeyboardInput, useKeyboard } from '../mobile';
import { cleanClubCode, createClub, inIosBrowserTab, inviteMessage, joinClub, leaveClub, loadLink, previewClub, syncClub, takeJoinRequest, type ClubLink } from '../switch/clubSync';

const ago = (time?: number) => {
  if (!time) return 'not yet';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  return seconds < 20 ? 'just now' : seconds < 90 ? 'a minute ago' : seconds < 3600 ? `${Math.round(seconds / 60)} minutes ago` : 'over an hour ago';
};

/** Share this club with friends, or join theirs: one shared club, the same players, nights, leagues and stats on every phone. */
export default function ClubSharing() {
  const keyboard = useKeyboard();
  const iosTab = inIosBrowserTab();
  const [confirm, confirmSheet] = useConfirm();
  const [link, setLink] = useState<ClubLink | null>(loadLink);
  const urlCode = (() => { try { return cleanClubCode(new URLSearchParams(window.location.search).get('club') || ''); } catch { return ''; } })();
  const [joining, setJoining] = useState(() => (Boolean(urlCode) || takeJoinRequest()) && !loadLink());
  const [code, setCode] = useState(urlCode);
  const [found, setFound] = useState<{ name: string; players: string[]; nights: number } | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  // The link opened from a friend's message goes straight to "Which one are you?".
  useEffect(() => { if (urlCode && !loadLink()) void look(urlCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function look(value = code) {
    keyboard.hide(); setError(''); setBusy(true);
    try { setFound(await previewClub(value)); } catch (reason) { setFound(null); setError(reason instanceof Error ? reason.message : 'Could not find that club.'); }
    setBusy(false);
  }
  async function join(as: string) {
    if (!as.trim()) { setError('Pick your name, or type it if you are not on the list.'); return; }
    keyboard.hide(); setBusy(true); setError('');
    try { await joinClub(code, as); setLink(loadLink()); setJoining(false); setFound(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not join that club.'); }
    setBusy(false);
  }
  async function start() {
    keyboard.hide(); setBusy(true); setError('');
    try { await createClub(); setLink(loadLink()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not share this club.'); }
    setBusy(false);
  }
  async function now() {
    setBusy(true); setError('');
    try { const changed = await syncClub(); setLink(loadLink()); setNote(changed ? 'New players and nights arrived.' : 'Up to date.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sync right now.'); }
    setBusy(false);
  }
  async function send() {
    if (!link) return;
    const message = inviteMessage(link.code);
    try { if (navigator.share) await navigator.share({ title: 'Switch club', text: message }); else { await navigator.clipboard.writeText(message); setNote('Link copied.'); } } catch { /* cancelled */ }
  }
  async function leave() {
    if (!await confirm({ title: 'Leave this shared club?', message: 'Your phone keeps every player and night it has now, but stops sending and receiving. The club carries on for everyone else.', confirmLabel: 'Leave club', destructive: true })) return;
    leaveClub(); setLink(null); setNote('');
  }

  if (link) return <section className="club-sharing live" aria-label="Shared club">
    <div className="club-sharing-head"><CheckCircle size={22} weight="fill" /><div><strong>Shared club</strong><span>Everyone with the code sees the same players, nights, leagues and stats.</span></div></div>
    <p className="club-code" aria-label="Club code">{link.code}</p>
    {iosTab && <p className="club-ios-note" role="note"><strong>You are in a browser tab.</strong> If you play in the Switch app on your Home Screen, open it, tap Join a club on Home and enter <b>{link.code}</b>, so your scores show there too.</p>}
    <p className="club-sync-line" role="status">Last in step {ago(link.lastSyncAt)}{note ? ` · ${note}` : ''}</p>
    {error && <p className="score-error" role="alert">{error}</p>}
    <div className="manage-actions"><button className="primary" onClick={send}>Invite a friend</button><button className="secondary" disabled={busy} onClick={now}><ArrowsClockwise size={16} />Sync now</button><button className="text-link" onClick={leave}>Leave</button></div>
    {confirmSheet}
  </section>;

  if (joining) return <section className="club-sharing" aria-label="Join a club">
    <div className="club-sharing-head"><UsersThree size={22} weight="fill" /><div><strong>Join a club</strong><span>Enter the club code a friend gave you.</span></div></div>
    {iosTab && <p className="club-ios-note" role="note"><strong>Using the Switch app on your iPhone?</strong> Open the app instead, tap Join a club on Home and enter this code{code ? <> <b>{code}</b></> : ''}. A browser tab and the app keep their own scores, so join where you play.</p>}
    {!found && <form className="join-form" onSubmit={(event) => { event.preventDefault(); void look(); }}>
      <label><span>Club code</span><KeyboardInput aria-label="Club code" autoCapitalize="characters" maxLength={8} placeholder="e.g. K7M2QXH4" value={code} onChange={(event) => setCode(cleanClubCode(event.target.value))} /></label>
      <button className="primary" type="submit" disabled={busy || code.length < 8}>{busy ? 'Looking…' : 'Find club'}</button>
    </form>}
    {found && <div className="watch-who" role="group" aria-label="Which player are you?">
      <strong>{found.name ? `${found.name}: which one are you?` : 'Which one are you?'}</strong>
      <span>{found.nights} saved night{found.nights === 1 ? '' : 's'} will join your history. Pick your name so your wins and losses count as yours.</span>
      <div className="player-tokens">{found.players.map((name) => <button key={name} disabled={busy} onClick={() => join(name)}>{name}</button>)}</div>
      <label><span>Not on the list? Type your name</span><KeyboardInput aria-label="Your name" value={newName} placeholder="Your name" onChange={(event) => setNewName(event.target.value)} /></label>
      <button className="secondary" disabled={busy || !newName.trim()} onClick={() => join(newName)}>Add me and join</button>
    </div>}
    {error && <p className="score-error" role="alert">{error}</p>}
    <button className="text-link" onClick={() => { setJoining(false); setFound(null); setError(''); }}>Cancel</button>
  </section>;

  return <section className="club-sharing" aria-label="Share your club">
    <div className="club-sharing-head"><UsersThree size={22} weight="fill" /><div><strong>Play with friends? Share this club</strong><span>Friends join with a code and see the same players, nights, leagues and stats. Anyone can add a night and everyone gets it.</span></div></div>
    {error && <p className="score-error" role="alert">{error}</p>}
    <div className="manage-actions"><button className="primary" disabled={busy} onClick={start}>{busy ? 'Making a code…' : 'Share this club'}</button><button className="secondary" onClick={() => { setJoining(true); setError(''); }}>Join a club</button></div>
  </section>;
}
