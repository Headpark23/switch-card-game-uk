import { useMemo } from 'react';
import { getReactionLog, summariseReactions } from '../switch/gameReplay';
import { reactionOf } from '../switch/reactions';
import { ReactionFace } from './ReactionSticker';

/** Your table talk in numbers: what you send, what comes back, and who never stops. */
export default function TableTalkStats() {
  const log = useMemo(getReactionLog, []);
  const summary = useMemo(() => summariseReactions(log), [log]);
  if (!log.length) {
    return <section className="talk-stats empty" aria-labelledby="talk-stats-title">
      <h3 id="talk-stats-title">Table talk</h3>
      <p>Tap React during a game to wind up the table. The computers answer back, and everything said is kept here and in each game's replay.</p>
    </section>;
  }
  const top = summary.byId.slice(0, 6);
  const most = Math.max(1, ...top.map((entry) => entry.mine + entry.theirs));
  const latest = log[0];
  return <section className="talk-stats" aria-labelledby="talk-stats-title">
    <h3 id="talk-stats-title">Table talk</h3>
    <div className="talk-tiles">
      <div><b>{summary.sent}</b><span>Sent</span></div>
      <div><b>{summary.received}</b><span>Received</span></div>
      <div><b>{summary.games}</b><span>Games</span></div>
    </div>
    {summary.favourite && <p className="talk-favourite"><ReactionFace id={summary.favourite.id} size={34} /><span>Your go-to: <strong>{reactionOf(summary.favourite.id)?.text}</strong>, sent {summary.favourite.count} time{summary.favourite.count === 1 ? '' : 's'}.</span></p>}
    {summary.chattiest && <p className="talk-line">{summary.chattiest.name} has the most to say: {summary.chattiest.count} remark{summary.chattiest.count === 1 ? '' : 's'} at your table.</p>}
    <ul className="talk-bars" aria-label="Most used reactions">{top.map((entry) => <li key={entry.id}>
      <span>{reactionOf(entry.id)?.text}</span>
      <i aria-hidden="true"><b className="mine" style={{ width: `${(entry.mine / most) * 100}%` }} /><b className="theirs" style={{ width: `${(entry.theirs / most) * 100}%` }} /></i>
      <em>{entry.mine} / {entry.theirs}</em>
    </li>)}</ul>
    <p className="talk-key"><i className="mine" /> You <i className="theirs" /> Everyone else</p>
    {latest && <p className="talk-line">Last said: {latest.from}, “{reactionOf(latest.id)?.text}”, {new Date(latest.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}, move {latest.move}.</p>}
  </section>;
}
