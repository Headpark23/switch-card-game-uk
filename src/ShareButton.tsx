import { useState } from 'react';
import { ShareNetwork } from '@phosphor-icons/react';
import type { ShareCardContent } from './switch/club';
import { renderShareCard, shareOrDownload } from './switch/shareCard';

/** One tap: draw a picture of the result and share or save it. */
export function ShareButton({ build, label, className = 'secondary' }: { build: () => ShareCardContent; label: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function run() {
    setState('busy');
    try {
      const content = build();
      const result = await shareOrDownload(await renderShareCard(content), content.filename, content.title);
      setState(result === 'shared' ? 'idle' : 'done');
    } catch {
      setState('error');
    }
  }
  return <>
    <button className={className} onClick={() => void run()} disabled={state === 'busy'}><ShareNetwork size={16} />{state === 'busy' ? 'Making picture…' : label}</button>
    {state === 'done' && <p className="share-note" role="status">Picture saved. Send it to the group chat.</p>}
    {state === 'error' && <p className="score-error" role="alert">The picture could not be made on this device.</p>}
  </>;
}
