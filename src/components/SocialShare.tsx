import React, { useState } from 'react';
import {
  WhatsappLogo,
  XLogo,
  FacebookLogo,
  TelegramLogo,
  RedditLogo,
  LinkedinLogo,
  ShareNetwork,
  Copy,
  Check,
  X,
} from '@phosphor-icons/react';

export interface SocialShareProps {
  title?: string;
  text?: string;
  url?: string;
  variant?: 'inline' | 'modal' | 'banner';
  onClose?: () => void;
}

export function getShareUrl(customUrl?: string): string {
  if (customUrl) return customUrl;
  if (typeof window !== 'undefined' && window.location.href) {
    // If it's a localhost URL, prefer the public live production URL so friends can open it!
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'https://headpark23.github.io/switch-card-game-uk/';
    }
    return window.location.origin + window.location.pathname;
  }
  return 'https://headpark23.github.io/switch-card-game-uk/';
}

export function SocialShare({
  title = 'The Card Companion ♠️♥️♦️♣️',
  text = 'Check out The Card Companion: Verified rules for 10 top card games, live digital scorekeeper, family leagues, and stats!',
  url,
  variant = 'inline',
  onClose,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = getShareUrl(url);

  // Full share text ensuring the link is always present
  const fullShareText = `${text} ${shareUrl}`;

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: WhatsappLogo,
      color: '#25D366',
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`,
    },
    {
      name: 'X (Twitter)',
      icon: XLogo,
      color: '#000000',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: FacebookLogo,
      color: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`,
    },
    {
      name: 'Telegram',
      icon: TelegramLogo,
      color: '#229ED9',
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
    },
    {
      name: 'Reddit',
      icon: RedditLogo,
      color: '#FF4500',
      href: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title + ' - ' + text)}`,
    },
    {
      name: 'LinkedIn',
      icon: LinkedinLogo,
      color: '#0A66C2',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullShareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullShareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.warn('Could not copy link', e);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or unsupported
      }
    } else {
      handleCopy();
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const content = (
    <div className={`social-share-container ${variant}`}>
      <div className="social-share-header">
        <div className="social-share-titles">
          <span className="social-share-tag">
            <ShareNetwork size={16} weight="bold" /> SHARE WITH PLAYERS
          </span>
          <h4>Invite Friends & Share The Companion</h4>
          <p className="social-share-sub">
            Share the live app with your game night crew across all devices.
          </p>
        </div>
        {variant === 'modal' && onClose && (
          <button className="social-share-close-btn" onClick={onClose} aria-label="Close share">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="social-share-grid">
        {shareLinks.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="social-share-btn"
              title={`Share on ${item.name}`}
              style={{ '--brand-color': item.color } as React.CSSProperties}
            >
              <div className="social-icon-circle" style={{ backgroundColor: item.color }}>
                <Icon size={22} weight="fill" color="#ffffff" />
              </div>
              <span className="social-share-name">{item.name}</span>
            </a>
          );
        })}
      </div>

      <div className="social-share-linkbox">
        <div className="social-url-display" title={shareUrl}>
          <span className="social-url-text">{shareUrl}</span>
        </div>
        <div className="social-action-buttons">
          <button
            type="button"
            className={`social-copy-btn ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={18} weight="bold" /> Copied Link!
              </>
            ) : (
              <>
                <Copy size={18} /> Copy Link
              </>
            )}
          </button>
          {canNativeShare && (
            <button
              type="button"
              className="social-device-share-btn"
              onClick={handleNativeShare}
            >
              <ShareNetwork size={18} weight="bold" /> Device Share
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="social-share-overlay" onClick={onClose}>
        <div className="social-share-modal" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
