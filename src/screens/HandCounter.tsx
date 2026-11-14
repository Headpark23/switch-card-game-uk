import { useState } from 'react';
import { trackFeature } from '../switch/telemetry';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const value = (rank: string, aceHigh: boolean) => rank === 'A' ? (aceHigh ? 11 : 1) : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : Number(rank);

/** Tap the cards left in the losing hand and get the total, so nobody adds up on their fingers. */
export default function HandCounter({ aceHigh, players, onUse }: { aceHigh: boolean; players: readonly { id: string; name: string }[]; onUse: (playerId: string, total: number) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const total = RANKS.reduce((sum, rank) => sum + (counts[rank] ?? 0) * value(rank, aceHigh), 0);
  const cards = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const bump = (rank: string, by: number) => { if (by > 0 && cards === 0) trackFeature('hand_counter_used'); setCounts((current) => ({ ...current, [rank]: Math.max(0, Math.min(4, (current[rank] ?? 0) + by)) })); };
  return <details className="hand-counter"><summary>Count the cards left in a hand</summary>
    <div className="hc-grid">{RANKS.map((rank) => <button key={rank} aria-label={`Add a ${rank} (worth ${value(rank, aceHigh)})`} onClick={() => bump(rank, 1)}>{rank}{counts[rank] ? <i>{counts[rank]}</i> : null}</button>)}</div>
    <p className="hc-total" role="status"><strong>{total}</strong> points from {cards} card{cards === 1 ? '' : 's'} <button className="text-link" onClick={() => setCounts({})}>Clear</button></p>
    {RANKS.some((rank) => counts[rank]) && <p className="hc-fix"><button className="text-link" onClick={() => { const last = [...RANKS].reverse().find((rank) => counts[rank]); if (last) bump(last, -1); }}>Remove last card</button></p>}
    <div className="hc-use">{players.map((player) => <button key={player.id} disabled={total === 0} onClick={() => { onUse(player.id, total); setCounts({}); }}>{total} to {player.name}</button>)}</div>
  </details>;
}
