import React from 'react';
import { Crown, Info } from '@phosphor-icons/react';

interface GoogleAdProps {
  format?: 'banner' | 'in-feed' | 'compact';
  slotId?: string;
  onOpenPremium?: () => void;
  hidden?: boolean;
}

export const GoogleAd: React.FC<GoogleAdProps> = ({
  format = 'banner',
  slotId = 'ca-pub-7821094821',
  onOpenPremium,
  hidden = false,
}) => {
  if (hidden) return null;

  if (format === 'in-feed') {
    return (
      <div className="google-ad-container in-feed" aria-label="Sponsored advertisement">
        <div className="google-ad-header">
          <span className="ad-badge">Ad</span>
          <span className="ad-provider">Google AdSense · {slotId}</span>
          <span className="ad-choices" title="AdChoices">
            <Info size={12} /> AdChoices
          </span>
        </div>
        <div className="google-ad-body">
          <div className="ad-icon">♠️</div>
          <div className="ad-content">
            <strong>Custom Waterproof Bicycle Playing Cards</strong>
            <p>Premium casino-quality air-cushion finish. Built to survive spilled game-night drinks.</p>
            <span className="ad-url">bicyclecards.com/official</span>
          </div>
          <a
            href="https://bicyclecards.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ad-cta-btn"
          >
            Shop Deck
          </a>
        </div>
        {onOpenPremium && (
          <button className="ad-remove-prompt" onClick={onOpenPremium}>
            <Crown size={12} weight="fill" /> Enjoy ad-free game nights with Premium Pass
          </button>
        )}
      </div>
    );
  }

  if (format === 'compact') {
    return (
      <div className="google-ad-container compact" aria-label="Sponsored advertisement">
        <div className="google-ad-header">
          <span className="ad-badge">Ad</span>
          <span className="ad-provider">Google Sponsors</span>
          {onOpenPremium && (
            <button className="ad-remove-link" onClick={onOpenPremium}>
              Remove ads
            </button>
          )}
        </div>
        <div className="google-ad-text-unit">
          <strong>The Red Lion Craft Ale Delivery</strong> — Handpicked British ales & ciders for your weekend card tables.
        </div>
      </div>
    );
  }

  // Default: Responsive Banner
  return (
    <div className="google-ad-container leaderboard" aria-label="Sponsored advertisement">
      <div className="google-ad-header">
        <span className="ad-badge">Ad</span>
        <span className="ad-provider">Google AdSense</span>
        <span className="ad-choices">
          <Info size={12} /> AdChoices
        </span>
        {onOpenPremium && (
          <button className="ad-remove-link" onClick={onOpenPremium}>
            Remove ads with Premium
          </button>
        )}
      </div>
      <div className="google-ad-banner-body">
        <div className="ad-brand-tag">CARD NIGHT SPONSOR</div>
        <p className="ad-headline">
          <strong>Solid Oak Card Shufflers & Holders</strong> — Perfect hands, effortless deals for 2 to 8 players.
        </p>
        <span className="ad-sponsor-pill">Visit Sponsor</span>
      </div>
    </div>
  );
};
