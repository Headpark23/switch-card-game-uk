import { useState } from 'react';
import { ArrowRight, Crown, Minus, Plus } from '@phosphor-icons/react';
import { cue } from '../feedback';
import { KeyboardInput, useKeyboard } from '../mobile';
import { addNight, createNightRecord, type NightCompletion, type SwitchNightRecord } from '../switch/history';
import { ShareButton } from '../ShareButton';
import { getClubName, nightShareCard } from '../switch/club';
import { ensureProfiles, getProfiles } from '../switch/profiles';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY } from '../switch/storage';
import type { Player } from '../switch/types';

/** The one-minute path: names, tap who won each round, finish. Saves to the same history as every other format. */
export default function QuickNight({ onBack, onHistory }: { onBack: () => void; onHistory: () => void }) {
  const keyboard = useKeyboard();
  const [loaded] = useState(() => loadScorekeeper(window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY)));
  const saved = getProfiles(loaded.state.extensions).filter((profile) => !profile.archived);
  const [names, setNames] = useState<string[]>(() => ['', '']);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [rounds, setRounds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [savedNight, setSavedNight] = useState<SwitchNightRecord | null>(null);

  const wins = (id: string) => rounds.filter((winner) => winner === id).length;
  const leader = players ? [...players].sort((a, b) => wins(b.id) - wins(a.id))[0] : null;

  function pickSaved(name: string) {
    if (names.some((entry) => entry.trim().toLowerCase() === name.toLowerCase())) return;
    const empty = names.findIndex((entry) => !entry.trim());
    if (empty >= 0) setNames((current) => current.map((entry, i) => (i === empty ? name : entry)));
    else if (names.length < 6) setNames((current) => [...current, name]);
  }
  function begin() {
    const typed = names.map((entry) => entry.trim());
    if (typed.some((entry) => !entry)) { setError('Add a name for every player.'); return; }
    try {
      const ensured = ensureProfiles(loaded.state.extensions, typed);
      setPlayers([...ensured.players]);
      persist(ensured.extensions, ensured.players);
      keyboard.hide(); setError(''); cue('good');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start.'); }
  }
  function persist(extensions: Record<string, unknown>, list: readonly Player[]) {
    const raw = window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY);
    const next = saveScorekeeper(raw, { schemaVersion: 1, selectedFormat: loaded.state.selectedFormat, players: list, scores: {}, target: loaded.state.target || 100, extensions });
    window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY, next);
  }
  function finish() {
    if (!players || !rounds.length) return;
    const best = Math.max(...players.map((player) => wins(player.id)));
    const winners = players.filter((player) => wins(player.id) === best);
    const completion: NightCompletion = {
      format: 'head-to-head',
      formatLabel: 'Quick night',
      players,
      winnerIds: winners.map((player) => player.id),
      outcome: winners.length === 1 ? `${winners[0].name} won the night` : `${winners.map((player) => player.name).join(' and ')} shared the night`,
      details: [{ heading: 'Rounds won', lines: players.map((player) => `${player.name}: ${wins(player.id)}`) }, { heading: 'Rounds played', lines: [String(rounds.length)] }],
    };
    const raw = window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY);
    const current = loadScorekeeper(raw).state.extensions;
    const night = createNightRecord(`Quick night · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, completion);
    persist(addNight(current, night), players);
    setSavedNight(night);
    setDone(true); cue('win');
  }

  if (done && players) return <section className="quick-night" aria-labelledby="quick-title">
    <Crown size={44} weight="light" /><p className="eyebrow">NIGHT SAVED</p>
    <h1 id="quick-title">{leader ? `${leader.name} takes the night.` : 'Night saved.'}</h1>
    <p>{rounds.length} round{rounds.length === 1 ? '' : 's'} played. It is in your history and stats.</p>
    {savedNight && <ShareButton className="primary" label="Share the result" build={() => nightShareCard(savedNight, getClubName(loaded.state.extensions))} />}
    <button className="secondary" onClick={onHistory}>See history <ArrowRight size={18} /></button>
    <button className="secondary" onClick={onBack}>Done</button>
  </section>;

  return <section className="quick-night" aria-labelledby="quick-title">
    <button className="text-link" onClick={onBack}>← Back</button>
    <p className="eyebrow">TONIGHT&apos;S GAME</p>
    <h1 id="quick-title">{players ? 'Who won that round?' : 'Who is playing?'}</h1>
    {!players ? <>
      {saved.length > 0 && <div className="player-tokens" aria-label="Saved players">{saved.map((profile) => <button key={profile.id} data-colour={profile.colour} onClick={() => pickSaved(profile.name)}>{profile.name}</button>)}</div>}
      <div className="player-fields">{names.map((name, index) => <label key={index}><span>Player {index + 1}</span><KeyboardInput value={name} placeholder="Enter name" onChange={(event) => setNames((current) => current.map((entry, i) => (i === index ? event.target.value : entry)))} /></label>)}</div>
      <div className="quick-count"><button aria-label="Remove a player" disabled={names.length <= 2} onClick={() => setNames((current) => current.slice(0, -1))}><Minus size={18} /></button><span>{names.length} players</span><button aria-label="Add a player" disabled={names.length >= 6} onClick={() => setNames((current) => [...current, ''])}><Plus size={18} /></button></div>
      {error && <p className="score-error" role="alert">{error}</p>}
      <button className="primary quick-start" onClick={begin}>Deal the cards <ArrowRight size={18} /></button>
    </> : <>
      <p className="quick-round">Round {rounds.length + 1}. Tap the winner as soon as someone plays their last card.</p>
      <div className="quick-board">{players.map((player) => <button key={player.id} aria-label={`${player.name} won the round`} onClick={() => { setRounds((current) => [...current, player.id]); cue('good'); }}><strong>{player.name}</strong><em>{wins(player.id)}</em><small>Won the round</small></button>)}</div>
      <div className="quick-actions"><button className="secondary" disabled={!rounds.length} onClick={() => setRounds((current) => current.slice(0, -1))}>Undo last round</button><button className="primary" disabled={!rounds.length} onClick={finish}>Finish the night</button></div>
    </>}
  </section>;
}
