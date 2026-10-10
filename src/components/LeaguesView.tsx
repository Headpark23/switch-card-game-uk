import { useState } from 'react';
import {
  UsersThree,
  Plus,
  Trophy,
  ShareNetwork,
  Crown,
  Calendar,
  Sparkle,
  CheckCircle,
  Copy
} from '@phosphor-icons/react';
import type { League, Player, MatchRecord } from '../data/initialLeagues';

interface LeaguesViewProps {
  leagues: League[];
  players: Player[];
  activeLeagueId: string;
  matchHistory: MatchRecord[];
  onSelectLeague: (leagueId: string) => void;
  onCreateLeague: (name: string, description: string, playerIds: string[]) => void;
}

export function LeaguesView({
  leagues,
  players,
  activeLeagueId,
  matchHistory,
  onSelectLeague,
  onCreateLeague,
}: LeaguesViewProps) {
  const currentLeague = leagues.find(l => l.id === activeLeagueId) || leagues[0];
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newLeagueName, setNewLeagueName] = useState<string>('');
  const [newLeagueDesc, setNewLeagueDesc] = useState<string>('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(players.map(p => p.id));
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Filter matches for this league
  const leagueMatches = matchHistory.filter(m => m.leagueId === currentLeague.id);

  // Compute standings for this league
  interface PlayerStats {
    player: Player;
    played: number;
    wins: number;
    totalPoints: number;
    winRate: number;
    form: ('W' | '2nd' | 'L')[];
  }

  const leaguePlayers = players.filter(p => currentLeague.playerIds.includes(p.id));

  const standings: PlayerStats[] = leaguePlayers.map(player => {
    let played = 0;
    let wins = 0;
    let totalPoints = 0;
    const form: ('W' | '2nd' | 'L')[] = [];

    // Loop through matches (chronological or reverse)
    leagueMatches.forEach(match => {
      const entry = match.scores.find(s => s.playerId === player.id);
      if (entry) {
        played += 1;
        totalPoints += entry.score;
        if (entry.rank === 1) {
          wins += 1;
          form.push('W');
        } else if (entry.rank === 2) {
          form.push('2nd');
        } else {
          form.push('L');
        }
      }
    });

    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return {
      player,
      played,
      wins,
      totalPoints,
      winRate,
      form: form.slice(-4), // Last 4 games
    };
  });

  // Sort standings: Most wins first, then win rate, then total points
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalPoints - a.totalPoints;
  });

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentLeague.code);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    onCreateLeague(
      newLeagueName.trim(),
      newLeagueDesc.trim() || 'Weekly card game night.',
      selectedPlayerIds
    );
    setNewLeagueName('');
    setNewLeagueDesc('');
    setShowCreateModal(false);
  };

  return (
    <div className="leagues-container">
      {/* Header & League Switcher */}
      <div className="leagues-header">
        <p className="eyebrow">FAMILY & FRIENDS HUB</p>
        <h2>Card Game Leagues</h2>
        <p className="intro">Run your family card nights like a championship. Standings, form guide, and match logs.</p>

        {/* League Selector Pills */}
        <div className="league-picker-bar">
          {leagues.map(l => (
            <button
              key={l.id}
              className={`league-tab-pill ${l.id === currentLeague.id ? 'active' : ''}`}
              onClick={() => onSelectLeague(l.id)}
            >
              <UsersThree size={16} weight="fill" />
              <span>{l.name}</span>
            </button>
          ))}
          <button className="league-tab-pill add-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} weight="bold" />
            <span>New League</span>
          </button>
        </div>
      </div>

      {/* Current League Details Card */}
      <section className="league-card-hero">
        <div className="league-hero-info">
          <div>
            <span className="league-badge">ACTIVE LEAGUE</span>
            <h3>{currentLeague.name}</h3>
            <p>{currentLeague.description}</p>
          </div>
          <button className="share-code-btn" onClick={handleCopyCode} title="Share league code">
            <ShareNetwork size={18} weight="bold" />
            <span>{currentLeague.code}</span>
            {copiedCode && <span className="copied-tooltip">Copied!</span>}
          </button>
        </div>

        <div className="league-quick-stats">
          <div className="lq-stat">
            <strong>{leaguePlayers.length}</strong>
            <small>Players</small>
          </div>
          <div className="lq-stat">
            <strong>{leagueMatches.length}</strong>
            <small>Matches Logged</small>
          </div>
          <div className="lq-stat">
            <strong>{standings[0]?.player.name || 'None'}</strong>
            <small>Current Leader 👑</small>
          </div>
        </div>
      </section>

      {/* Standings Table */}
      <section className="league-standings-section">
        <div className="section-title-row">
          <h4>League Standings</h4>
          <span className="caption-text">Wins & Points</span>
        </div>

        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>Pos</th>
                <th>Player</th>
                <th style={{ textAlign: 'center' }}>P</th>
                <th style={{ textAlign: 'center' }}>W</th>
                <th style={{ textAlign: 'center' }}>Win%</th>
                <th style={{ textAlign: 'center' }}>Form</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((st, index) => {
                const isLeader = index === 0 && st.wins > 0;
                return (
                  <tr key={st.player.id} className={isLeader ? 'leader-row' : ''}>
                    <td>
                      <span className={`rank-tag rank-${index + 1}`}>
                        {index === 0 && st.wins > 0 ? '👑' : index + 1}
                      </span>
                    </td>
                    <td>
                      <div className="player-col">
                        <span className="p-avatar">{st.player.avatar}</span>
                        <strong>{st.player.name}</strong>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{st.played}</td>
                    <td style={{ textAlign: 'center' }}><strong>{st.wins}</strong></td>
                    <td style={{ textAlign: 'center' }}>{st.winRate}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="form-badges">
                        {st.form.length === 0 ? (
                          <span className="form-dash">-</span>
                        ) : (
                          st.form.map((f, i) => (
                            <span
                              key={i}
                              className={`form-badge ${f === 'W' ? 'win' : f === '2nd' ? 'second' : 'loss'}`}
                            >
                              {f}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Match History Log */}
      <section className="league-history-section">
        <div className="section-title-row">
          <h4>Match History</h4>
          <span className="caption-text">{leagueMatches.length} games recorded</span>
        </div>

        {leagueMatches.length === 0 ? (
          <div className="empty-matches-card">
            <Trophy size={36} weight="light" />
            <p>No matches recorded in this league yet.</p>
            <small>Head to the Scorekeeper tab to log your first family game night!</small>
          </div>
        ) : (
          <div className="match-log-cards">
            {leagueMatches.slice().reverse().map(match => (
              <div key={match.id} className="match-log-card">
                <div className="ml-header">
                  <div>
                    <strong>{match.gameName}</strong>
                    <span className="ml-date"><Calendar size={13} /> {match.date}</span>
                  </div>
                  <div className="ml-winner-tag">
                    <Crown size={14} weight="fill" />
                    <span>{match.winnerName} won</span>
                  </div>
                </div>

                <div className="ml-scores-row">
                  {match.scores.map(s => (
                    <div key={s.playerId} className={`ml-score-pill ${s.rank === 1 ? 'winner' : ''}`}>
                      <span className="ml-pname">{s.playerName}</span>
                      <strong className="ml-pts">{s.score} pts</strong>
                    </div>
                  ))}
                </div>

                {match.notes && (
                  <p className="ml-notes">“{match.notes}”</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="sk-modal-overlay">
          <div className="sk-modal-card">
            <h3>Create a New League</h3>
            <p>Start a new competition for family game night or pub cards.</p>
            <form onSubmit={handleCreateSubmit}>
              <label className="sk-label">League Name</label>
              <input
                type="text"
                placeholder="e.g. Sunday Night Rummy Cup"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                autoFocus
              />

              <label className="sk-label">Description (optional)</label>
              <input
                type="text"
                placeholder="e.g. Weekly battles around the kitchen table"
                value={newLeagueDesc}
                onChange={e => setNewLeagueDesc(e.target.value)}
              />

              <div className="sk-modal-btns">
                <button type="button" className="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Create League
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
