import { useState, type ReactNode } from 'react';
import { BottomSheet } from '../mobile';
import { countryName } from '../switch/places';
import type { PassportStamp } from '../switch/badges';

/** The numbers on Me (won and lost share one tile, `record`). Each opens a small chart that explains it. */
export type StatId = 'played' | 'record' | 'nightWins' | 'nightRate' | 'streak' | 'beat' | 'vsRate' | 'countries';

export interface StatGame { when: string; won: boolean; kind: 'computer' | 'online' | 'home' }
export interface StatComputerGame { when: string; won: boolean; level: string }
export interface StatData {
  /** Every game and night that counts for you, whatever way it was played. */
  games: readonly StatGame[];
  /** Scored nights at home only. */
  nights: readonly StatGame[];
  /** Games against the computer (and online tables, which are logged the same way). */
  computer: readonly StatComputerGame[];
  stamps: readonly PassportStamp[];
}

const LEVELS: readonly { id: string; label: string }[] = [{ id: 'relaxed', label: 'Easy' }, { id: 'standard', label: 'Medium' }, { id: 'sharp', label: 'Hard' }];
const KINDS: readonly { id: StatGame['kind']; label: string }[] = [{ id: 'computer', label: 'v Computer' }, { id: 'online', label: 'Online' }, { id: 'home', label: 'At home' }];

const byDate = <T extends { when: string }>(items: readonly T[]) => [...items].sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const pct = (won: number, total: number) => (total ? Math.round((won / total) * 100) : 0);

interface Series { id: string; label: string; cls: string }

/** The last six months as stacked columns, one stack per month. */
function MonthColumns({ rows, series, label }: { rows: readonly { when: string; series: string }[]; series: readonly Series[]; label: string }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en-GB', { month: 'short' }), counts: Object.fromEntries(series.map((item) => [item.id, 0])) as Record<string, number> };
  });
  for (const row of rows) {
    const date = new Date(row.when);
    const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (month && row.series in month.counts) month.counts[row.series] += 1;
  }
  const total = (month: (typeof months)[number]) => series.reduce((sum, item) => sum + month.counts[item.id], 0);
  const max = Math.max(1, ...months.map(total));
  return <figure className="st-chart" role="img" aria-label={`${label}: ${months.map((month) => `${month.label} ${total(month)}`).join(', ')}`}>
    <div className="st-cols" aria-hidden="true">{months.map((month) => <div key={month.key}>
      <em>{total(month) || ''}</em>
      <span className="st-col" style={{ height: `${(total(month) / max) * 100}%` }}>{[...series].reverse().map((item) => month.counts[item.id] > 0 && <b key={item.id} className={item.cls} style={{ flexGrow: month.counts[item.id] }} />)}</span>
      <small>{month.label}</small></div>)}</div>
    {series.length > 1 && <figcaption className="st-legend">{series.map((item) => <span key={item.id}><i className={item.cls} />{item.label}</span>)}</figcaption>}
  </figure>;
}

/** A running line: after each game, where the number stands. */
function Line({ values, max, percent, unit, label }: { values: readonly number[]; max: number; percent?: boolean; unit: string; label: string }) {
  const width = 300; const height = 124; const left = 30; const right = 12; const top = 10; const bottom = 22;
  const innerWidth = width - left - right; const innerHeight = height - top - bottom;
  const x = (index: number) => left + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
  const y = (value: number) => top + innerHeight - (Math.min(value, max) / max) * innerHeight;
  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const area = values.length > 1 ? `${line} L${x(values.length - 1).toFixed(1)} ${top + innerHeight} L${x(0).toFixed(1)} ${top + innerHeight} Z` : '';
  const ticks = percent ? [0, 50, 100] : [0, Math.round(max / 2), max];
  const last = values[values.length - 1];
  return <figure className="st-chart" role="img" aria-label={`${label}: ${values.length === 1 ? 'one point' : `${values.length} ${unit}s`}, ending at ${percent ? `${last}%` : last}`}>
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(percent ? (tick / 100) * max : tick)} y2={y(percent ? (tick / 100) * max : tick)} className="st-grid" /><text x={left - 6} y={y(percent ? (tick / 100) * max : tick) + 3.5} textAnchor="end" className="st-axis">{percent ? `${tick}%` : tick}</text></g>)}
      {area && <path d={area} className="st-area" />}
      {values.length > 1 && <path d={line} className="st-line" />}
      <circle cx={x(values.length - 1)} cy={y(last)} r="4.5" className="st-dot" />
      <text x={left} y={height - 5} className="st-axis">{unit} 1</text>
      <text x={width - right} y={height - 5} textAnchor="end" className="st-axis">{unit} {values.length}</text>
    </svg>
  </figure>;
}

/** Every result in order, with your longest winning run lit in gold. */
function ResultStrip({ games }: { games: readonly StatGame[] }) {
  const ordered = byDate(games);
  let run = 0; let best = 0; let bestEnd = -1;
  ordered.forEach((game, index) => { run = game.won ? run + 1 : 0; if (run > best) { best = run; bestEnd = index; } });
  const shownFrom = Math.max(0, ordered.length - 48);
  return <figure className="st-chart" role="img" aria-label={`Every result in order, oldest first. Longest winning run: ${best}.`}>
    <div className="st-strip" aria-hidden="true">{ordered.slice(shownFrom).map((game, offset) => {
      const index = shownFrom + offset;
      const inBest = best > 0 && index > bestEnd - best && index <= bestEnd;
      return <i key={index} className={`${game.won ? 'w' : 'l'}${inBest ? ' best' : ''}`}>{game.won ? 'W' : 'L'}</i>;
    })}</div>
    <figcaption className="st-legend"><span><i className="w" />Won</span><span><i className="l" />Lost</span><span><i className="best-key" />Best run</span></figcaption>
    {shownFrom > 0 && <p className="st-note">Showing your latest 48 of {ordered.length}.</p>}
  </figure>;
}

function Bars({ rows, label }: { rows: readonly { label: string; value: number; total: number; note?: string }[]; label: string }) {
  return <ul className="st-bars" aria-label={label}>{rows.map((row) => <li key={row.label}>
    <span>{row.label}</span>
    <i aria-hidden="true"><b style={{ width: `${pct(row.value, row.total)}%` }} /></i>
    <em>{row.note ?? `${row.value}/${row.total}`}</em>
  </li>)}</ul>;
}

/** Running totals: the wins so far, or the win rate so far, after each game in turn. */
function running(games: readonly { when: string; won: boolean }[], mode: 'wins' | 'rate'): number[] {
  let wins = 0;
  return byDate(games).map((game, index) => { if (game.won) wins += 1; return mode === 'wins' ? wins : Math.round((wins / (index + 1)) * 100); });
}

interface View { title: string; headline: string; body: ReactNode; foot: string; empty?: string }

function view(stat: StatId, data: StatData): View {
  const { games, nights, computer, stamps } = data;
  const wins = games.filter((game) => game.won).length;
  const losses = games.length - wins;
  const nightWins = nights.filter((game) => game.won).length;
  const computerWins = computer.filter((game) => game.won).length;
  switch (stat) {
    case 'played': return {
      title: 'Games played', headline: plural(games.length, 'game'), empty: games.length ? undefined : 'Play a game, or score a night, and this chart starts filling in.',
      body: <MonthColumns label="Games played each month" series={KINDS.map((kind, index) => ({ id: kind.id, label: kind.label, cls: `k${index}` }))} rows={games.map((game) => ({ when: game.when, series: game.kind }))} />,
      foot: 'Every game counts: against the computer, online with friends, and scored at home, wins and losses alike.',
    };
    case 'record': return {
      title: 'Won and lost', headline: `${wins} won, ${losses} lost`, empty: games.length ? undefined : 'Play a game, or score a night, and your wins and losses show here.',
      body: <MonthColumns label="Games won and lost each month" series={[{ id: 'won', label: 'Won', cls: 'w' }, { id: 'lost', label: 'Lost', cls: 'l' }]} rows={games.map((game) => ({ when: game.when, series: game.won ? 'won' : 'lost' }))} />,
      foot: `${pct(wins, games.length)}% won from ${plural(games.length, 'game')}. Everyone loses games, and every one is saved so your record is honest.`,
    };
    case 'nightWins': return {
      title: 'Night wins', headline: `${nightWins} of ${plural(nights.length, 'night')}`, empty: nights.length ? undefined : 'Score a real card night in Score and your wins show here.',
      body: <MonthColumns label="Nights each month, won and lost" series={[{ id: 'won', label: 'Won', cls: 'w' }, { id: 'lost', label: 'Lost', cls: 'l' }]} rows={nights.map((night) => ({ when: night.when, series: night.won ? 'won' : 'lost' }))} />,
      foot: 'Nights are real games scored with friends. A night win means you finished top.',
    };
    case 'nightRate': return {
      title: 'Night win rate', headline: nights.length ? `${pct(nightWins, nights.length)}% of nights` : 'No nights yet', empty: nights.length ? undefined : 'Score a night to see your win rate move.',
      body: <Line label="Night win rate so far" values={running(nights, 'rate')} max={100} percent unit="night" />,
      foot: 'The line is your win rate after each night, so early nights swing it and later ones settle it.',
    };
    case 'streak': {
      const ordered = byDate(nights); let run = 0; let best = 0; ordered.forEach((game) => { run = game.won ? run + 1 : 0; best = Math.max(best, run); });
      return {
        title: 'Best night streak', headline: `${plural(best, 'night')} in a row`, empty: nights.length ? undefined : 'Win card nights back to back and the run lights up here.',
        body: <ResultStrip games={nights} />,
        foot: run > 0 ? `You are on a run of ${run} right now. Streaks count scored nights at home.` : 'Your longest run is lit in gold. Streaks count scored nights at home.',
      };
    }
    case 'beat': {
      const rows = LEVELS.map((level) => { const own = computer.filter((game) => game.level === level.id); return { label: level.label, value: own.filter((game) => game.won).length, total: own.length }; });
      return {
        title: 'Beat the computer', headline: plural(computerWins, 'win'), empty: computer.length ? undefined : 'Play the computer to start beating it.',
        body: <Bars label="Wins against the computer by level" rows={rows} />,
        foot: 'Wins against each level, out of the games you played at it. Hard is where bragging rights live.',
      };
    }
    case 'vsRate': return {
      title: 'Against the computer', headline: computer.length ? `${pct(computerWins, computer.length)}% win rate` : 'Not played yet', empty: computer.length ? undefined : 'Play the computer and your win rate starts here.',
      body: <Line label="Win rate against the computer so far" values={running(computer, 'rate')} max={100} percent unit="game" />,
      foot: `${computerWins} won from ${plural(computer.length, 'game')}. The line is your rate after each one.`,
    };
    case 'countries': return {
      title: 'Countries', headline: plural(stamps.length, 'country', 'countries'), empty: stamps.length ? undefined : 'Add a place when you save a night and it earns a passport stamp.',
      body: <Bars label="Nights in each country" rows={[...stamps].sort((a, b) => b.nights - a.nights).map((stamp) => ({ label: countryName(stamp.country), value: stamp.nights, total: Math.max(1, ...stamps.map((item) => item.nights)), note: `${plural(stamp.nights, 'night')}${stamp.wins ? ` · ${stamp.wins} won` : ''}` }))} />,
      foot: 'One stamp for every country you have played a night in. Open Passport to see them all.',
    };
  }
}

/** Overall win rate as a ring beside your last twelve results: the one-glance answer to "how am I doing?" */
export function FormCard({ games }: { games: readonly StatGame[] }) {
  const ordered = byDate(games);
  const wins = ordered.filter((game) => game.won).length;
  const rate = pct(wins, ordered.length);
  const recent = ordered.slice(-12);
  const radius = 34; const circumference = 2 * Math.PI * radius;
  const lately = recent.filter((game) => game.won).length;
  return <section className="st-form" aria-label="Your form">
    <svg viewBox="0 0 90 90" role="img" aria-label={ordered.length ? `${rate} percent of your games won` : 'No games yet'}>
      <circle cx="45" cy="45" r={radius} className="st-ring-track" />
      <circle cx="45" cy="45" r={radius} className="st-ring" strokeDasharray={`${(ordered.length ? wins / ordered.length : 0) * circumference} ${circumference}`} transform="rotate(-90 45 45)" />
      <text x="45" y="49" textAnchor="middle" className="st-ring-num">{ordered.length ? `${rate}%` : '–'}</text>
    </svg>
    <div>
      <h3>{ordered.length ? 'Your form' : 'Your story starts here'}</h3>
      {recent.length > 0
        ? <><div className="st-chips" aria-label="Your latest results, oldest first">{recent.map((game, index) => <i key={index} className={game.won ? 'w' : 'l'}>{game.won ? 'W' : 'L'}</i>)}</div>
          <p>{lately} win{lately === 1 ? '' : 's'} in your last {recent.length}. Tap any number above to see its chart.</p></>
        : <p>Play the computer or score a night and your numbers come alive. Tap any one for its chart.</p>}
    </div>
  </section>;
}

/** The sheet that opens from a tapped number. */
export function StatSheet({ stat, data, onClose }: { stat: StatId | null; data: StatData; onClose: () => void }) {
  const [shown, setShown] = useState(stat);
  if (stat && stat !== shown) setShown(stat);
  const content = shown ? view(shown, data) : null;
  return <BottomSheet open={!!stat} onOpenChange={(next) => { if (!next) onClose(); }} title={content?.title ?? ''} snap={0.62}>
    {content && <div className="stat-sheet" data-stat={shown}>
      <p className="st-headline">{content.headline}</p>
      {content.empty ? <p className="st-empty">{content.empty}</p> : content.body}
      <p className="st-foot">{content.foot}</p>
    </div>}
  </BottomSheet>;
}
