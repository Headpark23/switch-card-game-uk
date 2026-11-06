import { lazy, Suspense, useCallback, useLayoutEffect, useState } from 'react';
import { ArrowRight, BookOpen, Cards, UsersThree, ChatCircle, Club, MagnifyingGlass, X, Crown, DownloadSimple, CheckCircle, Lightbulb } from '@phosphor-icons/react';
import { BottomSheet, KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import { modes, powers, ruleChapters, rules } from './content';
import { AdSlot, Fan } from './ui';
import { enableOffline } from './offline';
import InstallButton from './InstallButton';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';

enableOffline();

// The game screens are loaded on demand so the rules pages open quickly.
const GuidedGame = lazy(() => import('./screens/GuidedGame'));
const SwitchScorekeeper = lazy(() => import('./screens/Scorekeeper'));

type Page = 'Learn' | 'Cards' | 'Modes' | 'Questions' | 'Tutorial' | 'Score';

/**
 * The demonstration ad slots and ad-free preview are not a real product yet,
 * so they appear only in development builds. Switch them on here when the
 * business model is ready.
 */
const SHOW_MONETISATION_PREVIEW = import.meta.env.DEV;

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
  const [page, setPage] = useState<Page>('Learn');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<(typeof powers)[number] | null>(null);
  const [membership, setMembership] = useState(false);
  const [adFree, setAdFree] = useState(false);
  const [ruleStep, setRuleStep] = useState(0);
  const [scrollKey, setScrollKey] = useState('');
  const [scoreView, setScoreView] = useState<'score' | 'stats' | 'leagues' | 'history'>('score');
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
  }, [page, selected, membership]);
  // A new game screen starts at the top. The scroll area is not remounted, so game state survives.
  useLayoutEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-testid="mobile-scroll"]');
    if (scroller) scroller.scrollTop = 0;
  }, [scrollKey]);

  const onGameStatus = useCallback((key: string) => setScrollKey(key), []);

  function go(next: Page) {
    keyboard.hide();
    setPage(next);
    setQuery('');
    setScrollKey('');
  }
  const startGuidedGame = () => go('Tutorial');
  const openNight = (view: 'score' | 'stats' | 'leagues' | 'history') => { setScoreView(view); go('Score'); };

  const result = rules.filter((r) => (r.q + ' ' + r.a).toLowerCase().includes(query.toLowerCase()));
  const ads = SHOW_MONETISATION_PREVIEW ? <AdSlot hidden={adFree} /> : null;

  return <div className="switch-app" onFocusCapture={resetDeviceScroll}>
    <MobileScroll key={page} className="switch-scroll">
      <main className={'switch-content ' + (page === 'Learn' ? 'home' : 'interior') + (page === 'Tutorial' ? ' tutorial-page' : '')}>
        {page === 'Learn' ? <>
          <section className="rules-banner">
            <div className="wordmark"><Club weight="fill" /><div>SWITCH</div><p>RULES FOR A BETTER<br />GAME NIGHT</p></div>
            <p className="eyebrow">THE COMPLETE GUIDE</p>
            <h1>Know the rules.<br />Own the table.</h1>
            <p>Five clear steps, then a guided game to put them into practice.</p>
            <button className="primary" onClick={() => openNight('score')}>Start a game night <ArrowRight size={19} /></button>
            <div className="night-shortcuts"><button className="text-link" onClick={() => openNight('stats')}>Stats</button><button className="text-link" onClick={() => openNight('leagues')}>Leagues</button><button className="text-link" onClick={() => openNight('history')}>History</button></div>
            <button className="secondary practise" onClick={startGuidedGame}>Play against the computer</button>
          </section>
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
          {ads}
          <section className="night-note"><p className="eyebrow">MAKE IT A GAME NIGHT</p><h2>A little friendly rivalry.</h2><p>From a quick head-to-head to your very own Switch Cup.</p><button className="text-link" onClick={() => go('Modes')}>Explore game modes <ArrowRight size={18} /></button></section>
          {SHOW_MONETISATION_PREVIEW && <button className="member-strip" onClick={() => setMembership(true)}><Crown size={24} /><span>More time at the table<small>Explore an ad-free experience</small></span><ArrowRight size={20} /></button>}
          <InstallButton />
          <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download all rules</button>
        </> : <>
          <header className="small-brand">
            <button onClick={() => go('Learn')} aria-label="Switch home"><Club weight="fill" size={20} /> SWITCH</button>
            {SHOW_MONETISATION_PREVIEW && <button aria-label="Explore ad-free preview" onClick={() => setMembership(true)}><Crown size={22} /></button>}
          </header>
          {page === 'Cards' && <>
            <p className="eyebrow">YOUR TABLE-SIDE REFERENCE</p><h1>Every card.<br />Every possibility.</h1><p className="intro">Tap a card to see its effect, defence and exceptions.</p>
            <div className="power-list">{powers.map((p) => <button key={p.name} onClick={() => setSelected(p)}><Fan codes={p.cards.slice(0, 2)} /><span><strong>{p.name}</strong><small>{p.short}</small></span><ArrowRight size={19} /></button>)}</div>
            {ads}
          </>}
          {page === 'Questions' && <>
            <p className="eyebrow">SETTLE THE DEBATE</p><h1>There’s a rule<br />for that.</h1><p className="intro">Quick answers, before the next card lands.</p>
            <div className="search"><MagnifyingGlass size={21} /><KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</div>
            <p className="results" aria-live="polite">{query ? `${result.length} matching ${result.length === 1 ? 'answer' : 'answers'}` : 'THE ESSENTIALS'}</p>
            <div className="answers">{result.map((r) => <details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>
            {!result.length && <div className="empty"><Cards size={40} /><h2>No matching rule yet.</h2><p>Try a card name such as “king”, or browse all the rules.</p><button className="secondary" onClick={() => { keyboard.hide(); setQuery(''); }}>Show all rules</button></div>}
            <p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p>
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Keep a copy of the rules</button>
            <InstallButton />
            <a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16} /></a>
            {ads}
          </>}
          {page === 'Modes' && <>
            <p className="eyebrow">YOUR PEOPLE. YOUR GAME.</p><h1>Make a night<br />of it.</h1><p className="intro">Six ways to play. One great card game.</p>
            <button className="primary mode-score-cta" onClick={() => openNight('score')}>Open the Switch scorekeeper <ArrowRight size={18} /></button>
            <div className="mode-list">{modes.map((m, i) => <details key={m.name}><summary><span className="mode-number">0{i + 1}</span><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p></details>)}</div>
            {ads}
            <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download game-night rules</button>
          </>}
          <Suspense fallback={<Loading />}>
            {page === 'Score' && <SwitchScorekeeper onBack={() => go('Modes')} initialView={scoreView} />}
            {page === 'Tutorial' && <GuidedGame onExit={() => go('Learn')} onOpenCards={() => go('Cards')} onStatusChange={onGameStatus} />}
          </Suspense>
        </>}
      </main>
    </MobileScroll>
    <nav className="bottom-tabs" aria-label="Main navigation" style={{ bottom: bottomInset }}>
      {([{ name: 'Learn', label: 'Rules', Icon: BookOpen }, { name: 'Cards', label: 'Cards', Icon: Cards }, { name: 'Modes', label: 'Modes', Icon: UsersThree }, { name: 'Questions', label: 'Questions', Icon: ChatCircle }] as const).map(({ name, label, Icon }) => {
        const active = page === name || (name === 'Learn' && page === 'Tutorial') || (name === 'Modes' && (page === 'Score'));
        return <button key={name} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => go(name)}><Icon weight={active ? 'fill' : 'regular'} size={26} /><span>{label}</span></button>;
      })}
    </nav>
    <BottomSheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name || 'Card rule'}>
      {selected && <div className="rule-sheet"><Fan codes={selected.cards} /><p className="eyebrow">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={() => setSelected(null)}>Got it <CheckCircle size={19} /></button></div>}
    </BottomSheet>
    {SHOW_MONETISATION_PREVIEW && <BottomSheet open={membership} onOpenChange={setMembership} title="A little more Switch" description="A preview of possible paid extras. No purchase or charge.">
      <div className="membership"><Crown size={38} weight="light" /><h2>Keep the good<br />times going.</h2><p>An ad-free experience, printable game-night packs and custom table themes are options for a future Switch Club.</p><div className="preview-label">INTERACTIVE PREVIEW</div><button className="primary" onClick={() => { setAdFree(!adFree); setMembership(false); }}>{adFree ? 'Restore demo ads' : 'Preview without ads'} <ArrowRight size={18} /></button><p className="fine-print">This changes the preview only. Paid plans are not available yet.</p></div>
    </BottomSheet>}
  </div>;
}
