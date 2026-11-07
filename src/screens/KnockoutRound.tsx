import { useState } from 'react';
import { KeyboardInput } from '../mobile';
import { roundLoser, type KnockoutState } from '../switch/knockout';

/** Enter what each player held when the round ended; the app works out who drops out (ruling 11). */
export default function KnockoutRound({ state, onLost }: { state: KnockoutState; onLost: (playerId: string) => void }) {
  const [cards, setCards] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [needValues, setNeedValues] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const active = state.players.filter((player) => !state.eliminatedIds.includes(player.id));
  if (state.championId || active.length < 2) return null;
  const num = (text: string | undefined) => (text === undefined || text.trim() === '' ? undefined : Math.max(0, Math.floor(Number(text))));

  function settle() {
    const hands = active.map((player) => ({ id: player.id, cards: num(cards[player.id]) ?? 0, value: num(values[player.id]) }));
    const result = roundLoser(hands);
    if (result.status === 'tie') {
      setNeedValues([...result.ids]);
      setMessage(result.needValues ? 'Level on cards. Add up the card values for the tied players, then settle again.' : 'Still level on card values. Play a tie-break, then tap LOST on the loser.');
      return;
    }
    const name = state.players.find((player) => player.id === result.id)?.name ?? 'Player';
    setMessage(`${name} holds the most ${result.byValue ? 'points' : 'cards'} and drops out.`);
    setCards({}); setValues({}); setNeedValues([]);
    onLost(result.id);
  }

  return <section className="knockout-round" aria-label="Settle the round">
    <h3>Round over? Enter cards held</h3>
    {active.map((player) => <label key={player.id}><span>{player.name}</span>
      <KeyboardInput aria-label={`Cards held by ${player.name}`} inputMode="numeric" placeholder="0" value={cards[player.id] ?? ''} onChange={(event) => setCards({ ...cards, [player.id]: event.target.value.replace(/\D/g, '') })} />
      {needValues.includes(player.id) && <KeyboardInput aria-label={`Card total for ${player.name}`} inputMode="numeric" placeholder="Total" value={values[player.id] ?? ''} onChange={(event) => setValues({ ...values, [player.id]: event.target.value.replace(/\D/g, '') })} />}
    </label>)}
    <button className="primary" onClick={settle}>Settle the round</button>
    {message && <p role="status" className="share-note">{message}</p>}
  </section>;
}
