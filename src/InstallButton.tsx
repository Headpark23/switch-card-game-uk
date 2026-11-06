import { useEffect, useState } from 'react';
import { DeviceMobile, ShareNetwork, DotsThreeVertical } from '@phosphor-icons/react';
import { BottomSheet } from './mobile';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Add to your phone": uses the browser's own install prompt where it exists, otherwise shows the steps. */
export default function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) { setHelp(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === 'accepted') setInstalled(true);
  }

  return <>
    <button className="install-phone" onClick={install}><DeviceMobile size={22} weight="fill" /><span>Add Switch to your phone<small>Works offline, opens like an app</small></span></button>
    <BottomSheet open={help} onOpenChange={setHelp} title="Add Switch to your phone" description="It takes a few seconds and needs no app store.">
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
    </BottomSheet>
  </>;
}
