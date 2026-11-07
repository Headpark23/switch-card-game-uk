import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { KeyboardInput, useKeyboard } from '../mobile';
import { createCup, drawNextCupRound, selectCupWinner, type CupState } from '../switch/cup';
import { createCrossLeaguePlayoffs, playoffsNeeded, rankLeague, type League } from '../switch/leagues';
import { createKnockout, markLost, undoKnockout, type KnockoutState } from '../switch/knockout';
import { googleSignInConfigured, mountGoogleOneTap, signOutGoogleSession, type SignedInUser } from '../switch/googleIdentity';
import { addNight, completionFromCup, completionFromKnockout, completionFromLeagues, completionFromSession, createNightRecord } from '../switch/history';
import { ensureProfiles, getProfiles } from '../switch/profiles';
import ClubhouseLeagues from './ClubhouseLeagues';
import ClubhouseStats from './ClubhouseStats';
import NightHistory from './NightHistory';
import { applyScoreCommand, scoreWinnerId, createSession, ScoreValidationError, undoScoreCommand, type ScoreFormat, type ScoreSession } from '../switch/scoring';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY, type ScorekeeperState } from '../switch/storage';
import type { Player } from '../switch/types';
import { getClubName } from '../switch/club';

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
  if(!configured)return null;
  return <div className="google-signin"><div><strong>Optional Google sign-in</strong><span>Use Switch without an account, or sign in for future sharing and sync.</span></div>{configured?<div ref={buttonRef} className="google-button"/>:<p>Google sign-in is ready for a client ID and secure verification endpoint.</p>}{message&&<p role="alert">{message}</p>}</div>;
}
type ClubView='score'|'stats'|'leagues'|'history';
export default function SwitchScorekeeper({onBack,initialView='score'}:{onBack:()=>void;initialView?:ClubView}){
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
  const [leagueWins,setLeagueWins]=useState<Record<string,number>>({});
  const [leagueRounds,setLeagueRounds]=useState<Record<string,number>>({});
  const [leaguePicks,setLeaguePicks]=useState<Record<string,string[]>>({});
  const [playoffOrder,setPlayoffOrder]=useState<Record<string,string[]>>({});
  const [setsToWin,setSetsToWin]=useState(3);
  const [aceHigh,setAceHigh]=useState(false);
  const [scoreInputs,setScoreInputs]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [savedRaw,setSavedRaw]=useState(loaded.originalRaw);
  const [storedExtensions,setStoredExtensions]=useState<Record<string,unknown>>(()=>({...loaded.state.extensions}));
  const [nightName,setNightName]=useState('Switch Night');
  const [savedCurrent,setSavedCurrent]=useState(false);
  const [view,setView]=useState<ClubView>(initialView);
  const requiredCount=format==='league'?leagueCount*4:format==='knockout'?Math.min(6,Math.max(3,players.length)):format==='cup'?Math.min(10,Math.max(2,players.length)):2;
  const visiblePlayers=players.slice(0,requiredCount);
  const savedPlayers=getProfiles(storedExtensions).filter(profile=>!profile.archived);
  function pickSavedPlayer(name:string){
    if(visiblePlayers.some(player=>player.name.trim().toLowerCase()===name.toLowerCase()))return;
    const emptyIndex=visiblePlayers.findIndex(player=>!player.name.trim());
    if(emptyIndex<0){setError('Every seat already has a name. Clear one to swap in '+name+'.');return;}
    setError('');setPlayers(current=>current.map((player,index)=>index===emptyIndex?{...player,name}:player));
  }
  function resizePlayers(count:number){setPlayers(current=>{const next=[...current];while(next.length<count)next.push(newPlayer(next.length));return next.slice(0,count);});}
  function chooseFormat(next:ScoreFormat){setFormat(next);setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setSavedCurrent(false);setError('');const count=next==='league'?leagueCount*4:next==='knockout'?Math.min(6,Math.max(3,players.length)):next==='cup'?Math.min(10,Math.max(2,players.length)):2;resizePlayers(count);}
  function persist(nextPlayers:readonly Player[],scores:Record<string,number>,extensionUpdates:Record<string,unknown>={}){
    const nextExtensions={...storedExtensions,...extensionUpdates};
    const state:ScorekeeperState={schemaVersion:1,selectedFormat:format,players:nextPlayers,scores,target:Number(target)||100,extensions:nextExtensions};
    const raw=saveScorekeeper(savedRaw,state);window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY,raw);setSavedRaw(raw);
    setStoredExtensions(nextExtensions);
  }
  function start(){
    setError('');setSavedCurrent(false);const typed=visiblePlayers.map(player=>({...player,name:player.name.trim()}));
    if(typed.some(player=>!player.name)){setError('Add a name for every player before starting.');return;}
    try{
      // Names resolve to stable local profiles, so every night builds on the same people.
      const ensured=ensureProfiles(storedExtensions,typed.map(player=>player.name));
      const named=[...ensured.players];const profileExt=ensured.extensions;
      setPlayers(current=>current.map((player,index)=>index<named.length?named[index]:player));
      if(format==='knockout'){const next=createKnockout(named);setKnockout(next);persist(named,{},profileExt);return;}
      if(format==='cup'){const next=createCup(named,Math.random);setCup(next);persist(named,{},profileExt);return;}
      if(format==='league'){const scores=Object.fromEntries(named.map(player=>[player.id,loaded.state.scores[player.id]||0]));setLeagueScores(scores);setLeagueStarted(true);persist(named,scores,{...profileExt,leagueCount});return;}
      const created=createSession(format,named,{target:Number(target),setsToWin});
      const restored={...created,scores:{...created.scores,...Object.fromEntries(named.map(player=>[player.id,loaded.state.scores[player.id]||0]))}};setSession(restored);persist(named,{...restored.scores},profileExt);
    }catch(reason){setError(reason instanceof Error?reason.message:'The scorekeeper could not start.');}
  }
  function updateSession(next:ScoreSession){setSession(next);persist(next.players,{...next.scores},{darts:next.darts});}
  function updateCup(next:CupState){setCup(next);persist(next.players,{}, {cup:next});}
  function addScore(playerId:string){if(!session)return;try{const next=applyScoreCommand(session,{type:'add-score',playerId,value:scoreInputs[playerId]??''});updateSession(next);setScoreInputs(current=>({...current,[playerId]:''}));setError('');}catch(reason){setError(reason instanceof ScoreValidationError?reason.message:'That score could not be added.');}}
  const leagues:League[]=leagueStarted?Array.from({length:leagueCount},(_,leagueIndex)=>({id:`league-${leagueIndex+1}`,name:`League ${leagueIndex+1}`,playoffOrder:playoffOrder[`league-${leagueIndex+1}`]||[],results:visiblePlayers.slice(leagueIndex*4,leagueIndex*4+4).map(player=>({player,points:leagueScores[player.id]||0,wins:leagueWins[player.id]||0}))})):[];
  const leagueDone=leagueStarted&&leagues.every(league=>(leagueRounds[league.id]||0)>=league.results.length);
  const playoffs=leagueDone?createCrossLeaguePlayoffs(leagues,Math.random):null;
  const PLACES=['1st','2nd','3rd','4th','5th','6th'];
  function persistLeague(scores:Record<string,number>,wins:Record<string,number>,rounds:Record<string,number>,order:Record<string,string[]>){persist(visiblePlayers,scores,{leagueCount,leagueWins:wins,leagueRounds:rounds,leaguePlayoffOrder:order});}
  function pickFinisher(league:League,playerId:string){
    const picks=[...(leaguePicks[league.id]||[]),playerId];const size=league.results.length;
    if(picks.length<size-1){setLeaguePicks(current=>({...current,[league.id]:picks}));return;}
    const last=league.results.find(result=>!picks.includes(result.player.id))?.player.id as string;const finishing=[...picks,last];
    const scores={...leagueScores};const wins={...leagueWins};finishing.forEach((id,place)=>{scores[id]=(scores[id]||0)+(size-place);});wins[finishing[0]]=(wins[finishing[0]]||0)+1;
    const rounds={...leagueRounds,[league.id]:(leagueRounds[league.id]||0)+1};
    setLeagueScores(scores);setLeagueWins(wins);setLeagueRounds(rounds);setLeaguePicks(current=>({...current,[league.id]:[]}));persistLeague(scores,wins,rounds,playoffOrder);
  }
  function settlePlayoff(league:League,winnerId:string,loserId:string){
    const order={...playoffOrder,[league.id]:[...(playoffOrder[league.id]||[]).filter(id=>id!==winnerId&&id!==loserId),winnerId,loserId]};
    setPlayoffOrder(order);persistLeague(leagueScores,leagueWins,leagueRounds,order);
  }
  const activeKnockout=knockout?knockout.players.filter(player=>!knockout.eliminatedIds.includes(player.id)):[];
  const currentRound=cup?.rounds.at(-1);
  const cupPlayer=(id:string)=>cup?.players.find(player=>player.id===id);
  const completion=session?completionFromSession(session):knockout?completionFromKnockout(knockout):cup?completionFromCup(cup):leagueStarted?completionFromLeagues(leagues,playoffs):null;
  function persistHistory(nextExtensions:Record<string,unknown>){const currentPlayers=session?.players??knockout?.players??cup?.players??visiblePlayers;const currentScores=session?{...session.scores}:leagueStarted?leagueScores:{};persist(currentPlayers,currentScores,nextExtensions);}
  function saveCompletedNight(){if(!completion||savedCurrent)return;keyboard.hide();try{const night=createNightRecord(nightName,completion);persistHistory(addNight(storedExtensions,night));setSavedCurrent(true);setError('');setView('history');}catch(reason){setError(reason instanceof Error?reason.message:'This night could not be saved.');}}
  function reset(){if(!window.confirm('Reset this score session? Player names will be kept.'))return;setSession(null);setKnockout(null);setCup(null);setLeagueStarted(false);setLeagueScores({});setSavedCurrent(false);setError('');persist(visiblePlayers,{});}
  return <section className="scorekeeper" aria-labelledby="scorekeeper-title"><div className={'scorekeeper-head'+(view==='score'?'':' compact')}><button className="text-link" onClick={onBack}>← Modes</button><p className="eyebrow">{getClubName(storedExtensions)?getClubName(storedExtensions).toUpperCase():'SWITCH NIGHT'}</p>{view==='score'?<><h1 id="scorekeeper-title">Keep every score straight.</h1></>:<span id="scorekeeper-title" hidden>Switch club</span>}</div><div className="club-tabs" aria-label="Scorekeeper sections">{([['score','Score'],['stats','Stats'],['leagues','Leagues'],['history','History']] as const).map(([id,label])=><button key={id} className={view===id?'active':''} aria-pressed={view===id} onClick={()=>{keyboard.hide();setView(id);}}>{label}</button>)}</div>
    {view==='stats'&&<ClubhouseStats extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='leagues'&&<ClubhouseLeagues extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='history'&&<NightHistory extensions={storedExtensions} onChange={persistHistory}/>}
    {view==='score'&&<><GoogleOneTap/>
    {loaded.status==='unreadable'&&<div className="score-warning" role="alert"><strong>Saved scores could not be read.</strong><span>They have not been overwritten. Starting a new session will replace them only after you confirm your setup.</span></div>}
    {!session&&!knockout&&!cup&&!leagueStarted?<><div className="format-grid" aria-label="Score format">{scoreFormats.map(item=><button key={item.id} className={format===item.id?'active':''} aria-pressed={format===item.id} onClick={()=>chooseFormat(item.id)}><strong>{item.name}</strong></button>)}</div><p className="format-note">{scoreFormats.find(item=>item.id===format)?.description}</p>
      {format==='league'&&<div className="count-control"><span>Leagues</span><button aria-label="Fewer leagues" disabled={leagueCount===1} onClick={()=>{const next=leagueCount-1;setLeagueCount(next);resizePlayers(next*4);}}>−</button><strong>{leagueCount}</strong><button aria-label="More leagues" disabled={leagueCount===4} onClick={()=>{const next=leagueCount+1;setLeagueCount(next);resizePlayers(next*4);}}>+</button></div>}
      {(format==='knockout'||format==='cup')&&<div className="count-control"><span>Players</span><button aria-label="Fewer players" disabled={players.length<=(format==='knockout'?3:2)} onClick={()=>resizePlayers(players.length-1)}>−</button><strong>{players.length}</strong><button aria-label="More players" disabled={players.length>=(format==='knockout'?6:10)} onClick={()=>resizePlayers(players.length+1)}>+</button></div>}
      {savedPlayers.length>0&&<div className="saved-players" aria-label="Saved players"><span>Saved players</span><div className="player-tokens">{savedPlayers.map(profile=><button key={profile.id} data-colour={profile.colour} aria-label={`Use saved player ${profile.name}`} aria-pressed={visiblePlayers.some(player=>player.name.trim().toLowerCase()===profile.name.toLowerCase())} onClick={()=>pickSavedPlayer(profile.name)}>{profile.name}</button>)}</div></div>}
      <div className="player-fields">{visiblePlayers.map((player,index)=><label key={player.id}><span>{format==='league'?`League ${Math.floor(index/4)+1} · Player ${index%4+1}`:`Player ${index+1}`}</span><KeyboardInput value={player.name} placeholder="Enter name" onChange={event=>setPlayers(current=>current.map(item=>item.id===player.id?{...item,name:event.target.value}:item))}/></label>)}</div>
      {(format==='domino'||format==='head-to-head')&&<label className="target-field"><span>Target score</span><KeyboardInput inputMode="numeric" value={target} onChange={event=>setTarget(event.target.value)}/></label>}
      {format==='domino'&&<div className="count-control"><span>Ace counts as</span><button aria-pressed={!aceHigh} onClick={()=>setAceHigh(false)}>1</button><button aria-pressed={aceHigh} onClick={()=>setAceHigh(true)}>11</button></div>}
      {format==='darts'&&<div className="count-control"><span>Sets to win</span><button aria-pressed={setsToWin===3} onClick={()=>setSetsToWin(3)}>3</button><button aria-pressed={setsToWin===5} onClick={()=>setSetsToWin(5)}>5</button></div>}
      {error&&<p className="score-error" role="alert">{error}</p>}<button className="primary score-start" onClick={start}>Start {scoreFormats.find(item=>item.id===format)?.name} <ArrowRight size={18}/></button></>:
      <div className="active-score">{session&&<><div className="score-status"><strong>{scoreFormats.find(item=>item.id===session.format)?.name}</strong><span>{session.format==='darts'?`First to ${session.darts?.setsToWin??3} sets`:`Target ${session.target}${session.format==='domino'?` · ace ${aceHigh?11:1}`:''}`}</span></div>{scoreWinnerId(session)&&<p className="winner-banner" role="status">{session.players.find(player=>player.id===scoreWinnerId(session))?.name} wins the match!</p>}{session.players.map(player=><article className="score-row" key={player.id}><div><strong>{player.name}</strong>{session.format==='darts'?<span>{session.darts?.sets[player.id]} sets · {session.darts?.legs[player.id]} legs</span>:<span>{session.scores[player.id]} points</span>}</div>{session.format==='darts'?<button className="primary" disabled={!!scoreWinnerId(session)} onClick={()=>updateSession(applyScoreCommand(session,{type:'win-leg',playerId:player.id}))}>Win leg</button>:<div className="score-entry"><KeyboardInput aria-label={`Score for ${player.name}`} inputMode="numeric" value={scoreInputs[player.id]||''} onChange={event=>setScoreInputs(current=>({...current,[player.id]:event.target.value}))}/><button disabled={!!scoreWinnerId(session)} onClick={()=>addScore(player.id)}>Add</button></div>}</article>)}{error&&<p className="score-error" role="alert">{error}</p>}<button className="secondary" disabled={!session.history.length} onClick={()=>updateSession(undoScoreCommand(session))}>Undo last score</button></>}
        {knockout&&<><div className="score-status"><strong>Knockout</strong><span>{knockout.championId?'Champion decided':`${activeKnockout.length} still playing`}</span></div>{knockout.players.map(player=><article className={'score-row '+(knockout.eliminatedIds.includes(player.id)?'lost':'')} key={player.id}><div><strong>{player.name}</strong><span>{knockout.eliminatedIds.includes(player.id)?'LOST':knockout.championId===player.id?'CHAMPION':'Still in'}</span></div>{!knockout.eliminatedIds.includes(player.id)&&!knockout.championId&&<button onClick={()=>{const next=markLost(knockout,player.id);setKnockout(next);persist(next.players,{}, {knockout:next});}}>LOST</button>}</article>)}<button className="secondary" disabled={!knockout.eliminatedIds.length} onClick={()=>{const next=undoKnockout(knockout);setKnockout(next);persist(next.players,{}, {knockout:next});}}>Undo elimination</button></>}
        {cup&&currentRound&&<><div className="score-status"><strong>Switch Cup</strong><span>{cup.championId?`${cupPlayer(cup.championId)?.name} is champion`:`Round ${currentRound.number}`}</span></div>{currentRound.byePlayerId&&<p className="bye-note"><strong>{cupPlayer(currentRound.byePlayerId)?.name}</strong> has the bye this round.</p>}{currentRound.fixtures.map(fixture=><article className="cup-fixture" key={fixture.id}><span>{fixture.winnerId?'Winner':'Choose winner'}</span>{fixture.playerIds.map(playerId=><button key={playerId} className={fixture.winnerId===playerId?'winner':''} disabled={!!fixture.winnerId} onClick={()=>updateCup(selectCupWinner(cup,fixture.id,playerId))}>{cupPlayer(playerId)?.name}</button>)}</article>)}{!cup.championId&&currentRound.fixtures.every(fixture=>fixture.winnerId)&&<button className="primary" onClick={()=>updateCup(drawNextCupRound(cup,Math.random))}>Draw next round <ArrowRight size={18}/></button>}</>}
        {leagueStarted&&<><div className="score-status"><strong>{leagueCount} league{leagueCount===1?'':'s'}</strong><span>{leagueDone?'All rounds played':'Tap players in the order they finish each round'}</span></div>{leagues.map(league=>{const picks=leaguePicks[league.id]||[];const rounds=leagueRounds[league.id]||0;const size=league.results.length;return <section className="league-table" key={league.id}><h2>{league.name}</h2><p className="house-note">{rounds>=size?'All '+size+' rounds played.':'Round '+(rounds+1)+' of '+size+' · '+size+' points for 1st down to 1 for last'}</p>{rankLeague(league.results,league.playoffOrder).map(entry=><article className="score-row" key={entry.player.id}><div><strong>{entry.rank}. {entry.player.name}</strong><span>{entry.points} points · {entry.wins??0} round win{(entry.wins??0)===1?'':'s'}{entry.tied?' · level':''}</span></div><button aria-label={picks.includes(entry.player.id)?entry.player.name+' finished '+PLACES[picks.indexOf(entry.player.id)]:entry.player.name+' finished '+PLACES[picks.length]} disabled={rounds>=size||picks.includes(entry.player.id)} onClick={()=>pickFinisher(league,entry.player.id)}>{picks.includes(entry.player.id)?PLACES[picks.indexOf(entry.player.id)]:'Finished '+PLACES[picks.length]}</button></article>)}{picks.length>0&&<button className="text-link" onClick={()=>setLeaguePicks(current=>({...current,[league.id]:[]}))}>Clear this round</button>}{rounds>=size&&playoffsNeeded(league).map(([first,second])=><div className="playoff-needed" key={first.id+second.id}><p>Level on points and round wins: play a deciding game.</p><button onClick={()=>settlePlayoff(league,first.id,second.id)}>{first.name} won</button><button onClick={()=>settlePlayoff(league,second.id,first.id)}>{second.name} won</button></div>)}</section>;})}{playoffs?.status==='ready'?<div className="playoffs"><h2>Cross-league playoffs</h2><h3>Championship</h3>{playoffs.championship.fixtures.map(fixture=><p key={fixture.id}>{fixture.home.player.name} <span>v</span> {fixture.away.player.name}</p>)}<h3>Plate</h3>{playoffs.plate.fixtures.map(fixture=><p key={fixture.id}>{fixture.home.player.name} <span>v</span> {fixture.away.player.name}</p>)}</div>:<p className="house-note">{playoffs?.status==='not-ready'?playoffs.reason:'Play every round in every league to unlock the cross-league playoffs.'}</p>}</>}
        <section className="night-completion" aria-label="Completed night"><p className="eyebrow">SAVE THE NIGHT</p><label><span>Night name</span><KeyboardInput aria-label="Night name" value={nightName} onChange={event=>setNightName(event.target.value)}/></label>{savedCurrent?<p className="night-ready"><CheckCircle size={18}/>Saved to history on this device.</p>:completion?<><p className="night-ready"><CheckCircle size={18}/>{completion.outcome}. This result is ready to save.</p><button className="primary" onClick={saveCompletedNight}>Save completed night</button></>:<p className="night-pending">Finish this format to save a trustworthy result. Tied target scores need a clear winner.</p>}</section>
        <button className="text-link reset-score" onClick={reset}>Reset session</button></div>}</>}
  </section>;
}
