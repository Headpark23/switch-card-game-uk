import { lazy, Suspense, useCallback, useLayoutEffect, useState } from 'react';
import { ArrowRight, BookOpen, Cards, PlayCircle, Trophy, Question, UsersThree, ChatCircle, Club, MagnifyingGlass, X, DownloadSimple, CheckCircle, Lightbulb } from '@phosphor-icons/react';
import WatchNight from './screens/WatchNight';
import Referee from './screens/Referee';
import NightReminder from './screens/NightReminder';
import { BottomSheet, KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import { modes, powers, ruleChapters, rules } from './content';
import { Fan } from './ui';
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

type Page = 'Learn' | 'Cards' | 'Modes' | 'Club' | 'Watch' | 'Questions' | 'Tutorial' | 'Score' | 'Quick' | 'Puzzles' | 'Privacy';

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
  const { bottomInset } = useKeyboardInsets();

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
  const closeWelcome = () => { setWelcome(false); try { window.localStorage.setItem('switchWelcome', 'done'); } catch { /* storage unavailable */ } };
  const openNight = (view: 'score' | 'stats' | 'leagues' | 'trophies' | 'history') => { setScoreView(view); go('Score'); };

  const result = rules.filter((r) => (r.q + ' ' + r.a).toLowerCase().includes(query.toLowerCase()));
  return <div className="switch-app" onFocusCapture={resetDeviceScroll}>
    <MobileScroll key={page} className="switch-scroll">
      <main className={'switch-content ' + (page === 'Learn' ? 'home' : 'interior') + (page === 'Tutorial' ? ' tutorial-page' : '')}>
        {page === 'Learn' ? <>
          {!rulesOpen && <>
          <section className="home-hub">
            <div className="wordmark"><Club weight="fill" /><div>SWITCH</div><p>RULES FOR A BETTER<br />GAME NIGHT</p></div>
            <h1>Know the rules.<br />Own the table.</h1>
            <p className="home-sub">{welcome ? 'New here? Start with the five moves.' : 'Where to next?'}</p>
            <div className="home-tiles">
              <button className={'home-tile learn' + (welcome ? ' start-here' : '')} onClick={() => { closeWelcome(); setRuleStep(0); setRulesOpen(true); }}><BookOpen size={26} weight="fill" /><strong>Learn the rules</strong><small>Five clear moves{welcome ? ' · start here' : ''}</small></button>
              <button className="home-tile" onClick={startGuidedGame}><Cards size={26} weight="fill" /><strong>Play against the computer</strong><small>Guided, with hints</small></button>
              <button className="home-tile" onClick={() => openNight('score')}><UsersThree size={26} weight="fill" /><strong>Start a game night</strong><small>Scores, leagues, cups</small></button>
              <button className="home-tile" aria-label="Quick night" onClick={() => go('Quick')}><Lightbulb size={26} weight="fill" /><strong>Quick night</strong><small>Real cards, 60 seconds</small></button>
            </div>
            <div className="night-shortcuts"><button className="text-link" onClick={() => openNight('stats')}>Stats</button><button className="text-link" onClick={() => openNight('leagues')}>Leagues</button><button className="text-link" onClick={() => openNight('history')}>History</button><button className="text-link" onClick={() => go('Puzzles')}>Puzzles</button><button className="text-link" onClick={() => setPlanOpen(true)}>Plan a night</button><button className="text-link" onClick={() => go('Watch')}>Join a night</button></div>
          </section>
          {(() => { const p = powers[new Date().getDate() % powers.length]; return <button className="home-daily" onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 3)} /><span><small>POWER CARD OF THE DAY</small><strong>{p.name}</strong><em>{p.short}</em><i>Tap to learn it <ArrowRight size={13} /></i></span></button>; })()}
          <AccountPanel home />
          </>}
          {rulesOpen && <>
          <button className="text-link rules-back" onClick={() => setRulesOpen(false)}><ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Home</button>
          <section className="rule-narrative" aria-labelledby="rule-story-title">
            <p className="eyebrow">THE MAIN EVENT</p>
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
          <section className="night-note"><p className="eyebrow">MAKE IT A GAME NIGHT</p><h2>A little friendly rivalry.</h2><p>From a quick head-to-head to your very own Switch Cup.</p><button className="text-link" onClick={() => go('Modes')}>Explore game modes <ArrowRight size={18} /></button></section>
          <InstallButton />
          <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download all rules</button>
          </>}
        </> : <>
          <header className="small-brand">
            <button onClick={() => go('Learn')} aria-label="Switch home"><Club weight="fill" size={20} /> SWITCH</button>
          </header>
          {page === 'Cards' && <>
            <p className="eyebrow">YOUR TABLE-SIDE REFERENCE</p><h1>Every card.<br />Every possibility.</h1><p className="intro">Tap a card to see its effect, defence and exceptions.</p>
            <div className="power-list">{powers.map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 2)} /><span><strong>{p.name}</strong><small>{p.short}</small></span><ArrowRight size={19} /></button>)}</div>
          </>}
          {page === 'Questions' && <>
            <p className="eyebrow">SETTLE THE DEBATE</p><h1>There’s a rule<br />for that.</h1><p className="intro">Quick answers, before the next card lands.</p>
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
            <p className="eyebrow">YOUR PEOPLE. YOUR GAME.</p><h1>Make a night<br />of it.</h1><p className="intro">Six ways to play. Tap any one to see what it means and how a night runs.</p>
            <button className="primary mode-score-cta" onClick={() => openNight('score')}>Open the Switch scorekeeper <ArrowRight size={18} /></button>
            <div className="mode-list">{modes.map((m, i) => <details key={m.name}><summary><span className="mode-number">0{i + 1}</span><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p>{m.how && <p className="mode-how"><strong>In plain English: </strong>{m.how}</p>}</details>)}</div>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download game-night rules</button>
          </>}
          <Suspense fallback={<Loading />}>
            {page === 'Score' && <SwitchScorekeeper onBack={() => go(scoreView === 'score' ? 'Modes' : 'Learn')} initialView={scoreView} onView={setScoreView} />}
            {page === 'Tutorial' && <GuidedGame onExit={() => go('Learn')} onOpenCards={() => go('Cards')} onStartNight={() => go('Quick')} onOpenPuzzles={() => go('Puzzles')} onStatusChange={onGameStatus} />}
            {page === 'Quick' && <QuickNight onBack={() => go('Learn')} onHistory={() => openNight('history')} />}
            {page === 'Watch' && <WatchNight initialCode={urlNight} onBack={() => go('Learn')} />}
            {page === 'Puzzles' && <Puzzles onBack={() => go('Learn')} onTutorial={startGuidedGame} />}
            {page === 'Privacy' && <Privacy onBack={() => go('Learn')} />}
          </Suspense>
        </>}
        {page !== 'Tutorial' && !rulesOpen && <Suspense fallback={null}><AppFooter page={page} onPrivacy={() => go('Privacy')} /></Suspense>}
      </main>
    </MobileScroll>
    <nav className="bottom-tabs" aria-label="Main navigation" style={{ bottom: bottomInset }}>
      {([{ name: 'Learn', label: 'Rules', Icon: BookOpen }, { name: 'Cards', label: 'Cards', Icon: Cards }, { name: 'Modes', label: 'Play', Icon: PlayCircle }, { name: 'Club', label: 'Club', Icon: Trophy }, { name: 'Questions', label: 'Questions', Icon: Question }] as const).map(({ name, label, Icon }) => {
        const clubView = page === 'Score' && scoreView !== 'score';
        const active = name === 'Club' ? clubView
          : page === name || (name === 'Learn' && (page === 'Tutorial' || page === 'Puzzles' || page === 'Watch')) || (name === 'Modes' && (page === 'Quick' || (page === 'Score' && !clubView)));
        const open = () => { if (name === 'Club') openNight(scoreView === 'score' ? 'stats' : scoreView); else go(name); };
        return <button key={name} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={open}><span className="tab-icon"><Icon weight={active ? 'fill' : 'regular'} size={23} /></span><span className="tab-label">{label}</span></button>;
      })}
    </nav>
    {page === 'Learn' && !rulesOpen && <InstallBanner bottom={bottomInset + 76} />}
    <NightReminder open={planOpen} onOpenChange={setPlanOpen} />
    <BottomSheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name || 'Card rule'}>
      {selected && <div className="rule-sheet"><Fan codes={selected.cards} /><p className="eyebrow">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={() => setSelected(null)}>Got it <CheckCircle size={19} /></button></div>}
    </BottomSheet>
  </div>;
}
