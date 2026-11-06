import { ArrowRight, Cards } from '@phosphor-icons/react';
import { useState } from 'react';

const steps = [
  'Find a standard 52-card pack. No jokers.',
  'Shuffle once and deal 7 cards to every player (2 to 6 people).',
  'Turn over one card to start the pile. If it is an ace, 2, 7, 8, jack or king, tuck it back and turn another.',
  'The player after the dealer goes first. Say "Last Card" when you are down to one!',
];

/** The bridge from practice to a real table: setup checklist, then straight into logging the night. */
export default function RealCards({ onStartNight }: { onStartNight: () => void }) {
  const [done, setDone] = useState<boolean[]>(steps.map(() => false));
  return <section className="real-cards" aria-labelledby="real-title">
    <p className="eyebrow">NOW FOR THE REAL THING</p>
    <h2 id="real-title"><Cards size={22} weight="fill" /> Play it with real cards</h2>
    <p>Switch is best across a table. Tick off the setup, then keep score on your phone.</p>
    <ul>{steps.map((step, index) => <li key={step}><label><input type="checkbox" checked={done[index]} onChange={() => setDone((current) => current.map((value, i) => (i === index ? !value : value)))} /><span>{step}</span></label></li>)}</ul>
    <button className="primary" onClick={onStartNight}>Start tonight&apos;s game <ArrowRight size={18} /></button>
  </section>;
}
