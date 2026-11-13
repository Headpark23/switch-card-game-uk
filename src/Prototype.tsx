import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { readClub, updateClub } from './switch/clubStore';
import { recoverMyGames } from './switch/identity';
import { syncJoinedNights } from './switch/joinedNights';
import { flushSharedResults } from './switch/shareNight';
import type { SwitchNightRecord } from './switch/history';
import { ArrowRight, House, ChartBar, ClockCounterClockwise, PuzzlePiece, CalendarPlus, Broadcast, Cards, Trophy, Question, Club, MagnifyingGlass, X, DownloadSimple, CheckCircle, Lightbulb, IdentificationBadge, Play } from '@phosphor-icons/react';
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

/** The corner index of a playing card, so each home tile reads as an ace dealt onto the table. */
function TileIndex({ suit, flip = false }: { suit: string; flip?: boolean }) {
  return <span className={'tile-index' + (flip ? ' flip' : '')} aria-hidden="true"><b>A</b><i>{suit}</i></span>;
}

type Page = 'Learn' | 'Cards' | 'Modes' | 'Club' | 'Watch' | 'Questions' | 'Tutorial' | 'Score' | 'Quick' | 'Puzzles' | 'Privacy' | 'Play' | 'Table' | 'Me';

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

const TABS = [
  { name: 'Learn', label: 'Home', Icon: House, pip: '♠', hero: false },
  { name: 'Cards', label: 'Cards', Icon: Cards, pip: '♦', hero: false },
  { name: 'Play', label: 'Play', Icon: Play, pip: '♥', hero: true },
  { name: 'Club', label: 'Club', Icon: Trophy, pip: '♣', hero: false },
  { name: 'Me', label: 'Me', Icon: IdentificationBadge, pip: '♠', hero: false },
  { name: 'Questions', label: 'Questions', Icon: Question, pip: '♦', hero: false },
] as const;

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
  const [scoreView, setScoreView] = useState<'score' | 'stats' | 'leagues' | 'trophies' | 'history'>('score');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => { try { return window.localStorage.getItem('switchWelcome') !== 'done'; } catch { return false; } });
  const keyboard = useKeyboard();
  const { bottomInset, isKeyboardVisible } = useKeyboardInsets();
  // One-off repair: games left on the automatic "You" player rejoin the owner's real name.
  useState(() => { try { if (recoverMyGames(readClub())) updateClub((current) => recoverMyGames(current) ?? current); } catch { /* leave saved data alone */ } return 0; });
  // Results from nights this phone joined arrive here, even when they were saved while the app was closed.
  const [arrived, setArrived] = useState<SwitchNightRecord[]>([]);
  useEffect(() => {
    const check = () => { void flushSharedResults(); syncJoinedNights().then((added) => { if (added.length) setArrived((current) => [...added, ...current]); }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', check); };
  }, []);

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
    if (next === 'Learn') setRulesOpen(false);
    keyboard.hide();
    setPage(next);
    setQuery('');
    setScrollKey('');
  }
  const startGuidedGame = () => go('Tutorial');
  const dealMeIn = (opponents: number, level: ComputerLevel) => { setTable({ opponents, level }); go(opponents === 1 ? 'Tutorial' : 'Table'); };
  const closeWelcome = () => { setWelcome(false); try { window.localStorage.setItem('switchWelcome', 'done'); } catch { /* storage unavailable */ } };
  // Where the scorekeeper was opened from decides its back link and which bottom tab stays lit, so neither jumps while you switch sections inside it.
  const [scoreFrom, setScoreFrom] = useState<{ back: 'Learn' | 'Modes' | 'Play'; tab: 'Modes' | 'Club' }>({ back: 'Learn', tab: 'Modes' });
  const [table, setTable] = useState<{ opponents: number; level: ComputerLevel }>({ opponents: 2, level: 'standard' });
  const openNight = (view: 'score' | 'stats' | 'leagues' | 'trophies' | 'history', back: 'Learn' | 'Modes' | 'Play' = page === 'Modes' ? 'Modes' : page === 'Play' ? 'Play' : 'Learn') => { setScoreView(view); setScoreFrom({ back, tab: view === 'score' ? 'Modes' : 'Club' }); go('Score'); };

  const result = rules.filter((r) => (r.q + ' ' + r.a).toLowerCase().includes(query.toLowerCase()));
  return <div className="switch-app" onFocusCapture={resetDeviceScroll}>
    <MobileScroll key={page} className="switch-scroll">
      <main className={'switch-content ' + (page === 'Learn' ? 'home' : 'interior') + (page === 'Tutorial' || page === 'Table' ? ' tutorial-page' : '') + (page === 'Cards' ? ' cards-page' : '')}>
        {page === 'Learn' ? <>
          {!rulesOpen && <>
          <section className="home-hub">
            <div className="wordmark"><Club weight="fill" /><div>SWITCH</div><p>RULES FOR A BETTER<br />GAME NIGHT</p></div>
            <h1>Know the rules.<br />Own the table.</h1>
            <p className="home-sub">{welcome ? 'New here? Start with the five moves.' : 'Where to next?'}</p>
            <div className="home-tiles">
              <button className={'home-tile learn' + (welcome ? ' start-here' : '')} onClick={() => { closeWelcome(); setRuleStep(0); setRulesOpen(true); }}><TileIndex suit="♠" />{welcome && <em className="tile-flag">Start here</em>}<strong>Learn the rules</strong><small>Five clear moves</small><TileIndex suit="♠" flip /></button>
              <button className="home-tile red" onClick={startGuidedGame}><TileIndex suit="♥" /><strong>Play against the computer</strong><small>Guided, with hints</small><TileIndex suit="♥" flip /></button>
              <button className="home-tile" onClick={() => openNight('score')}><TileIndex suit="♣" /><strong>Start a game night</strong><small>Scores, leagues, cups</small><TileIndex suit="♣" flip /></button>
              <button className="home-tile red" aria-label="Quick night" onClick={() => go('Quick')}><TileIndex suit="♦" /><strong>Quick night</strong><small>Real cards, 60 seconds</small><TileIndex suit="♦" flip /></button>
            </div>
            <div className="night-shortcuts"><button className="text-link" onClick={() => openNight('stats')}><ChartBar size={16} weight="bold" />Stats</button><button className="text-link" onClick={() => openNight('leagues')}><Trophy size={16} weight="bold" />Seasons</button><button className="text-link" onClick={() => openNight('history')}><ClockCounterClockwise size={16} weight="bold" />History</button><button className="text-link" onClick={() => go('Puzzles')}><PuzzlePiece size={16} weight="bold" />Puzzles</button><button className="text-link" onClick={() => setPlanOpen(true)}><CalendarPlus size={16} weight="bold" />Plan a night</button><button className="text-link" onClick={() => go('Watch')}><Broadcast size={16} weight="bold" />Join a night</button></div>
          </section>
          {(() => { const p = powers[new Date().getDate() % powers.length]; return <button className="home-daily" onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 3)} /><span><strong>{p.name}</strong><em>{p.short} · today’s power card</em><i>Tap to learn it <ArrowRight size={13} /></i></span></button>; })()}
          <AccountPanel home />
          </>}
          {rulesOpen && <>
          <button className="text-link rules-back" onClick={() => setRulesOpen(false)}><ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Home</button>
          <section className="rule-narrative" aria-labelledby="rule-story-title">
                        <h2 id="rule-story-title">Learn Switch<br />in five moves.</h2>
            <p className="rule-intro">A clear, visual guide from the first deal to the winning card.</p>
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
            <button className="rule-search-link" onClick={() => go('Questions')}><MagnifyingGlass size={19} /><span><strong>Need one answer?</strong><small>Search every rule in seconds</small></span><ArrowRight size={18} /></button>
          </section>
          <section className="power-preview">
            <div className="ornament"><Club weight="fill" /></div>
            <h2>Know your power cards</h2>
            <p className="section-caption">The cards that change the game.</p>
            <div className="power-columns">{[powers[0], powers[2], powers[6]].map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards} /><h3>{p.name}</h3><p>{p.short}.</p><span>View rule <ArrowRight size={12} /></span></button>)}</div>
          </section>
          <section className="night-note"><h2>A little friendly rivalry.</h2><p>From a quick head-to-head to your very own Switch Cup.</p><button className="text-link" onClick={() => go('Modes')}>Explore game modes <ArrowRight size={18} /></button></section>
          <InstallButton />
          <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download all rules</button>
          </>}
        </> : <>
          <header className={'small-brand' + (page === 'Cards' ? ' hidden-brand' : '')}>
            <button onClick={() => go('Learn')} aria-label="Switch home"><Club weight="fill" size={20} /> SWITCH</button>
          </header>
          {page === 'Cards' && <>
            <FeltHeader compact title="Every card. Every possibility." intro="Tap a card to see its effect, defence and exceptions." cards={['KS', '2H', '8D']} />
            <div className="power-grid">{powers.map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 2)} /><span><strong>{p.name}</strong><small>{p.short}</small></span></button>)}</div>
          </>}
          {page === 'Questions' && <>
            <FeltHeader title="There’s a rule for that." intro="Quick answers, before the next card lands." cards={['AS', '7H']} />
            <Referee />
            <div className="dispute-chips" role="group" aria-label="Common disputes">{['ace', 'last card', 'jack', 'seven', 'king', 'two', 'eight', 'deck runs out'].map((chip) => <button key={chip} className={query === chip ? 'active' : ''} onClick={() => { keyboard.hide(); setQuery(query === chip ? '' : chip); }}>{chip}</button>)}</div>
            <div className="search"><MagnifyingGlass size={21} /><KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</div>
            <p className="results" aria-live="polite">{query ? `${result.length} matching ${result.length === 1 ? 'answer' : 'answers'}` : 'THE ESSENTIALS'}</p>
            <div className="answers">{result.map((r) => <details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>
            {!result.length && <div className="empty"><Cards size={40} /><h2>No matching rule yet.</h2><p>Try a card name such as “king”, or browse all the rules.</p><button className="secondary" onClick={() => { keyboard.hide(); setQuery(''); }}>Show all rules</button></div>}
            <p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Keep a copy of the rules</button>
            <InstallButton />
            <button className="community" onClick={() => go('Privacy')}>Privacy: what stays on your phone <ArrowRight size={16} /></button>
            <a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16} /></a>
          </>}
          {page === 'Modes' && <>
            <FeltHeader title="Make a night of it." intro="Six ways to play. Tap any one to see what it means and how a night runs." cards={['QH', 'KC', 'JD']} />
            <button className="primary mode-score-cta" onClick={() => openNight('score')}>Open the Switch scorekeeper <ArrowRight size={18} /></button>
            <div className="mode-list">{modes.map((m, i) => <details key={m.name}><summary><MiniFan codes={MODE_CARDS[m.name] ?? ['AS', 'AH']} /><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p>{m.how && <p className="mode-how"><strong>In plain English: </strong>{m.how}</p>}</details>)}</div>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download game-night rules</button>
          </>}
          <Suspense fallback={<Loading />}>
            {page === 'Score' && <SwitchScorekeeper onBack={() => go(scoreFrom.back)} backLabel={scoreFrom.back === 'Modes' ? 'Ways to play' : scoreFrom.back === 'Play' ? 'Play' : 'Home'} initialView={scoreView} onView={setScoreView} />}
            {page === 'Play' && <PlayLobby onDeal={dealMeIn} onScore={() => openNight('score', 'Play')} onQuick={() => go('Quick')} onModes={() => go('Modes')} onMe={() => go('Me')} />}
            {page === 'Table' && <TableGame key={table.opponents + table.level} opponents={table.opponents} level={table.level} onExit={() => go('Play')} onChange={() => go('Play')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} />}
            {page === 'Me' && <MePage onPlay={() => go('Play')} onClub={() => openNight('stats', 'Learn')} />}
            {page === 'Tutorial' && <GuidedGame onExit={() => go('Play')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onOpenPuzzles={() => go('Puzzles')} onStatusChange={onGameStatus} />}
            {page === 'Quick' && <QuickNight onBack={() => go('Learn')} onHistory={() => openNight('history')} />}
            {page === 'Watch' && <WatchNight initialCode={urlNight} onBack={() => go('Learn')} />}
            {page === 'Puzzles' && <Puzzles onBack={() => go('Learn')} onTutorial={startGuidedGame} />}
            {page === 'Privacy' && <Privacy onBack={() => go('Learn')} />}
          </Suspense>
        </>}
        {page !== 'Tutorial' && page !== 'Table' && page !== 'Cards' && !rulesOpen && <Suspense fallback={null}><AppFooter page={page} onPrivacy={() => go('Privacy')} /></Suspense>}
      </main>
    </MobileScroll>
    {/* While typing, the keyboard needs the room: the tab bar steps aside and returns when it closes. */}
    {!isKeyboardVisible && <nav className="bottom-tabs" aria-label="Main navigation" style={{ bottom: bottomInset, ['--nav-extend' as string]: `${bottomInset}px` }}>
      {TABS.map(({ name, label, Icon, pip, hero }) => {
        const clubView = page === 'Score' && scoreFrom.tab === 'Club';
        const active = name === 'Club' ? clubView
          : name === 'Learn' ? page === 'Learn' || page === 'Puzzles' || page === 'Watch'
          : name === 'Play' ? page === 'Play' || page === 'Table' || page === 'Tutorial' || page === 'Quick' || page === 'Modes' || (page === 'Score' && !clubView)
          : name === 'Questions' ? page === 'Questions' || page === 'Privacy'
          : page === name;
        const open = () => { if (name === 'Club') openNight(page === 'Score' && scoreView !== 'score' ? scoreView : 'stats', 'Learn'); else go(name); };
        return <button key={name} className={(active ? 'active' : '') + (hero ? ' tab-play' : '')} data-pip={pip} aria-current={active ? 'page' : undefined} onClick={open}><span className="tab-card"><i className={'pip' + (pip === '♥' || pip === '♦' ? ' red' : '')} aria-hidden="true">{pip}</i><Icon weight={active || hero ? 'fill' : 'bold'} size={hero ? 25 : 20} /></span><span className="tab-label">{label}</span></button>;
      })}
    </nav>}
    {page === 'Learn' && !rulesOpen && <InstallBanner bottom={bottomInset + 92} />}
    <NightReminder open={planOpen} onOpenChange={setPlanOpen} />
    <BottomSheet open={arrived.length > 0 && page !== 'Watch'} onOpenChange={(open) => { if (!open) setArrived([]); }} title={arrived.length === 1 ? 'A result has come in' : `${arrived.length} results have come in`} description="From a night you joined with a code. Added to your history and stats." snap={0.5}>
      {arrived.length > 0 && <div className="confirm-sheet"><ul className="watch-results">{arrived.slice(0, 6).map((night) => <li key={night.id}><strong>{night.title}: {night.outcome}</strong><span>{night.formatLabel} · {new Date(night.completedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></li>)}</ul><button className="primary" onClick={() => { setArrived([]); go('Me'); }}>See my history</button><button className="secondary" onClick={() => setArrived([])}>Close</button></div>}
    </BottomSheet>
    <BottomSheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name || 'Card rule'}>
      {selected && <div className="rule-sheet"><Fan codes={selected.cards} /><p className="rule-lead">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={() => setSelected(null)}>Got it <CheckCircle size={19} /></button></div>}
    </BottomSheet>
  </div>;
}
