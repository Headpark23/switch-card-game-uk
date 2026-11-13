import { lazy, Suspense, useCallback, useLayoutEffect, useState } from 'react';
import { ArrowRight, House, Cards, Club, MagnifyingGlass, X, DownloadSimple, CheckCircle, Lightbulb, UserCircle, UsersThree, ListNumbers, PuzzlePiece, Question, CaretLeft } from '@phosphor-icons/react';
import { readActiveTable } from './switch/activeTable';
import type { ComputerLevel } from './switch/ai';
import WatchNight from './screens/WatchNight';
import Referee from './screens/Referee';
import NightReminder from './screens/NightReminder';
import { BottomSheet, KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import { modes, powers, ruleChapters, rules } from './content';
import { Fan, FeltHeader, MiniFan } from './ui';
import { enableOffline } from './offline';
import InstallButton, { InstallBanner } from './InstallButton';
import { AccountPanel } from './AccountPanel';
import HomeHub from './screens/HomeHub';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';

enableOffline();

// The game screens are loaded on demand so the rules pages open quickly.
const GuidedGame = lazy(() => import('./screens/GuidedGame'));
const SwitchScorekeeper = lazy(() => import('./screens/Scorekeeper'));
const QuickNight = lazy(() => import('./screens/QuickNight'));
const Puzzles = lazy(() => import('./screens/Puzzles'));
const Privacy = lazy(() => import('./screens/Privacy'));
const AppFooter = lazy(() => import('./screens/AppFooter'));
const PlayLobby = lazy(() => import('./screens/PlayLobby'));
const TableGame = lazy(() => import('./screens/TableGame'));
const MePage = lazy(() => import('./screens/MePage'));

/** Each way to play gets its own little hand of cards in place of a number or an icon. */
const MODE_CARDS: Record<string, string[]> = {
  'One v One': ['AS', 'AH'],
  'Knock Out': ['2C', '8S', 'KS'],
  'Group Play': ['QH', 'QS', 'QC'],
  'Darts Scoring': ['3H', '3S', '3D'],
  'Domino Scoring': ['5D', '6D'],
  'Switch Cup': ['KH', 'KD'],
};

type Page = 'Learn' | 'Rules' | 'Cards' | 'Modes' | 'Watch' | 'Questions' | 'Tutorial' | 'Score' | 'Club' | 'Quick' | 'Puzzles' | 'Privacy' | 'Play' | 'Table' | 'Me';
type ScoreView = 'score' | 'stats' | 'leagues' | 'trophies' | 'history';
type Tab = 'Home' | 'Play' | 'Score' | 'Club' | 'Me';

/** Which of the five destinations each screen belongs to, so the bottom bar always shows where you are. Learning lives under Home, apart from competitive play. */
const SECTION: Record<Page, Tab> = {
  Learn: 'Home', Rules: 'Home', Cards: 'Home', Questions: 'Home', Tutorial: 'Home', Puzzles: 'Home', Watch: 'Home',
  Play: 'Play', Table: 'Play',
  Score: 'Score', Quick: 'Score', Modes: 'Score',
  Club: 'Club',
  Me: 'Me', Privacy: 'Me',
};

function downloadRules() {
  const text = 'SWITCH — Rules for a better game night\n\n'
    + rules.map((r) => r.q + '\n' + r.a).join('\n\n')
    + '\n\nPOWER CARDS\n\n' + powers.map((p) => p.name + '\n' + p.text + ' ' + p.extra).join('\n\n')
    + '\n\nGAME MODES\n\n' + modes.map((m) => m.name + '\n' + m.text).join('\n\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'switch-rules.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TABS: readonly { tab: Tab; label: string; Icon: typeof House; pip: string }[] = [
  { tab: 'Home', label: 'Home', Icon: House, pip: '♠' },
  { tab: 'Play', label: 'Play', Icon: Cards, pip: '♥' },
  { tab: 'Score', label: 'Score', Icon: ListNumbers, pip: '♣' },
  { tab: 'Club', label: 'Club', Icon: UsersThree, pip: '♦' },
  { tab: 'Me', label: 'Me', Icon: UserCircle, pip: '♠' },
];

function Loading() {
  return <p className="house-note" role="status">Loading…</p>;
}

export default function Prototype() {
  const urlNight = (() => { try { return (new URLSearchParams(window.location.search).get('night') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); } catch { return ''; } })();
  const [page, setPage] = useState<Page>(urlNight ? 'Watch' : 'Learn');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<(typeof powers)[number] | null>(null);
  const [ruleStep, setRuleStep] = useState(0);
  const [scrollKey, setScrollKey] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [scoreView, setScoreView] = useState<ScoreView>('score');
  const [clubView, setClubView] = useState<ScoreView>('stats');
  const [meSection, setMeSection] = useState<'overview' | 'badges'>('overview');
  const [table, setTable] = useState<{ opponents: number; level: ComputerLevel; resume: boolean; deal: number }>({ opponents: 2, level: 'standard', resume: false, deal: 0 });
  /** Where a learning page goes back to: the rules guide, or Home when it was opened from Home. */
  const [learnBack, setLearnBack] = useState<'Learn' | 'Rules'>('Learn');
  const keyboard = useKeyboard();
  const { bottomInset, isKeyboardVisible } = useKeyboardInsets();

  const resetDeviceScroll = () => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
    if (screen) screen.scrollTop = 0;
  };
  useLayoutEffect(() => {
    resetDeviceScroll();
    const frame = requestAnimationFrame(resetDeviceScroll);
    return () => cancelAnimationFrame(frame);
  }, [page, selected]);
  // A new game screen starts at the top. The scroll area is not remounted, so game state survives.
  useLayoutEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-testid="mobile-scroll"]');
    if (scroller) scroller.scrollTop = 0;
  }, [scrollKey]);

  const onGameStatus = useCallback((key: string) => setScrollKey(key), []);

  function go(next: Page) {
    keyboard.hide();
    if (next === 'Rules' || next === 'Learn') setLearnBack(next);
    setPage(next);
    setQuery('');
    setScrollKey('');
  }
  const openRules = () => { try { window.localStorage.setItem('switchWelcome', 'done'); } catch { /* storage unavailable */ } setRuleStep(0); go('Rules'); };
  const startGuidedGame = () => go('Tutorial');
  const dealMeIn = (opponents: number, level: ComputerLevel) => { setTable((current) => ({ opponents, level, resume: false, deal: current.deal + 1 })); go('Table'); };
  const resumeTable = () => {
    const saved = readActiveTable();
    if (!saved) { go('Play'); return; }
    setTable((current) => ({ opponents: saved.opponents, level: saved.level, resume: true, deal: current.deal + 1 }));
    go('Table');
  };
  const openScore = (view: ScoreView = 'score') => { setScoreView(view); go('Score'); };
  const openClub = (view: ScoreView = clubView) => { setClubView(view); go('Club'); };
  const openMe = (section: 'overview' | 'badges' = 'overview') => { setMeSection(section); go('Me'); };
  const openTab = (tab: Tab) => {
    if (tab === 'Home') go('Learn');
    else if (tab === 'Play') go('Play');
    else if (tab === 'Score') openScore(page === 'Score' ? scoreView : 'score');
    else if (tab === 'Club') openClub();
    else openMe('overview');
  };
  const section = SECTION[page];
  const learnBackLink = <button className="text-link back-link" onClick={() => go(learnBack)}><CaretLeft size={15} weight="bold" />{learnBack === 'Rules' ? 'Learn the rules' : 'Home'}</button>;

  const result = rules.filter((r) => (r.q + ' ' + r.a).toLowerCase().includes(query.toLowerCase()));
  return <div className="switch-app" onFocusCapture={resetDeviceScroll} data-section={section}>
    <MobileScroll key={page} className="switch-scroll">
      <main className={'switch-content ' + (page === 'Learn' ? 'home' : 'interior') + (page === 'Tutorial' || page === 'Table' ? ' tutorial-page' : '') + (page === 'Cards' ? ' cards-page' : '') + (page === 'Rules' ? ' rules-page' : '')}>
        {page === 'Learn' && <>
          <HomeHub onPlay={() => go('Play')} onResumeTable={resumeTable} onScore={() => openScore('score')} onClub={() => openClub('stats')} onAchievements={() => openMe('badges')} onRules={openRules} onPuzzles={() => go('Puzzles')} onQuestions={() => go('Questions')} onPlan={() => setPlanOpen(true)} onJoin={() => go('Watch')} onHistory={() => openClub('history')} onPower={setSelected} />
          <AccountPanel home />
        </>}
        {page === 'Rules' && <>
          <button className="text-link rules-back" onClick={() => go('Learn')}><CaretLeft size={15} weight="bold" /> Home</button>
          <section className="rule-narrative" aria-labelledby="rule-story-title">
            <h2 id="rule-story-title">Learn Switch<br />in five moves.</h2>
            <p className="rule-intro">A clear, visual guide from the first deal to the winning card. Practice here never counts towards your stats.</p>
            <div className="rule-steps" aria-label="Rule guide steps">
              {ruleChapters.map((chapter, index) => <button key={chapter.number} className={ruleStep === index ? 'active' : ''} aria-current={ruleStep === index ? 'step' : undefined} onClick={() => setRuleStep(index)}><span>{chapter.number}</span><small>{index === 0 ? 'Deal' : index === 1 ? 'Play' : index === 2 ? 'Power' : index === 3 ? 'Call' : 'Win'}</small></button>)}
            </div>
            <article className="rule-chapter">
              <div className="rule-chapter-head"><div><p>{ruleChapters[ruleStep].eyebrow}</p><h3>{ruleChapters[ruleStep].title}</h3></div><Fan codes={ruleChapters[ruleStep].cards} /></div>
              <p className="rule-chapter-body">{ruleChapters[ruleStep].body}</p>
              <ul>{ruleChapters[ruleStep].points.map((point) => <li key={point}><CheckCircle size={17} weight="fill" /><span>{point}</span></li>)}</ul>
              <aside><Lightbulb size={18} weight="fill" /><span>{ruleChapters[ruleStep].tip}</span></aside>
              <div className="rule-controls">
                <button className="secondary" disabled={ruleStep === 0} onClick={() => setRuleStep((step) => step - 1)}>Previous</button>
                {ruleStep < ruleChapters.length - 1
                  ? <button className="primary" onClick={() => setRuleStep((step) => step + 1)}>Next rule <ArrowRight size={17} /></button>
                  : <button className="primary" onClick={startGuidedGame}>Play the guided game <ArrowRight size={17} /></button>}
              </div>
            </article>
            <div className="learn-links">
              <button onClick={startGuidedGame}><Cards size={19} weight="bold" /><span><strong>Guided practice game</strong><small>Hints and explanations on every move. Unranked.</small></span><ArrowRight size={16} /></button>
              <button onClick={() => go('Cards')}><Club size={19} weight="fill" /><span><strong>Every power card</strong><small>What each card does, and how to answer it</small></span><ArrowRight size={16} /></button>
              <button onClick={() => go('Puzzles')}><PuzzlePiece size={19} weight="bold" /><span><strong>Rules puzzles</strong><small>Test yourself on tricky positions</small></span><ArrowRight size={16} /></button>
              <button onClick={() => go('Questions')}><Question size={19} weight="bold" /><span><strong>Need one answer?</strong><small>Search every rule in seconds</small></span><ArrowRight size={16} /></button>
            </div>
          </section>
          <section className="power-preview">
            <div className="ornament"><Club weight="fill" /></div>
            <h2>Know your power cards</h2>
            <p className="section-caption">The cards that change the game.</p>
            <div className="power-columns">{[powers[0], powers[2], powers[6]].map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards} /><h3>{p.name}</h3><p>{p.short}.</p><span>View rule <ArrowRight size={12} /></span></button>)}</div>
          </section>
          <InstallButton />
          <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download all rules</button>
        </>}
        {page !== 'Learn' && page !== 'Rules' && <>
          <header className={'small-brand' + (page === 'Cards' ? ' hidden-brand' : '')}>
            <button onClick={() => go('Learn')} aria-label="Switch home"><Club weight="fill" size={20} /> SWITCH</button>
          </header>
          {page === 'Cards' && <>
            {learnBackLink}
            <FeltHeader compact title="Every card. Every possibility." intro="Tap a card to see its effect, defence and exceptions." cards={['KS', '2H', '8D']} />
            <div className="power-grid">{powers.map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 2)} /><span><strong>{p.name}</strong><small>{p.short}</small></span></button>)}</div>
          </>}
          {page === 'Questions' && <>
            {learnBackLink}
            <FeltHeader title="There’s a rule for that." intro="Quick answers, before the next card lands." cards={['AS', '7H']} />
            <Referee />
            <div className="dispute-chips" role="group" aria-label="Common disputes">{['ace', 'last card', 'jack', 'seven', 'king', 'two', 'eight', 'deck runs out'].map((chip) => <button key={chip} className={query === chip ? 'active' : ''} onClick={() => { keyboard.hide(); setQuery(query === chip ? '' : chip); }}>{chip}</button>)}</div>
            <div className="search"><MagnifyingGlass size={21} /><KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</div>
            <p className="results" aria-live="polite">{query ? `${result.length} matching ${result.length === 1 ? 'answer' : 'answers'}` : 'THE ESSENTIALS'}</p>
            <div className="answers">{result.map((r) => <details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>
            {!result.length && <div className="empty"><Cards size={40} /><h2>No matching rule yet.</h2><p>Try a card name such as “king”, or browse all the rules.</p><button className="secondary" onClick={() => { keyboard.hide(); setQuery(''); }}>Show all rules</button></div>}
            <p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Keep a copy of the rules</button>
            <a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16} /></a>
          </>}
          {page === 'Modes' && <>
            <button className="text-link back-link" onClick={() => openScore('score')}><CaretLeft size={15} weight="bold" />Score</button>
            <FeltHeader title="Make a night of it." intro="Six ways to play. Tap any one to see what it means and how a night runs." cards={['QH', 'KC', 'JD']} />
            <button className="primary mode-score-cta" onClick={() => openScore('score')}>Open the Switch scorekeeper <ArrowRight size={18} /></button>
            <div className="mode-list">{modes.map((m) => <details key={m.name}><summary><MiniFan codes={MODE_CARDS[m.name] ?? ['AS', 'AH']} /><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p>{m.how && <p className="mode-how"><strong>In plain English: </strong>{m.how}</p>}</details>)}</div>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download game-night rules</button>
          </>}
          <Suspense fallback={<Loading />}>
            {page === 'Score' && <SwitchScorekeeper section="score" onBack={() => go('Learn')} backLabel="Home" initialView={scoreView} onView={setScoreView} onQuick={() => go('Quick')} onModes={() => go('Modes')} />}
            {page === 'Club' && <SwitchScorekeeper section="club" onBack={() => go('Learn')} backLabel="Home" initialView={clubView} onView={setClubView} />}
            {page === 'Play' && <PlayLobby onDeal={dealMeIn} onResume={resumeTable} onMe={() => openMe('overview')} onLearn={openRules} />}
            {page === 'Table' && <TableGame key={table.deal} opponents={table.opponents} level={table.level} resume={table.resume ? readActiveTable() : null} onExit={() => go('Play')} onChange={() => go('Play')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} />}
            {page === 'Me' && <MePage key={meSection} initialSection={meSection} onPlay={() => go('Play')} onClub={() => openClub('stats')} onPrivacy={() => go('Privacy')} />}
            {page === 'Tutorial' && <GuidedGame onExit={() => go('Rules')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onOpenPuzzles={() => go('Puzzles')} onPlayForReal={() => go('Play')} onStatusChange={onGameStatus} />}
            {page === 'Quick' && <QuickNight onBack={() => openScore('score')} onHistory={() => openClub('history')} />}
            {page === 'Watch' && <WatchNight initialCode={urlNight} onBack={() => go('Learn')} />}
            {page === 'Puzzles' && <Puzzles onBack={() => go(learnBack)} onTutorial={startGuidedGame} />}
            {page === 'Privacy' && <Privacy onBack={() => openMe('overview')} />}
          </Suspense>
        </>}
        {page !== 'Tutorial' && page !== 'Table' && page !== 'Cards' && <Suspense fallback={null}><AppFooter page={page} onPrivacy={() => go('Privacy')} /></Suspense>}
      </main>
    </MobileScroll>
    {/* While typing, the keyboard needs the room: the tab bar steps aside and returns when it closes. */}
    {!isKeyboardVisible && <nav className="bottom-tabs v2" aria-label="Main navigation" style={{ bottom: bottomInset, ['--nav-extend' as string]: `${bottomInset}px` }}>
      {TABS.map(({ tab, label, Icon, pip }) => {
        const active = section === tab;
        return <button key={tab} className={active ? 'active' : ''} data-tab={tab} aria-current={active ? 'page' : undefined} onClick={() => openTab(tab)}><span className="tab-card"><i className={'pip' + (pip === '♥' || pip === '♦' ? ' red' : '')} aria-hidden="true">{pip}</i><Icon weight={active ? 'fill' : 'bold'} size={19} /></span><span className="tab-label">{label}</span></button>;
      })}
    </nav>}
    {page === 'Learn' && <InstallBanner bottom={bottomInset + 92} />}
    <NightReminder open={planOpen} onOpenChange={setPlanOpen} />
    <BottomSheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name || 'Card rule'}>
      {selected && <div className="rule-sheet"><Fan codes={selected.cards} /><p className="rule-lead">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={() => setSelected(null)}>Got it <CheckCircle size={19} /></button></div>}
    </BottomSheet>
  </div>;
}
