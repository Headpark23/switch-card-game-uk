import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { AccountPanel } from '../AccountPanel';
import { SIGN_IN_AVAILABLE } from '../auth';
import { ShareButton } from '../ShareButton';
import { getClubName, nightShareCard } from '../switch/club';
import { deleteNight, exportHistory, getHistory } from '../switch/history';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY } from '../switch/storage';

type Extensions = Record<string, unknown>;
type Props = { extensions: Extensions; onChange: (next: Extensions) => void };

export default function NightHistory({ extensions, onChange }: Props) {
  const nights = getHistory(extensions);
  const [backupMessage, setBackupMessage] = useState('');

  function removeNight(id: string, title: string) {
    if (!window.confirm(`Delete “${title}” from this device? This cannot be undone.`)) return;
    onChange(deleteNight(extensions, id));
  }

  function downloadHistory() {
    const url = URL.createObjectURL(new Blob([exportHistory(nights)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'switch-night-history.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadBackup() {
    const raw = window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY) ?? JSON.stringify({ schemaVersion: 1, extensions });
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `switch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage('Backup saved. Keep it somewhere safe, such as your email or cloud drive.');
  }

  async function restoreBackup(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
      if (parsed === null || typeof parsed !== 'object' || parsed.schemaVersion !== 1) throw new Error('not a Switch backup');
      const loaded = loadScorekeeper(raw);
      if (loaded.status !== 'loaded') throw new Error('unreadable');
      if (!window.confirm('Replace everything on this device with this backup? Your current players, nights and leagues will be overwritten.')) return;
      window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY, saveScorekeeper(null, loaded.state));
      window.location.reload();
    } catch {
      setBackupMessage('That file is not a Switch backup, so nothing was changed.');
    }
  }

  return <section className="night-history" aria-labelledby="night-history-title">
    <div className="history-heading">
      <div><p className="eyebrow">ON THIS DEVICE</p><h2 id="night-history-title">Switch Night history</h2></div>
      {nights.length > 0 && <button className="secondary" onClick={downloadHistory}><DownloadSimple size={16} />Export history</button>}
    </div>
    {nights.length === 0
      ? <p className="history-empty">No completed nights saved yet. Finish a score session and save it to build your real game-night story.</p>
      : <div className="history-list">{nights.map((night) => <details className="history-card" key={night.id}>
        <summary><span><strong>{night.title}</strong><small>{night.formatLabel} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(night.completedAt))}</small></span><b>{night.outcome}</b></summary>
        <div className="history-detail">
          <p>{night.players.map((player) => player.name).join(' · ')}</p>
          {night.details.map((section) => <section key={section.heading}><h3>{section.heading}</h3>{section.lines.map((line, index) => <p key={`${section.heading}-${index}`}>{line}</p>)}</section>)}
          <ShareButton label="Share this night" build={() => nightShareCard(night, getClubName(extensions))} />
          <button className="text-link history-delete" aria-label={`Delete ${night.title}`} onClick={() => removeNight(night.id, night.title)}>Delete this night</button>
        </div>
      </details>)}</div>}
    <AccountPanel />
    <div className="backup-panel">
      <h3>Back up your club</h3>
      <p>{SIGN_IN_AVAILABLE
        ? 'Your club is saved on this device. Signing in with Google also backs it up to the cloud. A backup file gives you another copy of your players, nights and leagues.'
        : 'Your club is saved only on this device. Download a backup file to keep your players, nights and leagues safe if you change phone or clear your browser.'}</p>
      <button className="secondary" onClick={downloadBackup}><DownloadSimple size={16} />Back up everything</button>
      <label className="restore"><span>Restore from a backup file</span><input type="file" accept="application/json,.json" aria-label="Restore backup file" onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {backupMessage && <p role="status">{backupMessage}</p>}
    </div>
  </section>;
}
