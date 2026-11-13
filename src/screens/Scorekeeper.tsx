import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, CaretLeft, CheckCircle, Crown } from '@phosphor-icons/react';
import { CardShower, FeltHeader, MiniFan } from '../ui';
import { BottomSheet, KeyboardInput, useKeyboard } from '../mobile';
import { clearCupResult, createCup, cupUndoStep, drawNextCupRound, isCupFinal, selectCupWinner, undoCupStep, type CupState } from '../switch/cup';
import { createCrossLeaguePlayoffs, rankLeague, tiedGroups, type League } from '../switch/leagues';
import { clearPicks, emptyLeagueProgress, recordFinisher, settleTie, undoLastRound, undoRoundBlocker, type LeagueProgress } from '../switch/leagueNight';
import { createKnockout, createPlayoffKnockout, markLost, undoKnockout, type KnockoutState } from '../switch/knockout';
import { addNight, completionFromCup, completionFromKnockout, completionFromLeagues, completionFromSession, createNightRecord } from '../switch/history';
import { ensureProfiles, getProfiles } from '../switch/profiles';
import ClubhouseLeagues from './ClubhouseLeagues';
import ShareNight from './ShareNight';
import { buildSnapshot, loadKeys, publishResult } from '../switch/shareNight';
import HandCounter from './HandCounter';
import { evenSizes, shuffled } from '../switch/draw';
import { isGameMatch } from '../switch/scoring';
import TrophyRoom from './TrophyRoom';
import ClubhouseStats from './ClubhouseStats';
import NightHistory from './NightHistory';
import { applyScoreCommand, scoreWinnerId, createSession, ScoreValidationError, undoScoreCommand, type ScoreFormat, type ScoreSession } from '../switch/scoring';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY, type ScorekeeperState } from '../switch/storage';
import type { Player } from '../switch/types';
import { getClubName } from '../switch/club';
import { announceClubWritten } from '../switch/clubStore';
import { useConfirm } from '../Confirm';
import { clearActiveNight, getActiveNight, putActiveNight, type ActiveNight } from '../switch/activeNight';
import DealerBar from './DealerBar';
import VenueFields from './VenueFields';
import { clearDealers, getDealers, passDeal, pickDealer, putDealers, setDealer, undoDeal, withSeats, type DealerState } from '../switch/dealer';
import { cleanPlace, getLastPlace, guessCountry, putLastPlace } from '../switch/places';

const scoreFormats:{id:ScoreFormat;name:string;description:string}[]=[
  {id:'head-to-head',name:'One v One',description:'Play first to a number of games, or best of an odd number of games.'},
  {id:'domino',name:'Domino',description:'Any whole-number round score and a flexible target.'},
  {id:'darts',name:'Darts',description:'Win three legs to take a set. First to the agreed number of sets (3 or 5) wins the match.'},
  {id:'league',name:'Group Play',description:'One to four leagues of 3 to 6 players, drawn at random, then championship and plate playoffs.'},
  {id:'knockout',name:'Knock Out',description:'Three to six players; mark the round loser LOST.'},
  {id:'cup',name:'Switch Cup',description:'Two to ten players with automatic byes.'},
];
/** Each game type's little hand of cards, shown in the picker. */
const FORMAT_CARDS:Record<ScoreFormat,string[]>={'head-to-head':['AS','AH'],domino:['5D','6D'],darts:['3H','3S','3D'],league:['QH','QS','QC'],knockout:['2C','8S','KS'],cup:['KH','KD']};
const newPlayer=(index:number):Player=>({id:`player-${Date.now()}-${index}`,name:''});
/** Dev-server switch for the browser tests: keep typed order when the app would otherwise draw at random. */
const keepTypedOrder=import.meta.env.DEV&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('typedDraw');
type ClubView='score'|'stats'|'leagues'|'trophies'|'history';
/** One screen, two homes: SCORE shows the scorecard and saved nights; CLUB shows the club's stats, seasons, trophies and history. */
const SECTION_TABS:Record<'score'|'club',readonly (readonly [ClubView,string])[]>={score:[['score','Scorecard'],['history','History']],club:[['stats','Stats'],['leagues','Seasons'],['trophies','Trophies'],['history','History']]};
export default function SwitchScorekeeper({onBack,backLabel='Home',initialView='score',onView,section='score',onQuick,onModes}:{onBack:()=>void;backLabel?:string;initialView?:ClubView;onView?:(view:ClubView)=>void;section?:'score'|'club';onQuick?:()=>void;onModes?:()=>void}){
  const keyboard=useKeyboard();
  const [confirm,confirmSheet]=useConfirm();
  const [loaded]=useState(()=>loadScorekeeper(typeof window==='undefined'?null:window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY)));
  const active=getActiveNight(loaded.state.extensions);
  const activeFormat:ScoreFormat|undefined=active?.kind==='score'?active.session.format:active?.kind==='knockout'?'knockout':active?.kind==='cup'?'cup':active?.kind==='league'?'league':undefined;
  const initialFormat=activeFormat??(scoreFormats.some(item=>item.id===loaded.state.selectedFormat)?loaded.state.selectedFormat as ScoreFormat:'domino');
  const [format,setFormat]=useState<ScoreFormat>(initialFormat);
  const activePlayers=active?.kind==='score'?active.session.players:active?.kind==='knockout'||active?.kind==='cup'?active.state.players:active?.kind==='league'?active.players:null;
  const [players,setPlayers]=useState<Player[]>(()=>activePlayers?[...activePlayers]:loaded.state.players.length?[...loaded.state.players]:[newPlayer(0),newPlayer(1)]);
  const [target,setTarget]=useState(String(active?.kind==='score'?active.session.target:loaded.state.target||100));
  const [sizes,setSizes]=useState<number[]>(()=>active?.kind==='league'?(active.sizes?[...active.sizes]:Array.from({length:active.leagueCount},()=>4)):[4,4]);
  const leagueCount=sizes.length;
  const [drawn,setDrawn]=useState(0);
  const [cupOrder,setCupOrder]=useState<number[]|null>(null);
  const [session,setSession]=useState<ScoreSession|null>(active?.kind==='score'?active.session:null);
  const [knockout,setKnockout]=useState<KnockoutState|null>(active?.kind==='knockout'?active.state:null);
  const [cup,setCup]=useState<CupState|null>(active?.kind==='cup'?active.state:null);
  const [leagueStarted,setLeagueStarted]=useState(active?.kind==='league');
  const [league,setLeague]=useState<LeagueProgress>(()=>active?.kind==='league'?{scores:{...active.scores},wins:{...active.wins},rounds:{...active.rounds},picks:{...active.picks},playoffOrder:{...active.playoffOrder},playoffKnockouts:{...(active.playoffKnockouts||{})},log:{...(active.log||{})}}:emptyLeagueProgress([]));
  const [games,setGames]=useState(String(active?.kind==='score'&&active.session.firstTo?active.session.firstTo:4));
  const [bestMode,setBestMode]=useState(active?.kind==='score'&&!!active.session.bestOf);
  const [bestOf,setBestOf]=useState(active?.kind==='score'&&active.session.bestOf?active.session.bestOf:7);
  const [setsToWin,setSetsToWin]=useState(active?.kind==='score'&&active.session.darts?active.session.darts.setsToWin:3);
  const [aceHigh,setAceHigh]=useState(active?.kind==='score'?active.aceHigh:false);
  const [scoreInputs,setScoreInputs]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [savedRaw,setSavedRaw]=useState(loaded.originalRaw);
  const [storedExtensions,setStoredExtensions]=useState<Record<string,unknown>>(()=>({...loaded.state.extensions}));
  const [nightName,setNightName]=useState('Switch Night');
  const [savedCurrent,setSavedCurrent]=useState(false);
  const [sentToFriends,setSentToFriends]=useState(false);
  // The save prompt opens by itself the moment a night is won; "Not yet" parks it until the result changes.
  const [savePromptFor,setSavePromptFor]=useState<string|null>(null);
  const [savePromptOpen,setSavePromptOpen]=useState(false);
  const [view,setView]=useState<ClubView>(initialView);
  const dealersRef=useRef<Record<string,DealerState>>(getDealers(loaded.state.extensions));
  const [dealers,setDealers]=useState<Record<string,DealerState>>(dealersRef.current);
  const [placeName,setPlaceName]=useState(()=>getLastPlace(loaded.state.extensions)?.name??'');
  const [placeCountry,setPlaceCountry]=useState(()=>getLastPlace(loaded.state.extensions)?.country??guessCountry());
  function setDealersNow(next:Record<string,DealerState>){dealersRef.current=next;setDealers(next);}
  /** Passes the deal clockwise (or steps it back when a result is undone), keeping the seats in step with who is still in. */
  function turnDeal(key:string,delta:number,seats?:readonly string[]){const current=dealersRef.current[key];if(!current)return;let next=current;if(delta>0){for(let i=0;i<delta;i+=1)next=passDeal(next);if(seats)next=withSeats(next,seats);}else{if(seats)next=withSeats(next,seats);for(let i=0;i<-delta;i+=1)next=undoDeal(next);}setDealersNow({...dealersRef.current,[key]:next});}
  useEffect(()=>{setView(initialView);},[initialView]);
  const requiredCount=format==='league'?sizes.reduce((total,size)=>total+size,0):format==='knockout'?Math.min(6,Math.max(3,players.length)):format==='cup'?Math.min(10,Math.max(2,players.length)):2;
  const visiblePlayers=players.slice(0,requiredCount);
  const savedPlayers=getProfiles(storedExtensions).filter(profile=>!profile.archived);
  function pickSavedPlayer(name:string){
    if(visiblePlayers.some(player=>player.name.trim().toLowerCase()===name.toLowerCase()))return;
    const emptyIndex=visiblePlayers.findIndex(player=>!player.name.trim());
    if(emptyIndex<0){setError('Every seat already has a name. Clear one to swap in '+name+'.');return;}
    setError('');setPlayers(current=>current.map((player,index)=>index===emptyIndex?{...player,name}:player));
  }
  function resizePlayers(count:number){setPlayers(current=>{const next=[...current];while(next.length<count)next.push(newPlayer(next.length));return next.slice(0,count);});}
  function planLeagues(count:number,total:number){
    if(count<1||count>4)return;
    const clamped=Math.min(6*count,Math.max(3*count,total));
    setSizes(evenSizes(clamped,count));resizePlayers(clamped);setDrawn(0);
  }
  function drawLeagues(){
    const hat=shuffled(visiblePlayers.map(player=>player.name.trim()).filter(Boolean));
    if(hat.length<2){setError('Add some names first, then draw the leagues.');return;}
    setError('');
    setPlayers(current=>{const next=current.slice(0,requiredCount).map(player=>({...player,name:''}));let cursor=0;
      for(let league=0;league<sizes.length;league+=1){for(let seat=0;seat<sizes[league]&&cursor<hat.length;seat+=1){const slot=leagueOffsets[league]+seat;next[slot]={...next[slot],name:hat[cursor]};cursor+=1;}}
      return [...next,...current.slice(requiredCount)];});
    setDrawn(count=>count+1);
  }
  function drawCup(){if(visiblePlayers.some(player=>!player.name.trim())){setError('Add a name for every player, then draw.');return;}setError('');setCupOrder(shuffled(visiblePlayers.map((_,index)=>index)));}
  function chooseFormat(next:ScoreFormat){setCupOrder(null);setFormat(next);setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setSavedCurrent(false);setError('');const count=next==='league'?sizes.reduce((total,size)=>total+size,0):next==='knockout'?Math.min(6,Math.max(3,players.length)):next==='cup'?Math.min(10,Math.max(2,players.length)):2;resizePlayers(count);}
  function persist(nextPlayers:readonly Player[],scores:Record<string,number>,extensionUpdates:Record<string,unknown>={},replaceExtensions=false){
    const merged=replaceExtensions?{...extensionUpdates}:{...storedExtensions,...extensionUpdates};
    const nextExtensions=Object.keys(dealersRef.current).length?putDealers(merged,dealersRef.current):clearDealers(merged);
    const state:ScorekeeperState={schemaVersion:1,selectedFormat:format,players:nextPlayers,scores,target:Number(target)||100,extensions:nextExtensions};
    const raw=saveScorekeeper(savedRaw,state,{replaceExtensions});window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY,raw);setSavedRaw(raw);
    announceClubWritten();
    setStoredExtensions(nextExtensions);
  }
  function start(){
    keyboard.hide();setError('');setSavedCurrent(false);let typed=visiblePlayers.map(player=>({...player,name:player.name.trim()}));
    if(typed.some(player=>!player.name)){setError('Add a name for every player before starting.');return;}
    // Ruling 16: the app draws the leagues. If nobody tapped Draw, draw now rather than use typing order.
    if(format==='league'&&!drawn){const hat=keepTypedOrder?typed.map(player=>player.name):shuffled(typed.map(player=>player.name));typed=typed.map((player,index)=>({...player,name:hat[index]}));}
    try{
      // Names resolve to stable local profiles, so every night builds on the same people.
      const ensured=ensureProfiles(storedExtensions,typed.map(player=>player.name));
      const named=[...ensured.players];const profileExt=ensured.extensions;
      setPlayers(current=>current.map((player,index)=>index<named.length?named[index]:player));
      const freshDealers:Record<string,DealerState>=format==='league'?Object.fromEntries(sizes.map((size,index)=>[`league-${index+1}`,pickDealer(named.slice(leagueOffsets[index],leagueOffsets[index]+size).map(player=>player.id))])):format==='cup'?{}:{main:pickDealer(named.map(player=>player.id))};
      setDealersNow(freshDealers);
      if(format==='knockout'){const next=createKnockout(named);setKnockout(next);persist(named,{},putActiveNight(profileExt,{version:1,kind:'knockout',state:next}));return;}
      if(format==='cup'){const useDraw=cupOrder&&cupOrder.length===named.length;const next=useDraw?createCup(cupOrder.map(index=>named[index]),()=>0.999999):createCup(named,Math.random);setCup(next);persist(named,{},putActiveNight(profileExt,{version:1,kind:'cup',state:next}));return;}
      if(format==='league'){const fresh=emptyLeagueProgress(named.map(player=>player.id));setLeague(fresh);setLeagueStarted(true);persist(named,{...fresh.scores},putActiveNight(profileExt,leagueSnapshot(named,fresh)));return;}
      const created=createSession(format,named,{target:Number(target),setsToWin,...(format==='head-to-head'?(bestMode?{bestOf}:{firstTo:Number(games)}):{})});
      // A new match always starts from nothing; a night in progress is restored from the saved active night instead.
      setSession(created);persist(named,{...created.scores},putActiveNight(profileExt,{version:1,kind:'score',session:created,aceHigh}));
    }catch(reason){setError(reason instanceof Error?reason.message:'The scorekeeper could not start.');}
  }
  function updateSession(next:ScoreSession){if(session&&next.history.length!==session.history.length)turnDeal('main',next.history.length-session.history.length);setSession(next);persist(next.players,{...next.scores},putActiveNight({darts:next.darts},{version:1,kind:'score',session:next,aceHigh}));}
  function updateCup(next:CupState){setCup(next);persist(next.players,{},putActiveNight({cup:next},{version:1,kind:'cup',state:next}));}
  function addScore(playerId:string){if(!session)return;try{const next=applyScoreCommand(session,{type:'add-score',playerId,value:scoreInputs[playerId]??''});updateSession(next);setScoreInputs(current=>({...current,[playerId]:''}));setError('');}catch(reason){setError(reason instanceof ScoreValidationError?reason.message:'That score could not be added.');}}
  const leagueOffsets=sizes.map((_,index)=>sizes.slice(0,index).reduce((total,size)=>total+size,0));
  const leagues:League[]=leagueStarted?Array.from({length:leagueCount},(_,leagueIndex)=>({id:`league-${leagueIndex+1}`,name:`League ${leagueIndex+1}`,playoffOrder:league.playoffOrder[`league-${leagueIndex+1}`]||[],results:visiblePlayers.slice(leagueOffsets[leagueIndex],leagueOffsets[leagueIndex]+sizes[leagueIndex]).map(player=>({player,points:league.scores[player.id]||0,wins:league.wins[player.id]||0}))})):[];
  const leagueDone=leagueStarted&&leagues.every(entry=>(league.rounds[entry.id]||0)>=entry.results.length);
  const playoffs=leagueDone?createCrossLeaguePlayoffs(leagues,Math.random):null;
  const PLACES=['1st','2nd','3rd','4th','5th','6th'];
  function leagueSnapshot(players:readonly Player[],progress:LeagueProgress):ActiveNight{return {version:1,kind:'league',players,leagueCount,sizes,scores:progress.scores,wins:progress.wins,rounds:progress.rounds,picks:progress.picks,playoffOrder:progress.playoffOrder,playoffKnockouts:progress.playoffKnockouts,log:progress.log};}
  function updateLeague(next:LeagueProgress){for(const id of Object.keys(next.rounds)){const diff=(next.rounds[id]||0)-(league.rounds[id]||0);if(diff)turnDeal(id,diff);}setLeague(next);setError('');persist(visiblePlayers,{...next.scores},putActiveNight({},leagueSnapshot(visiblePlayers,next)));}
  function tryLeague(change:()=>LeagueProgress){try{updateLeague(change());}catch(reason){setError(reason instanceof Error?reason.message:'That change could not be made.');}}
  const idsOf=(entry:League)=>entry.results.map(result=>result.player.id);
  function pickFinisher(entry:League,playerId:string){tryLeague(()=>recordFinisher(league,entry.id,idsOf(entry),playerId));}
  async function undoLeagueRound(entry:League){if(!await confirm({title:`Undo the last round of ${entry.name}?`,message:'Its points and round win come off the table, so you can enter it again.',confirmLabel:'Undo round'}))return;tryLeague(()=>undoLastRound(league,entry.id));}
  const [tiePicks,setTiePicks]=useState<Record<string,string[]>>({});
  function pickTieFinisher(entry:League,group:readonly Player[],playerId:string){
    const key=entry.id+':'+group.map(player=>player.id).join(',');const picks=[...(tiePicks[key]||[]),playerId];
    if(picks.length<group.length-1){setTiePicks(current=>({...current,[key]:picks}));return;}
    const finishing=[...picks,group.find(player=>!picks.includes(player.id))!.id];
    setTiePicks(current=>{const next={...current};delete next[key];return next;});tryLeague(()=>settleTie(league,entry.id,finishing));
  }
  // Never let a play-off problem blank the whole scorekeeper: fall back to a message.
  function koFor(key:string,entrants:readonly {player:Player}[]):KnockoutState|null{if(league.playoffKnockouts[key])return league.playoffKnockouts[key];if(entrants.length<2)return null;try{return createPlayoffKnockout(entrants.map(item=>item.player));}catch{return null;}}
  function playoffLost(key:string,state:KnockoutState,playerId:string){updateLeague({...league,playoffKnockouts:{...league.playoffKnockouts,[key]:markLost(state,playerId)}});}
  function playoffUndo(key:string,state:KnockoutState){updateLeague({...league,playoffKnockouts:{...league.playoffKnockouts,[key]:undoKnockout(state)}});}
  function playoffGroup(key:string,title:string,note:string,entrants:readonly {player:Player}[]){
    const state=koFor(key,entrants);
    if(!state)return <div className="playoff-group" key={key}><h3>{title}</h3>{entrants.length>1?<p>This play-off could not be set up. Play it at the table and note the winner.</p>:entrants[0]?<p>{entrants[0].player.name} <span>has a bye</span></p>:<p>No players in the {title.toLowerCase()} this time.</p>}</div>;
    const left=state.players.filter(player=>!state.eliminatedIds.includes(player.id));
    const total=state.players.length-1;const game=state.eliminatedIds.length+1;
    return <div className="playoff-group" key={key}><h3>{title}</h3><p className="playoff-note">{note}</p>
      <p className="playoff-status">{state.championId?`${state.players.find(player=>player.id===state.championId)?.name} wins the ${title.toLowerCase()}!`:`Game ${game} of ${total} · ${left.length} still playing · tap LOST on whoever finished last`}</p>
      {state.players.map(player=>{const out=state.eliminatedIds.includes(player.id);return <article className={'score-row '+(out?'lost':'')} key={player.id}><div><strong>{player.name}</strong><span>{out?'LOST':state.championId===player.id?'CHAMPION':'Still in'}</span></div>{!out&&!state.championId&&<button onClick={()=>playoffLost(key,state,player.id)}>LOST</button>}</article>;})}
      <button className="secondary" disabled={!state.eliminatedIds.length} onClick={()=>playoffUndo(key,state)}>Undo last game</button></div>;
  }
  const dealerBar=(key:string,list:readonly Player[])=>{const dealer=dealers[key];if(!dealer)return null;const nameOf=(id:string)=>list.find(player=>player.id===id)?.name??'Player';return <DealerBar dealer={dealer} nameOf={nameOf} onPass={()=>{turnDeal(key,1);persistHistory(storedExtensions);}} onPick={id=>{setDealersNow({...dealersRef.current,[key]:setDealer(dealer,id)});persistHistory(storedExtensions);}}/>;};
  const activeKnockout=knockout?knockout.players.filter(player=>!knockout.eliminatedIds.includes(player.id)):[];
  const currentRound=cup?.rounds.at(-1);
  const shareSnapshot=buildSnapshot({club:getClubName(storedExtensions)||undefined,session,knockout,cup,leagues:leagueStarted?leagues:[]});
  const cupPlayer=(id:string)=>cup?.players.find(player=>player.id===id);
  // Whoever has just won anything: a match, a Knock Out, the Cup or the league championship. A win already showing when the screen opens is not replayed.
  const celebrated=(session&&scoreWinnerId(session))||knockout?.championId||cup?.championId||(leagueStarted?league.playoffKnockouts.championship?.championId:null)||null;
  const winnerOnOpen=useRef(celebrated);
  const completion=session?completionFromSession(session):knockout?completionFromKnockout(knockout):cup?completionFromCup(cup):leagueStarted?completionFromLeagues(leagues,playoffs,league.playoffKnockouts):null;
  function persistHistory(nextExtensions:Record<string,unknown>,replaceExtensions=false){const currentPlayers=session?.players??knockout?.players??cup?.players??visiblePlayers;const currentScores=session?{...session.scores}:leagueStarted?{...league.scores}:{};persist(currentPlayers,currentScores,nextExtensions,replaceExtensions);}
  function saveCompletedNight(){if(!completion||savedCurrent)return;keyboard.hide();try{const place=cleanPlace(placeName,placeCountry);const night=createNightRecord(nightName,completion,undefined,undefined,place);const added=addNight(storedExtensions,night);setSentToFriends(publishResult(shareSnapshot,night));window.setTimeout(()=>setSavePromptOpen(false),0);setDealersNow({});persistHistory(clearActiveNight(place?putLastPlace(added,place):added),true);setSavedCurrent(true);setError('');setView('history');}catch(reason){setError(reason instanceof Error?reason.message:'This night could not be saved.');}}
  // A finished, unsaved night asks to be saved straight away, once per result (a correction that changes the result asks again).
  const completionKey=completion?`${completion.format}:${completion.winnerIds.join(',')}:${completion.outcome}`:null;
  useEffect(()=>{if(completionKey&&!savedCurrent&&completionKey!==savePromptFor){setSavePromptFor(completionKey);setSavePromptOpen(true);keyboard.hide();}if(!completionKey){setSavePromptFor(null);setSavePromptOpen(false);}},[completionKey,savedCurrent]);// eslint-disable-line react-hooks/exhaustive-deps
  const sharing=!!loadKeys()&&!!shareSnapshot;
  async function reset(){if(!await confirm({title:'End this game?',message:'The scores so far are cleared and you can choose a different game type. Player names are kept.',confirmLabel:'End game',destructive:true}))return;setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setLeague(emptyLeagueProgress([]));setTiePicks({});setSavedCurrent(false);setError('');setDealersNow({});persist(visiblePlayers,{},clearActiveNight(storedExtensions),true);}
  return <section className="scorekeeper" aria-labelledby="scorekeeper-title"><div className={'scorekeeper-head'+(view==='score'?'':' compact')}><button className="text-link back-link" aria-label={`Back to ${backLabel}`} onClick={onBack}><CaretLeft size={15} weight="bold" />{backLabel}</button>{section==='club'?<FeltHeader compact id="scorekeeper-title" title={getClubName(storedExtensions)||'Your club'} intro="Stats, seasons, trophies and every night you have saved." cards={['QS','KD']}/>:view==='score'?<FeltHeader compact id="scorekeeper-title" title="Keep every score straight." intro={getClubName(storedExtensions)||undefined} cards={['KC','QH']}/>:<span id="scorekeeper-title" hidden>Saved nights</span>}</div><CardShower trigger={celebrated&&celebrated!==winnerOnOpen.current?celebrated:null}/><div className={'club-tabs tabs-'+section} aria-label={section==='club'?'Club sections':'Scorekeeper sections'}>{SECTION_TABS[section].map(([id,label])=><button key={id} className={view===id?'active':''} aria-pressed={view===id} onClick={()=>{keyboard.hide();setView(id);onView?.(id);}}>{label}</button>)}</div>
    {view==='stats'&&<ClubhouseStats extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='leagues'&&<ClubhouseLeagues extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='trophies'&&<TrophyRoom extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='history'&&<NightHistory extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='score'&&<>
    {loaded.status==='unreadable'&&<div className="score-warning" role="alert"><strong>Saved scores could not be read.</strong><span>They have not been overwritten. Starting a new session will replace them only after you confirm your setup.</span></div>}
    {!session&&!knockout&&!cup&&!leagueStarted?<><div className="format-grid" aria-label="Score format">{scoreFormats.map(item=><button key={item.id} className={format===item.id?'active':''} aria-pressed={format===item.id} aria-label={item.name} onClick={()=>chooseFormat(item.id)}><MiniFan codes={FORMAT_CARDS[item.id]}/><strong>{item.name}</strong></button>)}</div><p className="format-note">{scoreFormats.find(item=>item.id===format)?.description}</p>
      {format==='league'&&<div className="count-control"><span>Leagues</span><button aria-label="Fewer leagues" disabled={leagueCount===1} onClick={()=>planLeagues(leagueCount-1,requiredCount-4)}>−</button><strong>{leagueCount}</strong><button aria-label="More leagues" disabled={leagueCount===4} onClick={()=>planLeagues(leagueCount+1,requiredCount+4)}>+</button></div>}
      {(format==='knockout'||format==='cup')&&<div className="count-control"><span>Players</span><button aria-label="Fewer players" disabled={players.length<=(format==='knockout'?3:2)} onClick={()=>resizePlayers(players.length-1)}>−</button><strong>{players.length}</strong><button aria-label="More players" disabled={players.length>=(format==='knockout'?6:10)} onClick={()=>resizePlayers(players.length+1)}>+</button></div>}
      {savedPlayers.length>0&&<div className="saved-players" aria-label="Saved players"><span>Saved players</span><div className="player-tokens">{savedPlayers.map(profile=><button key={profile.id} data-colour={profile.colour} aria-label={`Use saved player ${profile.name}`} aria-pressed={visiblePlayers.some(player=>player.name.trim().toLowerCase()===profile.name.toLowerCase())} onClick={()=>pickSavedPlayer(profile.name)}>{profile.name}</button>)}</div></div>}
      {format==='league'?<>
        <div className="count-control"><span>Players</span><button aria-label="Fewer players" disabled={requiredCount<=3*leagueCount} onClick={()=>planLeagues(leagueCount,requiredCount-1)}>−</button><strong>{requiredCount}</strong><button aria-label="More players" disabled={requiredCount>=6*leagueCount} onClick={()=>planLeagues(leagueCount,requiredCount+1)}>+</button></div>
        <div className="player-fields">{visiblePlayers.map((player,index)=><label key={player.id}><span>{`Player ${index+1}`}</span><KeyboardInput value={player.name} placeholder="Enter name" onChange={event=>setPlayers(current=>current.map(item=>item.id===player.id?{...item,name:event.target.value}:item))}/></label>)}</div>
        <div className="draw-box"><p>Now draw the leagues: the app puts each name in a league at random, as evenly as it can (for example 4, 4 and 3). If you skip this, the app draws when you start.</p><button className="secondary" onClick={drawLeagues}>{drawn?'Draw again':'Draw leagues at random'}</button>{drawn>0&&<p className="draw-done" role="status">Drawn! Check each league below.</p>}</div>
        {sizes.map((size,leagueIndex)=><section className="league-setup" key={leagueIndex} aria-label={`League ${leagueIndex+1} players`}><div className="league-setup-head"><h2>League {leagueIndex+1}</h2><span className="league-size">{size} players · {size} games</span></div><ul className="league-names">{visiblePlayers.slice(leagueOffsets[leagueIndex],leagueOffsets[leagueIndex]+size).map((player,index)=><li key={player.id} className={player.name.trim()?'':'empty'}>{player.name.trim()||`Seat ${index+1}`}</li>)}</ul></section>)}
      </>:<div className="player-fields">{visiblePlayers.map((player,index)=><label key={player.id}><span>{`Player ${index+1}`}</span><KeyboardInput value={player.name} placeholder="Enter name" onChange={event=>setPlayers(current=>current.map(item=>item.id===player.id?{...item,name:event.target.value}:item))}/></label>)}</div>}
      {format==='cup'&&<div className="draw-box"><p>Type every name, then draw the first round at random. With an odd number, one player gets a bye straight into round 2. Every later round is drawn at random too. Play each match as a single game or best of 3 at the table, then tap the winner.</p><button className="secondary" onClick={drawCup}>{cupOrder&&cupOrder.length===visiblePlayers.length?'Draw again':'Draw the 1v1s at random'}</button>{cupOrder&&cupOrder.length===visiblePlayers.length&&(()=>{const names=cupOrder.map(index=>visiblePlayers[index]?.name.trim()||`Seat ${index+1}`);const bye=names.length%2===1?names[0]:null;const rest=bye?names.slice(1):names;const pairs:string[][]=[];for(let k=0;k<rest.length;k+=2)pairs.push([rest[k],rest[k+1]]);return <div className="playoffs" role="status"><h3>Round 1 draw</h3>{pairs.map((pair,k)=><p key={k}>{pair[0]} <span>v</span> {pair[1]}</p>)}{bye&&<p>{bye} <span>has a bye</span></p>}</div>;})()}</div>}
      {format==='head-to-head'&&<><div className="count-control wide-toggle"><span>Match type</span><button aria-pressed={!bestMode} onClick={()=>setBestMode(false)}>First to</button><button aria-pressed={bestMode} onClick={()=>setBestMode(true)}>Best of</button></div>{bestMode?<div className="count-control"><span>Best of (odd) · first to {(bestOf+1)/2}</span><button aria-label="Fewer games" disabled={bestOf<=1} onClick={()=>setBestOf(bestOf-2)}>−</button><strong aria-live="polite">{bestOf}</strong><button aria-label="More games" disabled={bestOf>=21} onClick={()=>setBestOf(bestOf+2)}>+</button></div>:<div className="games-field"><span>First to win this many games</span><KeyboardInput inputMode="numeric" aria-label="Games to win" value={games} onChange={event=>setGames(event.target.value.replace(/[^0-9]/g,'').slice(0,2))}/></div>}</>}{format==='domino'&&<label className="target-field"><span>Target score</span><KeyboardInput inputMode="numeric" value={target} onChange={event=>setTarget(event.target.value)}/></label>}
      {format==='domino'&&<div className="count-control"><span>Ace counts as</span><button aria-pressed={!aceHigh} onClick={()=>setAceHigh(false)}>1</button><button aria-pressed={aceHigh} onClick={()=>setAceHigh(true)}>11</button></div>}
      {format==='darts'&&<div className="count-control"><span>Sets to win</span><button aria-pressed={setsToWin===3} onClick={()=>setSetsToWin(3)}>3</button><button aria-pressed={setsToWin===5} onClick={()=>setSetsToWin(5)}>5</button></div>}
      {error&&<p className="score-error" role="alert">{error}</p>}<button className="primary score-start" onClick={start}>Start {scoreFormats.find(item=>item.id===format)?.name} <ArrowRight size={18}/></button></>:
      <div className="active-score"><button className="change-game" onClick={reset}><ArrowCounterClockwise size={16} weight="bold" />Change game type</button>{session&&<><div className="score-status"><strong>{scoreFormats.find(item=>item.id===session.format)?.name}</strong><span>{session.format==='darts'?`First to ${session.darts?.setsToWin??3} sets · 3 legs take a set`:isGameMatch(session)?(session.bestOf?`Best of ${session.bestOf} · first to ${session.target} games`:`First to ${session.target} game${session.target===1?'':'s'}`):`Target ${session.target}${session.format==='domino'?` · ace ${aceHigh?11:1}`:''}`}</span></div>{!scoreWinnerId(session)&&dealerBar('main',session.players)}{scoreWinnerId(session)&&<p className="winner-banner" role="status"><Crown size={28} weight="fill"/>{session.players.find(player=>player.id===scoreWinnerId(session))?.name} wins the match!</p>}{session.players.map(player=><article className="score-row" key={player.id}><div><strong>{player.name}</strong>{session.format==='darts'?<span className="score-figure"><b>{session.darts?.sets[player.id]}</b> sets · {session.darts?.legs[player.id]} legs</span>:<span className="score-figure"><b>{session.scores[player.id]}</b> {isGameMatch(session)?(session.scores[player.id]===1?'game':'games'):'points'}</span>}</div>{session.format==='darts'||isGameMatch(session)?<button className="primary" disabled={!!scoreWinnerId(session)} onClick={()=>updateSession(applyScoreCommand(session,{type:'win-leg',playerId:player.id}))}>{session.format==='darts'?'Win leg':'Win game'}</button>:<div className="score-entry"><KeyboardInput aria-label={`Score for ${player.name}`} inputMode="numeric" value={scoreInputs[player.id]||''} onChange={event=>setScoreInputs(current=>({...current,[player.id]:event.target.value}))}/><button disabled={!!scoreWinnerId(session)} onClick={()=>addScore(player.id)}>Add</button></div>}</article>)}{session.format==='domino'&&!scoreWinnerId(session)&&<HandCounter aceHigh={aceHigh} players={session.players} onUse={(id,total)=>setScoreInputs(current=>({...current,[id]:String(total)}))}/>}{error&&<p className="score-error" role="alert">{error}</p>}<button className="secondary" disabled={!session.history.length} onClick={()=>updateSession(undoScoreCommand(session))}>Undo last score</button></>}
        {knockout&&<><div className="score-status"><strong>Knock Out</strong><span>{knockout.championId?'Champion decided':`${activeKnockout.length} still playing`}</span></div>{!knockout.championId&&dealerBar('main',knockout.players.filter(player=>!knockout.eliminatedIds.includes(player.id)))}{!knockout.championId&&<p className="dash-note">Round {knockout.eliminatedIds.length+1}: tap LOST on whoever finished last. Everyone else goes through.</p>}{knockout.players.map(player=><article className={'score-row '+(knockout.eliminatedIds.includes(player.id)?'lost':'')} key={player.id}><div><strong>{player.name}</strong><span>{knockout.eliminatedIds.includes(player.id)?'LOST':knockout.championId===player.id?'CHAMPION':'Still in'}</span></div>{!knockout.eliminatedIds.includes(player.id)&&!knockout.championId&&<button onClick={()=>{const next=markLost(knockout,player.id);turnDeal('main',1,next.players.filter(item=>!next.eliminatedIds.includes(item.id)).map(item=>item.id));setKnockout(next);persist(next.players,{},putActiveNight({knockout:next},{version:1,kind:'knockout',state:next}));}}>LOST</button>}</article>)}<button className="secondary" disabled={!knockout.eliminatedIds.length} onClick={()=>{const next=undoKnockout(knockout);turnDeal('main',-1,next.players.filter(item=>!next.eliminatedIds.includes(item.id)).map(item=>item.id));setKnockout(next);persist(next.players,{},putActiveNight({knockout:next},{version:1,kind:'knockout',state:next}));}}>Undo elimination</button></>}
        {cup&&currentRound&&(()=>{const final=isCupFinal(currentRound);const undoStep=cupUndoStep(cup);const roundName=final?'Final':`Round ${currentRound.number}`;return <><div className="score-status"><strong>Switch Cup</strong><span>{cup.championId?`${cupPlayer(cup.championId)?.name} is champion`:roundName}</span></div>{currentRound.byePlayerId&&<p className="bye-note"><strong>{cupPlayer(currentRound.byePlayerId)?.name}</strong> has the bye this round.</p>}{currentRound.fixtures.map(fixture=><article className="cup-fixture" key={fixture.id}><span>{fixture.winnerId?(final?'Final · winner':'Winner'):(final?'Final · choose winner':'Choose winner')}</span>{fixture.playerIds.map(playerId=><button key={playerId} className={fixture.winnerId===playerId?'winner':''} disabled={!!fixture.winnerId} onClick={()=>updateCup(selectCupWinner(cup,fixture.id,playerId))}>{cupPlayer(playerId)?.name}</button>)}{fixture.winnerId&&!cup.championId&&<button className="text-link cup-change" aria-label={`Change the winner of ${fixture.playerIds.map(id=>cupPlayer(id)?.name).join(' v ')}`} onClick={()=>updateCup(clearCupResult(cup,fixture.id))}>Change</button>}</article>)}{!cup.championId&&currentRound.fixtures.every(fixture=>fixture.winnerId)&&<button className="primary" onClick={()=>updateCup(drawNextCupRound(cup,Math.random))}>{final?'Crown the champion':'Draw next round'} <ArrowRight size={18}/></button>}{undoStep&&<button className="secondary" onClick={()=>updateCup(undoCupStep(cup))}>{undoStep==='champion'?'Undo crowning the champion':`Undo the round ${currentRound.number} draw`}</button>}</>;})()}
        {leagueStarted&&<><div className="score-status"><strong>{leagueCount} league{leagueCount===1?'':'s'}</strong><span>{leagueDone?'All rounds played':'Tap players in the order they finish each round'}</span></div>{leagues.map(entry=>{const picks=league.picks[entry.id]||[];const rounds=league.rounds[entry.id]||0;const size=entry.results.length;const undoBlock=undoRoundBlocker(league,entry.id);return <section className="league-table" key={entry.id}><h2>{entry.name}</h2>{rounds<size&&dealerBar(entry.id,entry.results.map(result=>result.player))}<p className="house-note">{rounds>=size?'All '+size+' rounds played.':'Round '+(rounds+1)+' of '+size+' · '+size+' points for 1st down to 1 for last'}</p>{rankLeague(entry.results,entry.playoffOrder).map(row=><article className="score-row" key={row.player.id}><div><strong>{rounds>0?`${row.rank}. `:''}{row.player.name}</strong><span>{row.points} point{row.points===1?'':'s'} · {row.wins??0} round win{(row.wins??0)===1?'':'s'}{rounds>=size&&row.tied?' · level':''}</span></div>{rounds<size&&<button aria-label={picks.includes(row.player.id)?row.player.name+' finished '+PLACES[picks.indexOf(row.player.id)]:row.player.name+' finished '+PLACES[picks.length]} disabled={picks.includes(row.player.id)} onClick={()=>pickFinisher(entry,row.player.id)}>{picks.includes(row.player.id)?PLACES[picks.indexOf(row.player.id)]:'Finished '+PLACES[picks.length]}</button>}</article>)}<div className="league-actions">{picks.length>0&&<button className="text-link" onClick={()=>updateLeague(clearPicks(league,entry.id))}>Clear this round</button>}{rounds>0&&picks.length===0&&<button className="text-link" disabled={!!undoBlock} title={undoBlock??undefined} onClick={()=>undoLeagueRound(entry)}>Undo last round</button>}{rounds>0&&picks.length===0&&undoBlock&&<span className="undo-note">{undoBlock}</span>}</div>{rounds>=size&&tiedGroups(entry).map(group=>{const key=entry.id+':'+group.map(player=>player.id).join(',');const done=tiePicks[key]||[];const names=group.map(player=>player.name);const list=names.length===2?names.join(' and '):names.slice(0,-1).join(', ')+' and '+names.at(-1);return <div className="playoff-needed" key={key}><p>{list} are level on points and round wins. They play one deciding game{group.length>2?': tap them in the order they finish.':'.'}</p>{group.map(player=>{const at=done.indexOf(player.id);return <button key={player.id} disabled={at>=0} onClick={()=>pickTieFinisher(entry,group,player.id)}>{group.length===2?player.name+' won':at>=0?player.name+' · '+PLACES[at]:player.name+' finished '+PLACES[done.length]}</button>;})}{done.length>0&&<button className="text-link" onClick={()=>setTiePicks(current=>({...current,[key]:[]}))}>Start this game again</button>}</div>;})}</section>;})}{playoffs?.status==='ready'?<div className="playoffs"><h2>Knockout playoffs</h2>{playoffGroup('championship',leagueCount===1?'Final':'Championship',leagueCount===1?'The top two play one game for the title. Tap LOST on whoever does not finish first.':'The top two from each league play a knockout: the player who finishes last each game drops out until two are left to play for the title.',playoffs.championship.entrants)}{playoffGroup('plate','Plate','Everyone else plays their own knockout, last place out each game, until one wins the plate.',playoffs.plate.entrants)}</div>:<p className="house-note">{playoffs?.status==='not-ready'?playoffs.reason:'Play every round in every league to unlock the playoffs.'}</p>}</>}
        {completion&&!savedCurrent&&<section className="save-now" aria-label="Save this night"><strong>This night is not saved yet</strong><span>Save it to put the result in everyone's history and stats.</span><button className="primary" onClick={()=>setSavePromptOpen(true)}>Save the night</button></section>}
        {savedCurrent&&<p className="night-ready saved-banner" role="status"><CheckCircle size={18}/>Saved to history{sentToFriends?' and sent to everyone who joined with the code.':'.'}</p>}
        {shareSnapshot&&<ShareNight snapshot={shareSnapshot}/>}
        {!completion&&!savedCurrent&&<section className="night-completion" aria-label="Completed night"><h2 className="night-completion-title">Save the night</h2><p className="night-pending">{leagueStarted?'Play every league round, then the championship and plate knockouts. The app will then ask you to save the night.':cup?'Play every Cup match, then crown the champion. The app will then ask you to save the night.':knockout?'Keep tapping LOST until one champion is left. The app will then ask you to save the night.':'When someone wins, the app asks you to save the night. Tied target scores need a clear winner first.'}</p></section>}
        </div>}</>}
  {section==='score'&&view==='score'&&(onQuick||onModes)&&<div className="score-shortcuts">{onQuick&&<button className="text-link" onClick={onQuick}>Quick night: real cards in 60 seconds <ArrowRight size={14}/></button>}{onModes&&<button className="text-link" onClick={onModes}>Ways to play <ArrowRight size={14}/></button>}</div>}
  <BottomSheet open={savePromptOpen&&!!completion} onOpenChange={next=>{if(!next)setSavePromptOpen(false);}} title="Save the night" description="So the win, the loss and every score count in everyone's history." snap={0.85}>
    {completion&&!savedCurrent&&<div className="save-sheet night-completion"><p className="save-sheet-outcome" role="status">{completion.outcome}</p><label><span>Night name</span><KeyboardInput aria-label="Night name" value={nightName} onChange={event=>setNightName(event.target.value)}/></label><VenueFields name={placeName} country={placeCountry} onName={setPlaceName} onCountry={setPlaceCountry}/>{error&&<p className="score-error" role="alert">{error}</p>}<button className="primary" onClick={saveCompletedNight}>Save completed night</button><p className="save-sheet-note">{sharing?'Everyone who joined with your code gets this result in their own history too.':'Tip: tap “Share live scores” before you save and the other players get this result on their phones too.'}</p><button className="text-link" onClick={()=>{keyboard.hide();setSavePromptOpen(false);}}>Not yet, I need to correct a score</button></div>}
  </BottomSheet>
  {confirmSheet}</section>;
}
