import { useState, type ComponentType, type ReactNode } from 'react';
import { BottomSheet } from '../mobile';
import {
  Airplane, Armchair, Barbell, Brain, CalendarCheck, CalendarStar, Cards, Columns, Compass, Cpu, Crosshair, Crown, Diamond, DiamondsFour, Fire, Flag, Globe,
  GlobeHemisphereWest, GridFour, Handshake, House, Lightning, MapPin, MapTrifold, Medal, Moon, Ranking, Robot, Rocket, ShieldStar, Skull, Smiley, Spade, Stamp, Star,
  Sun, SuitcaseRolling, Sword, Target, Timer, Trophy, Users, UsersFour, UsersThree, type IconProps,
} from '@phosphor-icons/react';
import { BADGE_CATEGORIES, type BadgeProgress, type PassportStamp } from '../switch/badges';
import { countryName } from '../switch/places';
import type { SwitchNightRecord } from '../switch/history';

const ICONS: Readonly<Record<string, ComponentType<IconProps>>> = {
  Airplane, Armchair, Barbell, Brain, CalendarCheck, CalendarStar, Cards, Columns, Compass, Cpu, Crosshair, Crown, Diamond, DiamondsFour, Fire, Flag, Globe,
  GlobeHemisphereWest, GridFour, Handshake, House, Lightning, MapPin, MapTrifold, Medal, Moon, Ranking, Robot, Rocket, ShieldStar, Skull, Smiley, Spade, Stamp, Star,
  Sun, SuitcaseRolling, Sword, Target, Timer, Trophy, Users, UsersFour, UsersThree,
};

/** A poker chip: milled edge in the tier's metal, a coloured face for the category, and the badge's drawn icon. Locked chips show progress as a ring. */
export function BadgeChip({ badge, size = 58 }: { badge: BadgeProgress; size?: number }) {
  const Icon = ICONS[badge.icon] ?? Star;
  const fraction = Math.max(0, Math.min(1, badge.have / badge.need));
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  return <span className={`chip ${badge.tier} cat-${badge.category} ${badge.earned ? 'on' : 'off'}`} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 48 48" className="chip-ring" focusable="false">
      <circle cx="24" cy="24" r="23" className="chip-edge" />
      <circle cx="24" cy="24" r="23" className="chip-milling" />
      {!badge.earned && <><circle cx="24" cy="24" r={radius} className="chip-track" /><circle cx="24" cy="24" r={radius} className="chip-progress" strokeDasharray={`${circumference * fraction} ${circumference}`} transform="rotate(-90 24 24)" /></>}
    </svg>
    <span className="chip-face"><Icon size={Math.round(size * 0.42)} weight={badge.earned ? 'fill' : 'duotone'} /></span>
  </span>;
}

const TIER_NAMES: Record<BadgeProgress['tier'], string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

/** Tap a chip and this says what the badge is, how to earn it and how far along you are. */
export function BadgeSheet({ badge, onClose }: { badge: BadgeProgress | null; onClose: () => void }) {
  const [shown, setShown] = useState(badge);
  if (badge && badge !== shown) setShown(badge);
  const category = BADGE_CATEGORIES.find((entry) => entry.id === shown?.category);
  const left = shown ? shown.need - shown.have : 0;
  return <BottomSheet open={!!badge} onOpenChange={(next) => { if (!next) onClose(); }} title={shown?.label ?? ''} snap={0.5}>
    {shown && <div className="award-sheet">
      <BadgeChip badge={shown} size={96} />
      <p className="award-kind">{TIER_NAMES[shown.tier]} badge · {category?.name}</p>
      <p className="award-how"><strong>How to earn it:</strong> {shown.hint}.</p>
      {shown.earned
        ? <p className="award-status done">Earned. It stays yours while the nights and games behind it are saved.</p>
        : <><span className="award-bar" aria-hidden="true"><b style={{ width: `${Math.round((shown.have / shown.need) * 100)}%` }} /></span>
          <p className="award-status">{shown.have} of {shown.need} so far · {left} to go</p></>}
      {category && <p className="award-note">{category.name}: {category.blurb}</p>}
    </div>}
  </BottomSheet>;
}

/** A chip you can tap to read about the badge. */
export function BadgeButton({ badge, size, onOpen, children }: { badge: BadgeProgress; size?: number; onOpen: (badge: BadgeProgress) => void; children?: ReactNode }) {
  return <button type="button" className="award-tap" aria-label={`${badge.label}: ${badge.earned ? 'earned' : `${badge.have} of ${badge.need}`}. Show details`} onClick={() => onOpen(badge)}>
    <BadgeChip badge={badge} size={size} />{children}
  </button>;
}

/** Every badge, grouped by what it is about. Earned chips shine; the rest show how far along you are. Tap one for its description. */
export function BadgeWall({ badges }: { badges: readonly BadgeProgress[] }) {
  const [open, setOpen] = useState<BadgeProgress | null>(null);
  return <div className="badge-wall">
    {BADGE_CATEGORIES.map((category) => {
      const list = badges.filter((badge) => badge.category === category.id);
      if (!list.length) return null;
      const got = list.filter((badge) => badge.earned).length;
      return <section key={category.id} className="badge-category" aria-label={category.name}>
        <header><h4>{category.name}</h4><span>{got} of {list.length}</span></header>
        <p>{category.blurb}</p>
        <ul className="chip-grid" aria-label={`${category.name} badges`}>
          {list.map((badge) => <li key={badge.id} className={'badge ' + (badge.earned ? 'earned' : 'locked')}>
            <BadgeButton badge={badge} onOpen={setOpen}>
              <strong>{badge.label}</strong>
              <small>{badge.earned ? badge.hint : `${badge.have} of ${badge.need}`}</small>
            </BadgeButton>
          </li>)}
        </ul>
      </section>;
    })}
    <BadgeSheet badge={open} onClose={() => setOpen(null)} />
  </div>;
}

const tilt = (code: string) => ((code.charCodeAt(0) * 7 + code.charCodeAt(1) * 3) % 15) - 7;

/** The passport: one inked stamp for every country the cards have been played in. */
export function PassportBook({ stamps, nights, name }: { stamps: readonly PassportStamp[]; nights: readonly SwitchNightRecord[]; name: string }) {
  const venues = new Map<string, { name: string; country: string; count: number }>();
  for (const night of nights) {
    if (!night.place) continue;
    const key = night.place.country + ':' + night.place.name.toLowerCase();
    const entry = venues.get(key) ?? { name: night.place.name, country: night.place.country, count: 0 };
    entry.count += 1;
    venues.set(key, entry);
  }
  const list = [...venues.values()].sort((a, b) => b.count - a.count);
  return <section className="passport" aria-label="Passport">
    <div className="passport-cover">
      <Compass size={30} weight="light" />
      <span><b>SWITCH PASSPORT</b><i>{name}</i></span>
      <em>{stamps.length} {stamps.length === 1 ? 'country' : 'countries'}</em>
    </div>
    <div className="passport-page">
      {stamps.length === 0
        ? <p className="passport-empty">No stamps yet. When you save a night, say where you played and the country lands here.</p>
        : <ul className="stamp-grid" aria-label="Passport stamps">{stamps.map((stamp) => <li key={stamp.country} style={{ ['--tilt' as string]: `${tilt(stamp.country)}deg` }}>
          <span className="stamp"><b>{stamp.country}</b><i>{stamp.nights} {stamp.nights === 1 ? 'night' : 'nights'}</i></span>
          <strong>{countryName(stamp.country)}</strong>
          <small>{stamp.venues.slice(0, 2).join(', ')}{stamp.venues.length > 2 ? ` +${stamp.venues.length - 2}` : ''}</small>
        </li>)}</ul>}
    </div>
    {list.length > 0 && <>
      <h4 className="passport-venues-title">Venues played</h4>
      <ul className="venue-list" aria-label="Venues played">{list.slice(0, 8).map((venue) => <li key={venue.country + venue.name}><MapPin size={16} weight="fill" /><span><strong>{venue.name}</strong><small>{countryName(venue.country)}</small></span><b>{venue.count}</b></li>)}</ul>
    </>}
  </section>;
}
