import { useEffect, useRef, useState } from 'react';
import { CloudCheck } from '@phosphor-icons/react';
import { loadAccount, saveAccount, SIGN_IN_AVAILABLE, signOut, startOneTap, syncNow, tokenExpired, type Account, type SyncOutcome } from './auth';

const MESSAGES: Record<SyncOutcome, string> = {
  uploaded: 'Your club is backed up to the cloud.',
  downloaded: 'Your club was restored from the cloud.',
  merged: 'Your club was combined with the cloud copy on this account.',
  'up-to-date': 'Everything is already in sync.',
};

/** Google one-tap sign-in plus cloud backup. Renders nothing until a Google client ID is configured. */
export function AccountPanel() {
  const [account, setAccount] = useState<Account | null>(() => {
    const saved = loadAccount();
    return saved && !tokenExpired(saved) ? saved : null;
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  async function sync(current: Account) {
    setBusy(true);
    setMessage('');
    try {
      const outcome = await syncNow(current);
      saveAccount({ ...current, lastSyncedAt: new Date().toISOString() });
      setMessage(MESSAGES[outcome]);
      // The screens read from storage when they open, so refresh after the data changed.
      if (outcome === 'downloaded' || outcome === 'merged') setTimeout(() => window.location.reload(), 900);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Syncing did not work. Your data on this phone is safe.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!SIGN_IN_AVAILABLE || account) return;
    startOneTap((signedIn) => { saveAccount(signedIn); setAccount(signedIn); void sync(signedIn); }, { prompt: true, button: buttonRef.current })
      .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'Google sign-in is not available right now.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  if (!SIGN_IN_AVAILABLE) return null;

  return <div className="account-panel">
    <h3><CloudCheck size={18} weight="fill" /> Cloud backup</h3>
    {account
      ? <>
        <p className="account-who">{account.picture && <img src={account.picture} alt="" referrerPolicy="no-referrer" />}<span><strong>{account.name}</strong><small>{account.email}</small></span></p>
        <button className="secondary" disabled={busy} onClick={() => void sync(account)}>{busy ? 'Syncing…' : 'Sync now'}</button>
        <button className="text-link" onClick={() => { void signOut(); setAccount(null); setMessage('Signed out. Your club stays on this phone.'); }}>Sign out</button>
      </>
      : <>
        <p>Sign in with Google to back up your club and open it on any phone. Switch still works without it.</p>
        <div ref={buttonRef} className="google-button" />
      </>}
    {message && <p role="status" className="share-note">{message}</p>}
  </div>;
}
