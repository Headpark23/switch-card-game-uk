import { useState } from 'react';
import {
  Cards,
  MagnifyingGlass,
  X,
  Play,
  Trophy,
  Lock,
  Crown,
  CheckCircle,
  Lightbulb,
  Sparkle,
  ArrowRight,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react';
import { TOP_10_GAMES, PREMIUM_20_EXPANSION_GAMES, type CardGame } from '../data/cardGames';

interface GamesLibraryViewProps {
  onStartScorekeeper: (gameId: string) => void;
  onPlaySwitchAI: () => void;
  onOpenPremium: () => void;
  isPremiumUser: boolean;
}

export function GamesLibraryView({
  onStartScorekeeper,
  onPlaySwitchAI,
  onOpenPremium,
  isPremiumUser,
}: GamesLibraryViewProps) {
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedGameId, setExpandedGameId] = useState<string | null>('switch');

  const categories = ['All', 'Family', 'Tricks', 'Shedding', 'Melds', 'Pub Classic'];

  const filteredGames = TOP_10_GAMES.filter(g => {
    const matchesCat = selectedCategory === 'All' || g.category === selectedCategory;
    const matchesSearch =
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.tagline.toLowerCase().includes(search.toLowerCase()) ||
      g.overview.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedGameId(prev => (prev === id ? null : id));
  };

  return (
    <div className="games-library-container">
      {/* Header */}
      <div className="gl-header">
        <p className="eyebrow">THE DEFINITIVE CARD COMPANION</p>
        <h2>Top 10 Card Games</h2>
        <p className="intro">
          Full rules, setup steps, scoring goals, and tactics for the world’s greatest card games.
        </p>

        {/* Search */}
        <div className="gl-search-bar">
          <MagnifyingGlass size={20} />
          <input
            type="text"
            placeholder="Search games, rules, or terms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="gl-category-pills">
          {categories.map(cat => (
            <button
              key={cat}
              className={`gl-cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Top 10 Games List */}
      <div className="gl-games-list">
        {filteredGames.map(game => {
          const isExpanded = expandedGameId === game.id;
          return (
            <article key={game.id} className={`gl-game-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="gl-card-main" onClick={() => toggleExpand(game.id)}>
                <div className="gl-card-top">
                  <span className="gl-category-tag">{game.category}</span>
                  <span className="gl-meta-tag">{game.players}</span>
                </div>

                <div className="gl-title-row">
                  <div>
                    <h3>{game.name}</h3>
                    <p className="gl-tagline">{game.tagline}</p>
                  </div>
                  <button className="gl-expand-toggle" aria-label="Toggle details">
                    {isExpanded ? <CaretUp size={22} /> : <CaretDown size={22} />}
                  </button>
                </div>
              </div>

              {/* Expanded Game Details */}
              {isExpanded && (
                <div className="gl-expanded-body">
                  <p className="gl-overview">{game.overview}</p>

                  <div className="gl-details-block">
                    <h4>How to Set Up ({game.deck})</h4>
                    <ul className="gl-bullet-list">
                      {game.setup.map((s, i) => (
                        <li key={i}>
                          <CheckCircle size={16} weight="fill" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="gl-details-block">
                    <h4>Rules of Play</h4>
                    <ul className="gl-bullet-list">
                      {game.howToPlay.map((r, i) => (
                        <li key={i}>
                          <CheckCircle size={16} weight="fill" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="gl-details-block">
                    <h4>Scoring & Winning</h4>
                    <p className="gl-scoring-desc"><strong>Target:</strong> {game.targetScoreDesc}</p>
                    <ul className="gl-bullet-list">
                      {game.scoringDetails.map((sc, i) => (
                        <li key={i}>
                          <CheckCircle size={16} weight="fill" />
                          <span>{sc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {game.keyRules && game.keyRules.length > 0 && (
                    <div className="gl-key-rules-block">
                      <h4>Essential House Rules & Cards</h4>
                      <div className="gl-rules-grid">
                        {game.keyRules.map((kr, idx) => (
                          <div key={idx} className="gl-rule-tile">
                            <strong>{kr.title}</strong>
                            <p>{kr.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="gl-tip-box">
                    <Lightbulb size={20} weight="fill" />
                    <div>
                      <strong>Golden Table Tip</strong>
                      <p>{game.goldenTip}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="gl-card-actions">
                    <button
                      className="primary gl-score-btn"
                      onClick={() => onStartScorekeeper(game.id)}
                    >
                      <Trophy size={18} weight="fill" /> Score at the Table
                    </button>

                    {game.id === 'switch' && (
                      <button
                        className="secondary gl-play-btn"
                        onClick={onPlaySwitchAI}
                      >
                        <Play size={18} weight="fill" /> Practice vs Computer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Premium 20 Expansion Games Teaser */}
      <section className="gl-premium-section">
        <div className="gl-premium-card">
          <div className="gl-premium-header">
            <Crown size={32} weight="fill" className="crown-icon" />
            <div>
              <span className="premium-pill">EXPANSION PACK</span>
              <h3>Unlock 20 More Classic Games</h3>
              <p>Bridge, Euchre, Pinochle, President, Yaniv, Skat, Belote and 13 more world favourites.</p>
            </div>
          </div>

          <div className="gl-bonus-games-preview">
            {PREMIUM_20_EXPANSION_GAMES.map(bg => (
              <div key={bg.id} className="gl-bonus-game-pill" onClick={onOpenPremium}>
                <Lock size={14} weight="bold" />
                <span className="bg-name">{bg.name}</span>
                <span className="bg-cat">{bg.category}</span>
              </div>
            ))}
          </div>

          <div className="gl-premium-footer">
            <button className="primary gl-upgrade-btn" onClick={onOpenPremium}>
              <Sparkle size={18} weight="fill" />
              <span>{isPremiumUser ? 'Premium Active' : 'Explore Card Companion Premium'}</span>
              <ArrowRight size={18} />
            </button>
            <small>Includes Ad-Free Table Play & Regional Leagues</small>
          </div>
        </div>
      </section>
    </div>
  );
}
