import { createDeck, rankOf, suitOf } from './switch/cards';
import type { CardId, Suit } from './switch/types';
import type { CoachOption } from './switch/coach';

export const suitNames:Record<Suit,string>={S:'spades',H:'hearts',D:'diamonds',C:'clubs'};
export const suitSymbols:Record<Suit,string>={S:'♠',H:'♥',D:'♦',C:'♣'};
export const rank=(card:string)=>rankOf(card as CardId);
export const suit=(card:string)=>suitOf(card as CardId);
export const isRedKing=(card:string)=>rank(card)==='K'&&(suit(card)==='H'||suit(card)==='D');
export const fullDeck=createDeck().map(card=>card.id);
export function CardImage({code}:{code:string}) {
  const suits:Record<string,string>={S:'spades',H:'hearts',D:'diamonds',C:'clubs'};const names:Record<string,string>={A:'Ace',K:'King',Q:'Queen',J:'Jack'};
  return <img className="playing-card" src={'/images/cards/'+code+'.webp'} alt={code==='back'?'Face-down deck':`${names[rank(code)]||rank(code)} of ${suits[suit(code)]}`} draggable={false}/>;
}
export function Fan({codes}:{codes:string[]}) {return <div className="card-fan">{codes.map(code=><CardImage key={code} code={code}/>)}</div>;}
export function AdSlot({hidden}:{hidden:boolean}) {return hidden?null:<aside className="advertisement" aria-label="Demonstration advertising placement"><span>ADVERTISEMENT</span><small>Demo placement · no live ad</small></aside>;}

/** Game-agnostic coaching panel: what the last move did, and what the player can do now. */
export function CoachPanel({ meaning, options, title = 'Your options' }: { meaning: string | null; options: readonly CoachOption[]; title?: string }) {
  if (!meaning && !options.length) return null;
  return <section className="coach" aria-label="Coach">
    {meaning && <p className="coach-meaning"><strong>What that means</strong> {meaning}</p>}
    {options.length > 0 && <><p className="coach-title">{title}</p><ul className="coach-options">{options.map((option) => <li key={option.label} data-kind={option.kind}><span className="coach-cards">{option.cards.slice(0, 4).map((card) => <CardImage key={card} code={card} />)}</span><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
  </section>;
}
