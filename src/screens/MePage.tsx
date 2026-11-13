import { useEffect, useState } from 'react';
import { CLUB_REFRESH } from '../switch/clubSync';
import { ArrowRight, Fire, Pencil, Robot } from '@phosphor-icons/react';
import { FeltHeader } from '../ui';
import { KeyboardInput, useKeyboard } from '../mobile';
import { BadgeButton, BadgeSheet, BadgeWall, PassportBook } from './Badges';
import { PlayerCabinet } from './TrophyRoom';
import { derivePassport, deriveBadges, type BadgeProgress } from '../switch/badges';
import { ensureMe, getComputerGames, getMeId, summariseComputerGames, type ComputerGame } from '../switch/computerLog';
import { claimMe, mergeProfiles } from '../switch/identity';
import { useConfirm } from '../Confirm';
import { derivePlayerStats } from '../switch/analytics';
import { getHistory } from '../switch/history';
import { ensureProfiles, getProfiles, isNameTaken, nameTakenMessage, renameProfile, resolveHistoryPlayerId } from '../switch/profiles';
import { countryName } from '../switch/places';
import { readClub, updateClub } from '../switch/clubStore';
import NightDetail from './NightDetail';
import type { SwitchNightRecord } from '../switch/history';
import { readSpeed, saveSpeed } from '../switch/activeTable';
import { SPEED_NAMES, type Speed } from '../switch/presentation';
import { feedbackEnabled, setFeedbackEnabled } from '../feedback';
import { AccountPanel } from '../AccountPanel';
import InstallButton from '../InstallButton';

type Section = 'overview' | 'history' | 'computer' | 'badges' | 'passport' | 'trophies' | 'settings';
const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: 'overview', label: 'Me' }, { id: 'history', label: 'History' }, { id: 'computer', label: 'Computer' }, { id: 'badges', label: 'Badges' }, { id: 'passport', label: 'Passport' }, { id: 'trophies', label: 'Trophies' }, { id: 'settings', label: 'Settings' },
];
const LEVEL_NAMES: Record<string, string> = { relaxed: 'Relaxed', standard: 'Standard', sharp: 'Sharp' };
const FORMAT_NAMES: Record<string, string> = { 'head-to-head': 'One v One', domino: 'Domino', darts: 'Darts', league: 'Group Play', knockout: 'Knock Out', cup: 'Switch Cup' };

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  return <div className="me-bar"><span>{label}</span><i aria-hidden="true"><b style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} /></i><em>{value}/{total}</em></div>;
}

function percent(rate: number) { return `${Math.round(rate * 100)}%`; }

/** Your own corner: who you are, every night and computer game you have played, your badges and passport. */
export default function MePage({ onPlay, onClub, onPrivacy, initialSection = 'overview' }: { onPlay: () => void; onClub: () => void; onPrivacy?: () => void; initialSection?: Section }) {
  const keyboard = useKeyboard();
  const [extensions, setExtensions] = useState(readClub);
  // A shared club changed under this screen: show the new players and nights without losing the tab you are on.
  useEffect(() => { const refresh = () => setExtensions(readClub()); window.addEventListener(CLUB_REFRESH, refresh); return () => window.removeEventListener(CLUB_REFRESH, refresh); }, []);
  const [section, setSection] = useState<Section>(initialSection);
  const [soundOn, setSoundOn] = useState(feedbackEnabled);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [filter, setFilter] = useState<'all' | 'nights' | 'computer'>('all');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [openBadge, setOpenBadge] = useState<BadgeProgress | null>(null);
  const [confirm, confirmSheet] = useConfirm();
  const [openNight, setOpenNight] = useState<SwitchNightRecord | null>(null);
  const [openGame, setOpenGame] = useState<ComputerGame | null>(null);
  // Run the change once on its own first, so a mistake shows as a message instead of blanking the page.
  const apply = (change: (current: Record<string, unknown>) => Record<string, unknown>) => { change(readClub()); setExtensions(updateClub(change)); };

  const profiles = getProfiles(extensions).filter((profile) => !profile.archived);
  const meId = getMeId(extensions);
  const me = profiles.find((profile) => profile.id === meId) ?? null;

  if (!me) {
    return <section className="me-page" aria-labelledby="me-title">
      <FeltHeader id="me-title" title="Who are you?" intro="Your games against the computer, your nights, badges and passport all hang on this name." cards={['KH', 'AS']} />
      {profiles.length > 0 && <div className="saved-players" aria-label="Saved players"><span>Already playing? Pick your name</span><div className="player-tokens">{profiles.map((profile) => <button key={profile.id} data-colour={profile.colour} onClick={() => apply((current) => claimMe(current, profile.id))}>{profile.name}</button>)}</div></div>}
      <label className="target-field"><span>Or type your name</span><KeyboardInput aria-label="Your name" value={draft} placeholder="Your name" onChange={(event) => setDraft(event.target.value)} /></label>
      {error && <p className="score-error" role="alert">{error}</p>}
      <button className="primary" disabled={!draft.trim()} onClick={() => {
        // Typing a registered player's name is not a way to become them: they pick their name from the list above instead.
        try { apply((current) => { if (isNameTaken(current, draft)) throw new Error(nameTakenMessage(draft)); const ensured = ensureProfiles(current, [draft]); return claimMe(ensured.extensions, ensured.players[0].id); }); keyboard.hide(); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'That name could not be saved.'); }
      }}>This is me <ArrowRight size={18} /></button>
      <button className="text-link" onClick={() => apply((current) => ensureMe(current).extensions)}>Skip and call me “You”</button>
      {onPrivacy && <button className="text-link" onClick={onPrivacy}>Privacy: what stays on your phone <ArrowRight size={16} /></button>}
    </section>;
  }

  const allProfiles = getProfiles(extensions);
  const nights = getHistory(extensions);
  const computerAll = getComputerGames(extensions);
  const games = computerAll.filter((game) => game.playerId === me.id);
  const summary = summariseComputerGames(games);
  const stats = derivePlayerStats(me, nights, allProfiles);
  const badges = deriveBadges(me, nights, allProfiles, computerAll);
  const earned = badges.filter((badge) => badge.earned);
  const nextUp = badges.filter((badge) => !badge.earned).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3);
  const myNights = nights.filter((night) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id));
  const stamps = derivePassport(me, nights, allProfiles);
  const nightRecord = { played: myNights.length, won: myNights.filter((night) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id && night.winnerIds.includes(player.id))).length };
  const wonNight = (night: (typeof nights)[number]) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id && night.winnerIds.includes(player.id));

  type Row = { key: string; when: string; kind: 'night' | 'computer'; title: string; detail: string; won: boolean; open: () => void };
  const rows: Row[] = [
    ...(filter !== 'computer' ? myNights.map((night): Row => ({ key: night.id, when: night.completedAt, kind: 'night', title: night.title, detail: `${FORMAT_NAMES[night.format] ?? night.formatLabel} · ${night.players.length} players${night.place ? ` · ${night.place.name}, ${countryName(night.place.country)}` : ''}`, won: wonNight(night), open: () => setOpenNight(night) })) : []),
    ...(filter !== 'nights' ? games.map((game): Row => ({ key: game.id, when: game.playedAt, kind: 'computer', title: game.won ? 'Beat the computer' : `Finished ${game.place}${['st', 'nd', 'rd'][game.place - 1] ?? 'th'}`, detail: `${game.opponents === 1 ? '1 opponent' : `${game.opponents} opponents`} · ${LEVEL_NAMES[game.level]} · ${game.moves} moves`, won: game.won, open: () => setOpenGame(game) })) : []),
  ].sort((a, b) => Date.parse(b.when) - Date.parse(a.when));

  const rename = async () => {
    keyboard.hide();
    const clean = draft.trim();
    if (isNameTaken(extensions, clean, me.id)) { setError(nameTakenMessage(clean)); return; }
    try { apply((current) => renameProfile(current, me.id, draft)); setEditing(false); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'That name could not be saved.'); }
  };

  return <section className="me-page" aria-labelledby="me-title">
    <FeltHeader compact id="me-title" title={me.name} intro={`${stats.appearances} night${stats.appearances === 1 ? '' : 's'} · ${summary.games} game${summary.games === 1 ? '' : 's'} v computer · ${earned.length} badges`} cards={['KH', 'QS']} />
    <div className="club-tabs me-tabs" role="group" aria-label="Me sections">{SECTIONS.map((item) => <button key={item.id} className={section === item.id ? 'active' : ''} aria-pressed={section === item.id} onClick={() => { keyboard.hide(); setSection(item.id); }}>{item.label}</button>)}</div>

    {section === 'overview' && <>
      <div className="me-tiles" aria-label="Your record">
        <div><b>{nightRecord.played + summary.games}</b><span>Games played</span></div>
        <div><b>{nightRecord.won + summary.wins}</b><span>Won</span></div>
        <div><b>{nightRecord.played - nightRecord.won + summary.losses}</b><span>Lost</span></div>
        <div><b>{stats.wins}</b><span>Night wins</span></div>
        <div><b>{stats.appearances ? percent(stats.winRate) : '–'}</b><span>Night win rate</span></div>
        <div><b>{stats.bestWinStreak}</b><span>Best streak</span></div>
        <div><b>{summary.wins}</b><span>Beat computer</span></div>
        <div><b>{summary.games ? percent(summary.winRate) : '–'}</b><span>v computer</span></div>
        <div><b>{stamps.length}</b><span>Countries</span></div>
      </div>
      {summary.form.length > 0 && <div className="me-form" aria-label="Recent games against the computer"><span>Lately v computer</span>{summary.form.map((result, index) => <i key={index} className={result === 'W' ? 'win' : 'loss'}>{result}</i>)}</div>}
      <button className="primary" onClick={onPlay}><Robot size={19} weight="bold" />Play the computer</button>
      {nextUp.length > 0 && <><h3>Next badges</h3><ul className="next-badges">{nextUp.map((badge) => <li key={badge.id}><BadgeButton badge={badge} size={46} onOpen={setOpenBadge}><span><strong>{badge.label}</strong><small>{badge.hint}</small></span><em>{badge.have}/{badge.need}</em></BadgeButton></li>)}</ul></>}
      {earned.length > 0 && <><h3>Latest badges</h3><div className="chip-row" aria-label="Badges earned">{earned.slice(-6).reverse().map((badge) => <BadgeButton key={badge.id} badge={badge} size={46} onOpen={setOpenBadge} />)}</div></>}
      <BadgeSheet badge={openBadge} onClose={() => setOpenBadge(null)} />
      <div className="me-name">
        {editing
          ? <><label><span>Your name</span><KeyboardInput aria-label="Your name" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>{error && <p className="score-error" role="alert">{error}</p>}<button className="secondary" onClick={rename}>Save name</button><button className="text-link" onClick={() => { setEditing(false); setError(''); }}>Cancel</button></>
          : <button className="text-link" onClick={() => { setDraft(me.name); setEditing(true); }}><Pencil size={15} weight="bold" />Change my name</button>}
        {profiles.length > 1 && <details><summary>Not {me.name}? Switch player</summary><div className="player-tokens">{profiles.filter((profile) => profile.id !== me.id).map((profile) => <button key={profile.id} data-colour={profile.colour} onClick={() => apply((current) => claimMe(current, profile.id))}>{profile.name}</button>)}</div></details>}
      </div>
      <button className="text-link" onClick={onClub}>Whole-club stats and seasons <ArrowRight size={16} /></button>
    </>}

    {section === 'history' && <>
      <div className="profile-chips" role="group" aria-label="Filter history">{([['all', 'Everything'], ['nights', 'Game nights'], ['computer', 'v Computer']] as const).map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {rows.length === 0 ? <p className="history-empty">Nothing here yet. Play the computer, or save a game night, and it lands in this list.</p>
        : <><p className="dash-note">{nightRecord.played + summary.games} {nightRecord.played + summary.games === 1 ? 'game' : 'games'} · {nightRecord.won + summary.wins} won · {nightRecord.played - nightRecord.won + summary.losses} lost. Tap any game for the full score.</p>
          <ul className="me-history" aria-label="Your game history">{rows.slice(0, 200).map((row) => <li key={row.key} className={row.won ? 'won' : 'lost'}><button type="button" className="me-history-row" onClick={row.open} aria-label={`${row.title}, ${row.won ? 'won' : 'lost'}, ${new Date(row.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Show full score`}><span className={'me-dot ' + row.kind} aria-hidden="true">{row.kind === 'computer' ? <Robot size={16} weight="fill" /> : <Fire size={16} weight="fill" />}</span><span><strong>{row.title}</strong><small>{row.detail}</small></span><span className="me-result"><b className={row.won ? 'win' : 'loss'}>{row.won ? 'Won' : 'Lost'}</b><em>{new Date(row.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</em></span></button></li>)}</ul></>}
    </>}

    {section === 'computer' && <>
      {summary.games === 0
        ? <><p className="history-empty">No games against the computer yet. Every finished game in Play is logged here. Guided practice games are not counted.</p><button className="primary" onClick={onPlay}>Play the computer <ArrowRight size={18} /></button></>
        : <>
          <div className="me-tiles" aria-label="Record against the computer">
            <div><b>{summary.games}</b><span>Played</span></div><div><b>{summary.wins}</b><span>Won</span></div><div><b>{percent(summary.winRate)}</b><span>Win rate</span></div>
            <div><b>{summary.currentStreak}</b><span>Win streak</span></div><div><b>{summary.bestStreak}</b><span>Best streak</span></div><div><b>{summary.averageMoves}</b><span>Avg moves</span></div>
          </div>
          <h3>By difficulty</h3>
          {(['relaxed', 'standard', 'sharp'] as const).map((level) => <Bar key={level} label={LEVEL_NAMES[level]} value={summary.byLevel[level]?.wins ?? 0} total={summary.byLevel[level]?.games ?? 0} />)}
          <h3>By table size</h3>
          {[1, 2, 3, 4].map((count) => <Bar key={count} label={count === 1 ? 'Head to head' : `You + ${count} computers`} value={summary.byOpponents[count]?.wins ?? 0} total={summary.byOpponents[count]?.games ?? 0} />)}
          <button className="primary" onClick={onPlay}>Play again <ArrowRight size={18} /></button>
        </>}
    </>}

    <NightDetail night={openNight} game={openGame} meId={me.id} profiles={allProfiles} onClose={() => { setOpenNight(null); setOpenGame(null); }} />
    {confirmSheet}
    {section === 'badges' && <BadgeWall badges={badges} />}
    {section === 'passport' && <PassportBook stamps={stamps} nights={myNights} name={me.name} />}
    {section === 'trophies' && <PlayerCabinet extensions={extensions} profileId={me.id} />}
    {section === 'settings' && <div className="me-settings">
      <h3>Profile</h3>
      <p className="lobby-note">You play as <strong>{me.name}</strong>. Change your name on the Me tab. Everything stays on this phone unless you back it up.</p>
      <AccountPanel />
      <h3>Playing the computer</h3>
      <div className="seg three compact" role="group" aria-label="Computer pace">{(['quick', 'natural', 'relaxed'] as const).map((id) => <button key={id} aria-pressed={speed === id} className={speed === id ? 'active' : ''} onClick={() => { setSpeed(id); saveSpeed(id); }}><b>{SPEED_NAMES[id]}</b></button>)}</div>
      <button className="secondary" onClick={() => { const next = !soundOn; setFeedbackEnabled(next); setSoundOn(next); }}>{soundOn ? 'Mute sounds and vibration' : 'Turn on sounds and vibration'}</button>
      <h3>This app</h3>
      <InstallButton />
      {onPrivacy && <button className="text-link" onClick={onPrivacy}>Privacy: what stays on your phone <ArrowRight size={16} /></button>}
    </div>}
  </section>;
}
