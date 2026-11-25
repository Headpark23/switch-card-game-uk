import { useEffect, useState } from 'react';
import { CLUB_REFRESH } from '../switch/sync/clubSync';
import { ArrowRight, CaretLeft, ChartLineUp, Pencil, Robot } from '@phosphor-icons/react';
import { FormCard, StatSheet, type StatData, type StatGame, type StatId } from '../components/MeCharts';
import { FeltHeader } from '../components/ui';
import { KeyboardInput, useKeyboard } from '../mobile';
import { BadgeButton, BadgeSheet, BadgeWall, PassportBook } from './Badges';
import { PlayerCabinet } from './TrophyRoom';
import { derivePassport, deriveTownStamps, deriveBadges, type BadgeProgress } from '../switch/stats/badges';
import { gpsAutoStampEnabled, readGpsStamps, setGpsAutoStamp } from '../services/gpsStamp';
import { ensureMe, gameMode, getComputerGames, getMeId, summariseByMode, summariseComputerGames, summariseRivals, toughestRival, RIVAL_MIN_GAMES, type ComputerGame } from '../switch/store/computerLog';
import { MODES, modeInfo } from '../switch/formats/series';
import { claimMe, mergeProfiles } from '../switch/store/identity';
import { useConfirm } from '../components/Confirm';
import { derivePlayerStats } from '../switch/stats/analytics';
import { getHistory } from '../switch/store/history';
import { ensureProfiles, getProfiles, type LocalProfile, isNameTaken, nameTakenMessage, renameProfile, resolveHistoryPlayerId } from '../switch/store/profiles';
import { countryName } from '../switch/store/places';
import { readClub, updateClub } from '../switch/store/clubStore';
import NightDetail from '../components/NightDetail';
import TableTalkStats from '../components/TableTalkStats';
import GameLengths from '../components/GameLengths';
import { setSpicyTalk, spicyTalk } from '../switch/stats/reactions';
import type { SwitchNightRecord } from '../switch/store/history';
import { readSpeed, saveSpeed } from '../switch/store/activeTable';
import { SPEED_NAMES, type Speed } from '../switch/stats/presentation';
import { feedbackEnabled, setFeedbackEnabled } from '../services/feedback';
import { AccountPanel } from '../components/AccountPanel';
import InstallButton from '../components/InstallButton';
import HistoryPanel, { type HistoryCategory, type HistoryEntry } from '../components/HistoryPanel';
import { LegendsCard } from '../components/LegendsCard';
import { readAutoSort, saveAutoSort } from '../components/tablePrefs';

type Section = 'overview' | 'history' | 'computer' | 'badges' | 'passport' | 'trophies' | 'settings';
const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: 'overview', label: 'Me' }, { id: 'history', label: 'History' }, { id: 'computer', label: 'Computer' }, { id: 'badges', label: 'Badges' }, { id: 'passport', label: 'Passport' }, { id: 'trophies', label: 'Trophies' }, { id: 'settings', label: 'Settings' },
];
const LEVEL_NAMES: Record<string, string> = { relaxed: 'Easy', standard: 'Medium', sharp: 'Hard' };
const FORMAT_NAMES: Record<string, string> = { 'head-to-head': 'One v One', domino: 'Dominoes', darts: 'Darts', league: 'Group Play', knockout: 'Last One Out', cup: 'Switch Cup' };

/** Scored-at-home formats named the same way as the matching way to play on the app, so charts group them together. */
const HOME_TYPES: Record<string, string> = { 'head-to-head': 'One v One', domino: 'Dominoes scoring', darts: 'Darts scoring', league: 'Group Play', knockout: 'Last One Out', cup: 'Switch Cup' };

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  return <div className="me-bar"><span>{label}</span><i aria-hidden="true"><b style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} /></i><em>{value}/{total}</em></div>;
}

function percent(rate: number) { return `${Math.round(rate * 100)}%`; }

/** Your own corner: who you are, every night and computer game you have played, your badges and passport. */
export default function MePage({ onPlay, onClub, onPrivacy, onReplay, onBack, initialSection = 'overview' }: { onPlay: () => void; onClub: () => void; onPrivacy?: () => void; onReplay?: (gameId: string) => void; onBack?: () => void; initialSection?: Section }) {
  const keyboard = useKeyboard();
  const [extensions, setExtensions] = useState(readClub);
  // A shared club changed under this screen: show the new players and nights without losing the tab you are on.
  useEffect(() => { const refresh = () => setExtensions(readClub()); window.addEventListener(CLUB_REFRESH, refresh); return () => window.removeEventListener(CLUB_REFRESH, refresh); }, []);
  const [section, setSection] = useState<Section>(initialSection);
  const [soundOn, setSoundOn] = useState(feedbackEnabled);
  const [autoSortOn, setAutoSortOn] = useState(readAutoSort);
  const [gpsAutoOn, setGpsAutoOn] = useState(gpsAutoStampEnabled);
  const [gpsTick, setGpsTick] = useState(0);
  const [spicyOn, setSpicyOn] = useState(spicyTalk);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [filter, setFilter] = useState<HistoryCategory>('all');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [openBadge, setOpenBadge] = useState<BadgeProgress | null>(null);
  const [confirm, confirmSheet] = useConfirm();
  const [openNight, setOpenNight] = useState<SwitchNightRecord | null>(null);
  const [openGame, setOpenGame] = useState<ComputerGame | null>(null);
  const [stat, setStat] = useState<StatId | null>(null);
  // Run the change once on its own first, so a mistake shows as a message instead of blanking the page.
  const apply = (change: (current: Record<string, unknown>) => Record<string, unknown>) => { change(readClub()); setExtensions(updateClub(change)); };

  const profiles = getProfiles(extensions).filter((profile) => !profile.archived);
  const meId = getMeId(extensions);
  const me = profiles.find((profile) => profile.id === meId) ?? null;

  if (!me) {
    let previewBadges: BadgeProgress[] = [];
    try { previewBadges = deriveBadges({ id: '__preview__', name: 'Preview' } as unknown as LocalProfile, [], [], []); } catch { /* the preview is optional */ }
    return <section className="me-page" aria-labelledby="me-title">
      {onBack && <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />Home</button>}
      <FeltHeader id="me-title" title="Who are you?" intro="Pick a name so your badges and passport follow you." cards={['KH', 'AS']} />
      {profiles.length > 0 && <div className="saved-players" aria-label="Saved players"><span>Already playing? Pick your name</span><div className="player-tokens">{profiles.map((profile) => <button key={profile.id} data-colour={profile.colour} onClick={() => apply((current) => claimMe(current, profile.id))}>{profile.name}</button>)}</div></div>}
      <label className="target-field"><span>Or type your name</span><KeyboardInput aria-label="Your name" value={draft} placeholder="Your name" onChange={(event) => setDraft(event.target.value)} /></label>
      {error && <p className="score-error" role="alert">{error}</p>}
      <button className="primary" disabled={!draft.trim()} onClick={() => {
        // Typing a registered player's name is not a way to become them: they pick their name from the list above instead.
        try { apply((current) => { if (isNameTaken(current, draft)) throw new Error(nameTakenMessage(draft)); const ensured = ensureProfiles(current, [draft]); return claimMe(ensured.extensions, ensured.players[0].id); }); keyboard.hide(); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'That name could not be saved.'); }
      }}>This is me <ArrowRight size={18} /></button>
      <button className="text-link" onClick={() => apply((current) => ensureMe(current).extensions)}>Skip and call me “You”</button>
      {onPrivacy && <button className="text-link" onClick={onPrivacy}>Privacy: what stays on your phone <ArrowRight size={16} /></button>}
      {previewBadges.length > 0 && <section className="badge-preview" aria-label="Badges you can win"><h3>Badges you can win</h3><BadgeWall badges={previewBadges} /></section>}
    </section>;
  }

  const allProfiles = getProfiles(extensions);
  const nights = getHistory(extensions);
  const computerAll = getComputerGames(extensions);
  const games = computerAll.filter((game) => game.playerId === me.id);
  const summary = summariseComputerGames(games);
  const byMode = summariseByMode(games);
  const rivals = summariseRivals(games);
  const toughest = toughestRival(rivals);
  const stats = derivePlayerStats(me, nights, allProfiles);
  const badges = deriveBadges(me, nights, allProfiles, computerAll);
  const earned = badges.filter((badge) => badge.earned);
  const nextUp = badges.filter((badge) => !badge.earned).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3);
  const myNights = nights.filter((night) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id));
  const gpsStamps = gpsTick >= 0 ? readGpsStamps() : [];
  const stamps = derivePassport(me, nights, allProfiles, gpsStamps);
  const townStamps = deriveTownStamps(me, nights, allProfiles, gpsStamps);
  const nightRecord = { played: myNights.length, won: myNights.filter((night) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id && night.winnerIds.includes(player.id))).length };
  const totalWon = nightRecord.won + summary.wins;
  const totalLost = nightRecord.played - nightRecord.won + summary.losses;
  const wonNight = (night: (typeof nights)[number]) => night.players.some((player) => resolveHistoryPlayerId(player, allProfiles) === me.id && night.winnerIds.includes(player.id));

  const statData: StatData = {
    games: [
      ...myNights.map((night): StatGame => ({ when: night.completedAt, won: wonNight(night), kind: 'home' })),
      ...games.map((game): StatGame => ({ when: game.playedAt, won: game.won, kind: game.online ? 'online' : 'computer' })),
    ],
    nights: myNights.map((night): StatGame => ({ when: night.completedAt, won: wonNight(night), kind: 'home' })),
    computer: games.map((game) => ({ when: game.playedAt, won: game.won, level: game.level })),
    stamps,
  };

  const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;
  const rows: HistoryEntry[] = [
    ...myNights.map((night): HistoryEntry => ({ key: night.id, when: night.completedAt, kind: 'home', type: HOME_TYPES[night.format] ?? night.formatLabel, title: night.title, detail: `${FORMAT_NAMES[night.format] ?? night.formatLabel} · ${night.players.length} players${night.place ? ` · ${night.place.name}, ${countryName(night.place.country)}` : ''}`, won: wonNight(night), open: () => setOpenNight(night) })),
    ...games.map((game): HistoryEntry => {
      const winner = game.rivals?.find((rival) => rival.place === 1)?.name;
      const mode = gameMode(game);
      return { key: game.id, when: game.playedAt, kind: game.online ? 'online' : 'computer', type: modeInfo(mode).name,
        title: game.won ? (game.online ? 'Won online' : 'Beat the computer') : `Finished ${ordinal(game.place)}`,
        detail: `${!game.won && winner ? `${winner} won · ` : ''}${mode === 'single' ? '' : `${modeInfo(mode).name}${game.series ? (game.series.won ? ' · won the whole thing' : ` · finished ${ordinal(game.series.place)} overall`) : ''} · `}${game.online ? `Online · ${game.opponents + 1} players` : game.opponents === 1 ? '1 opponent' : `${game.opponents} opponents`} · ${LEVEL_NAMES[game.level]} · ${game.moves} moves`,
        won: game.won, open: () => setOpenGame(game) };
    }),
  ];

  const rename = async () => {
    keyboard.hide();
    const clean = draft.trim();
    if (isNameTaken(extensions, clean, me.id)) { setError(nameTakenMessage(clean)); return; }
    try { apply((current) => renameProfile(current, me.id, draft)); setEditing(false); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'That name could not be saved.'); }
  };

  return <section className="me-page" aria-labelledby="me-title">
    <FeltHeader compact id="me-title" title={me.name} intro={`${stats.appearances} night${stats.appearances === 1 ? '' : 's'} · ${summary.games} game${summary.games === 1 ? '' : 's'} v computer · ${earned.length} ${earned.length === 1 ? 'badge' : 'badges'}`} cards={['KH', 'QS']} />
    <div className="club-tabs me-tabs" role="group" aria-label="Me sections">{SECTIONS.map((item) => <button key={item.id} className={section === item.id ? 'active' : ''} aria-pressed={section === item.id} onClick={() => { keyboard.hide(); setSection(item.id); }}>{item.label}</button>)}</div>

    {section === 'overview' && <>
      <div className="me-tiles" aria-label="Your record. Tap a number for its chart.">
        <button type="button" data-stat="played" aria-label={`Games played: ${nightRecord.played + summary.games}. Show chart`} onClick={() => { keyboard.hide(); setStat('played'); }}><b>{nightRecord.played + summary.games}</b><span>Games played</span><ChartLineUp size={13} weight="bold" aria-hidden="true" /></button>
        <button type="button" className="record-tile" data-stat="record" aria-label={`Won ${totalWon}, lost ${totalLost}${totalWon + totalLost ? `, ${percent(totalWon / (totalWon + totalLost))} won` : ''}. Show chart`} onClick={() => { keyboard.hide(); setStat('record'); }}>
          <span className="rt-score" aria-hidden="true"><b className="w">{totalWon}</b><i>won</i><em>·</em><b className="l">{totalLost}</b><i>lost</i></span>
          <span className="rt-bar" aria-hidden="true">{totalWon + totalLost > 0 && <>{totalWon > 0 && <u className="w" style={{ flexGrow: totalWon }} />}{totalLost > 0 && <u className="l" style={{ flexGrow: totalLost }} />}</>}</span>
          <span className="rt-note" aria-hidden="true">{totalWon + totalLost ? `${percent(totalWon / (totalWon + totalLost))} of your games won` : 'Your first game starts the bar'}</span>
          <ChartLineUp size={13} weight="bold" aria-hidden="true" />
        </button>
        {([
          ['nightWins', stats.wins, 'Night wins'],
          ['nightRate', stats.appearances ? percent(stats.winRate) : '–', 'Night win rate'],
          ['streak', stats.bestWinStreak, 'Best streak'],
          ['beat', summary.wins, 'Beat computer'],
          ['vsRate', summary.games ? percent(summary.winRate) : '–', 'v computer'],
          ['countries', stamps.length, 'Countries'],
        ] as const).map(([id, value, label]) => <button key={id} type="button" data-stat={id} aria-label={`${label}: ${value}. Show chart`} onClick={() => { keyboard.hide(); setStat(id); }}><b>{value}</b><span>{label}</span><ChartLineUp size={13} weight="bold" aria-hidden="true" /></button>)}
      </div>
      <FormCard games={statData.games} />
      <StatSheet stat={stat} data={statData} onClose={() => setStat(null)} />
      <GameLengths games={games} onReplay={onReplay} />
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

    {section === 'history' && <HistoryPanel entries={rows} category={filter} onCategory={setFilter} />}

    {section === 'computer' && <>
      <LegendsCard games={games} />
      {summary.games === 0
        ? <><p className="history-empty">No games against the computer yet. Every finished game in Play is logged here. Guided practice games are not counted.</p><button className="primary" onClick={onPlay}>Play the computer <ArrowRight size={18} /></button></>
        : <>
          <div className="me-tiles" aria-label="Record against the computer">
            <div><b>{summary.games}</b><span>Played</span></div><div><b>{summary.wins}</b><span>Won</span></div><div><b>{percent(summary.winRate)}</b><span>Win rate</span></div>
            <div><b>{summary.currentStreak}</b><span>Win streak</span></div><div><b>{summary.bestStreak}</b><span>Best streak</span></div><div><b>{summary.averageMoves}</b><span>Avg moves</span></div>
          </div>
          <h3>Your rivals</h3>
          {rivals.length === 0
            ? <p className="dash-note">Rivals are tracked from your next game. After a few games with each computer you will see which one is hardest to beat.</p>
            : <>
              <p className="rival-verdict" data-testid="toughest-rival">{toughest
                ? <><strong>{toughest.name}</strong> is your toughest rival: finished ahead of you in {toughest.ahead} of {toughest.games} games{toughest.wins > 0 ? `, and won ${toughest.wins} outright` : ''}.</>
                : `Play ${RIVAL_MIN_GAMES} games with a computer at the table to crown your toughest rival.`}</p>
              <ul className="rivals" aria-label="How each computer has played against you">{rivals.map((rival) => {
                const share = Math.round(rival.edge * 100);
                return <li key={rival.name} className={toughest?.name === rival.name ? 'toughest' : ''}>
                  <span className="rival-top"><strong>{rival.name}</strong><em>{rival.games >= RIVAL_MIN_GAMES ? `${share}% ahead of you` : `${rival.games} game${rival.games === 1 ? '' : 's'} so far`}</em></span>
                  <i aria-hidden="true"><b style={{ width: `${share}%` }} /></i>
                  <small>Finished ahead {rival.ahead} · behind {rival.behind}{rival.level ? ` · level ${rival.level}` : ''} · won {rival.wins} · average place {rival.averagePlace.toFixed(1)}</small>
                </li>;
              })}</ul>
              <p className="dash-note">All computers play at the level you pick, so the gap between them is the luck of the deal and their seat. Games played before this was tracked are not included.</p>
            </>}
          <h3>By difficulty</h3>
          {(['relaxed', 'standard', 'sharp'] as const).map((level) => <Bar key={level} label={LEVEL_NAMES[level]} value={summary.byLevel[level]?.wins ?? 0} total={summary.byLevel[level]?.games ?? 0} />)}
          <h3>By game type</h3>
          <ul className="mode-stats" aria-label="Results by game type">{MODES.map((mode) => {
            const entry = byMode.find((item) => item.mode === mode.id);
            return <li key={mode.id} className={entry ? '' : 'empty'}><strong>{mode.name}</strong>
              {entry ? <span>{mode.id === 'single' ? `${entry.won} won of ${entry.played}` : `${entry.played} played · ${entry.won} won`}{entry.played > 0 && mode.id !== 'single' ? ` · best finish ${entry.bestPlace}${['st', 'nd', 'rd'][entry.bestPlace - 1] ?? 'th'}` : ''}{entry.bestStreak > 1 ? ` · best run ${entry.bestStreak}` : ''}</span> : <span>Not played yet</span>}</li>;
          })}</ul>
          <h3>By table size</h3>
          {[1, 2, 3, 4, 5, 6, 7].map((count) => <Bar key={count} label={count === 1 ? 'Head to head' : `You + ${count} computers`} value={summary.byOpponents[count]?.wins ?? 0} total={summary.byOpponents[count]?.games ?? 0} />)}
          <button className="primary" onClick={onPlay}>Play again <ArrowRight size={18} /></button>
        </>}
      <TableTalkStats />
    </>}

    <NightDetail night={openNight} game={openGame} meId={me.id} profiles={allProfiles} onClose={() => { setOpenNight(null); setOpenGame(null); }} onReplay={onReplay ? (id) => { setOpenGame(null); onReplay(id); } : undefined} />
    {confirmSheet}
    {section === 'badges' && <BadgeWall badges={badges} />}
    {section === 'passport' && <PassportBook stamps={stamps} towns={townStamps} nights={myNights} name={me.name} showGpsControls onGpsStamped={() => setGpsTick((tick) => tick + 1)} />}
    {section === 'trophies' && <PlayerCabinet extensions={extensions} profileId={me.id} />}
    {section === 'settings' && <div className="me-settings">
      <h3>Profile</h3>
      <p className="lobby-note">You play as <strong>{me.name}</strong>. Change your name on the Me tab. Everything stays on this device unless you back it up.</p>
      <AccountPanel />
      <h3>Playing the computer</h3>
      <div className="seg three compact" role="group" aria-label="Computer pace">{(['quick', 'natural', 'relaxed'] as const).map((id) => <button key={id} aria-pressed={speed === id} className={speed === id ? 'active' : ''} onClick={() => { setSpeed(id); saveSpeed(id); }}><b>{SPEED_NAMES[id]}</b></button>)}</div>
      <button className="secondary setting-toggle" role="switch" aria-checked={soundOn} onClick={() => { const next = !soundOn; setFeedbackEnabled(next); setSoundOn(next); }}>Sounds and vibration: {soundOn ? 'on' : 'off'}</button>
      <button className="secondary setting-toggle" role="switch" aria-checked={autoSortOn} data-testid="autosort-setting" onClick={() => { const next = !autoSortOn; saveAutoSort(next); setAutoSortOn(next); }}>Always keep hand sorted: {autoSortOn ? 'on' : 'off'}</button>
      <button className="secondary setting-toggle" role="switch" aria-checked={gpsAutoOn} data-testid="gps-passport-setting" onClick={() => { const next = !gpsAutoOn; setGpsAutoStamp(next); setGpsAutoOn(next); }}>Auto-stamp passport with GPS: {gpsAutoOn ? 'on' : 'off'}</button>
      <button className="secondary" role="switch" aria-checked={spicyOn} data-testid="spicy-setting" onClick={() => { const next = !spicyOn; setSpicyTalk(next); setSpicyOn(next); }}>{spicyOn ? 'Spicy talk is on: turn it off' : 'Turn on spicy talk (swearing, adults only)'}</button>
      <p className="lobby-note">Spicy talk adds pub swearing to the reactions and lets the computers swear back. It is only ever on for this device: friends with it off see a clean version of whatever you say.</p>
      <h3>This app</h3>
      <InstallButton />
      {onPrivacy && <button className="text-link" onClick={onPrivacy}>Privacy: what stays on your phone <ArrowRight size={16} /></button>}
    </div>}
  </section>;
}
