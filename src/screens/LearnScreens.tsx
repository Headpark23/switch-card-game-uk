import { useState } from 'react';
import { ArrowRight, Cards, CaretLeft, CheckCircle, Club, DownloadSimple, Lightbulb, MagnifyingGlass, PuzzlePiece, Question, X } from '@phosphor-icons/react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { modes, powers, ruleChapters, rules } from '../services/content';
import { Fan, FeltHeader, MiniFan } from '../components/ui';
import InstallButton from '../components/InstallButton';
import Referee from '../components/Referee';

const MODE_CARDS: Record<string, string[]> = {
  'One v One': ['AS', 'AH'],
  'Last One Out': ['2C', '8S', 'KS'],
  'Group Play': ['QH', 'QS', 'QC'],
  'Darts Scoring': ['3H', '3S', '3D'],
  'Domino Scoring': ['5D', '6D'],
  'Switch Cup': ['KH', 'KD'],
};

export function downloadRules() {
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

export function RulesScreen({
  onBack,
  onStartGuidedGame,
  onOpenCards,
  onOpenPuzzles,
  onOpenQuestions,
  onSelectPower,
}: {
  onBack: () => void;
  onStartGuidedGame: () => void;
  onOpenCards: () => void;
  onOpenPuzzles: () => void;
  onOpenQuestions: () => void;
  onSelectPower: (power: (typeof powers)[number]) => void;
}) {
  const [ruleStep, setRuleStep] = useState(0);

  return <>
    <button className="text-link rules-back" onClick={onBack}><CaretLeft size={15} weight="bold" /> Home</button>
    <div className="rules-felt-wrap">
      <FeltHeader
        compact
        id="rule-story-title"
        title="Learn Switch in five moves."
        intro="A clear, visual guide from the first deal to the winning card. Practice here never counts towards your stats."
        cards={['AS', '2H', 'KS']}
      />
    </div>
    <section className="rule-narrative" aria-labelledby="rule-story-title">
      <div className="rule-steps" aria-label="Rule guide steps">
        {ruleChapters.map((chapter, index) => (
          <button
            key={chapter.number}
            className={ruleStep === index ? 'active' : ''}
            aria-current={ruleStep === index ? 'step' : undefined}
            onClick={() => setRuleStep(index)}
          >
            <span>{chapter.number}</span>
            <small>{index === 0 ? 'Deal' : index === 1 ? 'Play' : index === 2 ? 'Power' : index === 3 ? 'Call' : 'Win'}</small>
          </button>
        ))}
      </div>
      <article className="rule-chapter">
        <div className="rule-chapter-head">
          <div><h3>{ruleChapters[ruleStep].title}</h3></div>
          <Fan codes={ruleChapters[ruleStep].cards} />
        </div>
        <p className="rule-chapter-body">{ruleChapters[ruleStep].body}</p>
        <ul>
          {ruleChapters[ruleStep].points.map((point) => (
            <li key={point}><CheckCircle size={17} weight="fill" /><span>{point}</span></li>
          ))}
        </ul>
        <aside><Lightbulb size={18} weight="fill" /><span>{ruleChapters[ruleStep].tip}</span></aside>
        <div className="rule-controls">
          <button className="secondary" disabled={ruleStep === 0} onClick={() => setRuleStep((step) => step - 1)}>Previous</button>
          {ruleStep < ruleChapters.length - 1
            ? <button className="primary" onClick={() => setRuleStep((step) => step + 1)}>Next rule <ArrowRight size={17} /></button>
            : <button className="primary" onClick={onStartGuidedGame}>Play the guided game <ArrowRight size={17} /></button>}
        </div>
      </article>
      <div className="learn-links">
        <button onClick={onStartGuidedGame}><Cards size={19} weight="bold" /><span><strong>Guided practice game</strong><small>Hints and explanations on every move. Unranked.</small></span><ArrowRight size={16} /></button>
        <button onClick={onOpenCards}><Club size={19} weight="fill" /><span><strong>Every power card</strong><small>What each card does, and how to answer it</small></span><ArrowRight size={16} /></button>
        <button onClick={onOpenPuzzles}><PuzzlePiece size={19} weight="bold" /><span><strong>Rules puzzles</strong><small>Test yourself on tricky positions</small></span><ArrowRight size={16} /></button>
        <button onClick={onOpenQuestions}><Question size={19} weight="bold" /><span><strong>Need one answer?</strong><small>Search every rule in seconds</small></span><ArrowRight size={16} /></button>
      </div>
    </section>
    <section className="power-preview">
      <div className="ornament"><Club weight="fill" /></div>
      <h2>Know your power cards</h2>
      <p className="section-caption">The cards that change the game.</p>
      <div className="power-columns">
        {[powers[0], powers[2], powers[6]].map((p) => (
          <button key={p.name} onClick={() => onSelectPower(p)}>
            <Fan codes={p.cards} />
            <h3>{p.name}</h3>
            <p>{p.short}.</p>
            <span>View rule <ArrowRight size={12} /></span>
          </button>
        ))}
      </div>
    </section>
    <InstallButton />
    <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download all rules</button>
  </>;
}

export function CardsScreen({
  backLabel,
  onBack,
  onSelectPower,
}: {
  backLabel: string;
  onBack: () => void;
  onSelectPower: (power: (typeof powers)[number]) => void;
}) {
  return <>
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />{backLabel}</button>
    <FeltHeader compact title="Every card. Every possibility." intro="Tap a card to see its effect, defence and exceptions." cards={['KS', '2H', '8D']} />
    <div className="power-grid">
      {powers.map((p) => (
        <button key={p.name} onClick={() => onSelectPower(p)}>
          <Fan codes={p.cards.slice(0, 2)} />
          <span><strong>{p.name}</strong><small>{p.short}</small></span>
        </button>
      ))}
    </div>
  </>;
}

export function QuestionsScreen({
  backLabel,
  onBack,
}: {
  backLabel: string;
  onBack: () => void;
}) {
  const keyboard = useKeyboard();
  const [query, setQuery] = useState('');
  const result = rules.filter((r) => (r.q + ' ' + r.a).toLowerCase().includes(query.toLowerCase()));

  return <>
    <button className="text-link back-link" onClick={onBack}><CaretLeft size={15} weight="bold" />{backLabel}</button>
    <FeltHeader title="There’s a rule for that." intro="Quick answers, before the next card lands." cards={['AS', '7H']} />
    <Referee />
    <div className="dispute-chips" role="group" aria-label="Common disputes">
      {['ace', 'last card', 'jack', 'seven', 'king', 'two', 'eight', 'deck runs out'].map((chip) => (
        <button key={chip} className={query === chip ? 'active' : ''} onClick={() => { keyboard.hide(); setQuery(query === chip ? '' : chip); }}>
          {chip}
        </button>
      ))}
    </div>
    <div className="search">
      <MagnifyingGlass size={21} />
      <KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
    </div>
    <p className="results" aria-live="polite">{query ? `${result.length} matching ${result.length === 1 ? 'answer' : 'answers'}` : 'The essentials'}</p>
    <div className="answers">{result.map((r) => <details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>
    {!result.length && (
      <div className="empty">
        <Cards size={40} />
        <h2>No matching rule yet.</h2>
        <p>Try a card name such as “king”, or browse all the rules.</p>
        <button className="secondary" onClick={() => { keyboard.hide(); setQuery(''); }}>Show all rules</button>
      </div>
    )}
    <p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p>
    <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Keep a copy of the rules</button>
    <a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16} /></a>
  </>;
}

export function ModesScreen({ onOpenScore }: { onOpenScore: () => void }) {
  return <>
    <button className="text-link back-link" onClick={onOpenScore}><CaretLeft size={15} weight="bold" />Score</button>
    <FeltHeader title="Make a night of it." intro="Six ways to play. Tap any one to see what it means and how a night runs." cards={['QH', 'KC', 'JD']} />
    <button className="primary mode-score-cta" onClick={onOpenScore}>Open the Switch scorekeeper <ArrowRight size={18} /></button>
    <div className="mode-list">
      {modes.map((m) => (
        <details key={m.name}>
          <summary><MiniFan codes={MODE_CARDS[m.name] ?? ['AS', 'AH']} /><span><strong>{m.name}</strong><small>{m.label}</small></span></summary>
          <p>{m.text}</p>
          {m.how && <p className="mode-how"><strong>In plain English: </strong>{m.how}</p>}
        </details>
      ))}
    </div>
    <button className="download" onClick={downloadRules}><DownloadSimple size={20} />Download game-night rules</button>
  </>;
}
