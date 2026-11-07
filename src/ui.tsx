import { createDeck, rankOf, suitOf } from './switch/cards';
import type { CardId, Suit } from './switch/types';
import { useState, type ReactNode } from 'react';
import { BottomSheet } from './mobile';
import type { CoachOption } from './switch/coach';
import type { Lesson } from './switch/lessons';
import type { Advice } from './switch/tactics';

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

/** Game-agnostic coaching panel: what the last move did, the coach's pick with reasons, and a full lesson with tactics on tap. */
export function CoachPanel({ meaning, options, sheetOptions = options, lesson, advice, inlineTrigger = true, compact = false, title = 'Your options', open: controlledOpen, onOpenChange, footer }: { meaning: string | null; options: readonly CoachOption[]; sheetOptions?: readonly CoachOption[]; lesson?: Lesson | null; advice?: Advice | null; inlineTrigger?: boolean; compact?: boolean; title?: string; open?: boolean; onOpenChange?: (open: boolean) => void; footer?: ReactNode }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => { setInnerOpen(value); onOpenChange?.(value); };
  const detail = lesson || advice;
  const showInline = !!meaning || (advice ? advice.kind !== 'accept' : options.length > 0) || (detail && inlineTrigger);
  const strip = compact
    ? advice && advice.kind !== 'accept'
      ? <button className="coach-strip" onClick={() => setOpen(true)} aria-label={`Why & tactics: ${advice.headline}`}><span className="pick-cards" aria-hidden="true">{advice.cards.slice(0, 2).map((card) => <CardImage key={card} code={card} />)}{!advice.cards.length && <CardImage code="back" />}</span><span className="strip-text"><b>{advice.headline}</b><small>{advice.reasons[0]}</small></span><span className="strip-go" aria-hidden="true">Why ›</span></button>
      : meaning ? <button className="coach-strip quiet" onClick={() => setOpen(true)} aria-label="What that means"><span className="strip-text"><small>{meaning}</small></span><span className="strip-go" aria-hidden="true">More ›</span></button> : null
    : null;
  if (compact) return <>{strip}{detail && <BottomSheet open={open} onOpenChange={setOpen} title={advice ? (lesson?.title ?? "Coach's pick") : lesson!.title}>
      <div className="lesson">
        {meaning && <><h4>What that means</h4><p>{meaning}</p></>}
        {advice && <div className="lesson-pick"><div className="lesson-cards">{advice.cards.length ? advice.cards.map((card) => <CardImage key={card} code={card} />) : <CardImage code="back" />}</div><h4>Coach&apos;s pick</h4><p><b>{advice.headline}.</b></p><ul>{advice.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
        {lesson && <><h4>What was played</h4><p>{lesson.happened}</p></>}
        {advice
          ? <><h4>Your cards, one by one</h4><ul className="card-notes">{advice.notes.map((note) => <li key={note.card} data-legal={note.legal}><CardImage code={note.card} /><span>{note.text}</span></li>)}<li data-legal="true"><CardImage code="back" /><span>{advice.kind === 'accept' ? 'Accept the missed turn.' : 'Or pick up one card: allowed on a normal turn, and handy for saving your best cards.'}</span></li></ul></>
          : sheetOptions.length > 0 && <><h4>What you could play now</h4><ul className="coach-options">{sheetOptions.map((option) => <li key={option.label} data-kind={option.kind}><span className="coach-cards">{option.cards.slice(0, 4).map((card) => <CardImage key={card} code={card} />)}</span><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
        {advice && advice.tactics.length > 0 && <><h4>Tactics for this hand</h4><ul className="tactics">{advice.tactics.map((tactic) => <li key={tactic}>{tactic}</li>)}</ul></>}
        {lesson && <><h4>The rule</h4><p>{lesson.rule}</p><h4>Why it matters now</h4><p>{lesson.why}</p><p className="lesson-tip"><strong>Tip</strong> {lesson.tip}</p></>}
        <button className="primary lesson-done" onClick={() => setOpen(false)}>Got it</button>
        {footer}
      </div>
    </BottomSheet>}</>;
  return <>{showInline && <section className="coach" aria-label="Coach">
    {meaning && <p className="coach-meaning"><strong>What that means</strong> {meaning}</p>}
    {advice
      ? advice.kind === 'accept' ? null : <div className="coach-pick"><span className="pick-cards" aria-hidden="true">{advice.cards.slice(0, 3).map((card) => <CardImage key={card} code={card} />)}{!advice.cards.length && <CardImage code="back" />}</span><p><strong>Coach&apos;s pick</strong><b>{advice.headline}.</b> {advice.reasons[0]}</p></div>
      : options.length > 0 && <><p className="coach-title">{title}</p><ul className="coach-options inline">{options.map((option) => <li key={option.label} data-kind={option.kind}><i className="kind-dot" aria-hidden="true" /><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
    {detail && inlineTrigger && <button className="coach-more" onClick={() => setOpen(true)}>{advice ? 'Why? All options and tactics' : 'Tell me more'}</button>}
    </section>}
    {detail && <BottomSheet open={open} onOpenChange={setOpen} title={advice ? (lesson?.title ?? "Coach's pick") : lesson!.title}>
      <div className="lesson">
        {advice && <div className="lesson-pick"><div className="lesson-cards">{advice.cards.length ? advice.cards.map((card) => <CardImage key={card} code={card} />) : <CardImage code="back" />}</div><h4>Coach&apos;s pick</h4><p><b>{advice.headline}.</b></p><ul>{advice.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
        {lesson && <><h4>What was played</h4><p>{lesson.happened}</p></>}
        {advice
          ? <><h4>Your cards, one by one</h4><ul className="card-notes">{advice.notes.map((note) => <li key={note.card} data-legal={note.legal}><CardImage code={note.card} /><span>{note.text}</span></li>)}<li data-legal="true"><CardImage code="back" /><span>{advice.kind === 'accept' ? 'Accept the missed turn.' : 'Or pick up one card: allowed on a normal turn, and handy for saving your best cards.'}</span></li></ul></>
          : sheetOptions.length > 0 && <><h4>What you could play now</h4><ul className="coach-options">{sheetOptions.map((option) => <li key={option.label} data-kind={option.kind}><span className="coach-cards">{option.cards.slice(0, 4).map((card) => <CardImage key={card} code={card} />)}</span><span><b>{option.label}</b> <small>{option.detail}</small></span></li>)}</ul></>}
        {advice && advice.tactics.length > 0 && <><h4>Tactics for this hand</h4><ul className="tactics">{advice.tactics.map((tactic) => <li key={tactic}>{tactic}</li>)}</ul></>}
        {lesson && <><h4>The rule</h4><p>{lesson.rule}</p><h4>Why it matters now</h4><p>{lesson.why}</p><p className="lesson-tip"><strong>Tip</strong> {lesson.tip}</p></>}
        <button className="primary lesson-done" onClick={() => setOpen(false)}>Got it</button>
        {footer}
      </div>
    </BottomSheet>}
  </>;
}
