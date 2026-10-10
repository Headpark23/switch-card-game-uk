import React from 'react';
import {
  Cards,
  Trophy,
  UsersThree,
  ChartBar,
  Club,
  ArrowRight,
  Sparkle,
  Crown,
  Play,
  CheckCircle,
  DeviceMobile,
  Laptop,
} from '@phosphor-icons/react';
import { GoogleAd } from './GoogleAd';
import { TOP_10_GAMES, type CardGame } from '../data/cardGames';

interface HomeViewProps {
  onNavigate: (page: 'Games' | 'Score' | 'Leagues' | 'Stats' | 'Switch') => void;
  onStartScoreForGame: (gameId: string) => void;
  onOpenPremium: () => void;
  isPremium: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onStartScoreForGame,
  onOpenPremium,
  isPremium,
}) => {
  return (
    <div className="home-view-container">
      {/* Top Subtle Google Ad */}
      <GoogleAd
        format="banner"
        slotId="ca-pub-top-home"
        onOpenPremium={onOpenPremium}
        hidden={isPremium}
      />

      {/* Main Hero Section */}
      <section className="home-hero-card">
        <div className="home-hero-badge">
          <Sparkle size={14} weight="fill" />
          <span>THE ULTIMATE GAME NIGHT SUITE</span>
          <span className="device-tag">
            <DeviceMobile size={13} /> Mobile · <Laptop size={13} /> PC / Tablet
          </span>
        </div>

        <h1 className="home-hero-title">
          Know the rules.<br />
          Settle the scores.<br />
          <span className="highlight-text">Crown the champion.</span>
        </h1>

        <p className="home-hero-subtitle">
          Ditch the crumpled paper scorecards and house-rule debates. <strong>The Card Companion</strong> gives your table verified rules for <strong>10 legendary card games</strong>, a live digital scorekeeper, family leagues, and all-time trophies across every screen.
        </p>

        {/* Primary Action Row */}
        <div className="home-hero-actions">
          <button
            className="hero-btn primary-btn"
            onClick={() => onNavigate('Score')}
          >
            <Trophy size={20} weight="fill" />
            <span>Start Scoring Match</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="hero-btn secondary-btn"
            onClick={() => onNavigate('Games')}
          >
            <Cards size={20} weight="fill" />
            <span>Browse Top 10 Rules</span>
          </button>
        </div>

        {/* Quick Links Bar */}
        <div className="home-quick-strip">
          <button onClick={() => onNavigate('Leagues')}>
            <UsersThree size={16} weight="fill" /> Family Leagues
          </button>
          <span className="dot-sep">•</span>
          <button onClick={() => onNavigate('Stats')}>
            <ChartBar size={16} weight="fill" /> Trophies & Graphs
          </button>
          <span className="dot-sep">•</span>
          <button onClick={() => onNavigate('Switch')}>
            <Club size={16} weight="fill" /> Play Switch vs AI
          </button>
        </div>
      </section>

      {/* Four Core Pillars Grid */}
      <section className="home-pillars-section">
        <div className="section-heading-bar">
          <h2>Everything You Need for Tabletop Card Night</h2>
          <p>Built specifically for family nights, pub tables, and competitive friends</p>
        </div>

        <div className="pillars-grid">
          {/* Pillar 1: Top 10 Games */}
          <div className="pillar-card" onClick={() => onNavigate('Games')}>
            <div className="pillar-icon-box gold">
              <Cards size={28} weight="fill" />
            </div>
            <div className="pillar-header">
              <span className="pillar-tag">10 VERIFIED RULEBOOKS</span>
              <h3>Top 10 Card Games</h3>
            </div>
            <p>
              Clear, structured rules for Switch, Gin Rummy, Hearts, Spades, Cribbage, Pontoon, Whist, Canasta, Crazy Eights, and Cheat. No more arguing over house rules.
            </p>
            <div className="pillar-footer">
              <span className="game-count-chip">10 Free + 20 Expansion</span>
              <span className="jump-link">Open Library <ArrowRight size={14} /></span>
            </div>
          </div>

          {/* Pillar 2: Digital Scorekeeper */}
          <div className="pillar-card" onClick={() => onNavigate('Score')}>
            <div className="pillar-icon-box green">
              <Trophy size={28} weight="fill" />
            </div>
            <div className="pillar-header">
              <span className="pillar-tag">TAP-TO-SCORE</span>
              <h3>Digital Scorekeeper</h3>
            </div>
            <p>
              Leave the pen and paper behind. Quick buttons (-5, +1, +10), round-by-round point logging, real-time leader ranks, and podium finish celebrations.
            </p>
            <div className="pillar-footer">
              <span className="game-count-chip">Multiplayer Table Support</span>
              <span className="jump-link">Open Scorekeeper <ArrowRight size={14} /></span>
            </div>
          </div>

          {/* Pillar 3: Leagues & Standings */}
          <div className="pillar-card" onClick={() => onNavigate('Leagues')}>
            <div className="pillar-icon-box navy">
              <UsersThree size={28} weight="fill" />
            </div>
            <div className="pillar-header">
              <span className="pillar-tag">FAMILY & FRIENDS</span>
              <h3>Leagues & Hubs</h3>
            </div>
            <p>
              Create leagues for your Friday Family Game Night or Pub Crew. Track season wins, points tables, win percentages, and recent form guides (W/L).
            </p>
            <div className="pillar-footer">
              <span className="game-count-chip">Shareable Codes</span>
              <span className="jump-link">View Standings <ArrowRight size={14} /></span>
            </div>
          </div>

          {/* Pillar 4: Stats & Trophies */}
          <div className="pillar-card" onClick={() => onNavigate('Stats')}>
            <div className="pillar-icon-box burgundy">
              <ChartBar size={28} weight="fill" />
            </div>
            <div className="pillar-header">
              <span className="pillar-tag">BRAGGING RIGHTS</span>
              <h3>Trophies & Fun Stats</h3>
            </div>
            <p>
              Earn awards including 🏆 The Champion, 🔥 On Fire streaks, and the friendly 🥄 Wooden Spoon. Compare head-to-head showdowns with interactive graphs.
            </p>
            <div className="pillar-footer">
              <span className="game-count-chip">Visual Bar Charts</span>
              <span className="jump-link">View Stats <ArrowRight size={14} /></span>
            </div>
          </div>
        </div>
      </section>

      {/* In-Feed Subtle Google Ad */}
      <GoogleAd
        format="in-feed"
        slotId="ca-pub-infeed-home"
        onOpenPremium={onOpenPremium}
        hidden={isPremium}
      />

      {/* Featured Game of the Night Spotlight */}
      <section className="featured-game-card">
        <div className="spotlight-badge">TONIGHT'S TABLE SPOTLIGHT</div>
        <div className="spotlight-content">
          <div className="spotlight-info">
            <span className="suit-symbols">♠️ ♥️ ♦️ ♣️</span>
            <h3>Switch (British Classic)</h3>
            <p>
              The ultimate shedding game of trickery and turnarounds. Stack Black Kings to hit your opponent with +10 cards, switch suits with Aces, and accept missed turns!
            </p>
            <div className="spotlight-meta">
              <span>2–6 Players</span> · <span>52 Cards</span> · <span>Fast Paced</span>
            </div>
          </div>
          <div className="spotlight-actions">
            <button
              className="spotlight-btn primary"
              onClick={() => onStartScoreForGame('switch')}
            >
              <Trophy size={18} weight="fill" />
              Score Switch Match
            </button>
            <button
              className="spotlight-btn secondary"
              onClick={() => onNavigate('Switch')}
            >
              <Play size={18} weight="fill" />
              Play vs Computer
            </button>
          </div>
        </div>
      </section>

      {/* Popular Games Quick Row */}
      <section className="popular-games-section">
        <div className="section-heading-bar">
          <h2>Top 10 Games Quick Launch</h2>
          <button className="text-link" onClick={() => onNavigate('Games')}>
            View all 10 games with complete rules <ArrowRight size={14} />
          </button>
        </div>

        <div className="popular-games-grid">
          {TOP_10_GAMES.slice(0, 6).map((game: CardGame) => (
            <div key={game.id} className="popular-game-item">
              <div className="popular-game-top">
                <span className="category-pill">{game.category}</span>
                <span className="player-badge">{game.players}</span>
              </div>
              <h4>{game.name}</h4>
              <p>{game.tagline}</p>
              <div className="popular-game-buttons">
                <button
                  className="quick-score-btn"
                  onClick={() => onStartScoreForGame(game.id)}
                  title="Score this game"
                >
                  <Trophy size={15} weight="fill" /> Score
                </button>
                <button
                  className="quick-rule-btn"
                  onClick={() => onNavigate('Games')}
                  title="Read rules"
                >
                  Rules
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Compact Google Ad */}
      <GoogleAd
        format="compact"
        slotId="ca-pub-footer-home"
        onOpenPremium={onOpenPremium}
        hidden={isPremium}
      />

      {/* Premium Club Banner */}
      <section className="premium-perk-banner">
        <div className="premium-perk-icon">
          <Crown size={32} weight="fill" />
        </div>
        <div className="premium-perk-text">
          <strong>Unlock The Card Companion Club</strong>
          <p>Remove all advertisements, unlock 20 worldwide expansion games, and enable global leagues for your family.</p>
        </div>
        <button className="premium-cta-btn" onClick={onOpenPremium}>
          {isPremium ? 'Manage Club Pass' : 'Upgrade · £2.99 One-Off'}
        </button>
      </section>
    </div>
  );
};
