import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Broadcast, CalendarPlus, Cards, CheckCircle, Club, GraduationCap, House, ListNumbers, PuzzlePiece, Question, ShieldCheck, UserCircle, UsersThree } from '@phosphor-icons/react';
import { readActiveTable } from './switch/store/activeTable';
import { loadSeat } from './switch/sync/onlineRoom';
import { readClub, updateClub } from './switch/store/clubStore';
import { loadAccount, syncNow } from './services/auth';
import { recoverMyGames } from './switch/store/identity';
import { syncJoinedNights } from './switch/sync/joinedNights';
import { flushSharedResults } from './switch/sync/shareNight';
import { startClubSync } from './switch/sync/clubSync';
import type { SwitchNightRecord } from './switch/store/history';
import type { ComputerLevel } from './switch/ai/ai';
import type { SeriesSetup } from './switch/formats/series';
import type { ClubTabView } from './screens/ClubScreen';
import WatchNight from './screens/WatchNight';
import NightReminder from './components/NightReminder';
import { BottomSheet, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import type { powers } from './services/content';
import { Fan } from './components/ui';
import { enableOffline } from './services/offline';
import { trackOpen, trackView } from './switch/stats/telemetry';
import { InstallBanner } from './components/InstallButton';
import { AccountPanel } from './components/AccountPanel';
import HomeHub from './screens/HomeHub';
import { CardsScreen, ModesScreen, QuestionsScreen, RulesScreen } from './screens/LearnScreens';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';

// Anonymous counts for the owner's dashboard. This runs first, before anything has been saved on a fresh phone.
trackOpen();
enableOffline();

// Game, scorekeeper, club, and personal screens are loaded on demand so Home opens quickly.
const GuidedGame = lazy(() => import('./screens/GuidedGame'));
const SwitchScorekeeper = lazy(() => import('./screens/Scorekeeper'));
const ClubScreen = lazy(() => import('./screens/ClubScreen'));
const QuickNight = lazy(() => import('./screens/QuickNight'));
const Puzzles = lazy(() => import('./screens/Puzzles'));
const Privacy = lazy(() => import('./screens/Privacy'));
const AppFooter = lazy(() => import('./components/AppFooter'));
const PlayLobby = lazy(() => import('./screens/PlayLobby'));
const TableGame = lazy(() => import('./screens/TableGame'));
const SeriesPlay = lazy(() => import('./screens/SeriesPlay'));
const FriendsTable = lazy(() => import('./screens/FriendsTable'));
const OnlineTable = lazy(() => import('./screens/OnlineTable'));
const MePage = lazy(() => import('./screens/MePage'));
const ReplayScreen = lazy(() => import('./screens/ReplayScreen'));

type Page = 'Learn' | 'Rules' | 'Cards' | 'Modes' | 'Watch' | 'Questions' | 'Tutorial' | 'Score' | 'Club' | 'Quick' | 'Puzzles' | 'Privacy' | 'Play' | 'Table' | 'Series' | 'Friends' | 'Online' | 'Me' | 'Replay';
type ScoreView = 'score' | 'history';
type Tab = 'Home' | 'Play' | 'Score' | 'Club' | 'Me';

/** Which of the five destinations each screen belongs to, so the bottom bar always shows where you are. Learning lives under Home, apart from competitive play. */
const SECTION: Record<Page, Tab> = {
  Learn: 'Home', Rules: 'Home', Cards: 'Home', Questions: 'Home', Tutorial: 'Home', Puzzles: 'Home', Watch: 'Home',
  Play: 'Play', Table: 'Play', Series: 'Play', Friends: 'Play', Online: 'Play',
  Score: 'Score', Quick: 'Score', Modes: 'Score',
  Club: 'Club',
  Me: 'Me', Privacy: 'Me', Replay: 'Me',
};

const TABS: readonly { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: 'Home', label: 'Home', Icon: House },
  { tab: 'Play', label: 'Play', Icon: Cards },
  { tab: 'Score', label: 'Score', Icon: ListNumbers },
  { tab: 'Club', label: 'Club', Icon: UsersThree },
  { tab: 'Me', label: 'Me', Icon: UserCircle },
];

function Loading() {
  return <p className="house-note" role="status">Loading…</p>;
}

export default function Prototype() {
  const urlNight = (() => { try { return (new URLSearchParams(window.location.search).get('night') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); } catch { return ''; } })();
  const urlAs = (() => { try { return (new URLSearchParams(window.location.search).get('as') || '').trim().slice(0, 40); } catch { return ''; } })();
  const urlClub = (() => { try { return new URLSearchParams(window.location.search).get('club') ? true : false; } catch { return false; } })();
  const urlTable = (() => { try { return (new URLSearchParams(window.location.search).get('table') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); } catch { return ''; } })();
  const [inviteCode, setInviteCode] = useState(urlTable);
  const [nightCode, setNightCode] = useState(urlNight);
  const [page, setPage] = useState<Page>(urlNight ? 'Watch' : urlTable ? 'Friends' : urlClub ? 'Club' : 'Learn');
  const [selected, setSelected] = useState<(typeof powers)[number] | null>(null);
  const [scrollKey, setScrollKey] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [scoreView, setScoreView] = useState<ScoreView>('score');
  const [clubView, setClubView] = useState<ClubTabView>('stats');
  /** Which door of the Club screen Home opened: share my club, or join one. Passed down as `startMode` once the Club screen takes it. */
  const [clubMode, setClubMode] = useState<'share' | 'join' | undefined>(undefined);
  const [meSection, setMeSection] = useState<'overview' | 'badges'>('overview');
  const [table, setTable] = useState<{ opponents: number; level: ComputerLevel; resume: boolean; deal: number; names?: string[] }>({ opponents: 2, level: 'standard', resume: false, deal: 0 });
  /** Where a learning page goes back to: the rules guide, or Home when it was opened from Home. */
  const [learnBack, setLearnBack] = useState<'Learn' | 'Rules'>('Learn');
  const [puzzleMode, setPuzzleMode] = useState<'pack' | 'daily'>('pack');
  /** The game being replayed, and the screen to go back to afterwards. */
  const [replayOf, setReplayOf] = useState<{ id: string; back: Page } | null>(null);
  const keyboard = useKeyboard();
  useEffect(() => { trackView(page); }, [page]);
  const { bottomInset, isKeyboardVisible } = useKeyboardInsets();
  // One-off repair: games left on the automatic "You" player rejoin the owner's real name.
  useState(() => { try { if (recoverMyGames(readClub())) updateClub((current) => recoverMyGames(current) ?? current); } catch { /* leave saved data alone */ } return 0; });
  // A signed-in person's club follows them: it is brought together with the cloud copy when the app opens and whenever it comes back into view.
  useEffect(() => {
    let last = 0;
    const run = () => {
      const account = loadAccount();
      if (!account || Date.now() - last < 120_000) return;
      last = Date.now();
      syncNow(account).then((outcome) => { if (outcome === 'merged' || outcome === 'downloaded') updateClub((current) => current); }).catch(() => { /* the Sync now button explains what went wrong */ });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    run();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  // Results from nights this phone joined arrive here, even when they were saved while the app was closed.
  const [arrived, setArrived] = useState<SwitchNightRecord[]>([]);
  useEffect(() => {
    const check = () => { void flushSharedResults(); syncJoinedNights().then((added) => { if (added.length) setArrived((current) => [...added, ...current]); }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') check(); }, 15000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', check); };
  }, []);

  // Shared club: players, nights and seasons added on any member's phone arrive here, and ours reach them.
  const [clubTick, setClubTick] = useState(0);
  const [shownClubTick, setShownClubTick] = useState(0);
  useEffect(() => startClubSync(() => setClubTick((tick) => tick + 1)), []);
  // A screen reloads when the club changes under it, except the scorekeeper, which never refreshes mid-score.
  useEffect(() => { if (page !== 'Score') setShownClubTick(clubTick); }, [page, clubTick]);

  const resetDeviceScroll = () => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
    if (screen) screen.scrollTop = 0;
  };
  useLayoutEffect(() => {
    resetDeviceScroll();
    const frame = requestAnimationFrame(resetDeviceScroll);
    return () => cancelAnimationFrame(frame);
  }, [page, selected]);
  useLayoutEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-testid="mobile-scroll"]');
    if (scroller) scroller.scrollTop = 0;
  }, [scrollKey]);

  const onGameStatus = useCallback((key: string) => setScrollKey(key), []);

  function go(next: Page) {
    keyboard.hide();
    if (next === 'Rules' || next === 'Learn') setLearnBack(next);
    setPage(next);
    setScrollKey('');
  }
  const openCode = (kind: 'table' | 'night' | 'club', code: string) => {
    if (kind === 'table') { setInviteCode(code); go('Friends'); }
    else if (kind === 'night') { setNightCode(code); go('Watch'); }
    else window.location.assign(`/?club=${code}`);
  };
  const openRules = () => { try { window.localStorage.setItem('switchWelcome', 'done'); } catch { /* storage unavailable */ } go('Rules'); };
  const startGuidedGame = () => go('Tutorial');
  const [seriesAtTable, setSeriesAtTable] = useState(false);
  const [seriesRun, setSeriesRun] = useState<{ setup: SeriesSetup; run: number } | null>(null);
  const startSeriesPlay = (setup: SeriesSetup) => { setSeriesRun((current) => ({ setup, run: (current?.run ?? 0) + 1 })); go('Series'); };
  const dealMeIn = (opponents: number, level: ComputerLevel, computers?: string[]) => { setTable((current) => ({ opponents, level, resume: false, deal: current.deal + 1, names: computers ? ['You', ...computers] : undefined })); go('Table'); };
  const resumeTable = () => {
    const saved = readActiveTable();
    if (!saved) { go('Play'); return; }
    setTable((current) => ({ opponents: saved.opponents, level: saved.level, resume: true, deal: current.deal + 1, names: undefined }));
    go('Table');
  };
  const openScore = (view: ScoreView = 'score') => { setScoreView(view); go('Score'); };
  const openClub = (view: ClubTabView = clubView, mode?: 'share' | 'join') => { setClubView(view); setClubMode(mode); go('Club'); };
  const openMe = (section: 'overview' | 'badges' = 'overview') => { setMeSection(section); go('Me'); };
  const openTab = (tab: Tab) => {
    if (tab === 'Home') go('Learn');
    else if (tab === 'Play') go('Play');
    else if (tab === 'Score') openScore(page === 'Score' ? scoreView : 'score');
    else if (tab === 'Club') openClub();
    else openMe('overview');
  };
  const openReplay = (id: string) => { setReplayOf({ id, back: page }); go('Replay'); };
  const section = SECTION[page];
  const learnBackLabel = learnBack === 'Rules' ? 'Learn the rules' : 'Home';

  return <div className="switch-app" onFocusCapture={resetDeviceScroll} data-section={section}>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    {!isKeyboardVisible && <nav className="bottom-tabs v2" aria-label="Main navigation" style={{ bottom: bottomInset, ['--nav-extend' as string]: `${bottomInset}px` }}>
      <button className="side-brand" onClick={() => openTab('Home')} aria-label="Switch home"><Club weight="fill" size={26} /><span><b>SWITCH</b><i>Your game-night club</i></span></button>
      {TABS.map(({ tab, label, Icon }) => {
        const active = section === tab;
        return <button key={tab} className={active ? 'active' : ''} data-tab={tab} aria-current={active ? 'page' : undefined} onClick={() => openTab(tab)}><span className="tab-card"><Icon weight={active ? 'fill' : 'bold'} size={19} /></span><span className="tab-label">{label}</span></button>;
      })}
      <div className="side-more" role="group" aria-label="Learn and join">
        <p>Learn &amp; join</p>
        <button onClick={openRules}><GraduationCap size={18} weight="bold" />Learn the rules</button>
        <button onClick={() => go('Puzzles')}><PuzzlePiece size={18} weight="bold" />Rules puzzles</button>
        <button onClick={() => go('Questions')}><Question size={18} weight="bold" />Questions</button>
        <button onClick={() => setPlanOpen(true)}><CalendarPlus size={18} weight="bold" />Plan a night</button>
        <button onClick={() => go('Watch')}><Broadcast size={18} weight="bold" />Join a night</button>
        <button onClick={() => go('Privacy')}><ShieldCheck size={18} weight="bold" />Privacy</button>
      </div>
    </nav>}
    <MobileScroll key={page} className="switch-scroll">
      <main id="main-content" tabIndex={-1} className={'switch-content ' + (page === 'Learn' ? 'home' : 'interior') + (page === 'Tutorial' || page === 'Table' || page === 'Online' || (page === 'Series' && seriesAtTable) ? ' tutorial-page' : '') + (page === 'Cards' ? ' cards-page' : '') + (page === 'Rules' ? ' rules-page' : '')}>
        {page === 'Learn' && <>
          <HomeHub key={shownClubTick} onPlay={() => go('Play')} onResumeTable={resumeTable} onScore={() => openScore('score')} onClub={() => openClub('stats')} onShareClub={() => openClub('stats', 'share')} onAchievements={() => openMe('badges')} onRules={openRules} onPuzzles={() => { setPuzzleMode('pack'); go('Puzzles'); }} onDailyPuzzle={() => { setPuzzleMode('daily'); go('Puzzles'); }} onQuestions={() => go('Questions')} onPlan={() => setPlanOpen(true)} onJoin={() => go('Watch')} onJoinClub={() => openClub('stats', 'join')} onHistory={() => openClub('history')} onPower={setSelected} />
          <AccountPanel home />
        </>}
        {page === 'Rules' && <RulesScreen onBack={() => go('Learn')} onStartGuidedGame={startGuidedGame} onOpenCards={() => go('Cards')} onOpenPuzzles={() => go('Puzzles')} onOpenQuestions={() => go('Questions')} onSelectPower={setSelected} />}
        {page !== 'Learn' && page !== 'Rules' && <>
          <header className={'small-brand' + (page === 'Cards' ? ' hidden-brand' : '')}>
            <button onClick={() => go('Learn')} aria-label="Switch home"><Club weight="fill" size={20} /> SWITCH</button>
          </header>
          {page === 'Cards' && <CardsScreen backLabel={learnBackLabel} onBack={() => go(learnBack)} onSelectPower={setSelected} />}
          {page === 'Questions' && <QuestionsScreen backLabel={learnBackLabel} onBack={() => go(learnBack)} />}
          {page === 'Modes' && <ModesScreen onOpenScore={() => openScore('score')} />}
          <Suspense fallback={<Loading />}>
            {page === 'Score' && <SwitchScorekeeper section="score" onBack={() => go('Learn')} backLabel="Home" initialView={scoreView} onView={(v) => { if (v === 'score' || v === 'history') setScoreView(v); }} onQuick={() => go('Quick')} onModes={() => go('Modes')} />}
            {page === 'Club' && <ClubScreen key={shownClubTick} startMode={clubMode} onBack={() => go('Learn')} backLabel="Home" initialView={clubView} onView={setClubView} />}
            {page === 'Play' && <PlayLobby onDeal={dealMeIn} onStartSeries={startSeriesPlay} onResume={resumeTable} onMe={() => openMe('overview')} onLearn={openRules} onFriends={() => go(loadSeat() ? 'Online' : 'Friends')} />}
            {page === 'Friends' && <FriendsTable key={inviteCode} initialCode={inviteCode} onOpenCode={openCode} onBack={() => { setInviteCode(''); go('Play'); }} onSeated={() => { setInviteCode(''); go('Online'); }} />}
            {page === 'Online' && <OnlineTable onLeave={() => go('Play')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onReplay={openReplay} />}
            {page === 'Table' && <TableGame key={table.deal} opponents={table.opponents} level={table.level} resume={table.resume ? readActiveTable() : null} seatNames={table.resume ? undefined : table.names} onExit={() => go('Play')} onChange={() => go('Play')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onReplay={openReplay} />}
            {page === 'Series' && seriesRun && <SeriesPlay key={seriesRun.run} setup={seriesRun.setup} onTable={setSeriesAtTable} onExit={() => go('Play')} onChange={() => go('Play')} onMe={() => openMe('overview')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} />}
            {page === 'Me' && <MePage key={meSection} initialSection={meSection} onPlay={() => go('Play')} onClub={() => openClub('stats')} onPrivacy={() => go('Privacy')} onReplay={openReplay} onBack={() => go('Learn')} />}
            {page === 'Replay' && replayOf && <ReplayScreen gameId={replayOf.id} onBack={() => (replayOf.back === 'Me' ? openMe('overview') : go(replayOf.back))} />}
            {page === 'Tutorial' && <GuidedGame onExit={() => go('Rules')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onOpenPuzzles={() => go('Puzzles')} onPlayForReal={() => go('Play')} onStatusChange={onGameStatus} />}
            {page === 'Quick' && <QuickNight onBack={() => openScore('score')} onHistory={() => openClub('history')} />}
            {page === 'Watch' && <WatchNight key={nightCode} initialCode={nightCode} initialAs={nightCode === urlNight ? urlAs : ''} onOpenCode={openCode} onBack={() => go('Learn')} />}
            {page === 'Puzzles' && <Puzzles key={puzzleMode} initialMode={puzzleMode} backLabel={learnBackLabel} onBack={() => go(learnBack)} onTutorial={startGuidedGame} />}
            {page === 'Privacy' && <Privacy onBack={() => openMe('overview')} />}
          </Suspense>
        </>}
        {page !== 'Tutorial' && page !== 'Table' && page !== 'Online' && !(page === 'Series' && seriesAtTable) && page !== 'Cards' && <Suspense fallback={null}><AppFooter page={page} onPrivacy={() => go('Privacy')} /></Suspense>}
      </main>
    </MobileScroll>
    {page === 'Learn' && <InstallBanner bottom={bottomInset + 92} />}
    <NightReminder open={planOpen} onOpenChange={setPlanOpen} />
    <BottomSheet open={arrived.length > 0 && page !== 'Watch'} onOpenChange={(open) => { if (!open) setArrived([]); }} title={arrived.length === 1 ? 'A result has come in' : `${arrived.length} results have come in`} description="From a night you joined with a code. Added to your history and stats." snap={0.5}>
      {arrived.length > 0 && <div className="confirm-sheet"><ul className="watch-results">{arrived.slice(0, 6).map((night) => <li key={night.id}><strong>{night.title}: {night.outcome}</strong><span>{night.formatLabel} · {new Date(night.completedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></li>)}</ul><button className="primary" onClick={() => { setArrived([]); go('Me'); }}>See my history</button><button className="secondary" onClick={() => setArrived([])}>Close</button></div>}
    </BottomSheet>
    <BottomSheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name || 'Card rule'}>
      {selected && <div className="rule-sheet"><Fan codes={selected.cards} /><p className="rule-lead">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={() => setSelected(null)}>Got it <CheckCircle size={19} /></button></div>}
    </BottomSheet>
  </div>;
}
