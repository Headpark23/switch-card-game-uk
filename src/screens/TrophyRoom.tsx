import { useState, type ComponentType } from 'react';
import { CalendarCheck, Cards, Crown, DiamondsFour, Fire, GridFour, Lightning, Medal, Star, Sword, Target, Trophy, UsersThree, type IconProps } from '@phosphor-icons/react';
import SampleDataBar from './SampleDataBar';
import { getHistory } from '../switch/history';
import { getProfiles } from '../switch/profiles';
import { TROPHY_TIERS, deriveTrophyRoom, type TrophyTier } from '../switch/trophies';

type Extensions = Record<string, unknown>;

/** One drawn icon per badge, in one weight. Count badges keep their number, which is the point of the badge. */
const BADGE_ICONS: Readonly<Record<string, ComponentType<IconProps>>> = {
  'first-win': Star, 'three-win-streak': Fire, 'five-win-streak': Lightning, 'three-formats': DiamondsFour, 'full-house': Cards,
  'cup-champion': Trophy, 'knockout-king': Crown, 'domino-master': GridFour, 'dart-thrower': Target, duellist: Sword,
  'hat-trick-month': CalendarCheck, 'big-table': UsersThree, 'trophy-cabinet': Medal,
};
function BadgeMark({ id, glyph }: { id: string; glyph: string }) {
  const Icon = BADGE_ICONS[id];
  return Icon ? <Icon size={22} weight="fill" /> : <>{glyph}</>;
}

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

export default function TrophyRoom({ extensions, onChange }: { extensions: Extensions; onChange: (next: Extensions) => void }) {
  const allProfiles = getProfiles(extensions);
  const profiles = allProfiles.filter((profile) => !profile.archived);
  const nights = getHistory(extensions);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!profiles.length || !nights.length) {
    return <section className="club-panel" aria-labelledby="trophies-title">
      
      <h2 id="trophies-title">Win a night to start your collection.</h2>
      <p className="history-empty">Trophies come from winning saved nights, and the bigger the table or tournament, the fancier the trophy. Badges are for streaks, firsts and playing every format.</p>
      <div className="tier-ladder" aria-label="Trophy tiers">{TROPHY_TIERS.map(({ tier, name }) => <div key={tier}><TrophyArt tier={tier} size={48} /><small>{name}</small></div>)}</div>
      <SampleDataBar offer extensions={extensions} onChange={onChange} />
    </section>;
  }

  const rooms = profiles.map((profile) => ({ profile, room: deriveTrophyRoom(profile, nights, allProfiles) }));
  const best = [...rooms].sort((a, b) => b.room.trophies.length - a.room.trophies.length)[0];
  const current = rooms.find((entry) => entry.profile.id === chosen) ?? best;
  const { profile, room } = current;
  const earned = room.badges.filter((badge) => badge.earned);
  const locked = room.badges.filter((badge) => !badge.earned);

  return <section className="club-panel trophy-room" aria-labelledby="trophies-title">
    <SampleDataBar extensions={extensions} onChange={onChange} />
    
    <h2 id="trophies-title">{profile.name}'s trophy room</h2>
    <div className="profile-chips" role="group" aria-label="Choose a player">
      {rooms.map((entry) => <button key={entry.profile.id} className={entry.profile.id === profile.id ? 'active' : ''} aria-pressed={entry.profile.id === profile.id} onClick={() => setChosen(entry.profile.id)}>{entry.profile.name}<small>{entry.room.trophies.length}</small></button>)}
    </div>

    <h3>Trophy cabinet</h3>
    {room.trophies.length === 0
      ? <p className="history-empty">No trophies yet. Win a saved night to put the first one on the shelf.</p>
      : <>
        <div className="tier-ladder" aria-label="Trophies by tier">{TROPHY_TIERS.map(({ tier, name }) => <div key={tier} className={room.tierCounts[tier] ? 'has' : 'none'}><TrophyArt tier={tier} size={48} /><b>{room.tierCounts[tier]}</b><small>{name}</small></div>)}</div>
        <ul className="trophy-list" aria-label="Trophies won">{room.trophies.slice(0, 8).map((trophy) => <li key={trophy.nightId}>
          <TrophyArt tier={trophy.tier} size={40} />
          <span><strong>{trophy.tierName}</strong><small>{trophy.formatLabel} · {trophy.players} players · {new Date(trophy.wonAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span>
        </li>)}</ul>
        {room.trophies.length > 8 && <p className="dash-note">and {room.trophies.length - 8} more on the shelf.</p>}
      </>}

    <h3>Badges · {room.earnedCount} of {room.badges.length}</h3>
    <ul className="badge-grid" aria-label="Badges earned">{earned.map((badge) => <li key={badge.id} className="badge earned"><span className="badge-medal" aria-hidden="true"><BadgeMark id={badge.id} glyph={badge.glyph} /></span><strong>{badge.label}</strong><small>{badge.hint}</small></li>)}</ul>
    {locked.length > 0 && <>
      <h3>Still to win</h3>
      <ul className="badge-grid" aria-label="Badges still to earn">{locked.map((badge) => <li key={badge.id} className="badge locked"><span className="badge-medal" aria-hidden="true"><BadgeMark id={badge.id} glyph={badge.glyph} /></span><strong>{badge.label}</strong><small>{badge.hint}</small><i className="badge-progress" aria-hidden="true"><b style={{ width: `${Math.round((badge.have / badge.need) * 100)}%` }} /></i><em>{badge.have} of {badge.need}</em></li>)}</ul>
    </>}
  </section>;
}
