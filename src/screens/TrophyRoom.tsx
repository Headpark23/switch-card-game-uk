import { useState } from 'react';
import { BottomSheet } from '../mobile';
import SampleDataBar from './SampleDataBar';
import { BadgeWall, PassportBook } from './Badges';
import { derivePassport } from '../switch/badges';
import { getComputerGames } from '../switch/computerLog';
import { getHistory } from '../switch/history';
import { getProfiles } from '../switch/profiles';
import { TROPHY_TIERS, deriveTrophyRoom, type Trophy, type TrophyTier } from '../switch/trophies';

type Extensions = Record<string, unknown>;

const TIER_STYLE: Record<TrophyTier, { top: string; bottom: string; stars: number }> = {
  bronze: { top: '#d9a066', bottom: '#8a5a2b', stars: 0 },
  silver: { top: '#eef0f3', bottom: '#9aa3ad', stars: 1 },
  gold: { top: '#f7d774', bottom: '#b8860b', stars: 2 },
  platinum: { top: '#e6f2f7', bottom: '#6f93a6', stars: 3 },
  grand: { top: '#ffe08a', bottom: '#a9740a', stars: 5 },
};

/** One cup, drawn bigger and fancier as the tier rises: handles, plinth, stars and finally a crown. */
export function TrophyArt({ tier, size = 64 }: { tier: TrophyTier; size?: number }) {
  const { top, bottom, stars } = TIER_STYLE[tier];
  const id = `trophy-${tier}`;
  const fancy = tier === 'gold' || tier === 'platinum' || tier === 'grand';
  return <svg className={`trophy-art ${tier}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
    <path d="M18 14c-8 0-9 12 2 15M46 14c8 0 9 12-2 15" fill="none" stroke={`url(#${id})`} strokeWidth="3" strokeLinecap="round" />
    <path d="M18 10h28v10c0 9-6 15-14 15s-14-6-14-15z" fill={`url(#${id})`} stroke={bottom} strokeWidth="1.2" />
    <rect x="29" y="35" width="6" height="9" fill={`url(#${id})`} />
    <rect x={fancy ? 20 : 23} y="44" width={fancy ? 24 : 18} height="5" rx="1.5" fill={`url(#${id})`} stroke={bottom} strokeWidth="1" />
    {fancy && <rect x="17" y="49" width="30" height="5" rx="1.5" fill={bottom} />}
    {tier === 'grand' && <path d="M22 9l4-6 6 5 6-5 4 6z" fill={top} stroke={bottom} strokeWidth="1" />}
    {Array.from({ length: tier === 'grand' ? 0 : stars }, (_, index) => <circle key={index} cx={32 + (index - (stars - 1) / 2) * 6} cy="20" r="1.8" fill="#fff" opacity="0.9" />)}
    {tier === 'grand' && <path d="M32 14l2 4 4.4.6-3.2 3 .8 4.4L32 24l-4 2 .8-4.4-3.2-3 4.4-.6z" fill="#fff" opacity="0.9" />}
  </svg>;
}

/** How each cup is won. Tournaments (Knock Out, Switch Cup, Group Play) count as two extra players, as in trophyTier. */
const TIER_HOW: Record<TrophyTier, string> = {
  bronze: 'Win a night with two players, such as a One v One.',
  silver: 'Win a night with 3 or 4 players, or a two-player tournament.',
  gold: 'Win a night with 5 players, or a three-player tournament.',
  platinum: 'Win a night with 6 players, or a four-player tournament.',
  grand: 'Win a night with 7 or more players, or a tournament of 5 or more. The grandest cup on the shelf.',
};
const TOURNAMENT_NOTE = 'The bigger the table, the fancier the cup. Knock Out, Switch Cup and Group Play count as two extra players.';

type TrophyPick = { kind: 'tier'; tier: TrophyTier; count: number } | { kind: 'won'; trophy: Trophy };

/** Tap a cup and this says what it is and how it is won. */
function TrophySheet({ pick, onClose }: { pick: TrophyPick | null; onClose: () => void }) {
  const [shown, setShown] = useState(pick);
  if (pick && pick !== shown) setShown(pick);
  const tier = shown ? (shown.kind === 'tier' ? shown.tier : shown.trophy.tier) : 'bronze';
  const name = TROPHY_TIERS.find((entry) => entry.tier === tier)?.name ?? 'Cup';
  return <BottomSheet open={!!pick} onOpenChange={(next) => { if (!next) onClose(); }} title={shown?.kind === 'won' ? shown.trophy.title : name} snap={0.5}>
    {shown && <div className="award-sheet">
      <TrophyArt tier={tier} size={96} />
      {shown.kind === 'won'
        ? <><p className="award-kind">{name} · {shown.trophy.formatLabel}</p>
          <p className="award-status done">Won with {shown.trophy.players} players on {new Date(shown.trophy.wonAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.</p></>
        : <p className="award-kind">{shown.count ? `You have ${shown.count} on the shelf` : 'None on the shelf yet'}</p>}
      <p className="award-how"><strong>How to win it:</strong> {TIER_HOW[tier]}</p>
      <p className="award-note">{TOURNAMENT_NOTE}</p>
    </div>}
  </BottomSheet>;
}

/** One player's cabinet, badges and passport. Used for everyone in the Club and for you on the Me page. */
export function PlayerCabinet({ extensions, profileId }: { extensions: Extensions; profileId: string }) {
  const allProfiles = getProfiles(extensions);
  const profile = allProfiles.find((entry) => entry.id === profileId);
  const [pick, setPick] = useState<TrophyPick | null>(null);
  if (!profile) return null;
  const nights = getHistory(extensions);
  const room = deriveTrophyRoom(profile, nights, allProfiles, getComputerGames(extensions));
  const stamps = derivePassport(profile, nights, allProfiles);
  const mine = nights.filter((night) => night.place && night.players.some((player) => player.id === profile.id || player.name.toLowerCase() === profile.name.toLowerCase()));
  return <div className="cabinet">
    <TrophySheet pick={pick} onClose={() => setPick(null)} />
    <h3>Trophy cabinet</h3>
    <div className="tier-ladder" aria-label="Trophies by tier">{TROPHY_TIERS.map(({ tier, name }) => <button type="button" key={tier} className={room.tierCounts[tier] ? 'has' : 'none'} aria-label={`${name}: ${room.tierCounts[tier]} won. Show details`} onClick={() => setPick({ kind: 'tier', tier, count: room.tierCounts[tier] })}><TrophyArt tier={tier} size={48} /><b>{room.tierCounts[tier]}</b><small>{name}</small></button>)}</div>
    {room.trophies.length === 0
      ? <p className="history-empty">No trophies yet. Win a saved night to put the first one on the shelf. Tap a cup to see how it is won.</p>
      : <>
        <ul className="trophy-list" aria-label="Trophies won">{room.trophies.slice(0, 8).map((trophy) => <li key={trophy.nightId}><button type="button" className="award-tap" aria-label={`${trophy.tierName}, ${trophy.title}. Show details`} onClick={() => setPick({ kind: 'won', trophy })}>
          <TrophyArt tier={trophy.tier} size={40} />
          <span><strong>{trophy.tierName}</strong><small>{trophy.formatLabel} · {trophy.players} players · {new Date(trophy.wonAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span>
        </button></li>)}</ul>
        {room.trophies.length > 8 && <p className="dash-note">and {room.trophies.length - 8} more on the shelf.</p>}
      </>}
    <h3>Badges · {room.earnedCount} of {room.badges.length}</h3>
    <BadgeWall badges={room.badges} />
    <h3>Passport</h3>
    <PassportBook stamps={stamps} nights={mine} name={profile.name} />
  </div>;
}

export default function TrophyRoom({ extensions, onChange }: { extensions: Extensions; onChange: (next: Extensions) => void }) {
  const allProfiles = getProfiles(extensions);
  const profiles = allProfiles.filter((profile) => !profile.archived);
  const nights = getHistory(extensions);
  const games = getComputerGames(extensions);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!profiles.length || (!nights.length && !games.length)) {
    return <section className="club-panel" aria-labelledby="trophies-title">
      <h2 id="trophies-title">Win a night to start your collection.</h2>
      <p className="history-empty">Trophies come from winning saved nights, and the bigger the table or tournament, the fancier the trophy. Badges are for streaks, firsts, beating the computer and taking the cards on tour.</p>
      <div className="tier-ladder" aria-label="Trophy tiers">{TROPHY_TIERS.map(({ tier, name }) => <div key={tier}><TrophyArt tier={tier} size={48} /><small>{name}</small></div>)}</div>
      <SampleDataBar offer extensions={extensions} onChange={onChange} />
    </section>;
  }

  const rooms = profiles.map((profile) => ({ profile, room: deriveTrophyRoom(profile, nights, allProfiles, games) }));
  const best = [...rooms].sort((a, b) => b.room.trophies.length - a.room.trophies.length)[0];
  const current = rooms.find((entry) => entry.profile.id === chosen) ?? best;
  const { profile } = current;

  return <section className="club-panel trophy-room" aria-labelledby="trophies-title">
    <SampleDataBar extensions={extensions} onChange={onChange} />
    <h2 id="trophies-title">{profile.name}'s trophy room</h2>
    <div className="profile-chips" role="group" aria-label="Choose a player">
      {rooms.map((entry) => <button key={entry.profile.id} className={entry.profile.id === profile.id ? 'active' : ''} aria-pressed={entry.profile.id === profile.id} onClick={() => setChosen(entry.profile.id)}>{entry.profile.name}<small>{entry.room.trophies.length}</small></button>)}
    </div>
    <PlayerCabinet extensions={extensions} profileId={profile.id} />
  </section>;
}
