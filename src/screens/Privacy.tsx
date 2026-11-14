import { useState } from 'react';
import { deleteCloudCopy, loadAccount, saveAccount } from '../auth';
import { CONTACT_EMAIL, eraseDeviceData, exportDeviceData, switchKeys } from '../switch/privacy';
import { setStatsOptedOut, statsOptedOut, trackFeature } from '../switch/telemetry';

type Confirm = null | 'device' | 'cloud';

export default function Privacy(_props: { onBack: () => void }) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState('');
  const [signedIn, setSignedIn] = useState(() => loadAccount() !== null);
  const [counting, setCounting] = useState(() => !statsOptedOut());
  const items = switchKeys().length;

  function download() {
    const url = URL.createObjectURL(new Blob([exportDeviceData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'my-switch-data.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    trackFeature('export_data');
    setNote('Your data has been saved as my-switch-data.json.');
  }
  function eraseDevice() {
    const count = eraseDeviceData();
    setConfirm(null);
    setNote(`Deleted ${count} stored ${count === 1 ? 'item' : 'items'} from this device. Reloading…`);
    setTimeout(() => window.location.assign('/'), 900);
  }
  async function eraseCloud() {
    setConfirm(null);
    try { await deleteCloudCopy(); saveAccount(null); setSignedIn(false); setNote('Your cloud copy is deleted and you are signed out. Your club is still on this phone.'); }
    catch (reason) { setNote(reason instanceof Error ? reason.message : 'The cloud copy could not be deleted. Please try again.'); }
  }

  return <section className="privacy-page" aria-labelledby="privacy-title">
    
    <h1 id="privacy-title">Your club is<br />yours.</h1>
    <p className="intro">Switch has no ads, no tracking cookies and no profiles of you. It keeps your club on your phone, and adds up how the app is used in anonymous totals (you can turn that off below). Here is exactly what happens to your data.</p>

    <div className="privacy-controls">
      <h2>Your controls</h2>
      <button className="secondary" onClick={download}>Download my data</button>
      <button className="secondary" onClick={() => setConfirm('device')}>Delete data on this device</button>
      {signedIn && <button className="secondary" onClick={() => setConfirm('cloud')}>Delete my cloud copy</button>}
      {confirm && <div className="privacy-confirm" role="alertdialog" aria-label="Confirm deletion">
        <p><strong>{confirm === 'device' ? 'Delete everything Switch stores on this phone?' : 'Delete your cloud backup and sign out?'}</strong> {confirm === 'device' ? `That is ${items} stored ${items === 1 ? 'item' : 'items'}: players, scores, history and settings. This cannot be undone.` : 'Your club on this phone is kept. This cannot be undone.'}</p>
        <button className="primary" onClick={() => (confirm === 'device' ? eraseDevice() : void eraseCloud())}>Yes, delete</button>
        <button className="text-link" onClick={() => setConfirm(null)}>Keep it</button>
      </div>}
      <label className="feedback-check"><input type="checkbox" checked={counting} onChange={(event) => { setStatsOptedOut(!event.target.checked); setCounting(event.target.checked); }} /> Include this phone in anonymous usage counts</label>
      {note && <p role="status" className="share-note">{note}</p>}
    </div>

    <div className="privacy-copy">
      <h2>What stays on your phone</h2>
      <p>Player names, scores, night history, puzzle progress and settings are saved in this device's app storage. Playing, learning and keeping score work offline and send nothing anywhere. Only the optional features below, and the anonymous counts, ever send anything.</p>
      <h2>If you sign in with Google</h2>
      <p>Signing in is optional and needs your tick of consent. Google tells us your name, email address and profile picture. Those are held in the secure sign-in cookie, and a private backup of your club is stored against your Google account ID so it can follow you to another phone. We use it only for that. A short-lived secure cookie keeps you signed in; it is essential to the feature and holds no tracking. Google may see that you used its sign-in button. Sign out or delete the cloud copy at any time.</p>
      <h2>Shared nights</h2>
      <p>If you share a night, its title, player first names and scores (and, once you save it, the full result with any venue and country you entered) are stored under a six-letter code so friends can watch. A friend who opens it says which player they are, so the host can see who joined. The night can no longer be opened after two weeks, and we remove the stored copy when you ask. Share first names only.</p>
      <h2>Shared clubs</h2>
      <p>If you share a club, its name, players, saved nights with their scores, and seasons are stored under an eight-character code so every phone that joins sees the same club. Anyone who has the code can read the club and add to it. It is kept until you ask us to delete it. Leaving a club only stops that phone syncing; it does not delete the shared copy. Games against the computer are never shared.</p>
      <h2>Deleting shared copies</h2>
      <p>The buttons above delete what is on this phone and your Google backup. To have a shared night or club removed, email <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Delete my Switch data')}`}>{CONTACT_EMAIL}</a> with its code, or see <a href="/delete-data.html" target="_blank" rel="noreferrer">how to ask us to delete your data</a>.</p>
      <h2>Anonymous usage counts</h2>
      <p>Switch adds up how the app is used as plain totals: visits, new phones, games played and how they ended, penalty cards dealt, and which screens are opened. Nothing in them says who you are: no name, score, club, device ID, cookie or IP address is saved with a count, and your phone only remembers that it has been counted today. Tick or untick the box above to take part or not. If your browser sends Do Not Track or Global Privacy Control, nothing is sent at all. Our hosting provider (Vercel) briefly keeps standard server logs, which include IP addresses, for security.</p>
      <h2>Feedback emails</h2>
      <p>The feedback buttons open your own email app. We only receive what you choose to send, and use it to reply and improve Switch. Ask and we will delete it.</p>
      <h2>Who is responsible</h2>
      <p>M. White is the data controller. Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Under UK GDPR you can ask to see, correct, export, restrict or erase your data, object to its use, or withdraw consent, and the buttons above do most of that instantly. You can also complain to the Information Commissioner's Office at ico.org.uk. Data may be processed by Vercel and Google, including in the USA, under their standard safeguards.</p>
      <h2>Children</h2>
      <p>Switch is a family card game and works without an account. Please do not sign in if you are under 13 without a parent or guardian.</p>
    </div>
  </section>;
}
