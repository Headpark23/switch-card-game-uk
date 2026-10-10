import { useState } from 'react';
import {
  Trophy,
  Crown,
  Flame,
  Target,
  ChartBar,
  UsersThree,
  Medal,
  Sparkle
} from '@phosphor-icons/react';
import type { Player, MatchRecord } from '../data/initialLeagues';

interface StatsViewProps {
  players: Player[];
  matchHistory: MatchRecord[];
}

export function StatsView({ players, matchHistory }: StatsViewProps) {
  const [headPlayerA, setHeadPlayerA] = useState<string>(players[0]?.id || 'p1');
  const [headPlayerB, setHeadPlayerB] = useState<string>(players[1]?.id || 'p2');

  // Total matches
  const totalMatches = matchHistory.length;

  // Win counts per player
  const winCounts: Record<string, number> = {};
  const matchCounts: Record<string, number> = {};
  const totalScores: Record<string, number> = {};
  const maxScoreMap: Record<string, number> = {};
  const lastPlaceMap: Record<string, number> = {};

  players.forEach(p => {
    winCounts[p.id] = 0;
    matchCounts[p.id] = 0;
    totalScores[p.id] = 0;
    maxScoreMap[p.id] = 0;
    lastPlaceMap[p.id] = 0;
  });

  matchHistory.forEach(match => {
    if (match.winnerId && winCounts[match.winnerId] !== undefined) {
      winCounts[match.winnerId] += 1;
    }

    const matchPlayerCount = match.scores.length;
    match.scores.forEach(s => {
      if (matchCounts[s.playerId] !== undefined) {
        matchCounts[s.playerId] += 1;
        totalScores[s.playerId] += s.score;
        if (s.score > maxScoreMap[s.playerId]) {
          maxScoreMap[s.playerId] = s.score;
        }
        if (s.rank === matchPlayerCount && matchPlayerCount > 1) {
          lastPlaceMap[s.playerId] += 1;
        }
      }
    });
  });

  // Calculate Champion (most wins)
  let championId = players[0]?.id;
  let maxWins = -1;
  players.forEach(p => {
    if (winCounts[p.id] > maxWins) {
      maxWins = winCounts[p.id];
      championId = p.id;
    }
  });
  const championPlayer = players.find(p => p.id === championId);

  // Highest Single Score
  let highRollerId = players[0]?.id;
  let highestSingleScore = 0;
  players.forEach(p => {
    if (maxScoreMap[p.id] > highestSingleScore) {
      highestSingleScore = maxScoreMap[p.id];
      highRollerId = p.id;
    }
  });
  const highRollerPlayer = players.find(p => p.id === highRollerId);

  // Wooden Spoon (most last place finishes)
  let woodenSpoonId = players[1]?.id;
  let maxLastPlaces = -1;
  players.forEach(p => {
    if (lastPlaceMap[p.id] > maxLastPlaces) {
      maxLastPlaces = lastPlaceMap[p.id];
      woodenSpoonId = p.id;
    }
  });
  const woodenSpoonPlayer = players.find(p => p.id === woodenSpoonId);

  // Most Played Game
  const gameFrequency: Record<string, number> = {};
  matchHistory.forEach(m => {
    gameFrequency[m.gameName] = (gameFrequency[m.gameName] || 0) + 1;
  });
  const sortedGames = Object.entries(gameFrequency).sort((a, b) => b[1] - a[1]);

  // Head to Head calculation
  const h2hMatches = matchHistory.filter(
    m => m.scores.some(s => s.playerId === headPlayerA) && m.scores.some(s => s.playerId === headPlayerB)
  );

  let winsA = 0;
  let winsB = 0;
  let scoreTotalA = 0;
  let scoreTotalB = 0;

  h2hMatches.forEach(m => {
    const entryA = m.scores.find(s => s.playerId === headPlayerA);
    const entryB = m.scores.find(s => s.playerId === headPlayerB);
    if (entryA && entryB) {
      scoreTotalA += entryA.score;
      scoreTotalB += entryB.score;
      if (entryA.rank < entryB.rank) winsA += 1;
      else if (entryB.rank < entryA.rank) winsB += 1;
    }
  });

  const pA = players.find(p => p.id === headPlayerA);
  const pB = players.find(p => p.id === headPlayerB);

  return (
    <div className="stats-container">
      <div className="stats-header">
        <p className="eyebrow">FAMILY BRAGGING RIGHTS</p>
        <h2>Stats & Awards</h2>
        <p className="intro">Performance analytics, win streaks, and trophies from all your card game nights.</p>
      </div>

      {/* Fun Trophies Grid */}
      <section className="trophies-grid">
        <div className="trophy-card gold">
          <div className="trophy-icon-wrap">
            <Trophy size={28} weight="fill" />
          </div>
          <span className="trophy-title">The Champion</span>
          <strong className="trophy-winner">{championPlayer?.name}</strong>
          <small>{maxWins} career wins ({totalMatches ? Math.round((maxWins / totalMatches) * 100) : 0}%)</small>
        </div>

        <div className="trophy-card flame">
          <div className="trophy-icon-wrap">
            <Flame size={28} weight="fill" />
          </div>
          <span className="trophy-title">On Fire</span>
          <strong className="trophy-winner">{championPlayer?.name}</strong>
          <small>Won last 2 appearances</small>
        </div>

        <div className="trophy-card target">
          <div className="trophy-icon-wrap">
            <Target size={28} weight="fill" />
          </div>
          <span className="trophy-title">High Roller</span>
          <strong className="trophy-winner">{highRollerPlayer?.name}</strong>
          <small>{highestSingleScore} pts in a single game</small>
        </div>

        <div className="trophy-card wood">
          <div className="trophy-icon-wrap">
            <span>🥄</span>
          </div>
          <span className="trophy-title">The Wooden Spoon</span>
          <strong className="trophy-winner">{woodenSpoonPlayer?.name}</strong>
          <small>{maxLastPlaces} bottom-place finishes</small>
        </div>
      </section>

      {/* Wins Distribution Chart */}
      <section className="chart-section">
        <div className="chart-header">
          <h4>Win Share by Player</h4>
          <span className="caption-text">{totalMatches} matches recorded</span>
        </div>

        <div className="win-bars">
          {players.map(p => {
            const wins = winCounts[p.id] || 0;
            const pct = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
            return (
              <div key={p.id} className="win-bar-row">
                <div className="win-bar-label">
                  <span className="p-avatar">{p.avatar}</span>
                  <span className="p-name">{p.name}</span>
                  <strong className="p-count">{wins} wins</strong>
                </div>
                <div className="win-track">
                  <div
                    className="win-fill"
                    style={{
                      width: `${Math.max(6, pct)}%`,
                      backgroundColor: p.color || '#053527',
                    }}
                  >
                    <span>{pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Head to Head Matchup */}
      <section className="h2h-section">
        <div className="chart-header">
          <h4>Head-to-Head Rivalry</h4>
          <span className="caption-text">Direct match showdown</span>
        </div>

        <div className="h2h-selectors">
          <select value={headPlayerA} onChange={e => setHeadPlayerA(e.target.value)}>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
            ))}
          </select>
          <span className="vs-badge">VS</span>
          <select value={headPlayerB} onChange={e => setHeadPlayerB(e.target.value)}>
            {players.map(p => (
              <option key={p.id} value={p.id} disabled={p.id === headPlayerA}>{p.avatar} {p.name}</option>
            ))}
          </select>
        </div>

        <div className="h2h-scoreboard">
          <div className="h2h-player-side">
            <span className="h2h-avatar">{pA?.avatar}</span>
            <strong className="h2h-name">{pA?.name}</strong>
            <span className="h2h-wins">{winsA}</span>
            <small>Avg: {h2hMatches.length ? Math.round(scoreTotalA / h2hMatches.length) : 0} pts</small>
          </div>

          <div className="h2h-divider">
            <span className="h2h-total-games">{h2hMatches.length} games together</span>
            <div className="h2h-bar">
              <div
                className="h2h-fill-a"
                style={{ width: `${h2hMatches.length ? (winsA / (winsA + winsB || 1)) * 100 : 50}%` }}
              />
              <div
                className="h2h-fill-b"
                style={{ width: `${h2hMatches.length ? (winsB / (winsA + winsB || 1)) * 100 : 50}%` }}
              />
            </div>
          </div>

          <div className="h2h-player-side">
            <span className="h2h-avatar">{pB?.avatar}</span>
            <strong className="h2h-name">{pB?.name}</strong>
            <span className="h2h-wins">{winsB}</span>
            <small>Avg: {h2hMatches.length ? Math.round(scoreTotalB / h2hMatches.length) : 0} pts</small>
          </div>
        </div>
      </section>

      {/* Most Played Games */}
      <section className="most-played-section">
        <div className="chart-header">
          <h4>Table Favourites</h4>
          <span className="caption-text">Most played games</span>
        </div>

        <div className="games-freq-list">
          {sortedGames.map(([name, count], idx) => (
            <div key={name} className="game-freq-item">
              <span className="freq-rank">#{idx + 1}</span>
              <span className="freq-name">{name}</span>
              <div className="freq-bar-wrap">
                <div
                  className="freq-bar"
                  style={{ width: `${(count / (sortedGames[0]?.[1] || 1)) * 100}%` }}
                />
              </div>
              <strong className="freq-count">{count} {count === 1 ? 'game' : 'games'}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
