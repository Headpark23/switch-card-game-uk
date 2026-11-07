import { useEffect, useRef, useState } from 'react';
import { createShare, loadKeys, pushShare, saveKeys, shareLink, type NightSnapshot, type SharedNightKeys } from '../switch/shareNight';

/** Host side: publish the scoreboard under a short code and keep it up to date while the night is scored. */
export default function ShareNight({ snapshot }: { snapshot: NightSnapshot }) {
  const [keys, setKeys] = useState<SharedNightKeys | null>(loadKeys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const last = useRef('');
  const text = JSON.stringify(snapshot);

  useEffect(() => {
    if (!keys || last.current === text) return;
    const timer = window.setTimeout(() => { last.current = text; pushShare(keys, snapshot).catch(() => setError('Could not update the shared scoreboard. It will retry on the next change.')); }, 600);
    return () => window.clearTimeout(timer);
  }, [keys, text, snapshot]);

  async function start() {
    setBusy(true); setError('');
    try { const made = await createShare(snapshot); last.current = text; saveKeys(made); setKeys(made); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sharing is unavailable right now.'); }
    setBusy(false);
  }
  function stop() { saveKeys(null); setKeys(null); setNote(''); last.current = ''; }
  async function send() {
    if (!keys) return;
    const message = `Watch our Switch night live: ${shareLink(keys.code)} (code ${keys.code})`;
    try {
      if (navigator.share) await navigator.share({ title: 'Switch night', text: message });
      else { await navigator.clipboard.writeText(message); setNote('Link copied.'); }
    } catch { /* cancelled */ }
  }

  if (!keys) return <section className="share-night" aria-label="Share live scores">
    <div><strong>Let friends watch the scores</strong><span>Get a short code. They open it on their own phone and see the scores update.</span></div>
    <button disabled={busy} onClick={start}>{busy ? 'Making a code…' : 'Share live scores'}</button>
    {error && <p className="score-error" role="alert">{error}</p>}
  </section>;
  return <section className="share-night live" aria-label="Sharing live scores">
    <div><strong>Sharing live · code <b className="night-code">{keys.code}</b></strong><span>Friends can open {window.location.host} and tap “Join a night”, or use the link.</span></div>
    <button onClick={send}>Send the link</button>
    <button className="text-link" onClick={stop}>Stop sharing</button>
    {note && <p role="status">{note}</p>}{error && <p className="score-error" role="alert">{error}</p>}
  </section>;
}
