import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { cardIdLabel } from '../switch/cards';
import type { TableState } from '../switch/table';
import type { CardId } from '../switch/types';
import { CardImage, rank } from '../ui';

/**
 * How a game ended, shown before the results (owner decision, 16 Nov 2026): who went out and with what, why you lost,
 * and every hand face up. `names[0]` is you. `played` is the winning play if known (otherwise the top of the pile).
 */
export function GameEnding({ game, names, played, watching = false, onContinue }: { game: TableState; names: readonly string[]; played?: readonly CardId[]; watching?: boolean; onContinue: () => void }) {
  const winner = game.winner ?? 0;
  const youWon = !watching && winner === 0;
  const winnerName = names[winner] ?? 'Someone';
  const hand = watching ? [] : game.hands[0];
  const last = played && played.length ? played : game.discardPile.slice(-1);
  const winningRank = rank(last[last.length - 1]);
  const power: Record<string, string> = { '2': 'a two', '8': 'an eight', K: 'a king', A: 'an ace' };
  const powerLeft = hand.filter((card) => ['2', '8', 'K', 'A', 'J', '7'].includes(rank(card)));
  const order = [...game.hands.keys()].filter((seat) => seat !== winner).sort((a, b) => game.hands[a].length - game.hands[b].length || a - b);
  const why: string[] = [];
  if (!youWon && !watching) {
    why.push(`${winnerName} played their last card first. You were still holding ${hand.length} card${hand.length === 1 ? '' : 's'}.`);
    if (power[winningRank]) why.push(`Going out on ${power[winningRank]} is allowed, so it still wins the game.`);
    if (hand.length === 1) why.push('So close: you were one card away.');
    if (powerLeft.length) why.push(`You were left holding ${powerLeft.map(cardIdLabel).join(', ')}. Power cards kept to the end are the usual way to lose a close game, so use them while they help.`);
  }
  const hidden = (cards: readonly string[]) => cards.every((card) => card === 'back');
  return <section className="tutorial game-tutorial table-game" aria-label="How the game ended" data-testid="game-ending">
    <div className="completion game-ending">
      <CheckCircle size={52} weight="light" />
      <h1>{youWon ? <>You went<br />out.</> : <>{winnerName} went<br />out.</>}</h1>
      <p>{winnerName} played {last.length > 1 ? 'the last cards' : 'the last card'}:</p>
      <div className="end-played" aria-label="The winning play">{last.map((card) => <CardImage key={card} code={card} />)}</div>
      {why.length > 0 && <div className="end-why" data-testid="end-why"><strong>Why you lost</strong>{why.map((line) => <p key={line}>{line}</p>)}</div>}
      <h2 className="end-heading">{order.every((seat) => seat === 0 || hidden(game.hands[seat])) ? 'Cards left in each hand' : 'What everyone was holding'}</h2>
      <ul className="end-hands" aria-label="Cards left in each hand">{order.map((seat) => <li key={seat} className={seat === 0 && !watching ? 'me' : ''}><b>{seat === 0 && !watching ? 'You' : names[seat]}</b><span>{game.hands[seat].length === 0 ? 'Out' : `${game.hands[seat].length} left`}</span>{!hidden(game.hands[seat]) && <div>{game.hands[seat].map((card) => <CardImage key={card} code={card} />)}</div>}</li>)}</ul>
      <button className="primary" data-testid="end-continue" onClick={onContinue}>See the results <ArrowRight size={18} /></button>
    </div>
  </section>;
}
