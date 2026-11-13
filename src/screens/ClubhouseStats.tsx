import SampleDataBar from './SampleDataBar';
import ClubSharing from './ClubSharing';
import { useState } from 'react';
import { useConfirm } from '../Confirm';
import { Crown, Fire } from '@phosphor-icons/react';
import { ShareButton } from '../ShareButton';
import { buildLeaderboard, getClubName, leaderboardShareCard, putClubName } from '../switch/club';
import { KeyboardInput, useKeyboard } from '../mobile';
import { deriveClubhouseSummary, derivePlayerStats, deriveRivalries, type MilestoneId } from '../switch/analytics';
import { getHistory } from '../switch/history';
import { deriveDashboard } from '../switch/dashboard';
import { archiveProfile, getProfiles, renameProfile } from '../switch/profiles';

type Extensions = Record<string, unknown>;
type Props = { extensions: Extensions; onChange: (next: Extensions) => void };

const MILESTONES: Record<MilestoneId, { label: string; hint: string }> = {
  'first-night': { label: 'First night', hint: 'Played a saved night' },
  'first-win': { label: 'First win', hint: 'Won a saved night' },
  'five-nights': { label: 'Five nights', hint: 'Played five saved nights' },
  'three-win-streak': { label: 'Three-win streak', hint: 'Won three nights in a row' },
  'three-formats': { label: 'Three formats', hint: 'Played three different formats' },
  'cup-champion': { label: 'Cup champion', hint: 'Won a Switch Cup' },
};

const FORMAT_NAMES: Record<string, string> = {
  'head-to-head': 'One v One', domino: 'Domino', darts: 'Darts', league: 'Group Play', knockout: 'Knock Out', cup: 'Switch Cup',
};

function WinDial({ rate }: { rate: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return <svg className="win-dial" viewBox="0 0 128 128" aria-hidden="true">
    <circle cx="64" cy="64" r={radius} className="dial-track" />
    <circle cx="64" cy="64" r={radius} className="dial-value" strokeDasharray={`${circumference * rate} ${circumference}`} transform="rotate(-90 64 64)" />
  </svg>;
}

export default function ClubhouseStats({ extensions, onChange }: Props) {
  const keyboard = useKeyboard();
  const [confirm, confirmSheet] = useConfirm();
  const allProfiles = getProfiles(extensions);
  const profiles = allProfiles.filter((profile) => !profile.archived);
  const nights = getHistory(extensions);
  const [chosen, setChosen] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [error, setError] = useState('');
  const [clubDraft, setClubDraft] = useState('');

  if (!profiles.length || !nights.length) {
    return <section className="club-panel" aria-labelledby="stats-title">
      <ClubSharing />
<h2 id="stats-title">Stats appear after your first saved night.</h2>
      <p className="history-empty">Start a score session with your regular players, finish it and save the night. Every number here comes from real saved results, never made-up ones.</p>
      <SampleDataBar offer extensions={extensions} onChange={onChange} />
    </section>;
  }

  const withStats = profiles.map((profile) => ({ profile, stats: derivePlayerStats(profile, nights, allProfiles) }));
  const defaultId = [...withStats].sort((a, b) => b.stats.appearances - a.stats.appearances)[0].profile.id;
  const selected = withStats.find((entry) => entry.profile.id === chosen) ?? withStats.find((entry) => entry.profile.id === defaultId) ?? withStats[0];
  const { profile, stats } = selected;
  const summary = deriveClubhouseSummary(nights, allProfiles);
  const nameOf = (id: string | null) => allProfiles.find((entry) => entry.id === id)?.name ?? '';
  const percent = Math.round(stats.winRate * 100);
  const maxMonth = Math.max(1, ...stats.monthlyWins.map((month) => month.wins));
  const rivalries = deriveRivalries(nights, allProfiles).filter((entry) => entry.profileAId === profile.id || entry.profileBId === profile.id).slice(0, 3);
  const leaderboard = buildLeaderboard(allProfiles, nights);
  const club = getClubName(extensions);
  const dash = deriveDashboard(nights, allProfiles);
  const maxNights = Math.max(1, ...dash.months.map((month) => month.nights));
  const bestRate = summary.bestWinRateProfileId ? withStats.find((entry) => entry.profile.id === summary.bestWinRateProfileId)?.stats : null;

  function run(action: () => Extensions) {
    keyboard.hide();
    try { onChange(action()); setError(''); setRename(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'That change could not be saved.'); }
  }

  return <section className="club-panel" aria-labelledby="stats-title">
    <SampleDataBar extensions={extensions} onChange={onChange} />
    <ClubSharing />
    
    <section className="dashboard" aria-label="Club dashboard">
      <div className="dash-tiles">
        <div><b>{dash.totalNights}</b><span>night{dash.totalNights === 1 ? '' : 's'} played</span></div>
        <div><b>{dash.activePlayers}</b><span>players</span></div>
        <div><b>{dash.champion ? dash.champion.name : '–'}</b><span>{dash.champion ? `top of the table · ${dash.champion.wins} win${dash.champion.wins === 1 ? '' : 's'}` : 'no winner yet'}</span></div>
        <div><b>{dash.hot ? <>{dash.hot.name} <Fire className="streak-flame" size={22} weight="fill" aria-hidden="true" /></> : '–'}</b><span>{dash.hot ? `${dash.hot.streak} wins in a row` : 'no hot streak yet'}</span></div>
      </div>
      <h3>Nights played by month</h3>
      <div className="month-chart" role="img" aria-label="Nights played per month">
        {dash.months.map((month) => <div key={month.key}><b>{month.nights}</b><span className="bar" style={{ height: `${Math.max(4, (month.nights / maxNights) * 70)}px` }} /><small>{month.label}</small></div>)}
      </div>
      {dash.busiest && <p className="dash-note">Busiest month: {dash.busiest.label} with {dash.busiest.nights} night{dash.busiest.nights === 1 ? '' : 's'}.</p>}
    </section>
    <h2 className="leaderboard-title">{club ? `${club} leaderboard` : 'Club leaderboard'}</h2>
    <ol className="leaderboard" aria-label="Club leaderboard">{leaderboard.map((row) => <li key={row.profileId} className={row.rank === 1 ? 'leader' : ''}>
      <span className="lb-rank">{row.rank === 1 ? <Crown size={20} weight="fill" aria-label="Leader" /> : row.rank}</span>
      <span className="lb-name">{row.name}</span>
      <span className="lb-bar" aria-hidden="true"><i style={{ width: `${Math.round(row.winRate * 100)}%` }} /></span>
      <span className="lb-value">{row.wins} win{row.wins === 1 ? '' : 's'} · {Math.round(row.winRate * 100)}%</span>
    </li>)}</ol>
    <ShareButton label="Share the leaderboard" build={() => leaderboardShareCard(leaderboard, nights.length, club)} />
    <details className="manage-player club-name"><summary>{club ? 'Rename your club' : 'Name your club'}</summary>
      <label><span>Club name</span><KeyboardInput aria-label="Club name" value={clubDraft} maxLength={32} placeholder={club || 'The Friday Club'} onChange={(event) => setClubDraft(event.target.value)} /></label>
      <div className="manage-actions"><button className="secondary" onClick={() => { keyboard.hide(); onChange(putClubName(extensions, clubDraft)); setClubDraft(''); }}>Save club name</button></div>
    </details>
    <div className="player-tokens" aria-label="Choose a player">
      {withStats.map((entry) => <button key={entry.profile.id} data-colour={entry.profile.colour} aria-pressed={entry.profile.id === profile.id} onClick={() => { setChosen(entry.profile.id); setError(''); }}>{entry.profile.name}</button>)}
    </div>
    <h2 id="stats-title">{profile.name}'s record</h2>
    <div className="dial-wrap">
      <WinDial rate={stats.winRate} />
      <div className="dial-text"><strong>{percent}%</strong><span>win rate</span></div>
    </div>
    <p className="record-line">{stats.wins} win{stats.wins === 1 ? '' : 's'} from {stats.appearances} night{stats.appearances === 1 ? '' : 's'}</p>
    <dl className="record-grid">
      <div><dt>Current streak</dt><dd>{stats.currentWinStreak}</dd></div>
      <div><dt>Best streak</dt><dd>{stats.bestWinStreak}</dd></div>
    </dl>

    <h3>Wins by month</h3>
    <div className="month-chart" role="img" aria-label={`${profile.name} wins over six months`}>
      {stats.monthlyWins.map((month) => <div key={month.key}><b>{month.wins}</b><span className="bar" style={{ height: `${Math.max(4, (month.wins / maxMonth) * 70)}px` }} /><small>{month.label}</small></div>)}
    </div>

    <h3>Recent form</h3>
    <p className="form-line" aria-label={`Recent form, newest first: ${stats.recentForm.join(' ')}`}>{stats.recentForm.join(' ')}</p>

    {Object.keys(stats.formatWins).length > 0 && <>
      <h3>Wins by format</h3>
      <ul className="format-wins">{Object.entries(stats.formatWins).map(([format, wins]) => <li key={format}><span>{FORMAT_NAMES[format] ?? format}</span><strong>{wins}</strong></li>)}</ul>
    </>}

    <h3>Milestones</h3>
    {stats.milestones.length
      ? <ul className="milestones">{stats.milestones.map((id) => <li key={id}><span>{MILESTONES[id].label}</span><small>{MILESTONES[id].hint}</small></li>)}</ul>
      : <p className="history-empty">Milestones unlock from real results.</p>}

    {rivalries.length > 0 && <>
      <h3>Rivalries</h3>
      <ul className="rivalries">{rivalries.map((rivalry) => {
        const otherId = rivalry.profileAId === profile.id ? rivalry.profileBId : rivalry.profileAId;
        const mine = rivalry.profileAId === profile.id ? rivalry.winsA : rivalry.winsB;
        const theirs = rivalry.profileAId === profile.id ? rivalry.winsB : rivalry.winsA;
        return <li key={otherId}><span>v {nameOf(otherId)}</span><strong>{mine}–{theirs}</strong><small>{rivalry.meetings} night{rivalry.meetings === 1 ? '' : 's'}{rivalry.otherWins ? `, ${rivalry.otherWins} won by someone else` : ''}</small></li>;
      })}</ul>
    </>}

    <h3>The whole club</h3>
    <ul className="club-summary">
      <li><span>Saved nights</span><strong>{summary.totalNights}</strong></li>
      {summary.mostWinsProfileId && <li><span>Most wins</span><strong>{nameOf(summary.mostWinsProfileId)}</strong></li>}
      {bestRate && <li><span>Best win rate (3+ nights)</span><strong>{nameOf(summary.bestWinRateProfileId)} · {Math.round(bestRate.winRate * 100)}%</strong></li>}
    </ul>

    <details className="manage-player">
      <summary>Manage {profile.name}</summary>
      <label><span>New name</span><KeyboardInput aria-label="New name" value={rename} placeholder={profile.name} onChange={(event) => setRename(event.target.value)} /></label>
      <div className="manage-actions">
        <button className="secondary" onClick={() => run(() => renameProfile(extensions, profile.id, rename))}>Rename</button>
        <button className="text-link" onClick={async () => { if (await confirm({ title: `Archive ${profile.name}?`, message: 'Their history and stats are kept, but they stop appearing in new games.', confirmLabel: 'Archive player' })) run(() => archiveProfile(extensions, profile.id)); }}>Archive</button>
      </div>
      {error && <p className="score-error" role="alert">{error}</p>}
    </details>
  {confirmSheet}</section>;
}
