import { useEffect, useState } from 'react';
import { BottomSheet, KeyboardTextarea } from '../mobile';
import { FEEDBACK_KINDS, diagnostics, feedbackLink, type FeedbackKind } from '../switch/privacy';

// One count per app load, however many screens mount the footer. Only a number is stored, never who or what.
let counted: Promise<number | null> | null = null;
function countThisVisit(): Promise<number | null> {
  counted ??= fetch('/api/hit', { method: 'POST' })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { hits?: unknown } | null) => (body && typeof body.hits === 'number' ? body.hits : null))
    .catch(() => null);
  return counted;
}

export function FeedbackSheet({ kind, onClose, page }: { kind: FeedbackKind | null; onClose: () => void; page: string }) {
  const [message, setMessage] = useState('');
  const [withDetails, setWithDetails] = useState(false);
  const active = kind ?? 'feedback';
  const copy = FEEDBACK_KINDS[active];
  return <BottomSheet open={kind !== null} onOpenChange={(open) => { if (!open) onClose(); }} title={copy.label} description="Goes straight to the person who made Switch.">
    <div className="feedback-sheet">
      <label htmlFor="feedback-message">{copy.prompt}</label>
      <KeyboardTextarea id="feedback-message" aria-label="Your message" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type here" />
      <label className="feedback-check"><input type="checkbox" checked={withDetails} onChange={(event) => setWithDetails(event.target.checked)} /> Add screen and browser details to help me fix it</label>
      {message.trim()
        ? <a className="primary" href={feedbackLink(active, message, withDetails ? diagnostics(page) : '')} onClick={() => setTimeout(onClose, 400)}>Open my email app to send</a>
        : <button className="primary" disabled>Open my email app to send</button>}
      <small>Nothing is sent from Switch itself. This opens an email to martinwhite228@gmail.com for you to read and send. Your name and scores are never added.</small>
    </div>
  </BottomSheet>;
}

// A double tap on a button above can land on these once the page shifts, so only a first tap (or the keyboard) opens a sheet.
export default function AppFooter({ page, onPrivacy }: { page: string; onPrivacy: () => void }) {
  const [hits, setHits] = useState<number | null>(null);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  useEffect(() => { let live = true; void countThisVisit().then((value) => { if (live) setHits(value); }); return () => { live = false; }; }, []);
  return <footer className="app-footer">
    <div className="footer-actions" role="group" aria-label="Get in touch">
      {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((key) => <button key={key} onClick={(event) => { if (event.detail < 2) setKind(key); }}>{FEEDBACK_KINDS[key].label}</button>)}
    </div>
    <p className="footer-line">
      {hits !== null && <span className="hit-counter" aria-label={`${hits.toLocaleString('en-GB')} visits so far`}>{hits.toLocaleString('en-GB')} visits · </span>}
      <button className="footer-link" onClick={onPrivacy}>Privacy &amp; your data</button>
    </p>
    <p className="footer-copy">© M. White 2026</p>
    {kind !== null && <FeedbackSheet kind={kind} onClose={() => setKind(null)} page={page} />}
  </footer>;
}
