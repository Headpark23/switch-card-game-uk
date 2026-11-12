import { createDeck, rankOf, suitOf } from './switch/cards';
import type { CardId, Suit } from './switch/types';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet, useScreenPortal } from './mobile';
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
/**
 * The felt card table as a page header: the app's signature surface, the same felt and gold rim as the guided game.
 * Real cards fan off the right edge as the page's emblem.
 */
export function FeltHeader({title,intro,cards,id,compact=false,children}:{title:ReactNode;intro?:ReactNode;cards?:string[];id?:string;compact?:boolean;children?:ReactNode}) {
  return <header className={'felt-header'+(cards?.length?' has-fan':'')+(compact?' compact':'')}>
    <div className="felt-header-text"><h1 id={id}>{title}</h1>{intro&&<p>{intro}</p>}{children}</div>
    {cards&&cards.length>0&&<div className="felt-header-fan" aria-hidden="true">{cards.map(code=><span key={code}><CardImage code={code}/></span>)}</div>}
  </header>;
}

/** Two or three real cards as a small emblem, used where other apps would put an icon. */
export function MiniFan({codes}:{codes:string[]}) {return <span className="mini-fan" aria-hidden="true">{codes.map(code=><CardImage key={code} code={code}/>)}</span>;}

const SHOWER=['AS','KH','QC','JD','AH','KS','QD','JC','AD','KC','QS','JH','AC','KD','8H','7S'];
/**
 * A shower of playing cards across the phone screen when a match, knockout, cup or league is won.
 * Decorative only: it never blocks taps, ends by itself, and is skipped for people who prefer reduced motion.
 * Pass a new `trigger` value (such as the winner's id) to play it once.
 */
export function CardShower({trigger}:{trigger:string|null}) {
  const {screenRef}=useScreenPortal();
  const [burst,setBurst]=useState<string|null>(null);
  useEffect(()=>{
    if(!trigger)return;
    if(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    setBurst(trigger);
    const timer=window.setTimeout(()=>setBurst(null),3200);
    return ()=>window.clearTimeout(timer);
  },[trigger]);
  if(!burst||!screenRef.current)return null;
  return createPortal(<div className="card-shower" aria-hidden="true">{SHOWER.map((code,index)=><span key={burst+code} style={{'--x':`${4+((index*29)%88)}%`,'--delay':`${(index%8)*110}ms`,'--spin':`${(index%2?1:-1)*(160+index*27)}deg`,'--drift':`${(index%3-1)*38}px`} as CSSProperties}><CardImage code={code}/></span>)}</div>,screenRef.current);
}

export function AdSlot({hidden}:{hidden:boolean}) {return hidden?null:<aside className="advertisement" aria-label="Demonstration advertising placement"><span>ADVERTISEMENT</span><small>Demo placement · no live ad</small></aside>;}

/** Game-agnostic coaching panel: what the last move did, the coach's pick with reasons, and a full lesson with tactics on tap. */
export function CoachPanel({ meaning, options, sheetOptions = options, lesson, advice, inlineTrigger = true, compact = false, title = 'Your options', open: controlledOpen, onOpenChange, footer, revealPick = true }: { meaning: string | null; revealPick?: boolean; options: readonly CoachOption[]; sheetOptions?: readonly CoachOption[]; lesson?: Lesson | null; advice?: Advice | null; inlineTrigger?: boolean; compact?: boolean; title?: string; open?: boolean; onOpenChange?: (open: boolean) => void; footer?: ReactNode }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => { setInnerOpen(value); onOpenChange?.(value); };
  const detail = lesson || advice;
  const showInline = !!meaning || (advice ? advice.kind !== 'accept' : options.length > 0) || (detail && inlineTrigger);
  const strip = compact
    ? advice && advice.kind !== 'accept' && !revealPick
      // Hints are optional: the strip offers the coach's pick without giving the move away.
      ? <button className="coach-strip" onClick={() => setOpen(true)} aria-label="Why & tactics: see the coach's pick"><span className="pick-cards" aria-hidden="true"><CardImage code="back" /></span><span className="strip-text"><b>Your move</b><small>Stuck? Tap for the coach's pick and every card explained.</small></span><span className="strip-go" aria-hidden="true">Coach ›</span></button>
      : advice && advice.kind !== 'accept'
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
