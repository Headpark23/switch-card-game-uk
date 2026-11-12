import { useState } from 'react';
import { refereeRuling, type Situation } from '../switch/referee';
import type { CardId, Suit } from '../switch/types';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: [Suit, string, string][] = [['S', '♠', 'spades'], ['H', '♥', 'hearts'], ['D', '♦', 'diamonds'], ['C', '♣', 'clubs']];
const SITUATIONS: [Situation, string][] = [['nothing', 'Nothing pending'], ['draw-two', 'A 2 is on the table'], ['black-king', 'A black king'], ['miss-turn', 'An 8: miss a turn']];

function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: [T, string, string?][]; value: T; onPick: (v: T) => void }) {
  return <div className="ref-chips" role="group" aria-label={label}>{options.map(([id, text, aria]) => <button key={id} aria-label={aria} aria-pressed={value === id} className={value === id ? 'active' : ''} onClick={() => onPick(id)}>{text}</button>)}</div>;
}

/** "Can I play this?" The referee uses the same rules as the game and says which rule applies. */
export default function Referee() {
  const [topRank, setTopRank] = useState('9');
  const [suit, setSuit] = useState<Suit>('H');
  const [situation, setSituation] = useState<Situation>('nothing');
  const [myRank, setMyRank] = useState('9');
  const [mySuit, setMySuit] = useState<Suit>('S');
  const ranks = RANKS.map((r): [string, string] => [r, r]);
  const suits = SUITS.map(([id, glyph, name]): [Suit, string, string] => [id, glyph, name]);
  const ruling = refereeRuling(`${topRank}${suit}` as CardId, suit, situation, `${myRank}${mySuit}` as CardId);
  return <details className="referee"><summary>Ask the referee: can I play this?</summary>
    <p className="ref-label">What is on the table?</p>
    <Chips label="Card on the table" options={ranks} value={topRank} onPick={setTopRank} />
    <Chips label="Suit to match" options={suits} value={suit} onPick={setSuit} />
    <p className="ref-label">Is anything pending?</p>
    <Chips label="Pending penalty" options={SITUATIONS.map(([id, text]): [Situation, string] => [id, text])} value={situation} onPick={setSituation} />
    <p className="ref-label">What do you want to play?</p>
    <Chips label="Your card" options={ranks} value={myRank} onPick={setMyRank} />
    <Chips label="Your suit" options={suits} value={mySuit} onPick={setMySuit} />
    <div className={'ref-ruling ' + (ruling.legal ? 'yes' : 'no')} role="status"><strong>{ruling.verdict}</strong><span>{ruling.why}</span></div>
  </details>;
}
