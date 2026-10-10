import { useState } from 'react';
import {
  Trophy,
  Plus,
  Minus,
  CheckCircle,
  Play,
  ArrowCounterClockwise,
  UsersThree,
  Sparkle,
  Crown,
  CaretRight,
  UserPlus
} from '@phosphor-icons/react';
import { TOP_10_GAMES, type CardGame } from '../data/cardGames';
import type { League, Player, MatchRecord } from '../data/initialLeagues';

interface ScorekeeperProps {
  leagues: League[];
  players: Player[];
  activeLeagueId: string;
  onSaveMatch: (record: MatchRecord) => void;
  onAddPlayer: (name: string, avatar: string) => void;
  selectedGameId?: string;
}

interface PlayerScoreState {
  playerId: string;
  roundScore: number;
  totalScore: number;
}

interface CompletedRound {
  roundNumber: number;
  scores: Record<string, number>;
}

export function Scorekeeper({
  leagues,
  players,
  activeLeagueId,
  onSaveMatch,
  onAddPlayer,
  selectedGameId = 'switch',
}: ScorekeeperProps) {
  const currentLeague = leagues.find(l => l.id === activeLeagueId) || leagues[0];
  const [gameId, setGameId] = useState<string>(selectedGameId);
  const currentGame: CardGame = TOP_10_GAMES.find(g => g.id === gameId) || TOP_10_GAMES[0];

  const leaguePlayers = players.filter(p => currentLeague?.playerIds.includes(p.id));
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    leaguePlayers.map(p => p.id).slice(0, 4)
  );

  const [matchState, setMatchState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [currentRoundNum, setCurrentRoundNum] = useState<number>(1);
  const [scores, setScores] = useState<PlayerScoreState[]>([]);
  const [roundHistory, setRoundHistory] = useState<CompletedRound[]>([]);
  const [matchNotes, setMatchNotes] = useState<string>('');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState<boolean>(false);
  const [newPlayerName, setNewPlayerName] = useState<string>('');

  const togglePlayerSelection = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      if (selectedPlayerIds.length > 2) {
        setSelectedPlayerIds(selectedPlayerIds.filter(pid => pid !== id));
      }
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleStartMatch = () => {
    const initialScores: PlayerScoreState[] = selectedPlayerIds.map(pid => ({
      playerId: pid,
      roundScore: 0,
      totalScore: 0,
    }));
    setScores(initialScores);
    setRoundHistory([]);
    setCurrentRoundNum(1);
    setMatchState('playing');
  };

  const adjustRoundScore = (pid: string, delta: number) => {
    setScores(prev =>
      prev.map(item =>
        item.playerId === pid
          ? { ...item, roundScore: Math.max(0, item.roundScore + delta) }
          : item
      )
    );
  };

  const setExactRoundScore = (pid: string, val: number) => {
    setScores(prev =>
      prev.map(item =>
        item.playerId === pid
          ? { ...item, roundScore: Math.max(0, val) }
          : item
      )
    );
  };

  const completeRound = () => {
    const roundScores: Record<string, number> = {};
    const updated = scores.map(item => {
      roundScores[item.playerId] = item.roundScore;
      return {
        ...item,
        totalScore: item.totalScore + item.roundScore,
        roundScore: 0,
      };
    });
    setRoundHistory([...roundHistory, { roundNumber: currentRoundNum, scores: roundScores }]);
    setScores(updated);
    setCurrentRoundNum(prev => prev + 1);
  };

  const isLowWins = currentGame.scoringType === 'low-wins';

  // Sort scores to determine standings
  const sortedStandings = [...scores].sort((a, b) => {
    if (isLowWins) {
      return a.totalScore - b.totalScore;
    }
    return b.totalScore - a.totalScore;
  });

  const winnerPlayerId = sortedStandings[0]?.playerId;
  const winnerPlayer = players.find(p => p.id === winnerPlayerId);

  const handleFinishMatch = () => {
    const finalRanked = sortedStandings.map((item, idx) => {
      const pl = players.find(p => p.id === item.playerId);
      return {
        playerId: item.playerId,
        playerName: pl?.name || 'Player',
        score: item.totalScore,
        rank: idx + 1,
      };
    });

    const record: MatchRecord = {
      id: 'match-' + Date.now(),
      leagueId: currentLeague.id,
      gameId: currentGame.id,
      gameName: currentGame.name,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      scores: finalRanked,
      winnerId: winnerPlayerId || 'p1',
      winnerName: winnerPlayer?.name || 'Winner',
      notes: matchNotes.trim() || undefined,
    };

    onSaveMatch(record);
    setMatchState('finished');
  };

  const handleResetToSetup = () => {
    setMatchState('setup');
    setScores([]);
    setRoundHistory([]);
    setMatchNotes('');
  };

  const handleAddNewPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const avatars = ['🦁', '🦊', '🐼', '🐯', '🦅', '🍀', '🚀', '🎯'];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    onAddPlayer(newPlayerName.trim(), randomAvatar);
    setNewPlayerName('');
    setShowAddPlayerModal(false);
  };

  return (
    <div className="scorekeeper-container">
      {matchState === 'setup' && (
        <section className="sk-setup-view">
          <div className="sk-header">
            <p className="eyebrow">DIGITAL SCORECARD</p>
            <h2>Table Scorekeeper</h2>
            <p className="intro">Ditch the pen and paper. Pick your game, select players, and tap to log points.</p>
          </div>

          <div className="sk-card-box">
            <label className="sk-label">Current League</label>
            <div className="sk-league-badge">
              <UsersThree size={20} weight="fill" />
              <div>
                <strong>{currentLeague.name}</strong>
                <small>League Code: {currentLeague.code}</small>
              </div>
            </div>
          </div>

          <div className="sk-card-box">
            <label className="sk-label">Select Card Game</label>
            <div className="sk-game-selector">
              {TOP_10_GAMES.map(g => (
                <button
                  key={g.id}
                  className={`sk-game-pill ${gameId === g.id ? 'active' : ''}`}
                  onClick={() => setGameId(g.id)}
                >
                  <span>{g.name}</span>
                  <small>{g.scoringType === 'low-wins' ? 'Lowest score wins' : 'Highest score wins'}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="sk-card-box">
            <div className="sk-label-row">
              <label className="sk-label">Who is at the table? ({selectedPlayerIds.length} players)</label>
              <button className="sk-btn-text" onClick={() => setShowAddPlayerModal(true)}>
                <UserPlus size={16} /> Add person
              </button>
            </div>
            <div className="sk-player-selector">
              {players.map(p => {
                const isSelected = selectedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    className={`sk-player-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePlayerSelection(p.id)}
                  >
                    <span className="sk-avatar">{p.avatar}</span>
                    <span className="sk-name">{p.name}</span>
                    {isSelected && <CheckCircle size={16} weight="fill" className="sk-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sk-summary-box">
            <div className="sk-rule-callout">
              <Sparkle size={18} weight="fill" />
              <span><strong>Scoring Goal:</strong> {currentGame.targetScoreDesc}</span>
            </div>
          </div>

          <button className="primary sk-start-btn" onClick={handleStartMatch}>
            <Play size={20} weight="fill" /> Start Scoring Match
          </button>
        </section>
      )}

      {matchState === 'playing' && (
        <section className="sk-live-view">
          <div className="sk-live-topbar">
            <div>
              <p className="eyebrow">{currentGame.name.toUpperCase()}</p>
              <h3>Round {currentRoundNum}</h3>
            </div>
            <button className="sk-btn-subtle" onClick={handleResetToSetup}>
              End Match
            </button>
          </div>

          {/* Live Standings Bar */}
          <div className="sk-standings-banner">
            <div className="sk-standings-title">
              <Trophy size={16} weight="fill" />
              <span>Live Standings ({isLowWins ? 'Lowest wins' : 'Highest wins'})</span>
            </div>
            <div className="sk-standings-chips">
              {sortedStandings.map((st, index) => {
                const pl = players.find(p => p.id === st.playerId);
                const isLeader = index === 0;
                return (
                  <div key={st.playerId} className={`sk-standing-chip ${isLeader ? 'leader' : ''}`}>
                    <span className="rank-badge">#{index + 1}</span>
                    <span className="avatar">{pl?.avatar}</span>
                    <span className="name">{pl?.name}</span>
                    <strong className="pts">{st.totalScore} pts</strong>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Round Score Inputs */}
          <div className="sk-round-inputs">
            <h4>Points This Round (Round {currentRoundNum})</h4>
            <div className="sk-player-cards">
              {scores.map(item => {
                const pl = players.find(p => p.id === item.playerId);
                return (
                  <div key={item.playerId} className="sk-score-card">
                    <div className="sk-card-player-info">
                      <span className="sk-player-avatar-large">{pl?.avatar}</span>
                      <div>
                        <strong>{pl?.name}</strong>
                        <small>Total: {item.totalScore} pts</small>
                      </div>
                    </div>

                    <div className="sk-card-controls">
                      <div className="sk-quick-buttons">
                        <button onClick={() => adjustRoundScore(item.playerId, -5)}>-5</button>
                        <button onClick={() => adjustRoundScore(item.playerId, -1)}>-1</button>
                        <span className="sk-round-val">{item.roundScore}</span>
                        <button onClick={() => adjustRoundScore(item.playerId, 1)}>+1</button>
                        <button onClick={() => adjustRoundScore(item.playerId, 5)}>+5</button>
                        <button onClick={() => adjustRoundScore(item.playerId, 10)}>+10</button>
                      </div>

                      <div className="sk-custom-row">
                        <button
                          className="sk-won-round-btn"
                          onClick={() => setExactRoundScore(item.playerId, currentGame.scoringType === 'first-out' ? 5 : 0)}
                        >
                          Round Winner
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match Actions */}
          <div className="sk-action-buttons">
            <button className="primary sk-round-btn" onClick={completeRound}>
              Next Round (Round {currentRoundNum + 1}) <CaretRight size={18} weight="bold" />
            </button>
            <button className="secondary sk-finish-btn" onClick={handleFinishMatch}>
              <Trophy size={18} weight="fill" /> Finish Match & Crown Winner
            </button>
          </div>

          {/* Round History accordion if rounds completed */}
          {roundHistory.length > 0 && (
            <div className="sk-history-table">
              <h4>Round by Round History</h4>
              <div className="sk-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Round</th>
                      {scores.map(s => {
                        const pl = players.find(p => p.id === s.playerId);
                        return <th key={s.playerId}>{pl?.name}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {roundHistory.map(rh => (
                      <tr key={rh.roundNumber}>
                        <td><strong>R{rh.roundNumber}</strong></td>
                        {scores.map(s => (
                          <td key={s.playerId}>{rh.scores[s.playerId] ?? 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {matchState === 'finished' && (
        <section className="sk-podium-view">
          <div className="podium-celebration">
            <Crown size={52} weight="fill" className="podium-crown" />
            <p className="eyebrow">MATCH COMPLETED</p>
            <h2>{winnerPlayer?.name} takes the victory!</h2>
            <p className="intro">
              Congratulations! Final scores have been officially recorded to <strong>{currentLeague.name}</strong>.
            </p>
          </div>

          <div className="podium-cards">
            {sortedStandings.map((st, idx) => {
              const pl = players.find(p => p.id === st.playerId);
              const rankIcon = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`;
              return (
                <div key={st.playerId} className={`podium-card ${idx === 0 ? 'winner' : ''}`}>
                  <div className="podium-rank">{rankIcon}</div>
                  <div className="podium-avatar">{pl?.avatar}</div>
                  <div className="podium-name">{pl?.name}</div>
                  <div className="podium-score"><strong>{st.totalScore}</strong> pts</div>
                </div>
              );
            })}
          </div>

          <div className="sk-notes-box">
            <label className="sk-label">Add Game Night Memory / Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Dad got hit with 10 cards in round 2!"
              value={matchNotes}
              onChange={e => setMatchNotes(e.target.value)}
            />
          </div>

          <div className="sk-podium-actions">
            <button className="primary" onClick={handleResetToSetup}>
              <ArrowCounterClockwise size={18} /> Start Another Match
            </button>
          </div>
        </section>
      )}

      {/* Add Player Dialog */}
      {showAddPlayerModal && (
        <div className="sk-modal-overlay">
          <div className="sk-modal-card">
            <h3>Add New Player</h3>
            <p>Add a friend or family member to the table.</p>
            <form onSubmit={handleAddNewPlayerSubmit}>
              <input
                type="text"
                placeholder="Player name (e.g. Grandma, Uncle Dave)"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                autoFocus
              />
              <div className="sk-modal-btns">
                <button type="button" className="secondary" onClick={() => setShowAddPlayerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Add to Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
