import { useEffect, useState } from 'react';
import { DeviceRotate, X } from '@phosphor-icons/react';

/**
 * Cards per row in portrait phone view:
 * - 1 to 5 cards: single row
 * - 6 to 12 cards: 2 balanced rows (3 to 6 per row)
 * - 13+ cards: capped at 6 per row so cards never shrink tiny or overlap (20+ cards wrap neatly into 4 readable rows)
 */
export function handPerRow(count: number): number {
  if (count <= 5) return Math.max(1, count);
  return Math.min(6, Math.ceil(count / 2));
}

export const BIG_HAND_THRESHOLD = 14;

/**
 * Quiet, dismissible nudge shown on portrait phones when a player holds a big hand (14+ cards),
 * inviting them to turn their phone sideways for a wider table view. Automatically hides on rotate.
 */
export function BigHandHint({ count }: { count: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [portraitPhone, setPortraitPhone] = useState(false);

  useEffect(() => {
    if (count < BIG_HAND_THRESHOLD) setDismissed(false);
  }, [count]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 639px) and (orientation: portrait)');
    const sync = () => setPortraitPhone(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  if (count < BIG_HAND_THRESHOLD || dismissed || !portraitPhone) return null;

  return (
    <div className="rotate-hand-hint" role="status" data-testid="rotate-hand-hint">
      <DeviceRotate size={18} weight="bold" aria-hidden="true" />
      <span>
        <strong>Big hand ({count} cards)</strong> — turn your phone sideways for a wider view.
      </span>
      <button type="button" aria-label="Dismiss rotate hint" onClick={() => setDismissed(true)}>
        <X size={15} weight="bold" />
      </button>
    </div>
  );
}
