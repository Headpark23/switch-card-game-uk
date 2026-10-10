import React, { useState, useEffect } from 'react';
import { DownloadSimple, Check, X, DeviceMobile, AppleLogo } from '@phosphor-icons/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // General prompt
      alert('To install The Card Companion: Open your browser menu (⋮ or Share) and select "Install App" or "Add to Home Screen".');
    }
  };

  return (
    <>
      <div className="install-pwa-banner">
        <div className="ipb-content">
          <div className="ipb-icon">
            <DeviceMobile size={22} weight="fill" />
          </div>
          <div className="ipb-text">
            <strong>Install The Card Companion App</strong>
            <p>Add to your home screen for instant offline access at any card table.</p>
          </div>
        </div>
        <div className="ipb-actions">
          <button className="ipb-install-btn" onClick={handleInstallClick}>
            <DownloadSimple size={16} weight="bold" />
            <span>Install Free App</span>
          </button>
          <button
            className="ipb-dismiss-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div className="ios-guide-overlay" onClick={() => setShowIosGuide(false)}>
          <div className="ios-guide-modal" onClick={e => e.stopPropagation()}>
            <button className="ios-guide-close" onClick={() => setShowIosGuide(false)}>
              <X size={18} />
            </button>
            <div className="ios-guide-header">
              <AppleLogo size={32} weight="fill" />
              <h3>Install on iPhone or iPad</h3>
            </div>
            <ol className="ios-steps">
              <li>
                <span>1</span>
                <div>Tap the <strong>Share</strong> icon at the bottom of Safari (a box with an arrow pointing up).</div>
              </li>
              <li>
                <span>2</span>
                <div>Scroll down and tap <strong>Add to Home Screen</strong>.</div>
              </li>
              <li>
                <span>3</span>
                <div>Tap <strong>Add</strong> in the top right corner. The Card Companion is now installed on your device!</div>
              </li>
            </ol>
            <button className="primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setShowIosGuide(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
