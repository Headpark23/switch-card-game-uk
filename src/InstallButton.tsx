import { useEffect, useState, useSyncExternalStore } from 'react';
import { DeviceMobile, DotsThreeVertical, ShareNetwork, X } from '@phosphor-icons/react';
import { BottomSheet } from './mobile';
import { trackFeature } from './switch/telemetry';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/* One shared install state. The browser fires its install event early, so capture it at load, not on mount. */
let deferred: InstallPrompt | null = null;
let installed = isStandalone();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferred = event as InstallPrompt; emit(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

const DISMISS_KEY = 'switchInstallDismissed';
const dismissedRecently = () => { try { return Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) || 0) < 7 * 86400000; } catch { return false; } };

function useInstall() {
  useSyncExternalStore(subscribe, () => `${installed}-${!!deferred}`);
  const [help, setHelp] = useState(false);
  async function install() {
    trackFeature('install_prompt');
    if (!deferred) { setHelp(true); return; }
    const prompt = deferred;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferred = null;
    if (choice.outcome === 'accepted') installed = true;
    emit();
  }
  const sheet = <BottomSheet open={help} onOpenChange={setHelp} title="Add Switch to your phone" description="It takes a few seconds and needs no app store.">
    <ol className="install-steps">
      {isIos()
        ? <>
          <li>Tap the <ShareNetwork size={18} weight="bold" /> <b>Share</b> button in Safari.</li>
          <li>Scroll down and choose <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. Switch now opens like any other app.</li>
        </>
        : <>
          <li>Open your browser menu <DotsThreeVertical size={18} weight="bold" />.</li>
          <li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
          <li>Confirm. Switch now opens like any other app.</li>
        </>}
    </ol>
    <button className="primary" onClick={() => setHelp(false)}>Got it</button>
  </BottomSheet>;
  return { installed, install, sheet };
}

/** Inline "Add to your phone" button: the browser's own install prompt where it exists, otherwise the steps. */
export default function InstallButton() {
  const { installed: done, install, sheet } = useInstall();
  if (done) return null;
  return <>
    <button className="install-phone" onClick={install}><DeviceMobile size={22} weight="fill" /><span>Add Switch to your phone<small>Works offline, opens like an app</small></span></button>
    {sheet}
  </>;
}

/** One-tap banner above the tab bar on every main screen until installed or dismissed (remembered for a week). */
export function InstallBanner({ bottom }: { bottom: number }) {
  const { installed: done, install, sheet } = useInstall();
  const [hidden, setHidden] = useState(dismissedRecently);
  useEffect(() => { if (done) setHidden(true); }, [done]);
  if (done || hidden) return null;
  return <>
    <div className="install-banner" role="region" aria-label="Install Switch" style={{ bottom }}>
      <DeviceMobile size={26} weight="fill" />
      <span><b>Get Switch on your phone</b><small>Free, works offline, no app store</small></span>
      <button className="install-go" aria-label="Add Switch to your phone" onClick={install}>Install</button>
      <button className="install-x" aria-label="Dismiss install banner" onClick={() => { try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ } setHidden(true); }}><X size={16} weight="bold" /></button>
    </div>
    {sheet}
  </>;
}
