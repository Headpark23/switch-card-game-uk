import { useMemo } from 'react';
import { Clock, FilmStrip, ListNumbers } from '@phosphor-icons/react';
import type { ComputerGame } from '../switch/computerLog';
import { gameLengths, formatDuration, type LengthRecord } from '../switch/gameLengths';
import { getAllReplays, replaySeconds } from '../switch/gameReplay';
import { modeInfo } from '../switch/series';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;

const ROWS = [
  { key: 'longestMoves', label: 'Longest game', by: 'moves', icon: 'moves' },
  { key: 'shortestMoves', label: 'Shortest game', by: 'moves', icon: 'moves' },
  { key: 'longestTime', label: 'Longest game', by: 'time', icon: 'time' },
  { key: 'shortestTime', label: 'Shortest game', by: 'time', icon: 'time' },
] as const;

/**
 * Your longest and shortest games by moves and by time, each one replayable with every player's hand face up so you can
 * see how it was played. Replays are kept for your latest 30 games and for the games that hold these records.
 */
export default function GameLengths({ games, onReplay }: { games: readonly ComputerGame[]; onReplay?: (gameId: string) => void }) {
  const { lengths, replays } = useMemo(() => {
    const replays = new Map(getAllReplays().map((replay) => [replay.id, replay]));
    const secondsOf = (game: ComputerGame) => game.seconds ?? (replays.has(game.id) ? replaySeconds(replays.get(game.id)!) : null);
    return { lengths: gameLengths(games, secondsOf), replays };
  }, [games]);
  if (!lengths.counted) return null;

  const describe = (record: LengthRecord) => {
    const game = record.game;
    const mode = game.mode && game.mode !== 'single' ? `${modeInfo(game.mode).name} · ` : '';
    return `${shortDate(game.playedAt)} · ${mode}${game.online ? `Online, ${game.opponents + 1} players` : game.opponents === 1 ? 'v 1 computer' : `v ${game.opponents} computers`} · ${game.won ? 'you won' : `you finished ${ordinal(game.place)}`}`;
  };

  return <section className="game-lengths" aria-labelledby="game-lengths-title" data-testid="game-lengths">
    <h3 id="game-lengths-title">Longest and shortest games</h3>
    <ul>{ROWS.map((row) => {
      const record = lengths[row.key];
      const Icon = row.icon === 'time' ? Clock : ListNumbers;
      if (!record) return <li key={row.key} className="empty" data-length={row.key}><Icon size={20} weight="bold" aria-hidden="true" /><div><strong>{row.label} by {row.by}</strong><small>Time is kept from your next game.</small></div></li>;
      const replay = replays.get(record.game.id);
      const handsUp = !!replay?.start.hands;
      const value = row.by === 'time' ? formatDuration(record.seconds ?? 0) : `${record.moves} move${record.moves === 1 ? '' : 's'}`;
      const other = row.by === 'time' ? `${record.moves} move${record.moves === 1 ? '' : 's'}` : record.seconds ? formatDuration(record.seconds) : null;
      return <li key={row.key} data-length={row.key}>
        <Icon size={20} weight="bold" aria-hidden="true" />
        <div>
          <strong>{row.label} by {row.by}</strong>
          <b className="gl-value">{value}{other && <small> · {other}</small>}</b>
          <small>{describe(record)}</small>
          {replay && onReplay
            ? <button type="button" className="secondary gl-watch" onClick={() => onReplay(record.game.id)} data-testid={`watch-${row.key}`}><FilmStrip size={17} />{handsUp ? 'Watch it, every hand face up' : 'Watch the replay'}</button>
            : <small className="gl-note">No replay kept for this one.</small>}
        </div>
      </li>;
    })}</ul>
    <p className="dash-note">{lengths.timed < lengths.counted ? `Time counts ${lengths.timed} of your ${lengths.counted} games: older ones were saved without it. ` : ''}Every replay shows all hands face up.</p>
  </section>;
}
