import { fullDeck } from './ui';

/**
 * Registers the offline service worker (production builds only) and asks it to
 * keep every file the app needs, including the lazily loaded screens and all card art.
 */
export function enableOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      // Load the on-demand screens so their files are part of what we save.
      await Promise.all([import('./screens/GuidedGame'), import('./screens/Scorekeeper')]);
      const seen = performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname);
      const cards = [...fullDeck, 'back'].map((card) => `/images/cards/${card}.webp`);
      const urls = [...new Set(['/', '/index.html', ...seen, ...cards])];
      (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'precache', urls });
    } catch {
      // Offline support is an extra; the app works normally without it.
    }
  };

  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}
