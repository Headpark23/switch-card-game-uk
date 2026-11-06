import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Cards, UsersThree, ChatCircle, Club, MagnifyingGlass, X, Crown, DownloadSimple, CheckCircle, ArrowCounterClockwise, Lightbulb, HandPalm } from '@phosphor-icons/react';
import { BottomSheet, KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import { chooseComputerAction } from './switch/ai';
import { createDeck, rankOf, suitOf } from './switch/cards';
import { createCup, drawNextCupRound, selectCupWinner, type CupState } from './switch/cup';
import { createCrossLeaguePlayoffs, rankLeague, type League } from './switch/leagues';
import { createKnockout, markLost, undoKnockout, type KnockoutState } from './switch/knockout';
import { googleSignInConfigured, mountGoogleOneTap, signOutGoogleSession, type SignedInUser } from './switch/googleIdentity';
import { addNight, completionFromCup, completionFromKnockout, completionFromLeagues, completionFromSession, createNightRecord, deleteNight, exportHistory, getHistory } from './switch/history';
import { applyAction as applyGameAction, createInitialGame as createEngineGame, drawCards as drawEngineCards, legalMoves as getLegalMoves } from './switch/rules';
import { applyScoreCommand, createSession, ScoreValidationError, undoScoreCommand, type ScoreFormat, type ScoreSession } from './switch/scoring';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY, type ScorekeeperState } from './switch/storage';
import type { CardId, GameAction, GameState as EngineGameState, PendingPenalty, Player, Suit as EngineSuit } from './switch/types';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';

type Page = 'Learn' | 'Cards' | 'Modes' | 'Questions' | 'Tutorial' | 'Score';
const powers = [
  {name:'Black kings',cards:['KS','KC'],short:'Pick up five',text:'The next player picks up 5 cards, unless they pass the penalty on with another black king.',extra:'Black kings stack: two mean 10 cards. Each red king cancels one black king.'},
  {name:'Red kings',cards:['KH','KD'],short:'Cancel a black king',text:'Play a red king to cancel the effect of one black king.',extra:'You need one red king for each black king played.'},
  {name:'Twos',cards:['2H','2S','2D','2C'],short:'Pick up two',text:'The next player picks up 2 cards, unless they play another two.',extra:'Each two adds 2 to the penalty. All four twos make a maximum of 8 cards.'},
  {name:'Eights',cards:['8H','8S'],short:'Miss a turn',text:'The next player misses their turn.',extra:'They can counter with another eight, passing the effect to the next player.'},
  {name:'Sevens',cards:['7H','7S'],short:'Play again',text:'Play another card after a seven.',extra:'You cannot finish on a seven, because you still have to play again.'},
  {name:'Jacks',cards:['JH','JS'],short:'Reverse direction',text:'One or three jacks reverse play. Two or four leave the original direction.',extra:'In this ruleset, a jack cannot be your last card in a two-player game.'},
  {name:'Aces',cards:['AS','AH','AD','AC'],short:'Play wild · choose the suit',text:'An ace can be played on any ordinary card, regardless of the current suit, then lets you choose the next suit.',extra:'An ace cannot interrupt an active black king, two or eight.'},
];
const rules = [
  {q:'How do we start?',a:'Play with 2–6 people using one complete 52-card pack. Shuffle once, deal 7 cards to each person, then turn over the top card of the deck to start the discard pile.'},
  {q:'Which card can I play?',a:'Match the suit or number of the previous card. An ace is wild on any ordinary card, regardless of suit, and lets you choose the next suit. It cannot interrupt a black king, two or eight. On a normal turn, you may pick up one card instead of playing, even when you have a legal card.'},
  {q:'Do I have to play a card if I can?',a:'No. On a normal turn you may choose to pick up one card and end your turn. This can be useful when you want to save an ace, king, two or another valuable card for later. Active pick-up and missed-turn penalties must still be resolved normally.'},
  {q:'Can I play several cards at once?',a:'Yes, you can play multiple cards of the same number. The first must match the previous suit.'},
  {q:'Can I finish on a seven?',a:'No. A seven means play again, so it cannot be your last card.'},
  {q:'What happens after a black king?',a:'A black king adds 5 cards to the penalty. The next player may play another black king to pass on 10, or use a red king to cancel one black king. The chain continues until someone cannot respond and picks up the full outstanding penalty.'},
  {q:'When can I play an ace?',a:'You can play an ace at any time on an ordinary card, even when it does not match the current suit or number. After playing it, choose the suit the next player must follow. An ace cannot interrupt an active black king, two or eight.'},
  {q:'What if I forget to say “Last Card”?',a:'Announce “Last Card” as soon as you have one card remaining. Forgetting means picking up 2 cards as a penalty.'},
  {q:'Can I finish on a jack?',a:'In a two-player game, this ruleset says you cannot finish on a jack because play reverses back to you. Agree any house-rule exceptions before starting.'},
  {q:'How do stacked twos work?',a:'Counter a two with another two. Each adds 2 cards to the penalty, up to 8 cards when all four have been played.'},
  {q:'How do eights work?',a:'An eight makes the next player miss a turn. They can defend with another eight and pass the effect on.'},
  {q:'What happens when the deck runs out?',a:'When the deck runs out, keep the top card of the discard pile in place. Turn the remaining played cards face down to become the new draw pile and continue in the same order. Do not shuffle them.'},
  {q:'How do I win?',a:'Be the first player to legally play your last card. Remember to announce “Last Card” beforehand, and follow the finishing restrictions.'},
];
const modes = [
  {name:'One v One',label:'2 players · The classic',text:'A simple head-to-head game. The first person to legally play all their cards wins.'},
  {name:'Knock Out',label:'3–6 players · Last one standing',text:'The last player holding cards drops out after each round. Remaining players play again until the final two compete for the win.'},
  {name:'Group Play',label:'3–6 players · League night',text:'Play as many rounds as there are players. With 5 players, finishing places earn 5, 4, 3, 2 and 1 point. Add scores across rounds. The top two contest the champions final; the bottom two play the runners-up final.'},
  {name:'Darts Scoring',label:'2 players · Sets and legs',text:'Agree the number of sets to win, usually 3 or 5. Win 3 legs to take a set. If sets and legs are drawn, win by 2 clear legs.'},
  {name:'Domino Scoring',label:'2 players · Every card counts',text:'Agree a target, such as 100 points. After each round, the winner earns the value of the cards left in the losing hand. Number cards count at face value; jack 11, queen 12, king 13. Agree before playing whether an ace counts as 1 or 11. First to the target wins.'},
  {name:'Switch Cup',label:'Groups · Tournament night',text:'Put names in a bowl and draw pairs for head-to-head matches. Choose single games or best of 3. Return winners to the bowl for the next round. With an odd number, draw one random player for a bye. Continue to a final.'},
];
const ruleChapters = [
  {number:'01',eyebrow:'SET THE TABLE',title:'Deal everyone in.',body:'Switch works with 2–6 players and one complete 52-card pack. Choose a dealer, shuffle once and get the table ready.',cards:['back'],points:['Deal 7 cards to every player.','Place the remaining deck face down.','When the deck runs out, keep the top played card and turn the rest over without shuffling.'],tip:'The player beside the dealer takes the first turn. Every physical card appears once in the pack.'},
  {number:'02',eyebrow:'TAKE A TURN',title:'Play it or keep it.',body:'Match the suit or number showing on the discard pile — or pick up one card and end your turn.',cards:['3H','9H','3C','AS'],points:['Matching numbers may be played together; the first card must match the previous suit.','An ace is wild on any ordinary card, regardless of suit, and lets you choose the next suit.','You may pick up instead even when you can play, saving a useful card for later.'],tip:'An ace cannot interrupt an active black king, two or eight. Holding one can be a smart move near the end.'},
  {number:'03',eyebrow:'POWER CARDS',title:'Expect a chain reaction.',body:'Power cards change what happens next. The other player may be able to defend and pass the effect on.',cards:['2H','8H','KS','KH'],points:['Twos add 2 cards to the penalty, up to 8.','Eights pass a missed turn when countered by another eight.','Black kings stack 5 at a time; each red king cancels one black king.'],tip:'Two black kings mean 10 cards unless the next player can answer. Sevens play again; jacks reverse.'},
  {number:'04',eyebrow:'ONE CARD LEFT',title:'Call it out.',body:'As soon as you have one card remaining, announce “Last Card” clearly to the table.',cards:['9H'],points:['Say “Last Card” before play continues.','Forget to announce it and you pick up 2 penalty cards.','Keep watching your opponents — the rule applies to everyone.'],tip:'The guided game pauses so you can practise making the call.'},
  {number:'05',eyebrow:'WIN THE GAME',title:'Finish legally.',body:'The first player to play every card wins, provided their final move follows the finishing rules.',cards:['7H','JH','AC'],points:['You cannot finish on a seven because it means play again.','In a two-player game, you cannot finish on a jack because play reverses back to you.','Play your last legal card to win.'],tip:'You now know enough to take on the computer.'},
];
type Suit = EngineSuit;
type Turn = 'you'|'computer';
type Pending = 'two'|'black-king'|'eight'|null;
type Game = {
  playerHand:string[];computerHand:string[];drawPile:string[];discard:string[];currentSuit:Suit;
  turn:Turn;pending:Pending;pendingDraw:number;status:'playing'|'won'|'lost';notice:string;
  hint:boolean;awaitingLastCard:boolean;nextTurn:Turn;lastCardCalled:boolean;move:number;
};
const suitNames:Record<Suit,string>={S:'spades',H:'hearts',D:'diamonds',C:'clubs'};
const suitSymbols:Record<Suit,string>={S:'♠',H:'♥',D:'♦',C:'♣'};
const rank=(card:string)=>rankOf(card as CardId);
const suit=(card:string)=>suitOf(card as CardId);
const isRedKing=(card:string)=>rank(card)==='K'&&(suit(card)==='H'||suit(card)==='D');
const fullDeck=createDeck().map(card=>card.id);
function shuffledDeck(){
  const cards=[...fullDeck];
  for(let index=cards.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[cards[index],cards[swap]]=[cards[swap],cards[index]];}
  return cards;
}
function demonstrationDeck(){
  const opening=['9H','3C','7H','2C','KH','AS','JH','8H','2D','KC','4H','JS','7S','KD','3H','AH','AC','KS','8S','2S','2H'];
  return [...opening,...fullDeck.filter(card=>!opening.includes(card))];
}
function blackKingChainDeck(){
  const opening=['AS','KS','KH','9H','3C','7H','JH','KC','4D','5D','6D','9S','QH','10D','3H'];
  return [...opening,...fullDeck.filter(card=>!opening.includes(card))];
}
function partialKingDeck(){
  const opening=['KS','KH','3C','4D','5D','6D','7D','KC','2H','3H','4H','5H','6H','7H','9S'];
  return [...opening,...fullDeck.filter(card=>!opening.includes(card))];
}
function pendingToEngine(game:Game):PendingPenalty|null{
  if(game.pending==='two')return {kind:'draw-two',cards:game.pendingDraw as 2|4|6|8};
  if(game.pending==='black-king')return {kind:'black-king',units:(game.pendingDraw/5) as 1|2,cards:game.pendingDraw as 5|10};
  if(game.pending==='eight')return {kind:'miss-turn'};
  return null;
}
function toEngine(game:Game):EngineGameState{
  return {playerHand:game.playerHand as CardId[],computerHand:game.computerHand as CardId[],drawPile:game.drawPile as CardId[],discardPile:game.discard as CardId[],currentSuit:game.currentSuit,turn:game.turn==='you'?'player':'computer',pendingPenalty:pendingToEngine(game),status:game.status==='playing'?'playing':'won',winner:game.status==='won'?'player':game.status==='lost'?'computer':null,move:game.move};
}
function pendingFromEngine(pending:PendingPenalty|null):{pending:Pending;pendingDraw:number}{
  if(!pending)return {pending:null,pendingDraw:0};
  if(pending.kind==='draw-two')return {pending:'two',pendingDraw:pending.cards};
  if(pending.kind==='black-king')return {pending:'black-king',pendingDraw:pending.cards};
  return {pending:'eight',pendingDraw:0};
}
function mergeEngine(game:Game,next:EngineGameState,notice:string):Game{
  const penalty=pendingFromEngine(next.pendingPenalty);
  return {...game,playerHand:[...next.playerHand],computerHand:[...next.computerHand],drawPile:[...next.drawPile],discard:[...next.discardPile],currentSuit:next.currentSuit,turn:next.turn==='player'?'you':'computer',...penalty,status:next.status==='playing'?'playing':next.winner==='player'?'won':'lost',notice,hint:false,move:next.move};
}
function freshPresentation(engine:EngineGameState):Game{
  return {playerHand:[...engine.playerHand],computerHand:[...engine.computerHand],drawPile:[...engine.drawPile],discard:[...engine.discardPile],currentSuit:engine.currentSuit,turn:engine.turn==='player'?'you':'computer',pending:null,pendingDraw:0,status:'playing',notice:'Your turn. Play a legal card, or pick up one to save your cards for later.',hint:false,awaitingLastCard:false,nextTurn:'computer',lastCardCalled:false,move:engine.move};
}
const initialGame=():Game=>{
  const testDeck=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('testDeck'):null;
  if(!testDeck)return freshPresentation(createEngineGame(Math.random));
  const deck=testDeck==='blackKingChain'?blackKingChainDeck():testDeck==='partialKing'?partialKingDeck():testDeck==='1'?demonstrationDeck():shuffledDeck();
  const playerHand=deck.splice(0,7);const computerHand=deck.splice(0,7);
  const starterIndex=deck.findIndex(card=>!['A','2','7','8','J','K'].includes(rank(card)));
  const [starter]=deck.splice(starterIndex<0?0:starterIndex,1);
  return {playerHand,computerHand,drawPile:deck.reverse(),discard:[starter],currentSuit:suit(starter),turn:'you',pending:null,pendingDraw:0,
    status:'playing',notice:'Your turn. Play a legal card, or pick up one to save your cards for later.',hint:false,awaitingLastCard:false,
    nextTurn:'computer',lastCardCalled:false,move:0};
};
function canPlay(card:string,game:Game,handSize:number){
  void handSize;
  return getLegalMoves(toEngine(game)).some(action=>action.type==='play'&&action.cards.length===1&&action.cards[0]===card);
}
function takeCards(game:Game,count:number,to:Turn){
  return mergeEngine(game,drawEngineCards(toEngine(game),count,to==='you'?'player':'computer'),game.notice);
}
function playCard(game:Game,card:string,actor:Turn,aceSuit?:Suit):Game{
  return playSet(game,[card],aceSuit,actor);
}
function playSet(game:Game,cards:string[],aceSuit?:Suit,actor:Turn='you'):Game{
  const action:GameAction={type:'play',cards:cards as CardId[],...(aceSuit?{chosenSuit:aceSuit}:{})};
  const next=applyGameAction(toEngine(game),action);
  const cardRank=rank(cards[0]);
  let notice=cards.length===1?(actor==='you'?`You played ${cards[0]}.`:`Computer played ${cards[0]}.`):`${actor==='you'?'You':'Computer'} played ${cards.length} ${cardRank}s together.`;
  if(next.pendingPenalty?.kind==='draw-two')notice+=` ${next.pendingPenalty.cards} cards are now at stake.`;
  else if(next.pendingPenalty?.kind==='black-king')notice+=game.pending==='black-king'&&cards.some(isRedKing)?` A red king cancels 5; ${next.pendingPenalty.cards} cards are still at stake.`:` ${next.pendingPenalty.cards} cards are now at stake.`;
  else if(game.pending==='black-king'&&cards.some(isRedKing))notice+=' The red king cancels the penalty.';
  else if(cardRank==='8')notice+=' An eight can pass the skipped turn.';
  else if(cardRank==='7')notice+=' A seven means play again.';
  else if(cardRank==='J')notice+=cards.length%2?' The reverse sends play back to the same player.':' The even number of reverses keeps play moving.';
  else if(cardRank==='A')notice+=` The suit is now ${suitNames[aceSuit||suit(cards[cards.length-1])]}.`;
  const base=mergeEngine(game,next,notice);
  const remaining=actor==='you'?base.playerHand.length:base.computerHand.length;
  if(next.status==='won')return {...base,notice:actor==='you'?(cards.length>1?'You played your matching set legally — you win!':'You played your last card legally — you win!'):'The computer played its last card. Try another game and use the hints when you need them.'};
  if(actor==='you'&&remaining===1)return {...base,awaitingLastCard:true,nextTurn:base.turn,turn:'you',notice:'One card left. Say “Last Card” before play continues.'};
  if(actor==='computer'&&remaining===1)return {...base,notice:notice+' Computer says “Last Card”.'};
  return base;
}
function computerTurn(game:Game):Game{
  if(game.status!=='playing'||game.turn!=='computer')return game;
  const engine=toEngine(game);const action=chooseComputerAction(engine,Math.random);
  if(action.type==='play')return playSet(game,[...action.cards],action.chosenSuit,'computer');
  const next=applyGameAction(engine,action);
  if(action.type==='accept-missed-turn')return mergeEngine(game,next,'The computer cannot counter the eight and misses its turn.');
  const count=game.pendingDraw||1;return mergeEngine(game,next,`The computer picks up ${count} card${count===1?'':'s'}. Your turn.`);
}
function CardImage({code}:{code:string}) {
  const suits:Record<string,string>={S:'spades',H:'hearts',D:'diamonds',C:'clubs'};const names:Record<string,string>={A:'Ace',K:'King',Q:'Queen',J:'Jack'};
  return <img className="playing-card" src={'/images/cards/'+code+'.png'} alt={code==='back'?'Face-down deck':`${names[rank(code)]||rank(code)} of ${suits[suit(code)]}`} draggable={false}/>;
}
function Fan({codes}:{codes:string[]}) {return <div className="card-fan">{codes.map(code=><CardImage key={code} code={code}/>)}</div>;}
function AdSlot({hidden}:{hidden:boolean}) {return hidden?null:<aside className="advertisement" aria-label="Demonstration advertising placement"><span>ADVERTISEMENT</span><small>Demo placement · no live ad</small></aside>;}
function downloadRules(){
  const text = 'SWITCH — Rules for a better game night\n\n'+rules.map(r=>r.q+'\n'+r.a).join('\n\n')+'\n\nPOWER CARDS\n\n'+powers.map(p=>p.name+'\n'+p.text+' '+p.extra).join('\n\n')+'\n\nGAME MODES\n\n'+modes.map(m=>m.name+'\n'+m.text).join('\n\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='switch-rules.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const scoreFormats:{id:ScoreFormat;name:string;description:string}[]=[
  {id:'head-to-head',name:'One v One',description:'Simple wins or points for two players.'},
  {id:'domino',name:'Domino',description:'Any whole-number round score and a flexible target.'},
  {id:'darts',name:'Darts',description:'Legs, sets and a two-leg lead.'},
  {id:'league',name:'Group leagues',description:'One to four leagues with championship and plate playoffs.'},
  {id:'knockout',name:'Knockout',description:'Three to six players; mark the round loser LOST.'},
  {id:'cup',name:'Switch Cup',description:'Two to ten players with automatic byes.'},
];
const newPlayer=(index:number):Player=>({id:`player-${Date.now()}-${index}`,name:''});
function GoogleOneTap(){
  const buttonRef=useRef<HTMLDivElement>(null);const [user,setUser]=useState<SignedInUser|null>(null);const [message,setMessage]=useState('');const configured=googleSignInConfigured();
  useEffect(()=>{if(!buttonRef.current||!configured||user)return;let active=true;mountGoogleOneTap(buttonRef.current,signedIn=>{if(active)setUser(signedIn);},error=>{if(active)setMessage(error);}).catch(error=>{if(active)setMessage(error instanceof Error?error.message:'Google sign-in failed.');});return()=>{active=false;};},[configured,user]);
  if(user)return <div className="google-account"><span>Signed in as</span><strong>{user.name||user.email}</strong><button onClick={()=>signOutGoogleSession().then(()=>setUser(null)).catch(error=>setMessage(error instanceof Error?error.message:'Sign-out failed.'))}>Sign out</button>{message&&<p role="alert">{message}</p>}</div>;
  return <div className="google-signin"><div><strong>Optional Google sign-in</strong><span>Use Switch without an account, or sign in for future sharing and sync.</span></div>{configured?<div ref={buttonRef} className="google-button"/>:<p>Google sign-in is ready for a client ID and secure verification endpoint.</p>}{message&&<p role="alert">{message}</p>}</div>;
}
function SwitchScorekeeper({onBack}:{onBack:()=>void}){
  const keyboard=useKeyboard();
  const [loaded]=useState(()=>loadScorekeeper(typeof window==='undefined'?null:window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY)));
  const initialFormat=scoreFormats.some(item=>item.id===loaded.state.selectedFormat)?loaded.state.selectedFormat as ScoreFormat:'domino';
  const [format,setFormat]=useState<ScoreFormat>(initialFormat);
  const [players,setPlayers]=useState<Player[]>(()=>loaded.state.players.length?[...loaded.state.players]:[newPlayer(0),newPlayer(1)]);
  const [target,setTarget]=useState(String(loaded.state.target||100));
  const [leagueCount,setLeagueCount]=useState(2);
  const [session,setSession]=useState<ScoreSession|null>(null);
  const [knockout,setKnockout]=useState<KnockoutState|null>(null);
  const [cup,setCup]=useState<CupState|null>(null);
  const [leagueScores,setLeagueScores]=useState<Record<string,number>>({});
  const [leagueStarted,setLeagueStarted]=useState(false);
  const [scoreInputs,setScoreInputs]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [savedRaw,setSavedRaw]=useState(loaded.originalRaw);
  const [storedExtensions,setStoredExtensions]=useState<Record<string,unknown>>(()=>({...loaded.state.extensions}));
  const [nightName,setNightName]=useState('Switch Night');
  const [savedCurrent,setSavedCurrent]=useState(false);
  const requiredCount=format==='league'?leagueCount*4:format==='knockout'?Math.min(6,Math.max(3,players.length)):format==='cup'?Math.min(10,Math.max(2,players.length)):2;
  const visiblePlayers=players.slice(0,requiredCount);
  function resizePlayers(count:number){setPlayers(current=>{const next=[...current];while(next.length<count)next.push(newPlayer(next.length));return next.slice(0,count);});}
  function chooseFormat(next:ScoreFormat){setFormat(next);setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setSavedCurrent(false);setError('');const count=next==='league'?leagueCount*4:next==='knockout'?Math.min(6,Math.max(3,players.length)):next==='cup'?Math.min(10,Math.max(2,players.length)):2;resizePlayers(count);}
  function persist(nextPlayers:readonly Player[],scores:Record<string,number>,extensionUpdates:Record<string,unknown>={}){
    const nextExtensions={...storedExtensions,...extensionUpdates};
    const state:ScorekeeperState={schemaVersion:1,selectedFormat:format,players:nextPlayers,scores,target:Number(target)||100,extensions:nextExtensions};
    const raw=saveScorekeeper(savedRaw,state);window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY,raw);setSavedRaw(raw);
    setStoredExtensions(nextExtensions);
  }
  function start(){
    setError('');setSavedCurrent(false);const named=visiblePlayers.map(player=>({...player,name:player.name.trim()}));
    if(named.some(player=>!player.name)){setError('Add a name for every player before starting.');return;}
    try{
      if(format==='knockout'){const next=createKnockout(named);setKnockout(next);persist(named,{});return;}
      if(format==='cup'){const next=createCup(named,Math.random);setCup(next);persist(named,{});return;}
      if(format==='league'){const scores=Object.fromEntries(named.map(player=>[player.id,loaded.state.scores[player.id]||0]));setLeagueScores(scores);setLeagueStarted(true);persist(named,scores,{leagueCount});return;}
      const created=createSession(format,named,{target:Number(target),setsToWin:3});
      const restored={...created,scores:{...created.scores,...Object.fromEntries(named.map(player=>[player.id,loaded.state.scores[player.id]||0]))}};setSession(restored);persist(named,{...restored.scores});
    }catch(reason){setError(reason instanceof Error?reason.message:'The scorekeeper could not start.');}
  }
  function updateSession(next:ScoreSession){setSession(next);persist(next.players,{...next.scores},{darts:next.darts});}
  function updateCup(next:CupState){setCup(next);persist(next.players,{}, {cup:next});}
  function addScore(playerId:string){if(!session)return;try{const next=applyScoreCommand(session,{type:'add-score',playerId,value:scoreInputs[playerId]??''});updateSession(next);setScoreInputs(current=>({...current,[playerId]:''}));setError('');}catch(reason){setError(reason instanceof ScoreValidationError?reason.message:'That score could not be added.');}}
  const leagues:League[]=leagueStarted?Array.from({length:leagueCount},(_,leagueIndex)=>({id:`league-${leagueIndex+1}`,name:`League ${leagueIndex+1}`,results:visiblePlayers.slice(leagueIndex*4,leagueIndex*4+4).map(player=>({player,points:leagueScores[player.id]||0}))})):[];
  const playoffs=leagueStarted?createCrossLeaguePlayoffs(leagues,Math.random):null;
  const activeKnockout=knockout?knockout.players.filter(player=>!knockout.eliminatedIds.includes(player.id)):[];
  const currentRound=cup?.rounds.at(-1);
  const cupPlayer=(id:string)=>cup?.players.find(player=>player.id===id);
  const completion=session?completionFromSession(session):knockout?completionFromKnockout(knockout):cup?completionFromCup(cup):leagueStarted?completionFromLeagues(leagues,playoffs):null;
  const nights=getHistory(storedExtensions);
  function persistHistory(nextExtensions:Record<string,unknown>){const currentPlayers=session?.players??knockout?.players??cup?.players??visiblePlayers;const currentScores=session?{...session.scores}:leagueStarted?leagueScores:{};persist(currentPlayers,currentScores,nextExtensions);}
  function saveCompletedNight(){if(!completion||savedCurrent)return;keyboard.hide();try{const night=createNightRecord(nightName,completion);persistHistory(addNight(storedExtensions,night));setSavedCurrent(true);setError('');}catch(reason){setError(reason instanceof Error?reason.message:'This night could not be saved.');}}
  function removeNight(id:string,title:string){if(!window.confirm(`Delete “${title}” from this device? This cannot be undone.`))return;persistHistory(deleteNight(storedExtensions,id));}
  function downloadHistory(){const url=URL.createObjectURL(new Blob([exportHistory(nights)],{type:'application/json;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='switch-night-history.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function reset(){if(!window.confirm('Reset this score session? Player names will be kept.'))return;setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setLeagueScores({});setSavedCurrent(false);setError('');persist(visiblePlayers,{});}
  return <section className="scorekeeper" aria-labelledby="scorekeeper-title"><div className="scorekeeper-head"><button className="text-link" onClick={onBack}>← Modes</button><p className="eyebrow">SWITCH NIGHT</p><h1 id="scorekeeper-title">Keep every<br/>score straight.</h1><p>Names stay on this device. Nothing is shared or published unless you choose a future sync option.</p></div><GoogleOneTap/>
    {loaded.status==='unreadable'&&<div className="score-warning" role="alert"><strong>Saved scores could not be read.</strong><span>They have not been overwritten. Starting a new session will replace them only after you confirm your setup.</span></div>}
    {!session&&!knockout&&!cup&&!leagueStarted?<><div className="format-grid" aria-label="Score format">{scoreFormats.map(item=><button key={item.id} className={format===item.id?'active':''} aria-pressed={format===item.id} onClick={()=>chooseFormat(item.id)}><strong>{item.name}</strong><span>{item.description}</span></button>)}</div>
      {format==='league'&&<div className="count-control"><span>Leagues</span><button aria-label="Fewer leagues" disabled={leagueCount===1} onClick={()=>{const next=leagueCount-1;setLeagueCount(next);resizePlayers(next*4);}}>−</button><strong>{leagueCount}</strong><button aria-label="More leagues" disabled={leagueCount===4} onClick={()=>{const next=leagueCount+1;setLeagueCount(next);resizePlayers(next*4);}}>+</button></div>}
      {(format==='knockout'||format==='cup')&&<div className="count-control"><span>Players</span><button aria-label="Fewer players" disabled={players.length<=(format==='knockout'?3:2)} onClick={()=>resizePlayers(players.length-1)}>−</button><strong>{players.length}</strong><button aria-label="More players" disabled={players.length>=(format==='knockout'?6:10)} onClick={()=>resizePlayers(players.length+1)}>+</button></div>}
      <div className="player-fields">{visiblePlayers.map((player,index)=><label key={player.id}><span>{format==='league'?`League ${Math.floor(index/4)+1} · Player ${index%4+1}`:`Player ${index+1}`}</span><KeyboardInput value={player.name} placeholder="Enter name" onChange={event=>setPlayers(current=>current.map(item=>item.id===player.id?{...item,name:event.target.value}:item))}/></label>)}</div>
      {(format==='domino'||format==='head-to-head')&&<label className="target-field"><span>Target score</span><KeyboardInput inputMode="numeric" value={target} onChange={event=>setTarget(event.target.value)}/></label>}
      {error&&<p className="score-error" role="alert">{error}</p>}<button className="primary score-start" onClick={start}>Start {scoreFormats.find(item=>item.id===format)?.name} <ArrowRight size={18}/></button></>:
      <div className="active-score">{session&&<><div className="score-status"><strong>{scoreFormats.find(item=>item.id===session.format)?.name}</strong><span>{session.format==='darts'?'First to 3 sets':`Target ${session.target}`}</span></div>{session.players.map(player=><article className="score-row" key={player.id}><div><strong>{player.name}</strong>{session.format==='darts'?<span>{session.darts?.sets[player.id]} sets · {session.darts?.legs[player.id]} legs</span>:<span>{session.scores[player.id]} points</span>}</div>{session.format==='darts'?<button className="primary" onClick={()=>updateSession(applyScoreCommand(session,{type:'win-leg',playerId:player.id}))}>Win leg</button>:<div className="score-entry"><KeyboardInput aria-label={`Score for ${player.name}`} inputMode="numeric" value={scoreInputs[player.id]||''} onChange={event=>setScoreInputs(current=>({...current,[player.id]:event.target.value}))}/><button onClick={()=>addScore(player.id)}>Add</button></div>}</article>)}{error&&<p className="score-error" role="alert">{error}</p>}<button className="secondary" disabled={!session.history.length} onClick={()=>updateSession(undoScoreCommand(session))}>Undo last score</button></>}
        {knockout&&<><div className="score-status"><strong>Knockout</strong><span>{knockout.championId?'Champion decided':`${activeKnockout.length} still playing`}</span></div>{knockout.players.map(player=><article className={'score-row '+(knockout.eliminatedIds.includes(player.id)?'lost':'')} key={player.id}><div><strong>{player.name}</strong><span>{knockout.eliminatedIds.includes(player.id)?'LOST':knockout.championId===player.id?'CHAMPION':'Still in'}</span></div>{!knockout.eliminatedIds.includes(player.id)&&!knockout.championId&&<button onClick={()=>{const next=markLost(knockout,player.id);setKnockout(next);persist(next.players,{}, {knockout:next});}}>LOST</button>}</article>)}<button className="secondary" disabled={!knockout.eliminatedIds.length} onClick={()=>{const next=undoKnockout(knockout);setKnockout(next);persist(next.players,{}, {knockout:next});}}>Undo elimination</button></>}
        {cup&&currentRound&&<><div className="score-status"><strong>Switch Cup</strong><span>{cup.championId?`${cupPlayer(cup.championId)?.name} is champion`:`Round ${currentRound.number}`}</span></div>{currentRound.byePlayerId&&<p className="bye-note"><strong>{cupPlayer(currentRound.byePlayerId)?.name}</strong> has the bye this round.</p>}{currentRound.fixtures.map(fixture=><article className="cup-fixture" key={fixture.id}><span>{fixture.winnerId?'Winner':'Choose winner'}</span>{fixture.playerIds.map(playerId=><button key={playerId} className={fixture.winnerId===playerId?'winner':''} disabled={!!fixture.winnerId} onClick={()=>updateCup(selectCupWinner(cup,fixture.id,playerId))}>{cupPlayer(playerId)?.name}</button>)}</article>)}{!cup.championId&&currentRound.fixtures.every(fixture=>fixture.winnerId)&&<button className="primary" onClick={()=>updateCup(drawNextCupRound(cup,Math.random))}>Draw next round <ArrowRight size={18}/></button>}</>}
        {leagueStarted&&<><div className="score-status"><strong>{leagueCount} league{leagueCount===1?'':'s'}</strong><span>Top two: championship · bottom two: plate</span></div>{leagues.map(league=><section className="league-table" key={league.id}><h2>{league.name}</h2>{rankLeague(league.results).map(entry=><article className="score-row" key={entry.player.id}><div><strong>{entry.rank}. {entry.player.name}</strong><span>{entry.points} points</span></div><button aria-label={`Add point for ${entry.player.name}`} onClick={()=>setLeagueScores(current=>{const next={...current,[entry.player.id]:(current[entry.player.id]||0)+1};persist(visiblePlayers,next,{leagueCount});return next;})}>+1</button></article>)}</section>)}{playoffs?.status==='ready'?<div className="playoffs"><h2>Cross-league playoffs</h2><h3>Championship</h3>{playoffs.championship.fixtures.map(fixture=><p key={fixture.id}>{fixture.home.player.name} <span>v</span> {fixture.away.player.name}</p>)}<h3>Plate</h3>{playoffs.plate.fixtures.map(fixture=><p key={fixture.id}>{fixture.home.player.name} <span>v</span> {fixture.away.player.name}</p>)}</div>:<p className="house-note">Add at least two complete leagues to create cross-league playoffs.</p>}</>}
        <section className="night-completion" aria-label="Completed night"><p className="eyebrow">SAVE THE NIGHT</p><label><span>Night name</span><KeyboardInput aria-label="Night name" value={nightName} onChange={event=>setNightName(event.target.value)}/></label>{savedCurrent?<p className="night-ready"><CheckCircle size={18}/>Saved to history on this device.</p>:completion?<><p className="night-ready"><CheckCircle size={18}/>{completion.outcome}. This result is ready to save.</p><button className="primary" onClick={saveCompletedNight}>Save completed night</button></>:<p className="night-pending">Finish this format to save a trustworthy result. Tied target scores need a clear winner.</p>}</section>
        <button className="text-link reset-score" onClick={reset}>Reset session</button></div>}
    <section className="night-history" aria-labelledby="night-history-title"><div className="history-heading"><div><p className="eyebrow">ON THIS DEVICE</p><h2 id="night-history-title">Switch Night history</h2></div>{nights.length>0&&<button className="secondary" onClick={downloadHistory}><DownloadSimple size={16}/>Export history</button>}</div>{nights.length===0?<p className="history-empty">No completed nights saved yet. Finish a score session and save it to build your real game-night story.</p>:<div className="history-list">{nights.map(night=><details className="history-card" key={night.id}><summary><span><strong>{night.title}</strong><small>{night.formatLabel} · {new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(night.completedAt))}</small></span><b>{night.outcome}</b></summary><div className="history-detail"><p>{night.players.map(player=>player.name).join(' · ')}</p>{night.details.map(section=><section key={section.heading}><h3>{section.heading}</h3>{section.lines.map((line,index)=><p key={`${section.heading}-${index}`}>{line}</p>)}</section>)}<button className="text-link history-delete" aria-label={`Delete ${night.title}`} onClick={()=>removeNight(night.id,night.title)}>Delete this night</button></div></details>)}</div>}</section>
  </section>;
}
export default function Prototype(){
  const [page,setPage]=useState<Page>('Learn');const [query,setQuery]=useState('');const [selected,setSelected]=useState<(typeof powers)[number]|null>(null);
  const [membership,setMembership]=useState(false);const [adFree,setAdFree]=useState(false);const [game,setGame]=useState<Game>(initialGame);const [aceChoice,setAceChoice]=useState<string[]|null>(null);const [staged,setStaged]=useState<string[]>([]);const [ruleStep,setRuleStep]=useState(0);
  const keyboard=useKeyboard();const {bottomInset}=useKeyboardInsets();
  const resetDeviceScroll=()=>{const screen=document.querySelector<HTMLElement>('[data-testid="device-screen"]');if(screen)screen.scrollTop=0;};
  useLayoutEffect(()=>{resetDeviceScroll();const frame=requestAnimationFrame(resetDeviceScroll);return()=>cancelAnimationFrame(frame);},[page,game.move,game.status,aceChoice,selected,membership]);
  useEffect(()=>{if(page!=='Tutorial'||game.turn!=='computer'||game.status!=='playing')return;const timer=setTimeout(()=>setGame(current=>computerTurn(current)),650);return()=>clearTimeout(timer);},[page,game.turn,game.move,game.status]);
  function go(next:Page){keyboard.hide();setPage(next);setQuery('');}
  function start(){setGame(initialGame());setAceChoice(null);setStaged([]);go('Tutorial');}
  function chooseCard(card:string){
    if(game.turn!=='you'||game.status!=='playing'||game.awaitingLastCard)return;
    if(staged.length){if(rank(card)!==rank(staged[0])){setGame(current=>({...current,notice:'Cards played together must have the same number or picture.'}));return;}setStaged(current=>current.includes(card)?current.filter(item=>item!==card):[...current,card]);return;}
    if(!canPlay(card,game,game.playerHand.length)){setGame(current=>({...current,hint:true,notice:current.playerHand.length===1&&(rank(card)==='7'||rank(card)==='J')?'You cannot finish on a seven or a jack in this two-player game.':rank(card)==='A'?'An ace is wild on ordinary cards, but cannot interrupt a black king, two or eight.':'That card cannot follow the current card. Use a hint to see your legal moves.'}));return;}
    if(rank(card)==='A'){setStaged([]);setAceChoice([card]);return;}
    if(game.pending==='black-king'){setStaged([]);setGame(current=>playCard(current,card,'you'));return;}
    if(game.playerHand.filter(item=>rank(item)===rank(card)).length>1){setStaged([card]);setGame(current=>({...current,notice:`You have matching ${rank(card)}s. Select any others you want to play together, then confirm your move.`}));return;}
    setGame(current=>playCard(current,card,'you'));
  }
  function playStaged(){if(!staged.length)return;const lead=staged.find(card=>canPlay(card,game,game.playerHand.length));if(!lead){setGame(current=>({...current,notice:'Select a matching card that can legally lead this set.'}));return;}const ordered=[lead,...staged.filter(card=>card!==lead)];if(rank(lead)==='A'){setAceChoice(ordered);return;}setGame(current=>playSet(current,ordered));setStaged([]);}
  function drawOrResolve(){
    if(game.turn!=='you'||game.status!=='playing')return;
    setGame(current=>{const count=current.pendingDraw||1;const action:GameAction=current.pending==='eight'?{type:'accept-missed-turn'}:{type:'draw'};const next=applyGameAction(toEngine(current),action);return {...mergeEngine(current,next,current.pending==='eight'?'You cannot counter with an eight, so you miss this turn.':`You pick up ${count} card${count===1?'':'s'}. Computer’s turn.`),lastCardCalled:false};});
  }
  function answerLastCard(said:boolean){setGame(current=>{if(said)return {...current,awaitingLastCard:false,lastCardCalled:true,turn:current.nextTurn,notice:'“Last Card!” — called in time.',move:current.move+1};const penalised=takeCards(current,2,'you');return {...penalised,awaitingLastCard:false,lastCardCalled:false,turn:current.nextTurn,notice:'You forgot “Last Card” and pick up two penalty cards.',move:current.move+1};});}
  const result=rules.filter(r=>(r.q+' '+r.a).toLowerCase().includes(query.toLowerCase()));
  const legalCards=game.playerHand.filter(card=>canPlay(card,game,game.playerHand.length));
  const topCard=game.discard[game.discard.length-1];
  const gameHint=game.pending==='two'?`Play another two to pass on ${game.pendingDraw+2}, or pick up ${game.pendingDraw}.`:game.pending==='black-king'?`Play another black king to add 5 and pass on ${game.pendingDraw+5}, play a red king to cancel 5, or pick up ${game.pendingDraw}.`:game.pending==='eight'?'Play another eight to pass the missed turn. If you have none, you must miss your turn.':legalCards.length?`You can play ${legalCards.join(', ')}. Aces are wild on ordinary cards. You may also pick up one card instead and save a useful card for later.`:'You have no legal card. Pick up one card and the computer will play.';
  const cardsInGame=[...game.playerHand,...game.computerHand,...game.drawPile,...game.discard];
  const deckDescription=`${cardsInGame.length}-card game with ${new Set(cardsInGame).size} unique cards`;
  return <div className="switch-app" onFocusCapture={resetDeviceScroll}><MobileScroll key={page+(page==='Tutorial'?game.status:'')} className="switch-scroll"><main className={'switch-content '+(page==='Learn'?'home':'interior')+(page==='Tutorial'?' tutorial-page':'')}>
  {page==='Learn'?<>
    <section className="rules-banner"><div className="wordmark"><Club weight="fill"/><div>SWITCH</div><p>RULES FOR A BETTER<br/>GAME NIGHT</p></div><p className="eyebrow">THE COMPLETE GUIDE</p><h1>Know the rules.<br/>Own the table.</h1><p>Five clear steps, then a guided game to put them into practice.</p><button className="primary" onClick={start}>Play against the computer <ArrowRight size={19}/></button></section>
    <section className="rule-narrative" aria-labelledby="rule-story-title"><p className="eyebrow">THE MAIN EVENT</p><h2 id="rule-story-title">Learn Switch<br/>in five moves.</h2><p className="rule-intro">A clear, visual guide from the first deal to the winning card.</p><div className="rule-steps" aria-label="Rule guide steps">{ruleChapters.map((chapter,index)=><button key={chapter.number} className={ruleStep===index?'active':''} aria-current={ruleStep===index?'step':undefined} onClick={()=>setRuleStep(index)}><span>{chapter.number}</span><small>{index===0?'Deal':index===1?'Play':index===2?'Power':index===3?'Call':'Win'}</small></button>)}</div><article className="rule-chapter"><div className="rule-chapter-head"><div><p>{ruleChapters[ruleStep].eyebrow}</p><h3>{ruleChapters[ruleStep].title}</h3></div><Fan codes={ruleChapters[ruleStep].cards}/></div><p className="rule-chapter-body">{ruleChapters[ruleStep].body}</p><ul>{ruleChapters[ruleStep].points.map(point=><li key={point}><CheckCircle size={17} weight="fill"/><span>{point}</span></li>)}</ul><aside><Lightbulb size={18} weight="fill"/><span>{ruleChapters[ruleStep].tip}</span></aside><div className="rule-controls"><button className="secondary" disabled={ruleStep===0} onClick={()=>setRuleStep(step=>step-1)}>Previous</button>{ruleStep<ruleChapters.length-1?<button className="primary" onClick={()=>setRuleStep(step=>step+1)}>Next rule <ArrowRight size={17}/></button>:<button className="primary" onClick={start}>Play the guided game <ArrowRight size={17}/></button>}</div></article><button className="rule-search-link" onClick={()=>go('Questions')}><MagnifyingGlass size={19}/><span><strong>Need one answer?</strong><small>Search every rule in seconds</small></span><ArrowRight size={18}/></button></section>
    <section className="power-preview"><div className="ornament"><Club weight="fill"/></div><h2>Know your power cards</h2><p className="section-caption">The cards that change the game.</p><div className="power-columns">{[powers[0],powers[2],powers[6]].map(p=><button key={p.name} onClick={()=>setSelected(p)}><Fan codes={p.cards}/><h3>{p.name}</h3><p>{p.short}.</p><span>View rule <ArrowRight size={12}/></span></button>)}</div></section>
    <AdSlot hidden={adFree}/><section className="night-note"><p className="eyebrow">MAKE IT A GAME NIGHT</p><h2>A little friendly rivalry.</h2><p>From a quick head-to-head to your very own Switch Cup.</p><button className="text-link" onClick={()=>go('Modes')}>Explore game modes <ArrowRight size={18}/></button></section><button className="member-strip" onClick={()=>setMembership(true)}><Crown size={24}/><span>More time at the table<small>Explore an ad-free experience</small></span><ArrowRight size={20}/></button><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Download all rules</button>
  </>:<>
    <header className="small-brand"><button onClick={()=>go('Learn')} aria-label="Switch home"><Club weight="fill" size={20}/> SWITCH</button><button aria-label="Explore ad-free preview" onClick={()=>setMembership(true)}><Crown size={22}/></button></header>
    {page==='Cards'&&<><p className="eyebrow">YOUR TABLE-SIDE REFERENCE</p><h1>Every card.<br/>Every possibility.</h1><p className="intro">Tap a card to see its effect, defence and exceptions.</p><div className="power-list">{powers.map(p=><button key={p.name} onClick={()=>setSelected(p)}><Fan codes={p.cards.slice(0,2)}/><span><strong>{p.name}</strong><small>{p.short}</small></span><ArrowRight size={19}/></button>)}</div><AdSlot hidden={adFree}/></>}
    {page==='Questions'&&<><p className="eyebrow">SETTLE THE DEBATE</p><h1>There’s a rule<br/>for that.</h1><p className="intro">Quick answers, before the next card lands.</p><div className="search"><MagnifyingGlass size={21}/><KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><p className="results" aria-live="polite">{query?`${result.length} matching ${result.length===1?'answer':'answers'}`:'THE ESSENTIALS'}</p><div className="answers">{result.map(r=><details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>{!result.length&&<div className="empty"><Cards size={40}/><h2>No matching rule yet.</h2><p>Try a card name such as “king”, or browse all the rules.</p><button className="secondary" onClick={()=>{keyboard.hide();setQuery('');}}>Show all rules</button></div>}<p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Keep a copy of the rules</button><a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16}/></a><AdSlot hidden={adFree}/></>}
    {page==='Modes'&&<><p className="eyebrow">YOUR PEOPLE. YOUR GAME.</p><h1>Make a night<br/>of it.</h1><p className="intro">Six ways to play. One great card game.</p><button className="primary mode-score-cta" onClick={()=>go('Score')}>Open the Switch scorekeeper <ArrowRight size={18}/></button><div className="mode-list">{modes.map((m,i)=><details key={m.name}><summary><span className="mode-number">0{i+1}</span><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p></details>)}</div><AdSlot hidden={adFree}/><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Download game-night rules</button></>}
    {page==='Score'&&<SwitchScorekeeper onBack={()=>go('Modes')}/>}
    {page==='Tutorial'&&<section className="tutorial game-tutorial" aria-label={deckDescription}>{game.status!=='playing'?<div className="completion"><CheckCircle size={60} weight="light"/><p className="eyebrow">{game.status==='won'?'GAME WON':'GOOD PRACTICE'}</p><h1>{game.status==='won'?<>You beat the<br/>computer.</>:<>The computer<br/>won this one.</>}</h1><p>{game.notice}</p><button className="primary" onClick={start}><ArrowCounterClockwise size={18}/>Play another guided game</button><button className="secondary" onClick={()=>go('Cards')}>Open card guide <ArrowRight size={18}/></button><AdSlot hidden={adFree}/></div>:<><div className="lesson-meta"><span>GUIDED GAME · {game.turn==='you'?'YOUR TURN':'COMPUTER TURN'}</span><button onClick={()=>go('Learn')}>Exit game</button></div><div className="opponent" aria-label={`Computer has ${game.computerHand.length} cards`}><span>COMPUTER</span><div>{game.computerHand.slice(0,5).map((_,i)=><CardImage code="back" key={i}/>)}</div><strong>{game.computerHand.length} card{game.computerHand.length===1?'':'s'}</strong></div><div className="game-table"><button className="draw-pile" onClick={drawOrResolve} disabled={game.turn!=='you'||game.awaitingLastCard||!!staged.length||game.pending==='eight'} aria-label={game.pending==='eight'?'Draw pile unavailable while resolving the eight':game.pendingDraw?`Pick up ${game.pendingDraw} cards`:legalCards.length?'Pick up one card instead of playing':'Draw a card'}><CardImage code="back"/><span>{game.pending==='eight'?'Eight played':game.pendingDraw?`Pick up ${game.pendingDraw}`:legalCards.length?'Pick up instead':'Draw'}</span></button><div className="discard-pile"><CardImage code={topCard}/><span>Current suit <b className={(game.currentSuit==='H'||game.currentSuit==='D')?'red':''}>{suitSymbols[game.currentSuit]} {suitNames[game.currentSuit]}</b></span></div></div><p className="game-notice" aria-live="polite">{game.turn==='computer'?'Computer is choosing a card…':game.notice}</p>{game.turn==='you'&&game.pending==='eight'&&!game.awaitingLastCard&&<div className="miss-turn-action"><strong>The computer played an eight</strong><p>{legalCards.some(card=>rank(card)==='8')?'Play an eight to pass the missed turn, or accept it.':'You have no eight to counter with, so you must miss this turn.'}</p><button className="primary" onClick={drawOrResolve}>Accept missed turn <ArrowRight size={18}/></button></div>}{game.awaitingLastCard?<div className="last-card-call"><HandPalm size={27}/><strong>One card remaining</strong><p>Say “Last Card” now. Forgetting costs two cards.</p><button className="primary" onClick={()=>answerLastCard(true)}>Say “Last Card”</button><button className="text-link" onClick={()=>answerLastCard(false)}>Continue without saying it</button></div>:<><div className="game-actions"><button className={'hint-button '+(game.hint?'active':'')} onClick={()=>setGame(current=>({...current,hint:!current.hint}))} disabled={game.turn!=='you'}><Lightbulb size={19} weight={game.hint?'fill':'regular'}/>{game.hint?'Hide hint':'Show hint'}</button><span>{game.playerHand.length} cards in your hand</span></div>{game.hint&&<p className="game-hint"><Lightbulb size={17}/>{gameHint}</p>}<div className="player-hand" aria-label="Your hand">{game.playerHand.map(card=><button key={card} onClick={()=>chooseCard(card)} className={(game.hint&&canPlay(card,game,game.playerHand.length)?'playable ':'')+(staged.includes(card)?'selected':'')} disabled={game.turn!=='you'} aria-label={`Play ${card}${canPlay(card,game,game.playerHand.length)?', legal move':', not currently playable'}`}><CardImage code={card}/></button>)}</div>{staged.length>0&&<div className="multi-action"><p>{staged.length} matching card{staged.length===1?'':'s'} selected</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={()=>setStaged([])}>Cancel selection</button></div>}</>}{aceChoice&&<div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S','H','D','C'] as Suit[]).map(chosen=><button key={chosen} className={(chosen==='H'||chosen==='D')?'red':''} onClick={()=>{setGame(current=>playSet(current,aceChoice,chosen));setAceChoice(null);setStaged([]);}}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={()=>setAceChoice(null)}>Cancel</button></div>}<div className="game-rule"><strong>Rule in play</strong><p>{game.pending==='two'?`Twos stack. The penalty is ${game.pendingDraw}.`:game.pending==='black-king'?`Another black king adds 5 and passes the penalty on. A red king cancels 5. Otherwise pick up ${game.pendingDraw}.`:game.pending==='eight'?'Counter with another eight or miss your turn.':'Match the suit or number, or pick up one card instead. Aces are wild on ordinary cards and let you choose the next suit. Matching numbers may be played together.'}</p></div></>}</section>}
  </>}
  </main></MobileScroll><nav className="bottom-tabs" aria-label="Main navigation" style={{bottom:bottomInset}}>{([{name:'Learn',label:'Rules',Icon:BookOpen},{name:'Cards',label:'Cards',Icon:Cards},{name:'Modes',label:'Modes',Icon:UsersThree},{name:'Questions',label:'Questions',Icon:ChatCircle}] as const).map(({name,label,Icon})=>{const active=page===name||name==='Learn'&&page==='Tutorial'||name==='Modes'&&page==='Score';return <button key={name} className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>go(name)}><Icon weight={active?'fill':'regular'} size={26}/><span>{label}</span></button>;})}</nav>
  <BottomSheet open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title={selected?.name||'Card rule'}>{selected&&<div className="rule-sheet"><Fan codes={selected.cards}/><p className="eyebrow">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={()=>setSelected(null)}>Got it <CheckCircle size={19}/></button></div>}</BottomSheet>
  <BottomSheet open={membership} onOpenChange={setMembership} title="A little more Switch" description="A preview of possible paid extras. No purchase or charge."><div className="membership"><Crown size={38} weight="light"/><h2>Keep the good<br/>times going.</h2><p>An ad-free experience, printable game-night packs and custom table themes are options for a future Switch Club.</p><div className="preview-label">INTERACTIVE PREVIEW</div><button className="primary" onClick={()=>{setAdFree(!adFree);setMembership(false);}}>{adFree?'Restore demo ads':'Preview without ads'} <ArrowRight size={18}/></button><p className="fine-print">This changes the preview only. Paid plans are not available yet.</p></div></BottomSheet></div>;
}
