import { useState } from 'react';
import { firstToPlay, type DealerState } from '../switch/dealer';

/**
 * Who deals, who plays first, and a button to pass the deal clockwise. This is the thing that gets forgotten at a real table,
 * so it sits at the top of every game: picked at the start, passed on automatically as results are logged.
 */
export default function DealerBar({ dealer, nameOf, onPass, onPick, title = 'Dealer' }: { dealer: DealerState; nameOf: (id: string) => string; onPass: () => void; onPick: (id: string) => void; title?: string }) {
  const [changing, setChanging] = useState(false);
  return <div className="dealer-bar" role="group" aria-label={`${title}: ${nameOf(dealer.dealerId)}`}>
    <span className="dealer-card" aria-hidden="true">D</span>
    <div>
      <small>{title} · deal {dealer.deal}</small>
      <strong>{nameOf(dealer.dealerId)}</strong>
      <em>{nameOf(firstToPlay(dealer))} plays first</em>
      {changing && <span className="dealer-pick">{dealer.seats.map((id) => <button key={id} className={id === dealer.dealerId ? 'on' : ''} aria-pressed={id === dealer.dealerId} onClick={() => { onPick(id); setChanging(false); }}>{nameOf(id)}</button>)}</span>}
    </div>
    <span className="dealer-actions" style={{ display: 'grid', gap: 4 }}>
      <button onClick={onPass}>Pass the deal</button>
      <button onClick={() => setChanging((open) => !open)} aria-expanded={changing}>{changing ? 'Close' : 'Change'}</button>
    </span>
  </div>;
}
