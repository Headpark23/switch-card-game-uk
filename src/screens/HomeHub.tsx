import { ArrowRight, Broadcast, CalendarPlus, ClockCounterClockwise, Club, GraduationCap, PuzzlePiece, Question, UsersThree } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { loadLink, wantJoinForm } from '../switch/clubSync';
import { fetchShare, loadKeys } from '../switch/shareNight';
import { readClub } from '../switch/clubStore';
import { getActiveNight } from '../switch/activeNight';
import { readActiveTable } from '../switch/activeTable';
import { getComputerGames, getMeId } from '../switch/computerLog';
import { getHistory } from '../switch/history';
import { getProfiles, resolveHistoryPlayerId } from '../switch/profiles';
import { powers } from '../content';
import { Fan } from '../ui';

const FORMAT_NAMES: Record<string, string> = { 'head-to-head': 'One v One', domino: 'Domino', darts: 'Darts', league: 'Group Play', knockout: 'Knock Out', cup: 'Switch Cup' };
const LEVEL_NAMES: Record<string, string> = { relaxed: 'Relaxed', standard: 'Standard', sharp: 'Sharp' };

/** The corner index of a playing card, so each launch tile reads as an ace dealt onto the table. */
function TileIndex({ suit, flip = false }: { suit: string; flip?: boolean }) {
  return <span className={'tile-index' + (flip ? ' flip' : '')} aria-hidden="true"><b>A</b><i>{suit}</i></span>;
}

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function when(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type Props = {
  onPlay: () => void;
  onResumeTable: () => void;
  onScore: () => void;
  onClub: () => void;
  onAchievements: () => void;
  onRules: () => void;
  onPuzzles: () => void;
  onQuestions: () => void;
  onPlan: () => void;
  onJoin: () => void;
  onJoinClub: () => void;
  onHistory: () => void;
  onPower: (power: (typeof powers)[number]) => void;
};

/** HOME: a compact, personal dashboard on the photographic card-table background. */
export default function HomeHub(props: Props) {
  const club = readClub();
  const sharing = loadKeys();
  const [arrived, setArrived] = useState<string[]>([]);
  // A game being shared shows who has opened it, so the host can see it worked without opening the scorecard.
  useEffect(() => {
    if (!sharing) return;
    let alive = true;
    fetchShare(sharing.code).then((result) => { if (alive) setArrived(result.joined.map((entry) => entry.name)); }).catch(() => { /* offline */ });
    return () => { alive = false; };
  }, [sharing?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const meId = getMeId(club);
  const profiles = getProfiles(club);
  const me = profiles.find((profile) => profile.id === meId && profile.name.toLowerCase() !== 'you');
  const activeNight = getActiveNight(club);
  const activeTable = readActiveTable();
  const nights = getHistory(club);
  const games = getComputerGames(club).filter((game) => !meId || game.playerId === meId);
  const fresh = nights.length === 0 && games.length === 0;

  type Row = { key: string; at: string; title: string; detail: string; won: boolean; open: () => void };
  const recent: Row[] = [
    ...nights.map((night): Row => {
      const mine = meId ? night.players.some((player) => resolveHistoryPlayerId(player, profiles) === meId && night.winnerIds.includes(player.id)) : false;
      const winners = night.players.filter((player) => night.winnerIds.includes(player.id)).map((player) => player.name).join(' & ');
      return { key: night.id, at: night.completedAt, title: night.title || `${FORMAT_NAMES[night.format] ?? night.formatLabel} night`, detail: `${FORMAT_NAMES[night.format] ?? night.formatLabel}${winners ? ` · won by ${winners}` : ''}`, won: mine, open: props.onHistory };
    }),
    ...games.map((game): Row => ({ key: game.id, at: game.playedAt, title: game.won ? 'Beat the computer' : `Finished ${game.place}${['st', 'nd', 'rd'][game.place - 1] ?? 'th'} v the computer`, detail: `${game.opponents === 1 ? '1 opponent' : `${game.opponents} opponents`} · ${LEVEL_NAMES[game.level] ?? game.level}`, won: game.won, open: props.onAchievements })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3);

  const nightLabel = activeNight ? (activeNight.kind === 'score' ? FORMAT_NAMES[activeNight.session.format] : activeNight.kind === 'league' ? 'Group Play' : activeNight.kind === 'cup' ? 'Switch Cup' : 'Knock Out') : '';
  const nightTitle = activeNight?.kind === 'score' ? `Your game: ${activeNight.session.players.map((player) => player.name).join(' v ')}` : activeNight ? `Your ${nightLabel}` : '';
  const nightScore = activeNight?.kind === 'score' && activeNight.session.players.length === 2 && activeNight.session.format !== 'darts' ? ` · ${activeNight.session.players.map((player) => activeNight.session.scores[player.id] ?? 0).join('–')}` : '';
  const nightShare = sharing ? (arrived.length ? ` · ${arrived.join(' & ')} joined` : ' · sharing live') : '';
  const power = powers[new Date().getDate() % powers.length];

  return <>
    <section className="home-hub v2" aria-labelledby="home-greeting">
      <div className="home-brand"><span className="home-mark"><Club weight="fill" />SWITCH</span><span className="home-tagline">Your game-night club</span></div>
      <h1 id="home-greeting">{greeting(new Date())}{me ? `, ${me.name}` : ''}.</h1>
      <p className="home-sub">{fresh ? 'Deal a game, keep score at the table, and watch your club grow.' : activeNight || activeTable ? 'Pick up where you left off, or start something new.' : 'What’s on the table tonight?'}</p>

      {(activeTable || activeNight) && <div className="resume-stack">
        {activeTable && <button className="resume-card" onClick={props.onResumeTable}><span className="resume-dot" aria-hidden="true" /><span><strong>Resume your game</strong><small>Against {activeTable.opponents === 1 ? 'the computer' : `${activeTable.opponents} computers`} · {LEVEL_NAMES[activeTable.level]} · {activeTable.game.hands[0].length} cards in hand</small></span><ArrowRight size={17} /></button>}
        {activeNight && <button className="resume-card night" onClick={props.onScore}><span className="resume-dot" aria-hidden="true" /><span><strong>{nightTitle}</strong><small>{nightLabel}{nightScore}{nightShare} · tap to carry on</small></span><ArrowRight size={17} /></button>}
      </div>}

      <div className="home-tiles v2">
        <button className="home-tile red" onClick={props.onPlay}><TileIndex suit="♥" /><strong>Play cards</strong><small>Against 1 to 4 computers</small></button>
        <button className="home-tile" onClick={props.onScore}><TileIndex suit="♣" /><strong>Keep score</strong><small>Real cards, real table</small></button>
        <button className="home-tile" onClick={props.onClub}><TileIndex suit="♠" /><strong>My club</strong><small>Stats, seasons, trophies</small></button>
        <button className="home-tile red" onClick={props.onAchievements}><TileIndex suit="♦" /><strong>Achievements</strong><small>Badges and passport</small></button>
      </div>
    </section>

    <section className="home-lower" aria-label="More from Switch">
      {fresh
        ? <button className="home-welcome" onClick={props.onRules}><Fan codes={['AS', '8D', '2H']} /><span><strong>New to Switch?</strong><em>Learn the rules in five moves, then practise with a guided game.</em></span><ArrowRight size={17} /></button>
        : <div className="home-recent">
          <div className="home-section-head"><h2>Recent</h2><button className="text-link" onClick={props.onHistory}><ClockCounterClockwise size={15} weight="bold" />All history</button></div>
          <ul>{recent.map((row) => <li key={row.key}><button onClick={row.open}><i className={row.won ? 'won' : ''} aria-hidden="true">{row.won ? '♥' : '♣'}</i><span><strong>{row.title}</strong><small>{row.detail}</small></span><em>{when(row.at)}</em></button></li>)}</ul>
        </div>}

      {loadLink()
        ? <button className="home-club-card linked" onClick={props.onClub}><UsersThree size={24} weight="fill" /><span><strong>Your club is shared</strong><em>Scores, players and leagues sync automatically. Tap to invite a friend.</em></span><ArrowRight size={15} /></button>
        : <div className="home-club-card"><UsersThree size={24} weight="fill" /><span><strong>Playing with friends? Share your club</strong><em>Everyone's scores, leagues and stats in one place, updating by themselves.</em><span className="home-club-actions"><button className="primary" onClick={props.onClub}>Share my club</button><button className="secondary" onClick={() => { wantJoinForm(); props.onJoinClub(); }}>Join a club</button></span></span></div>}
      <nav className="home-discover" aria-label="Discover">
        <button onClick={props.onRules}><GraduationCap size={18} weight="bold" />Learn rules</button>
        <button onClick={props.onPuzzles}><PuzzlePiece size={18} weight="bold" />Puzzles</button>
        <button onClick={props.onQuestions}><Question size={18} weight="bold" />Questions</button>
        <button onClick={props.onPlan}><CalendarPlus size={18} weight="bold" />Plan a night</button>
        <button onClick={props.onJoin}><Broadcast size={18} weight="bold" />Join a night</button>
      </nav>

      <button className="home-daily v2" onClick={() => props.onPower(power)}><Fan codes={power.cards.slice(0, 3)} /><span><strong>{power.name}</strong><em>{power.short} · today’s power card</em></span><ArrowRight size={15} /></button>
    </section>
  </>;
}
