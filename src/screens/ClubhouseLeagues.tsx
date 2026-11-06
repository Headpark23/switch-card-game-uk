import { useState } from 'react';
import { ShareButton } from '../ShareButton';
import { getClubName, seasonShareCard } from '../switch/club';
import { KeyboardInput, useKeyboard } from '../mobile';
import { getHistory, type SwitchNightRecord } from '../switch/history';
import { getProfiles } from '../switch/profiles';
import { addNightToSeason, completeSeason, createSeason, getSeasons, putSeasons, seasonStandings, type SwitchSeason } from '../switch/seasons';

type Extensions = Record<string, unknown>;
type Props = { extensions: Extensions; onChange: (next: Extensions) => void };

export default function ClubhouseLeagues({ extensions, onChange }: Props) {
  const keyboard = useKeyboard();
  const allProfiles = getProfiles(extensions);
  const profiles = allProfiles.filter((profile) => !profile.archived);
  const seasons = getSeasons(extensions);
  const nights = getHistory(extensions);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const members = picked ?? profiles.map((profile) => profile.id);
  const nameOf = (id: string) => allProfiles.find((profile) => profile.id === id)?.name ?? 'Former player';

  function save(next: readonly SwitchSeason[]) {
    onChange(putSeasons(extensions, next));
  }

  function create() {
    keyboard.hide();
    try {
      save([...seasons, createSeason(name, members, allProfiles)]);
      setName('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This league could not be created.');
    }
  }

  function count(season: SwitchSeason, night: SwitchNightRecord) {
    try {
      const next = addNightToSeason(season, night, allProfiles);
      save(seasons.map((entry) => (entry.id === season.id ? next : entry)));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That night could not be counted.');
    }
  }

  function eligible(season: SwitchSeason) {
    return nights.filter((night) => {
      if (season.nightIds.includes(night.id)) return false;
      try { addNightToSeason(season, night, allProfiles); return true; } catch { return false; }
    });
  }

  return <section className="club-panel" aria-labelledby="leagues-title">
    <p className="eyebrow">THE NOTICEBOARD</p>
    <h2 id="leagues-title">Season leagues</h2>
    <p className="intro">Three points for a win, one for taking part. You choose which saved nights count.</p>

    {seasons.map((season) => {
      const standings = seasonStandings(season, nights, allProfiles);
      const counted = season.nightIds.map((id) => nights.find((night) => night.id === id)).filter((night): night is SwitchNightRecord => !!night);
      const open = season.status === 'active' ? eligible(season) : [];
      return <article className="season-card" key={season.id}>
        <h3>{season.name}</h3>
        <p className="season-status">{season.status === 'complete' ? 'Season complete' : 'Season in progress'}</p>
        <table className="season-table">
          <thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col">P</th><th scope="col">W</th><th scope="col">Pts</th></tr></thead>
          <tbody>{standings.map((row) => <tr key={row.profileId}><td>{row.rank}</td><td>{nameOf(row.profileId)}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.points}</td></tr>)}</tbody>
        </table>
        {standings.some((row) => row.played > 0) && <ShareButton label={season.status === 'complete' ? 'Share the final table' : 'Share the table'} build={() => seasonShareCard(season, standings, nameOf, getClubName(extensions))} />}
        {counted.length > 0 && <><h4>Counted nights</h4><ul className="counted-nights">{counted.map((night) => <li key={night.id}>{night.title} <small>{night.outcome}</small></li>)}</ul></>}
        {season.status === 'active' && <>
          {open.length > 0 && <><h4>Nights you can count</h4>{open.map((night) => <button className="secondary count-night" key={night.id} aria-label={`Count ${night.title} in ${season.name}`} onClick={() => count(season, night)}>Count {night.title} <small>{night.outcome}</small></button>)}</>}
          {open.length === 0 && <p className="history-empty">Save a night with at least two league players to count it here.</p>}
          <button className="text-link" aria-label={`Complete ${season.name}`} onClick={() => { if (window.confirm(`Complete ${season.name}? The table is frozen and no more nights can be added.`)) save(seasons.map((entry) => (entry.id === season.id ? completeSeason(entry) : entry))); }}>Complete this season</button>
        </>}
      </article>;
    })}

    <div className="new-season">
      <h3>Start a league season</h3>
      {profiles.length < 2
        ? <p className="history-empty">Save two or more players first. Start a score session with your regulars and they will appear here.</p>
        : <>
          <label><span>League name</span><KeyboardInput aria-label="League name" value={name} placeholder="Family League" onChange={(event) => setName(event.target.value)} /></label>
          <fieldset><legend>Who is in?</legend>{profiles.map((profile) => <label className="check" key={profile.id}><input type="checkbox" checked={members.includes(profile.id)} onChange={(event) => setPicked(event.target.checked ? [...members, profile.id] : members.filter((id) => id !== profile.id))} /><span>{profile.name}</span></label>)}</fieldset>
          <button className="primary" onClick={create}>Create league season</button>
        </>}
      {error && <p className="score-error" role="alert">{error}</p>}
    </div>
  </section>;
}
