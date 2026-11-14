import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, ChartBar, Trophy } from '@phosphor-icons/react';
import { logSeriesResult } from '../switch/logGame';
import {
  advanceComputers, isSeriesOver, modeInfo, placeOf, resultOf, seriesOutcome, seriesPlayerName, standings, startSeries, submitGame, yourNextGame,
  ME_ID, type PendingGame, type SeriesSetup, type SeriesState,
} from '../switch/series';
import { CardShower, FeltHeader } from '../ui';
import TableGame from './TableGame';

const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;

type Props = { setup: SeriesSetup; onTable?: (atTable: boolean) => void; onExit: () => void; onChange: () => void; onMe: () => void; onOpenCards: () => void; onStartNight: () => void };

/** Puts you first at the table, keeping everyone else in the same order around it. */
function seatOrder(ids: readonly string[]): string[] {
  const at = ids.indexOf(ME_ID);
  return at <= 0 ? [...ids] : [...ids.slice(at), ...ids.slice(0, at)];
}

/**
 * A tournament or match against the computers. You play your own games at the table, exactly as in a single game;
 * every game between computers is played in an instant. Between games you see how everyone stands.
 */
export default function SeriesPlay({ setup, onTable, onExit, onChange, onMe, onOpenCards, onStartNight }: Props) {
  const [run, setRun] = useState(() => start());
  const [view, setView] = useState<'board' | 'table'>('board');
  useEffect(() => { onTable?.(view === 'table'); return () => onTable?.(false); }, [view]);
  const lastGame = useRef<string | null>(null);
  const recorded = useRef<string | null>(null);

  function start() {
    const first = advanceComputers(startSeries(setup, Math.random), Math.random);
    return { state: first.state, log: first.lines, deal: 0 };
  }

  const { state, log } = run;
  const over = isSeriesOver(state);
  const next: PendingGame | null = over ? null : yourNextGame(state);
  const outcome = seriesOutcome(state);
  const info = modeInfo(setup.mode);
  const ids = useMemo(() => (next ? seatOrder(next.playerIds) : []), [next?.key]);
  const seatNames = useMemo(() => ids.map((id) => seriesPlayerName(state, id)), [ids, state.base.id]);

  function finished(table: Parameters<NonNullable<React.ComponentProps<typeof TableGame>['series']>['onFinished']>[0], gameId: string) {
    if (!next) return;
    lastGame.current = gameId;
    const played = submitGame(state, next.key, resultOf(table, ids));
    const advanced = advanceComputers(played, Math.random);
    setRun((current) => ({ state: advanced.state, log: advanced.lines, deal: current.deal + 1 }));
    setView('board');
    if (isSeriesOver(advanced.state) && recorded.current !== state.base.id && lastGame.current) {
      recorded.current = state.base.id;
      const end = seriesOutcome(advanced.state);
      logSeriesResult(lastGame.current, { won: end?.winnerId === ME_ID, place: placeOf(advanced.state, ME_ID) ?? advanced.state.base.players.length, players: advanced.state.base.players.length, games: advanced.state.base.games });
    }
  }

  function again() {
    lastGame.current = null;
    recorded.current = null;
    setRun((current) => ({ ...start(), deal: current.deal + 1 }));
    setView('board');
  }

  if (view === 'table' && next) {
    return <TableGame key={`${state.base.id}-${next.key}-${run.deal}`} opponents={ids.length - 1} level={setup.level} seatNames={seatNames}
      series={{ title: `${info.name} · ${next.title}`, seriesId: state.base.id, mode: setup.mode, playOn: next.playOn, onFinished: finished }}
      onExit={() => setView('board')} onChange={onChange} onOpenCards={onOpenCards} onStartNight={onStartNight} />;
  }

  const youWon = outcome?.winnerId === ME_ID;
  const myPlace = outcome ? placeOf(state, ME_ID) : null;
  const tables = standings(state);

  if (outcome) {
    return <section className="series-board" aria-labelledby="series-title">
      <CardShower trigger={youWon ? `series-${state.base.id}` : null} />
      <FeltHeader compact id="series-title" title={youWon ? 'You won it.' : `${seriesPlayerName(state, outcome.winnerId)} won it.`}
        intro={setup.mode === 'dominoes' && outcome.loserId ? `${seriesPlayerName(state, outcome.loserId)} reached ${setup.limit} first and loses.` : `${info.name} finished after ${state.base.games} games.`} cards={['KH', 'AS']} />
      <p className="series-result" role="status" data-testid="series-result">{youWon ? `You won the ${info.name}.` : `You finished ${ordinal(myPlace ?? 0)} of ${state.base.players.length}.`}{youWon ? ' A trophy is in your cabinet.' : ''} Every game counts in your stats.</p>
      <ol className="place-list" aria-label="Final places">{outcome.order.map((id, index) => <li key={id} className={id === ME_ID ? 'me' : ''}><b>{ordinal(index + 1)}</b><span>{seriesPlayerName(state, id)}</span><em>{id === outcome.loserId ? 'reached the number' : id === outcome.winnerId ? 'winner' : ''}</em></li>)}</ol>
      {tables.map((table) => <StandingsTable key={table.heading} heading={table.heading} rows={table.rows} />)}
      <button className="primary" onClick={again}><ArrowCounterClockwise size={18} />Play {info.name} again</button>
      <button className="secondary" onClick={onChange}>Change the game type</button>
      <button className="secondary" onClick={onMe}><ChartBar size={18} />See my stats and trophies</button>
    </section>;
  }

  return <section className="series-board" aria-labelledby="series-title">
    <FeltHeader compact id="series-title" title={info.name} intro={next?.title} cards={['KS', 'QH']} />
    {log.length > 0 && <div className="series-log" aria-label="What the computers played" role="status"><strong>Meanwhile</strong><ul>{log.slice(-6).map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
    {tables.map((table) => <StandingsTable key={table.heading} heading={table.heading} rows={table.rows} />)}
    {next && <button className="primary deal-button" data-testid="series-play" onClick={() => setView('table')}><Trophy size={20} weight="fill" />Play: {next.title}</button>}
    <button className="text-link" onClick={onExit}>Leave this {info.name}. Games already played still count.</button>
  </section>;
}

function StandingsTable({ heading, rows }: { heading: string; rows: ReturnType<typeof standings>[number]['rows'] }) {
  return <div className="standings" role="group" aria-label={heading}>
    <h2>{heading}</h2>
    <ul>{rows.map((row) => <li key={row.id} className={(row.name.includes('You') ? 'me ' : '') + (row.out ? 'out' : '')}><span>{row.name}</span><b>{row.main}</b>{row.note && <small>{row.note}</small>}</li>)}</ul>
  </div>;
}
