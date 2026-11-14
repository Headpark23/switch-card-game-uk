import { CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { readClub } from '../switch/clubStore';
import { myNames } from '../switch/joinedNights';
import { createShare, fetchShare, loadInvites, loadKeys, pushShare, rememberInvite, saveKeys, shareLink, type JoinedPlayer, type NightSnapshot, type SentInvite, type SharedNightKeys } from '../switch/shareNight';

const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();
const clock = (time: number) => new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** Past this many people a row each gets long, so one link for everyone is shown instead. */
const MAX_NAMED = 4;

/**
 * Host side: one tap sends the game to a player. Their link joins them as that player (no question to answer),
 * and this panel shows who it was sent to and who has arrived, so nobody has to wonder.
 */
export default function ShareNight({ snapshot }: { snapshot: NightSnapshot }) {
  const [keys, setKeys] = useState<SharedNightKeys | null>(loadKeys);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [joined, setJoined] = useState<JoinedPlayer[]>([]);
  const [invites, setInvites] = useState<SentInvite[]>(() => { const saved = loadKeys(); return saved ? loadInvites(saved.code) : []; });
  const last = useRef('');
  const text = JSON.stringify(snapshot);

  const everyone = snapshot.players?.length ? snapshot.players : snapshot.lines.map((line) => line.label.replace(/^\d+\.\s*/, ''));
  const mine = myNames(readClub());
  const others = everyone.filter((name) => !mine.some((known) => same(known, name)));
  // If this phone does not know which player its owner is, offer everyone rather than guess wrongly.
  const invitees = others.length === everyone.length || others.length === 0 ? everyone : others;
  const named = invitees.length >= 1 && invitees.length <= MAX_NAMED && everyone.length >= 2 ? invitees : [];

  useEffect(() => {
    if (!keys || last.current === text) return;
    const timer = window.setTimeout(() => { last.current = text; pushShare(keys, snapshot).catch(() => setError('Could not update the shared scoreboard. It will retry on the next change.')); }, 600);
    return () => window.clearTimeout(timer);
  }, [keys, text, snapshot]);

  // Look for friends arriving while the code is live.
  useEffect(() => {
    if (!keys) return;
    let alive = true;
    const look = () => fetchShare(keys.code).then((result) => { if (alive) setJoined(result.joined); }).catch(() => { /* offline: try again next time */ });
    look();
    const timer = window.setInterval(look, 6000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [keys]);

  async function ensureKeys(): Promise<SharedNightKeys> {
    if (keys) return keys;
    const made = await createShare(snapshot);
    last.current = text; saveKeys(made); setKeys(made);
    return made;
  }

  /** One tap: makes the code if there is none, then opens the phone's share sheet (WhatsApp, Messages and so on). */
  async function send(name?: string) {
    setBusy(name ?? 'everyone'); setError(''); setNote('');
    let live: SharedNightKeys;
    try { live = await ensureKeys(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sharing is unavailable right now.'); setBusy(null); return; }
    const host = mine[0];
    const link = shareLink(live.code, name);
    const message = `${host ? `${host} has` : 'I’ve'} started a Switch game${name ? ' with you' : ''}. Tap to ${name ? 'join' : 'follow the scores'}:\n${link}\nCode: ${live.code}`;
    const record = () => { if (name) { rememberInvite(live.code, name); setInvites(loadInvites(live.code)); } };
    try {
      if (navigator.share) { await navigator.share({ title: 'Switch game', text: message }); record(); }
      else { await navigator.clipboard.writeText(message); record(); setNote('Link copied. Paste it into WhatsApp or a message.'); }
    } catch (reason) {
      // Closing the share sheet is not a problem. A phone that wants a fresh tap just needs the button pressed again.
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setNote(name ? `Tap “Send to ${name}” again to choose where to send it.` : 'Tap Send again to choose where to send it.');
    }
    setBusy(null);
  }

  function stop() { saveKeys(null); setKeys(null); setNote(''); setJoined([]); setInvites([]); last.current = ''; }

  if (!keys) return <section className="share-night invite" aria-label="Send this game">
    <div><strong>{named.length === 1 ? `Send this game to ${named[0]}` : named.length > 1 ? 'Who is joining on their own phone?' : 'Send this game to your friends'}</strong><span>One tap. They open the link and they are in, and their scores save to their own history.</span></div>
    {named.length ? <div className="share-actions">{named.map((name) => <button key={name} className="share-send" disabled={busy !== null} onClick={() => void send(name)}><PaperPlaneTilt size={17} weight="bold" />{busy === name ? 'Getting ready…' : `Send to ${name}`}</button>)}</div>
      : <div className="share-actions"><button className="share-send" disabled={busy !== null} onClick={() => void send()}><PaperPlaneTilt size={17} weight="bold" />{busy ? 'Getting ready…' : 'Send the link'}</button></div>}
    {note && <p role="status">{note}</p>}
    {error && <p className="score-error" role="alert">{error}</p>}
  </section>;

  return <section className="share-night invite live" aria-label="Sharing live scores">
    <div><strong>Sharing live · code <b className="night-code">{keys.code}</b></strong><span>You are keeping score, and only you can change it. The scores update on their phones as you play.</span></div>
    {named.length > 0 && <ul className="share-people" aria-label="Who has been sent this game">{named.map((name) => {
      const arrived = joined.some((entry) => same(entry.name, name));
      const sent = invites.find((entry) => same(entry.name, name));
      return <li key={name}>
        <span className="share-who"><b>{name}</b>{arrived ? <em className="in"><CheckCircle size={15} weight="fill" />Joined</em> : <em>{sent ? `Sent at ${clock(sent.sentAt)} · waiting for them to open it` : 'Not sent yet'}</em>}</span>
        {!arrived && <button className="share-send" disabled={busy !== null} onClick={() => void send(name)}>{sent ? 'Send again' : `Send to ${name}`}</button>}
      </li>;
    })}</ul>}
    {(named.length === 0 || everyone.length > named.length) && <button className="share-send wide" disabled={busy !== null} onClick={() => void send()}><PaperPlaneTilt size={17} weight="bold" />Send the link{named.length ? ' to someone else' : ''}</button>}
    <p className="share-help">Message slow or lost? Read out the code. They open Switch, tap <b>Join a night</b> and type <b>{keys.code}</b>.</p>
    <button className="text-link" onClick={stop}>Stop sharing</button>
    {note && <p role="status">{note}</p>}{error && <p className="score-error" role="alert">{error}</p>}
  </section>;
}
