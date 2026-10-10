import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowRight, BookOpen, Cards, UsersThree, ChatCircle, Club, MagnifyingGlass, X, Crown, DownloadSimple, CheckCircle, ArrowCounterClockwise, Lightbulb, HandPalm, Trophy, ChartBar, Sparkle, House } from '@phosphor-icons/react';
import { BottomSheet, KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from './mobile';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import './companion.css';

import { TOP_10_GAMES } from './data/cardGames';
import {
  INITIAL_PLAYERS,
  INITIAL_LEAGUES,
  INITIAL_MATCH_HISTORY,
  type Player,
  type League,
  type MatchRecord
} from './data/initialLeagues';
import { Scorekeeper } from './components/Scorekeeper';
import { LeaguesView } from './components/LeaguesView';
import { StatsView } from './components/StatsView';
import { GamesLibraryView } from './components/GamesLibraryView';
import { PremiumModal } from './components/PremiumModal';
import { HomeView } from './components/HomeView';
import { GoogleAd } from './components/GoogleAd';

type Page = 'Home' | 'Learn' | 'Games' | 'Score' | 'Leagues' | 'Stats' | 'Cards' | 'Modes' | 'Questions' | 'Tutorial';
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
  {q:'What happens when the draw pile runs out?',a:'Keep the top card of the discard pile in place. Turn the remaining played cards face down to become the new draw pile and continue in the same order. Do not shuffle them.'},
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
  {number:'01',eyebrow:'SET THE TABLE',title:'Deal everyone in.',body:'Switch works with 2–6 players and one complete 52-card pack. Choose a dealer, shuffle once and get the table ready.',cards:['back'],points:['Deal 7 cards to every player.','Place the remaining deck face down.','When it runs out, keep the top played card and turn the rest over without shuffling.'],tip:'The player beside the dealer takes the first turn. Every physical card appears once in the pack.'},
  {number:'02',eyebrow:'TAKE A TURN',title:'Play it or keep it.',body:'Match the suit or number showing on the discard pile — or pick up one card and end your turn.',cards:['3H','9H','3C','AS'],points:['Matching numbers may be played together; the first card must match the previous suit.','An ace is wild on any ordinary card, regardless of suit, and lets you choose the next suit.','You may pick up instead even when you can play, saving a useful card for later.'],tip:'An ace cannot interrupt an active black king, two or eight. Holding one can be a smart move near the end.'},
  {number:'03',eyebrow:'POWER CARDS',title:'Expect a chain reaction.',body:'Power cards change what happens next. The other player may be able to defend and pass the effect on.',cards:['2H','8H','KS','KH'],points:['Twos add 2 cards to the penalty, up to 8.','Eights pass a missed turn when countered by another eight.','Black kings stack 5 at a time; each red king cancels one black king.'],tip:'Two black kings mean 10 cards unless the next player can answer. Sevens play again; jacks reverse.'},
  {number:'04',eyebrow:'ONE CARD LEFT',title:'Call it out.',body:'As soon as you have one card remaining, announce “Last Card” clearly to the table.',cards:['9H'],points:['Say “Last Card” before play continues.','Forget to announce it and you pick up 2 penalty cards.','Keep watching your opponents — the rule applies to everyone.'],tip:'The guided game pauses so you can practise making the call.'},
  {number:'05',eyebrow:'WIN THE GAME',title:'Finish legally.',body:'The first player to play every card wins, provided their final move follows the finishing rules.',cards:['7H','JH','AC'],points:['You cannot finish on a seven because it means play again.','In a two-player game, you cannot finish on a jack because play reverses back to you.','Play your last legal card to win.'],tip:'You now know enough to take on the computer.'},
];
type Suit = 'S'|'H'|'D'|'C';
type Turn = 'you'|'computer';
type Pending = 'two'|'black-king'|'eight'|null;
type Game = {
  playerHand:string[];computerHand:string[];drawPile:string[];discard:string[];currentSuit:Suit;
  turn:Turn;pending:Pending;pendingDraw:number;status:'playing'|'won'|'lost';notice:string;
  hint:boolean;awaitingLastCard:boolean;nextTurn:Turn;lastCardCalled:boolean;move:number;
};
const suitNames:Record<Suit,string>={S:'spades',H:'hearts',D:'diamonds',C:'clubs'};
const suitSymbols:Record<Suit,string>={S:'♠',H:'♥',D:'♦',C:'♣'};
const rank=(card:string)=>card.slice(0,-1);
const suit=(card:string)=>card.slice(-1) as Suit;
const isBlackKing=(card:string)=>rank(card)==='K'&&(suit(card)==='S'||suit(card)==='C');
const isRedKing=(card:string)=>rank(card)==='K'&&(suit(card)==='H'||suit(card)==='D');
const fullDeck=(['S','H','D','C'] as Suit[]).flatMap(cardSuit=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map(cardRank=>cardRank+cardSuit));
function shuffledDeck(){
  const cards=[...fullDeck];
  for(let index=cards.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[cards[index],cards[swap]]=[cards[swap],cards[index]];}
  return cards;
}
function demonstrationDeck(){
  const opening=['9H','3C','7H','2C','KH','AS','JH','8H','2D','KC','AD','JS','7S','KD','3H','AH','AC','KS','8S','2S','2H'];
  return [...opening,...fullDeck.filter(card=>!opening.includes(card))];
}
function blackKingChainDeck(){
  const opening=['AS','KS','KH','9H','3C','7H','JH','KC','4D','5D','6D','9S','QH','10D','3H'];
  return [...opening,...fullDeck.filter(card=>!opening.includes(card))];
}
const initialGame=():Game=>{
  const testDeck=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('testDeck'):null;
  const deck=testDeck==='blackKingChain'?blackKingChainDeck():testDeck==='1'?demonstrationDeck():shuffledDeck();
  const playerHand=deck.splice(0,7);const computerHand=deck.splice(0,7);
  const starterIndex=deck.findIndex(card=>!['A','2','7','8','J','K'].includes(rank(card)));
  const [starter]=deck.splice(starterIndex<0?0:starterIndex,1);
  return {playerHand,computerHand,drawPile:deck,discard:[starter],currentSuit:suit(starter),turn:'you',pending:null,pendingDraw:0,
    status:'playing',notice:'Your turn. Play a legal card, or pick up one to save your cards for later.',hint:false,awaitingLastCard:false,
    nextTurn:'computer',lastCardCalled:false,move:0};
};
function canPlay(card:string,game:Game,handSize:number){
  if(handSize===1&&(rank(card)==='7'||rank(card)==='J'))return false;
  if(game.pending==='two')return rank(card)==='2';
  if(game.pending==='black-king')return isBlackKing(card)||isRedKing(card);
  if(game.pending==='eight')return rank(card)==='8';
  const top=game.discard[game.discard.length-1];
  if(rank(card)==='A'&&(rank(top)==='2'||rank(top)==='8'||isBlackKing(top)))return false;
  return rank(card)==='A'||suit(card)===game.currentSuit||rank(card)===rank(top);
}
function takeCards(game:Game,count:number,to:Turn){
  let draw=[...game.drawPile],discard=[...game.discard],taken:string[]=[];
  while(taken.length<count){
    if(!draw.length&&discard.length>1){const top=discard.pop()!;draw=discard;discard=[top];}
    const card=draw.shift();if(!card)break;taken.push(card);
  }
  return {...game,drawPile:draw,discard,
    playerHand:to==='you'?[...game.playerHand,...taken]:game.playerHand,
    computerHand:to==='computer'?[...game.computerHand,...taken]:game.computerHand};
}
function playCard(game:Game,card:string,actor:Turn,aceSuit?:Suit):Game{
  const playerHand=actor==='you'?game.playerHand.filter(c=>c!==card):game.playerHand;
  const computerHand=actor==='computer'?game.computerHand.filter(c=>c!==card):game.computerHand;
  const remaining=actor==='you'?playerHand.length:computerHand.length;
  const other:Turn=actor==='you'?'computer':'you';
  const cardRank=rank(card);let next:Turn=other;let pending:Pending=null;let pendingDraw=0;
  let notice=actor==='you'?`You played ${card}.`:`Computer played ${card}.`;
  if(cardRank==='2'){pending='two';pendingDraw=game.pendingDraw+2;notice+=` ${pendingDraw} cards are now at stake.`;}
  else if(isBlackKing(card)){pending='black-king';pendingDraw=game.pendingDraw+5;notice+=` ${pendingDraw} cards are now at stake.`;}
  else if(game.pending==='black-king'&&isRedKing(card)){notice+=' The red king cancels the penalty.';}
  else if(cardRank==='8'){pending='eight';notice+=' An eight can pass the skipped turn.';}
  else if(cardRank==='7'){next=actor;notice+=' A seven means play again.';}
  else if(cardRank==='J'){next=actor;notice+=' In a two-player game, the reverse sends play back to you.';}
  else if(cardRank==='A'){notice+=` The suit is now ${suitNames[aceSuit||suit(card)]}.`;}
  const base:Game={...game,playerHand,computerHand,discard:[...game.discard,card],currentSuit:cardRank==='A'?(aceSuit||suit(card)):suit(card),turn:next,pending,pendingDraw,notice,hint:false,move:game.move+1};
  if(remaining===0)return {...base,status:actor==='you'?'won':'lost',notice:actor==='you'?'You played your last card legally — you win!':'The computer played its last card. Try another game and use the hints when you need them.'};
  if(actor==='you'&&remaining===1)return {...base,awaitingLastCard:true,nextTurn:next,turn:'you',notice:'One card left. Say “Last Card” before play continues.'};
  if(actor==='computer'&&remaining===1)return {...base,notice:notice+' Computer says “Last Card”.'};
  return base;
}
function playSet(game:Game,cards:string[],aceSuit?:Suit):Game{
  if(cards.length===1)return playCard(game,cards[0],'you',aceSuit);
  const setRank=rank(cards[0]);const playerHand=game.playerHand.filter(card=>!cards.includes(card));
  if(playerHand.length===0&&(setRank==='7'||setRank==='J'))return {...game,notice:'You cannot finish on a seven or a jack in this two-player game.',hint:true};
  let pending:Pending=null,pendingDraw=0,next:Turn='computer';
  let notice=`You played ${cards.length} ${setRank}s together.`;
  if(setRank==='2'){pending='two';pendingDraw=game.pendingDraw+(cards.length*2);notice+=` ${pendingDraw} cards are now at stake.`;}
  else if(setRank==='K'){
    const blackCards=cards.filter(isBlackKing).length;const redCards=cards.filter(isRedKing).length;
    const outstanding=Math.max(0,(game.pending==='black-king'?game.pendingDraw/5:0)+blackCards-redCards);
    if(outstanding){pending='black-king';pendingDraw=outstanding*5;notice+=` ${pendingDraw} cards are now at stake.`;}else notice+=' The red and black king effects cancel.';
  }
  else if(setRank==='8'){pending='eight';notice+=' The computer must counter with an eight or miss its turn.';}
  else if(setRank==='7'){next='you';notice+=' Sevens mean play again.';}
  else if(setRank==='J'){next=cards.length%2?'you':'computer';notice+=cards.length%2?' The odd number of reverses sends play back to you.':' The even number of reverses keeps the original direction.';}
  else if(setRank==='A'){notice+=` The suit is now ${suitNames[aceSuit||suit(cards[cards.length-1])]}.`;}
  const base:Game={...game,playerHand,discard:[...game.discard,...cards],currentSuit:setRank==='A'?(aceSuit||suit(cards[cards.length-1])):suit(cards[cards.length-1]),turn:next,pending,pendingDraw,notice,hint:false,move:game.move+1};
  if(!playerHand.length)return {...base,status:'won',notice:'You played your matching set legally — you win!'};
  if(playerHand.length===1)return {...base,awaitingLastCard:true,nextTurn:next,turn:'you',notice:'One card left. Say “Last Card” before play continues.'};
  return base;
}
function computerTurn(game:Game):Game{
  if(game.status!=='playing'||game.turn!=='computer')return game;
  const legal=game.computerHand.filter(card=>canPlay(card,game,game.computerHand.length));
  if(!legal.length){
    if(game.pending==='eight')return {...game,pending:null,turn:'computer',notice:'The computer cannot counter the eight and misses its turn.',move:game.move+1};
    const count=game.pendingDraw||1;const drawn=takeCards(game,count,'computer');
    return {...drawn,pending:null,pendingDraw:0,turn:'you',notice:`The computer picks up ${count} card${count===1?'':'s'}. Your turn.`,move:game.move+1};
  }
  const card=legal.find(c=>rank(c)==='2'||isBlackKing(c)||rank(c)==='8'||rank(c)==='7'||rank(c)==='J')||legal[0];
  const chosenSuit:Suit=card[0]==='A'?(['H','S','D','C'] as Suit[]).sort((a,b)=>game.computerHand.filter(c=>suit(c)===b).length-game.computerHand.filter(c=>suit(c)===a).length)[0]:suit(card);
  return playCard(game,card,'computer',chosenSuit);
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
export default function Prototype(){
  const [page,setPage]=useState<Page>('Home');const [query,setQuery]=useState('');const [selected,setSelected]=useState<(typeof powers)[number]|null>(null);
  const [membership,setMembership]=useState(false);const [adFree,setAdFree]=useState(false);const [game,setGame]=useState<Game>(initialGame);const [aceChoice,setAceChoice]=useState<string[]|null>(null);const [staged,setStaged]=useState<string[]>([]);const [ruleStep,setRuleStep]=useState(0);

  // Companion App State
  const [leagues, setLeagues] = useState<League[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('card_companion_leagues');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
    }
    return INITIAL_LEAGUES;
  });

  const [players, setPlayers] = useState<Player[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('card_companion_players');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
    }
    return INITIAL_PLAYERS;
  });

  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('card_companion_matches');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
    }
    return INITIAL_MATCH_HISTORY;
  });

  const [activeLeagueId, setActiveLeagueId] = useState<string>('league-family');
  const [scoreGameId, setScoreGameId] = useState<string>('switch');
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('card_companion_premium') === 'true';
    }
    return false;
  });
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);

  const handleSaveMatch = (record: MatchRecord) => {
    const updated = [...matchHistory, record];
    setMatchHistory(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('card_companion_matches', JSON.stringify(updated));
    }
  };

  const handleAddPlayer = (name: string, avatar: string) => {
    const newPlayer: Player = {
      id: 'p-' + Date.now(),
      name,
      avatar,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    };
    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    const updatedLeagues = leagues.map(l =>
      l.id === activeLeagueId
        ? { ...l, playerIds: [...l.playerIds, newPlayer.id] }
        : l
    );
    setLeagues(updatedLeagues);
    if (typeof window !== 'undefined') {
      localStorage.setItem('card_companion_players', JSON.stringify(updatedPlayers));
      localStorage.setItem('card_companion_leagues', JSON.stringify(updatedLeagues));
    }
  };

  const handleCreateLeague = (name: string, description: string, playerIds: string[]) => {
    const code = 'FAM-' + Math.floor(1000 + Math.random() * 9000);
    const newLeague: League = {
      id: 'league-' + Date.now(),
      name,
      description,
      code,
      createdDate: 'Oct 2026',
      playerIds,
    };
    const updated = [...leagues, newLeague];
    setLeagues(updated);
    setActiveLeagueId(newLeague.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('card_companion_leagues', JSON.stringify(updated));
    }
  };

  const handleTogglePremium = () => {
    const next = !isPremium;
    setIsPremium(next);
    setAdFree(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('card_companion_premium', String(next));
    }
  };

  const startScorekeeperForGame = (gid: string) => {
    setScoreGameId(gid);
    go('Score');
  };
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
    if(game.pending==='eight'){setGame(current=>({...current,pending:null,turn:'computer',notice:'You cannot counter with an eight, so you miss this turn.',hint:false,move:current.move+1}));return;}
    const count=game.pendingDraw||1;setGame(current=>{const drawn=takeCards(current,count,'you');return {...drawn,pending:null,pendingDraw:0,turn:'computer',lastCardCalled:false,notice:`You pick up ${count} card${count===1?'':'s'}. Computer’s turn.`,hint:false,move:current.move+1};});
  }
  function answerLastCard(said:boolean){setGame(current=>{if(said)return {...current,awaitingLastCard:false,lastCardCalled:true,turn:current.nextTurn,notice:'“Last Card!” — called in time.',move:current.move+1};const penalised=takeCards(current,2,'you');return {...penalised,awaitingLastCard:false,lastCardCalled:false,turn:current.nextTurn,notice:'You forgot “Last Card” and pick up two penalty cards.',move:current.move+1};});}
  const result=rules.filter(r=>(r.q+' '+r.a).toLowerCase().includes(query.toLowerCase()));
  const legalCards=game.playerHand.filter(card=>canPlay(card,game,game.playerHand.length));
  const topCard=game.discard[game.discard.length-1];
  const gameHint=game.pending==='two'?`Play another two to pass on ${game.pendingDraw+2}, or pick up ${game.pendingDraw}.`:game.pending==='black-king'?`Play another black king to add 5 and pass on ${game.pendingDraw+5}, play a red king to cancel 5, or pick up ${game.pendingDraw}.`:game.pending==='eight'?'Play another eight to pass the missed turn. If you have none, you must miss your turn.':legalCards.length?`You can play ${legalCards.join(', ')}. Aces are wild on ordinary cards. You may also pick up one card instead and save a useful card for later.`:'You have no legal card. Pick up one card and the computer will play.';
  const cardsInGame=[...game.playerHand,...game.computerHand,...game.drawPile,...game.discard];
  const deckDescription=`${cardsInGame.length}-card game with ${new Set(cardsInGame).size} unique cards`;
  const isCompanionInterior = ['Home', 'Games', 'Score', 'Leagues', 'Stats'].includes(page);

  return <div className="switch-app card-companion-shell" onFocusCapture={resetDeviceScroll}>
  
  {/* DESKTOP HEADER BAR: PC, Laptop, Tablet */}
  <header className="desktop-header-bar">
    <button className="desktop-brand" onClick={() => go('Home')}>
      <span className="desktop-brand-suits">♠️♥️♦️♣️</span>
      <div>
        <strong>The Card Companion</strong>
        <small>The Ultimate Game Night Suite</small>
      </div>
    </button>
    <nav className="desktop-nav-links">
      <button className={`desktop-nav-btn ${page === 'Home' ? 'active' : ''}`} onClick={() => go('Home')}>
        <House size={16} /> Home
      </button>
      <button className={`desktop-nav-btn ${page === 'Games' ? 'active' : ''}`} onClick={() => go('Games')}>
        <Cards size={16} /> Top 10 Games
      </button>
      <button className={`desktop-nav-btn ${page === 'Score' ? 'active' : ''}`} onClick={() => go('Score')}>
        <Trophy size={16} /> Scorekeeper
      </button>
      <button className={`desktop-nav-btn ${page === 'Leagues' ? 'active' : ''}`} onClick={() => go('Leagues')}>
        <UsersThree size={16} /> Leagues
      </button>
      <button className={`desktop-nav-btn ${page === 'Stats' ? 'active' : ''}`} onClick={() => go('Stats')}>
        <ChartBar size={16} /> Stats
      </button>
      <button className={`desktop-nav-btn ${page === 'Learn' || page === 'Tutorial' ? 'active' : ''}`} onClick={() => go('Learn')}>
        <Club size={16} /> Switch AI
      </button>
    </nav>
    <button
      className={`desktop-premium-btn ${isPremium ? 'is-active' : ''}`}
      onClick={() => setShowPremiumModal(true)}
    >
      <Crown size={18} weight={isPremium ? 'fill' : 'regular'} />
      <span>{isPremium ? 'Club Member' : 'Club Pass'}</span>
    </button>
  </header>

  <MobileScroll key={page+(page==='Tutorial'?game.status:'')} className="switch-scroll"><main className={'switch-content '+(page==='Learn'?'home':'interior')+(page==='Tutorial'?' tutorial-page':'')}>

  {/* Mobile Companion Header */}
  {isCompanionInterior && (
    <header className="small-brand">
      <button onClick={()=>go('Home')} aria-label="The Card Companion home">
        <Club weight="fill" size={20}/> THE CARD COMPANION
      </button>
      <button aria-label="Explore premium" onClick={()=>setShowPremiumModal(true)}>
        <Crown size={22} color={isPremium ? "#ac7b26" : undefined} weight={isPremium ? "fill" : "regular"} />
      </button>
    </header>
  )}

  {/* PAGE: HOME */}
  {page === 'Home' && (
    <HomeView
      onNavigate={(dest) => {
        if (dest === 'Switch') go('Learn');
        else go(dest);
      }}
      onStartScoreForGame={startScorekeeperForGame}
      onOpenPremium={() => setShowPremiumModal(true)}
      isPremium={isPremium}
    />
  )}

  {/* PAGE: TOP 10 CARD GAMES */}
  {page === 'Games' && (
    <>
      <GamesLibraryView
        onStartScorekeeper={startScorekeeperForGame}
        onPlaySwitchAI={start}
        onOpenPremium={() => setShowPremiumModal(true)}
        isPremiumUser={isPremium}
      />
      <AdSlot hidden={isPremium || adFree} />
    </>
  )}

  {/* PAGE: TABLE SCOREKEEPER */}
  {page === 'Score' && (
    <>
      <Scorekeeper
        leagues={leagues}
        players={players}
        activeLeagueId={activeLeagueId}
        onSaveMatch={handleSaveMatch}
        onAddPlayer={handleAddPlayer}
        selectedGameId={scoreGameId}
      />
      <AdSlot hidden={isPremium || adFree} />
    </>
  )}

  {/* PAGE: LEAGUES */}
  {page === 'Leagues' && (
    <>
      <LeaguesView
        leagues={leagues}
        players={players}
        activeLeagueId={activeLeagueId}
        matchHistory={matchHistory}
        onSelectLeague={setActiveLeagueId}
        onCreateLeague={handleCreateLeague}
      />
      <AdSlot hidden={isPremium || adFree} />
    </>
  )}

  {/* PAGE: STATS & TROPHIES */}
  {page === 'Stats' && (
    <>
      <StatsView
        players={players}
        matchHistory={matchHistory}
      />
      <AdSlot hidden={isPremium || adFree} />
    </>
  )}

  {page==='Learn'?<>
    <section className="rules-banner"><div className="wordmark"><Club weight="fill"/><div>SWITCH</div><p>RULES FOR A BETTER<br/>GAME NIGHT</p></div><p className="eyebrow">THE COMPLETE GUIDE</p><h1>Know the rules.<br/>Own the table.</h1><p>Five clear steps, then a guided game to put them into practice.</p><button className="primary" onClick={start}>Play against the computer <ArrowRight size={19}/></button></section>
    <section className="companion-jump-banner" style={{ background: '#f5eedf', padding: '12px 16px', borderTop: '1px solid #ebd9b7', borderBottom: '1px solid #ebd9b7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: '#8a652b', textTransform: 'uppercase' }}>CARD COMPANION</span>
        <strong style={{ display: 'block', fontSize: '13px', color: '#053527' }}>Top 10 Games & Scorekeeper</strong>
      </div>
      <button className="primary" style={{ minHeight: '34px', padding: '6px 12px', fontSize: '11px', width: 'auto' }} onClick={()=>go('Games')}>
        Explore Library <ArrowRight size={14}/>
      </button>
    </section>
    <section className="rule-narrative" aria-labelledby="rule-story-title"><p className="eyebrow">THE MAIN EVENT</p><h2 id="rule-story-title">Learn Switch<br/>in five moves.</h2><p className="rule-intro">A clear, visual guide from the first deal to the winning card.</p><div className="rule-steps" aria-label="Rule guide steps">{ruleChapters.map((chapter,index)=><button key={chapter.number} className={ruleStep===index?'active':''} aria-current={ruleStep===index?'step':undefined} onClick={()=>setRuleStep(index)}><span>{chapter.number}</span><small>{index===0?'Deal':index===1?'Play':index===2?'Power':index===3?'Call':'Win'}</small></button>)}</div><article className="rule-chapter"><div className="rule-chapter-head"><div><p>{ruleChapters[ruleStep].eyebrow}</p><h3>{ruleChapters[ruleStep].title}</h3></div><Fan codes={ruleChapters[ruleStep].cards}/></div><p className="rule-chapter-body">{ruleChapters[ruleStep].body}</p><ul>{ruleChapters[ruleStep].points.map(point=><li key={point}><CheckCircle size={17} weight="fill"/><span>{point}</span></li>)}</ul><aside><Lightbulb size={18} weight="fill"/><span>{ruleChapters[ruleStep].tip}</span></aside><div className="rule-controls"><button className="secondary" disabled={ruleStep===0} onClick={()=>setRuleStep(step=>step-1)}>Previous</button>{ruleStep<ruleChapters.length-1?<button className="primary" onClick={()=>setRuleStep(step=>step+1)}>Next rule <ArrowRight size={17}/></button>:<button className="primary" onClick={start}>Play the guided game <ArrowRight size={17}/></button>}</div></article><button className="rule-search-link" onClick={()=>go('Questions')}><MagnifyingGlass size={19}/><span><strong>Need one answer?</strong><small>Search every rule in seconds</small></span><ArrowRight size={18}/></button></section>
    <section className="power-preview"><div className="ornament"><Club weight="fill"/></div><h2>Know your power cards</h2><p className="section-caption">The cards that change the game.</p><div className="power-columns">{[powers[0],powers[2],powers[6]].map(p=><button key={p.name} onClick={()=>setSelected(p)}><Fan codes={p.cards}/><h3>{p.name}</h3><p>{p.short}.</p><span>View rule <ArrowRight size={12}/></span></button>)}</div></section>
    <AdSlot hidden={adFree}/><section className="night-note"><p className="eyebrow">MAKE IT A GAME NIGHT</p><h2>A little friendly rivalry.</h2><p>From a quick head-to-head to your very own Switch Cup.</p><button className="text-link" onClick={()=>go('Modes')}>Explore game modes <ArrowRight size={18}/></button></section><button className="member-strip" onClick={()=>setMembership(true)}><Crown size={24}/><span>More time at the table<small>Explore an ad-free experience</small></span><ArrowRight size={20}/></button><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Download all rules</button>
  </>:<>
    <header className="small-brand"><button onClick={()=>go('Learn')} aria-label="Switch home"><Club weight="fill" size={20}/> SWITCH</button><button aria-label="Explore ad-free preview" onClick={()=>setMembership(true)}><Crown size={22}/></button></header>
    {page==='Cards'&&<><p className="eyebrow">YOUR TABLE-SIDE REFERENCE</p><h1>Every card.<br/>Every possibility.</h1><p className="intro">Tap a card to see its effect, defence and exceptions.</p><div className="power-list">{powers.map(p=><button key={p.name} onClick={()=>setSelected(p)}><Fan codes={p.cards.slice(0,2)}/><span><strong>{p.name}</strong><small>{p.short}</small></span><ArrowRight size={19}/></button>)}</div><AdSlot hidden={adFree}/></>}
    {page==='Questions'&&<><p className="eyebrow">SETTLE THE DEBATE</p><h1>There’s a rule<br/>for that.</h1><p className="intro">Quick answers, before the next card lands.</p><div className="search"><MagnifyingGlass size={21}/><KeyboardInput aria-label="Search rules" placeholder="Try “ace” or “last card”" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><p className="results" aria-live="polite">{query?`${result.length} matching ${result.length===1?'answer':'answers'}`:'THE ESSENTIALS'}</p><div className="answers">{result.map(r=><details key={r.q}><summary>{r.q}</summary><p>{r.a}</p></details>)}</div>{!result.length&&<div className="empty"><Cards size={40}/><h2>No matching rule yet.</h2><p>Try a card name such as “king”, or browse all the rules.</p><button className="secondary" onClick={()=>{keyboard.hide();setQuery('');}}>Show all rules</button></div>}<p className="house-note">Every table has its traditions. These answers follow the rules in your original Switch guide.</p><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Keep a copy of the rules</button><a className="community" href="https://783j5slzrfvf.trickle.host/#comments" target="_blank" rel="noreferrer">Visit the original community discussion <ArrowRight size={16}/></a><AdSlot hidden={adFree}/></>}
    {page==='Modes'&&<><p className="eyebrow">YOUR PEOPLE. YOUR GAME.</p><h1>Make a night<br/>of it.</h1><p className="intro">Six ways to play. One great card game.</p><div className="mode-list">{modes.map((m,i)=><details key={m.name}><summary><span className="mode-number">0{i+1}</span><span><strong>{m.name}</strong><small>{m.label}</small></span></summary><p>{m.text}</p></details>)}</div><AdSlot hidden={adFree}/><button className="download" onClick={downloadRules}><DownloadSimple size={20}/>Download game-night rules</button></>}
    {page==='Tutorial'&&<section className="tutorial game-tutorial" aria-label={deckDescription}>{game.status!=='playing'?<div className="completion"><CheckCircle size={60} weight="light"/><p className="eyebrow">{game.status==='won'?'GAME WON':'GOOD PRACTICE'}</p><h1>{game.status==='won'?<>You beat the<br/>computer.</>:<>The computer<br/>won this one.</>}</h1><p>{game.notice}</p><button className="primary" onClick={start}><ArrowCounterClockwise size={18}/>Play another guided game</button><button className="secondary" onClick={()=>go('Cards')}>Open card guide <ArrowRight size={18}/></button><AdSlot hidden={adFree}/></div>:<><div className="lesson-meta"><span>GUIDED GAME · {game.turn==='you'?'YOUR TURN':'COMPUTER TURN'}</span><button onClick={()=>go('Learn')}>Exit game</button></div><div className="opponent" aria-label={`Computer has ${game.computerHand.length} cards`}><span>COMPUTER</span><div>{game.computerHand.slice(0,5).map((_,i)=><CardImage code="back" key={i}/>)}</div><strong>{game.computerHand.length} card{game.computerHand.length===1?'':'s'}</strong></div><div className="game-table"><button className="draw-pile" onClick={drawOrResolve} disabled={game.turn!=='you'||game.awaitingLastCard||!!staged.length||game.pending==='eight'} aria-label={game.pending==='eight'?'Draw pile unavailable while resolving the eight':game.pendingDraw?`Pick up ${game.pendingDraw} cards`:legalCards.length?'Pick up one card instead of playing':'Draw a card'}><CardImage code="back"/><span>{game.pending==='eight'?'Eight played':game.pendingDraw?`Pick up ${game.pendingDraw}`:legalCards.length?'Pick up instead':'Draw'}</span></button><div className="discard-pile"><CardImage code={topCard}/><span>Current suit <b className={(game.currentSuit==='H'||game.currentSuit==='D')?'red':''}>{suitSymbols[game.currentSuit]} {suitNames[game.currentSuit]}</b></span></div></div><p className="game-notice" aria-live="polite">{game.turn==='computer'?'Computer is choosing a card…':game.notice}</p>{game.turn==='you'&&game.pending==='eight'&&!game.awaitingLastCard&&<div className="miss-turn-action"><strong>The computer played an eight</strong><p>{legalCards.some(card=>rank(card)==='8')?'Play an eight to pass the missed turn, or accept it.':'You have no eight to counter with, so you must miss this turn.'}</p><button className="primary" onClick={drawOrResolve}>Accept missed turn <ArrowRight size={18}/></button></div>}{game.awaitingLastCard?<div className="last-card-call"><HandPalm size={27}/><strong>One card remaining</strong><p>Say “Last Card” now. Forgetting costs two cards.</p><button className="primary" onClick={()=>answerLastCard(true)}>Say “Last Card”</button><button className="text-link" onClick={()=>answerLastCard(false)}>Continue without saying it</button></div>:<><div className="game-actions"><button className={'hint-button '+(game.hint?'active':'')} onClick={()=>setGame(current=>({...current,hint:!current.hint}))} disabled={game.turn!=='you'}><Lightbulb size={19} weight={game.hint?'fill':'regular'}/>{game.hint?'Hide hint':'Show hint'}</button><span>{game.playerHand.length} cards in your hand</span></div>{game.hint&&<p className="game-hint"><Lightbulb size={17}/>{gameHint}</p>}<div className="player-hand" aria-label="Your hand">{game.playerHand.map(card=><button key={card} onClick={()=>chooseCard(card)} className={(game.hint&&canPlay(card,game,game.playerHand.length)?'playable ':'')+(staged.includes(card)?'selected':'')} disabled={game.turn!=='you'} aria-label={`Play ${card}${canPlay(card,game,game.playerHand.length)?', legal move':', not currently playable'}`}><CardImage code={card}/></button>)}</div>{staged.length>0&&<div className="multi-action"><p>{staged.length} matching card{staged.length===1?'':'s'} selected</p><button className="primary" onClick={playStaged}>Play selected</button><button className="text-link" onClick={()=>setStaged([])}>Cancel selection</button></div>}</>}{aceChoice&&<div className="suit-choice" role="dialog" aria-label="Choose a suit"><p>Choose the suit for your ace</p><div>{(['S','H','D','C'] as Suit[]).map(chosen=><button key={chosen} className={(chosen==='H'||chosen==='D')?'red':''} onClick={()=>{setGame(current=>playSet(current,aceChoice,chosen));setAceChoice(null);setStaged([]);}}>{suitSymbols[chosen]}<span>{suitNames[chosen]}</span></button>)}</div><button className="text-link" onClick={()=>setAceChoice(null)}>Cancel</button></div>}<div className="game-rule"><strong>Rule in play</strong><p>{game.pending==='two'?`Twos stack. The penalty is ${game.pendingDraw}.`:game.pending==='black-king'?`Another black king adds 5 and passes the penalty on. A red king cancels 5. Otherwise pick up ${game.pendingDraw}.`:game.pending==='eight'?'Counter with another eight or miss your turn.':'Match the suit or number, or pick up one card instead. Aces are wild on ordinary cards and let you choose the next suit. Matching numbers may be played together.'}</p></div></>}</section>}
  </>}
  </main></MobileScroll><nav className="bottom-tabs" aria-label="Main navigation" style={{bottom:bottomInset}}>{([
    {name:'Home',label:'Home',Icon:House},
    {name:'Games',label:'Top 10',Icon:Cards},
    {name:'Score',label:'Score',Icon:Trophy},
    {name:'Leagues',label:'Leagues',Icon:UsersThree},
    {name:'Stats',label:'Stats',Icon:ChartBar},
    {name:'Learn',label:'Switch',Icon:Club},
  ] as const).map(({name,label,Icon})=>{
    const isActive = page===name || (name==='Learn'&&['Tutorial','Cards','Modes','Questions'].includes(page));
    return <button key={name} className={isActive?'active':''} aria-current={isActive?'page':undefined} onClick={()=>go(name)}><Icon weight={isActive?'fill':'regular'} size={24}/><span>{label}</span></button>;
  })}</nav>
  <BottomSheet open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title={selected?.name||'Card rule'}>{selected&&<div className="rule-sheet"><Fan codes={selected.cards}/><p className="eyebrow">{selected.short}</p><p>{selected.text}</p><div className="exception"><strong>At the table</strong><p>{selected.extra}</p></div><button className="primary" onClick={()=>setSelected(null)}>Got it <CheckCircle size={19}/></button></div>}</BottomSheet>
  <BottomSheet open={membership} onOpenChange={setMembership} title="A little more Switch" description="A preview of possible paid extras. No purchase or charge."><div className="membership"><Crown size={38} weight="light"/><h2>Keep the good<br/>times going.</h2><p>An ad-free experience, printable game-night packs and custom table themes are options for a future Switch Club.</p><div className="preview-label">INTERACTIVE PREVIEW</div><button className="primary" onClick={()=>{handleTogglePremium();setMembership(false);}}>{isPremium?'Restore demo ads':'Preview without ads'} <ArrowRight size={18}/></button><p className="fine-print">This changes the preview only. Paid plans are not available yet.</p></div></BottomSheet>
  <PremiumModal isOpen={showPremiumModal} onClose={()=>setShowPremiumModal(false)} isPremium={isPremium} onTogglePremium={handleTogglePremium} /></div>;
}
