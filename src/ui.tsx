import { createDeck, rankOf, suitOf } from './switch/cards';
import type { CardId, Suit } from './switch/types';
import { useState, type ReactNode } from 'react';
import { BottomSheet } from './mobile';
import type { CoachOption } from './switch/coach';
import type { Lesson } from './switch/lessons';

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

/** Game-agnostic coaching panel: what the last move did, what you can do now, and a full lesson on tap. */
export function CoachPanel({ meaning, options, sheetOptions = options, lesson, title = 'Your options', open: controlledOpen, onOpenChange, footer }: { meaning: string | null; options: readonly CoachOption[]; sheetOptions?: readonly CoachOption[]; lesson?: Lesson | null; title?: string; open?: boolean; onOpenChange?: (open: boolean) => void; footer?: ReactNode }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => { setInnerOpen(value); onOpenChange?.(value); };
  if (!meaning && !options.length) return null;
  return <section className="coach" aria-label="Coach">
    {meaning && <p className="coach-meaning"><strong>What that means</strong> {meaning}</p>}
    {options.length > 0 && <><p className="coach-title">{title}</p><ul className="coach-options">{options.map((option) => <li key={option.label} data-kind={option.kind}><span className="coach-cards">{option.cards.slice(0, 4).map((card) => <CardImage key={card} code={card} />)}</span><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
    {lesson && <button className="coach-more" onClick={() => setOpen(true)}>Tell me more</button>}
    {lesson && <BottomSheet open={open} onOpenChange={setOpen} title={lesson.title}>
      <div className="lesson">
        {lesson.cards.length > 0 && <div className="lesson-cards">{lesson.cards.map((card) => <CardImage key={card} code={card} />)}</div>}
        <h4>What was played</h4><p>{lesson.happened}</p>
        <h4>The rule</h4><p>{lesson.rule}</p>
        <h4>Why it matters now</h4><p>{lesson.why}</p>
        {sheetOptions.length > 0 && <><h4>What you could play now</h4><ul className="coach-options">{sheetOptions.map((option) => <li key={option.label} data-kind={option.kind}><span className="coach-cards">{option.cards.slice(0, 4).map((card) => <CardImage key={card} code={card} />)}</span><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
        <p className="lesson-tip"><strong>Tip</strong> {lesson.tip}</p>
        <button className="primary lesson-done" onClick={() => setOpen(false)}>Got it</button>
        {footer}
      </div>
    </BottomSheet>}
  </section>;
}
