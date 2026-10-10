import {
  Crown,
  CheckCircle,
  X,
  Sparkle,
  Globe,
  Cards,
  Devices,
  Eye
} from '@phosphor-icons/react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPremium: boolean;
  onTogglePremium: () => void;
}

export function PremiumModal({
  isOpen,
  onClose,
  isPremium,
  onTogglePremium,
}: PremiumModalProps) {
  if (!isOpen) return null;

  return (
    <div className="sk-modal-overlay" onClick={onClose}>
      <div className="premium-modal-card" onClick={e => e.stopPropagation()}>
        <button className="premium-close-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="premium-modal-hero">
          <Crown size={48} weight="fill" className="crown-hero" />
          <span className="premium-tag">PREMIUM PASS</span>
          <h2>Upgrade Your Game Nights</h2>
          <p className="intro">
            Unlock the full 30-game rules library, remove all ads, and join global and regional leagues.
          </p>
        </div>

        <div className="premium-perks-list">
          <div className="perk-item">
            <div className="perk-icon"><CheckCircle size={20} weight="fill" /></div>
            <div>
              <strong>100% Ad-Free Experience</strong>
              <p>Zero distractions while keeping score at the table or learning rules.</p>
            </div>
          </div>

          <div className="perk-item">
            <div className="perk-icon"><Cards size={20} weight="fill" /></div>
            <div>
              <strong>20+ Bonus Worldwide Card Games</strong>
              <p>Bridge, Euchre, Pinochle, President, Yaniv, Skat, Belote and more.</p>
            </div>
          </div>

          <div className="perk-item">
            <div className="perk-icon"><Globe size={20} weight="fill" /></div>
            <div>
              <strong>Global & Regional Leagues</strong>
              <p>Link your family club to regional leaderboards and see how your scores rank.</p>
            </div>
          </div>

          <div className="perk-item">
            <div className="perk-icon"><Devices size={20} weight="fill" /></div>
            <div>
              <strong>Multi-Device Family Sync</strong>
              <p>Share your league code with family so anyone can log points from their phone.</p>
            </div>
          </div>

          <div className="perk-item">
            <div className="perk-icon"><Eye size={20} weight="fill" /></div>
            <div>
              <strong>High-Contrast & Large-Card Mode</strong>
              <p>Easy-on-the-eyes card suits and poker felt table themes for late nights.</p>
            </div>
          </div>
        </div>

        <div className="premium-pricing-box">
          <div className="price-tag">
            <strong>£2.99</strong>
            <span>One-off lifetime pass</span>
          </div>
          <small>or £0.99 / year support pass</small>
        </div>

        <div className="premium-modal-actions">
          <button className="primary upgrade-action-btn" onClick={() => { onTogglePremium(); onClose(); }}>
            <Sparkle size={19} weight="fill" />
            <span>{isPremium ? 'Switch Back to Free Tier' : 'Activate Premium Pass'}</span>
          </button>
          <button className="sk-btn-text" onClick={onClose}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
