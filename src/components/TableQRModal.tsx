import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, DeviceMobile } from '@phosphor-icons/react';

interface TableQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName?: string;
  leagueName?: string;
}

export function TableQRModal({ isOpen, onClose, gameName, leagueName }: TableQRModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined'
    ? (window.location.origin.includes('localhost')
        ? 'https://headpark23.github.io/switch-card-game-uk/'
        : window.location.href)
    : 'https://headpark23.github.io/switch-card-game-uk/';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="table-qr-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="table-qr-dialog" onClick={e => e.stopPropagation()}>
        <button className="table-qr-close" onClick={onClose} aria-label="Close QR Modal">
          <X size={20} />
        </button>

        <div className="table-qr-header">
          <div className="table-qr-icon-pill">
            <QrCode size={24} weight="bold" />
          </div>
          <h3>Join Table & View Rules</h3>
          <p>
            {gameName ? `Playing ${gameName}` : 'The Card Companion'}
            {leagueName ? ` • ${leagueName}` : ''}
          </p>
        </div>

        <div className="table-qr-code-wrapper">
          <div className="table-qr-frame">
            <QRCodeSVG
              value={currentUrl}
              size={190}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#053527"
            />
          </div>
          <div className="table-qr-instructions">
            <DeviceMobile size={18} weight="fill" />
            <span>Point your phone camera at this code to open on your device</span>
          </div>
        </div>

        <div className="table-qr-url-box">
          <span className="table-qr-url">{currentUrl}</span>
          <button className="table-qr-copy-btn" onClick={handleCopy}>
            {copied ? (
              <>
                <Check size={16} weight="bold" color="#25D366" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} weight="bold" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <button className="secondary table-qr-done-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
