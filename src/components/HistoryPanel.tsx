import { useState } from 'react';
import { CaretDown, Fire, Flame, Globe, House, Robot, Trophy, Target } from '@phosphor-icons/react';

/** The four ways a game can sit in your history. */
export type HistoryCategory = 'all' | 'computer' | 'online' | 'home';
export type EntryKind = 'computer' | 'online' | 'home';

/** One finished game, whatever way it was played: one line in the list, one slice of every chart. */
export interface HistoryEntry {
  key: string;
  when: string;
  kind: EntryKind;
  /** The way of playing (Single game, Switch Cup, Darts...), used to group the charts. */
  type: string;
  title: string;
  detail: string;
  won: boolean;
  open: () => void;
}

export const CATEGORIES: readonly { id: HistoryCategory; label: string }[] = [
  { id: 'all', label: 'Everything' }, { id: 'computer', label: 'v Computer' }, { id: 'online', label: 'Online' }, { id: 'home', label: 'At home' },
];
const KIND_NAME: Record<EntryKind, string> = { computer: 'v Computer', online: 'Online', home: 'At home' };
const EMPTY: Record<HistoryCategory, string> = {
  all: 'Nothing here yet. Play the computer, play with friends, or score a night at home and it lands in this list.',
  computer: 'No games against the computer yet. Every finished game in Play is logged here.',
  online: 'No online games yet. Play with friends and family from Play and every result lands here.',
  home: 'No games scored at home yet. Score a real card night in Score and it lands here.',
};

const day = (when: string, options: Intl.DateTimeFormatOptions) => new Date(when).toLocaleDateString('en-GB', options);
const pct = (won: number, total: number) => (total ? Math.round((won / total) * 100) : 0);

function KindIcon({ kind, size = 16 }: { kind: EntryKind; size?: number }) {
  return kind === 'computer' ? <Robot size={size} weight="fill" /> : kind === 'online' ? <Globe size={size} weight="fill" /> : <House size={size} weight="fill" />;
}

function streaks(entries: readonly HistoryEntry[]) {
  const ordered = [...entries].sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  let run = 0; let best = 0;
  for (const entry of ordered) { run = entry.won ? run + 1 : 0; best = Math.max(best, run); }
  return { best, current: run };
}

function Donut({ won, lost }: { won: number; lost: number }) {
  const total = won + lost; const radius = 44; const circumference = 2 * Math.PI * radius; const share = total ? won / total : 0;
  return <svg className="hx-donut" viewBox="0 0 120 120" role="img" aria-label={`${won} won, ${lost} lost, ${pct(won, total)} percent win rate`}>
    <circle cx="60" cy="60" r={radius} className="hx-donut-loss" />
    <circle cx="60" cy="60" r={radius} className="hx-donut-win" strokeDasharray={`${share * circumference} ${circumference}`} transform="rotate(-90 60 60)" />
    <text x="60" y="58" textAnchor="middle" className="hx-donut-num">{total ? `${pct(won, total)}%` : '–'}</text>
    <text x="60" y="76" textAnchor="middle" className="hx-donut-cap">win rate</text>
  </svg>;
}

/** Wins and losses for each way of playing, as bars that read at a glance. */
function TypeBars({ entries }: { entries: readonly HistoryEntry[] }) {
  const map = new Map<string, { won: number; lost: number; kind: EntryKind }>();
  for (const entry of entries) { const slot = map.get(entry.type) ?? { won: 0, lost: 0, kind: entry.kind }; if (entry.won) slot.won += 1; else slot.lost += 1; map.set(entry.type, slot); }
  const rows = [...map.entries()].map(([type, slot]) => ({ type, ...slot, total: slot.won + slot.lost })).sort((a, b) => b.total - a.total).slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (rows.length === 0) return null;
  return <section className="hx-card" aria-label="Wins and losses by game type"><h3>By game type</h3>
    <ul className="hx-types">{rows.map((row) => <li key={row.type}>
      <span className="hx-type-name">{row.type}<em>{pct(row.won, row.total)}%</em></span>
      <i aria-hidden="true" style={{ width: `${(row.total / max) * 100}%` }}><b className="w" style={{ flexGrow: row.won }} /><b className="l" style={{ flexGrow: row.lost }} /></i>
      <small>{row.won} won · {row.lost} lost</small>
    </li>)}</ul></section>;
}

/** The last six months, one stacked column per month. */
function Months({ entries }: { entries: readonly HistoryEntry[] }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1); return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en-GB', { month: 'short' }), won: 0, lost: 0 }; });
  for (const entry of entries) { const date = new Date(entry.when); const slot = months.find((month) => month.key === `${date.getFullYear()}-${date.getMonth()}`); if (slot) { if (entry.won) slot.won += 1; else slot.lost += 1; } }
  const max = Math.max(1, ...months.map((month) => month.won + month.lost));
  if (months.every((month) => month.won + month.lost === 0)) return null;
  return <section className="hx-card" aria-label="Games by month"><h3>Month by month</h3>
    <div className="hx-months">{months.map((month) => <div key={month.key} aria-label={`${month.label}: ${month.won} won, ${month.lost} lost`}>
      <span className="hx-col" aria-hidden="true"><b className="l" style={{ height: `${(month.lost / max) * 100}%` }} /><b className="w" style={{ height: `${(month.won / max) * 100}%` }} /></span>
      <small>{month.label}</small></div>)}</div>
    <p className="hx-legend"><i className="w" />Won <i className="l" />Lost</p></section>;
}

/** Everything view only: how each of the three ways of playing is going. */
function Compare({ entries }: { entries: readonly HistoryEntry[] }) {
  const kinds: EntryKind[] = ['computer', 'online', 'home'];
  const stats = kinds.map((kind) => { const own = entries.filter((entry) => entry.kind === kind); return { kind, total: own.length, won: own.filter((entry) => entry.won).length }; });
  return <section className="hx-card" aria-label="Win rate by where you play"><h3>Where you win most</h3>
    <ul className="hx-compare">{stats.map((row) => <li key={row.kind} data-kind={row.kind}>
      <span className="hx-badge"><KindIcon kind={row.kind} size={15} /></span>
      <span className="hx-compare-body"><strong>{KIND_NAME[row.kind]}</strong><i aria-hidden="true"><b style={{ width: `${pct(row.won, row.total)}%` }} /></i></span>
      <em>{row.total ? `${pct(row.won, row.total)}%` : '–'}<small>{row.won}/{row.total}</small></em>
    </li>)}</ul></section>;
}

/** The charts for whichever category is chosen, above a list of one-line rows that open on touch. */
export default function HistoryPanel({ entries, category, onCategory }: { entries: readonly HistoryEntry[]; category: HistoryCategory; onCategory: (next: HistoryCategory) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const shown = category === 'all' ? entries : entries.filter((entry) => entry.kind === category);
  const sorted = [...shown].sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
  const won = shown.filter((entry) => entry.won).length; const lost = shown.length - won;
  const { best, current } = streaks(shown);
  const recent = sorted.slice(0, 12);
  const counts = (id: HistoryCategory) => (id === 'all' ? entries.length : entries.filter((entry) => entry.kind === id).length);
  const tally = new Map<string, number>(); for (const entry of shown) tally.set(entry.type, (tally.get(entry.type) ?? 0) + 1);
  const favourite = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];

  return <div className="hx" data-category={category}>
    <div className="hx-tabs" role="group" aria-label="Filter history">{CATEGORIES.map((item) => <button key={item.id} type="button" data-cat={item.id} className={category === item.id ? 'active' : ''} aria-pressed={category === item.id} onClick={() => { setOpenKey(null); onCategory(item.id); }}>{item.id !== 'all' && <KindIcon kind={item.id} size={15} />}{item.label}<small>{counts(item.id)}</small></button>)}</div>

    {shown.length === 0 ? <p className="history-empty">{EMPTY[category]}</p> : <>
      <section className="hx-hero" aria-label={`${CATEGORIES.find((item) => item.id === category)?.label} record`}>
        <Donut won={won} lost={lost} />
        <div className="hx-hero-stats">
          <div className="w"><b>{won}</b><span>Won</span></div>
          <div className="l"><b>{lost}</b><span>Lost</span></div>
          <div><b><Fire size={18} weight="fill" />{best}</b><span>Best streak</span></div>
          <div><b><Flame size={18} weight="fill" />{current}</b><span>Win run now</span></div>
        </div>
        {favourite && <p className="hx-fun"><Trophy size={16} weight="fill" />{favourite[0]} is your go-to: {favourite[1]} {favourite[1] === 1 ? 'game' : 'games'}.</p>}
      </section>

      <section className="hx-card" aria-label="Recent results"><h3>Lately</h3>
        <div className="hx-form">{recent.slice().reverse().map((entry) => <i key={entry.key} className={entry.won ? 'w' : 'l'} title={`${entry.title}, ${day(entry.when, { day: 'numeric', month: 'short' })}`}>{entry.won ? 'W' : 'L'}</i>)}</div></section>

      {category === 'all' && <Compare entries={shown} />}
      <TypeBars entries={shown} />
      <Months entries={shown} />

      <h3 className="hx-list-title"><Target size={18} weight="fill" />Every game <small>tap one to open it</small></h3>
      <ul className="hx-list" aria-label="Your game history">{sorted.slice(0, 200).map((entry) => {
        const open = openKey === entry.key;
        return <li key={entry.key} data-kind={entry.kind} className={`${entry.won ? 'won' : 'lost'}${open ? ' open' : ''}`}>
          <button type="button" className="hx-row" aria-expanded={open} aria-label={`${entry.title}, ${entry.won ? 'won' : 'lost'}, ${day(entry.when, { day: 'numeric', month: 'long', year: 'numeric' })}`} onClick={() => setOpenKey(open ? null : entry.key)}>
            <span className="hx-badge" aria-hidden="true"><KindIcon kind={entry.kind} /></span>
            <strong>{entry.title}</strong>
            <b className={entry.won ? 'win' : 'loss'}>{entry.won ? 'Won' : 'Lost'}</b>
            <em>{day(entry.when, { day: 'numeric', month: 'short' })}</em>
            <CaretDown size={14} weight="bold" className="hx-caret" aria-hidden="true" />
          </button>
          {open && <div className="hx-more">
            <p>{entry.detail}</p>
            <p className="hx-when">{KIND_NAME[entry.kind]} · {day(entry.when, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <button type="button" className="secondary" onClick={entry.open}>Full score</button>
          </div>}
        </li>;
      })}</ul>
    </>}
  </div>;
}
