/** Everything Switch keeps lives in this browser's storage under keys that start with "switch". */
const isSwitchKey = (key: string | null): key is string => Boolean(key && key.startsWith('switch'));
/** The sign-in details are a login, not club data, so they are left out of exports. */
const SIGN_IN_KEY = 'switchAccount';

export function switchKeys(storage: Storage = window.localStorage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (isSwitchKey(key)) keys.push(key);
  }
  return keys.sort();
}

/** A readable copy of everything stored on this device (GDPR: right of access and portability). */
export function exportDeviceData(storage: Storage = window.localStorage, now: Date = new Date()): string {
  const data: Record<string, unknown> = {};
  for (const key of switchKeys(storage)) {
    if (key === SIGN_IN_KEY) continue;
    const raw = storage.getItem(key) ?? '';
    try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
  }
  return JSON.stringify({ app: 'Switch', exportedAt: now.toISOString(), note: 'Everything Switch stores on this device.', data }, null, 2);
}

/** Deletes everything Switch stored on this device (GDPR: right to erasure). Returns how many items were removed. */
export function eraseDeviceData(storage: Storage = window.localStorage): number {
  const keys = switchKeys(storage);
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

/** What the feedback form may add if the person ticks the box. Never names, scores or the account. */
export function diagnostics(page: string, win: Window = window): string {
  return [`App: Switch (switchcardgame.co.uk)`, `Screen: ${page}`, `Viewport: ${win.innerWidth}x${win.innerHeight}`, `Browser: ${win.navigator.userAgent}`].join('\n');
}

export const CONTACT_EMAIL = 'martinwhite228@gmail.com';

export type FeedbackKind = 'feedback' | 'bug' | 'idea';
export const FEEDBACK_KINDS: Record<FeedbackKind, { label: string; subject: string; prompt: string }> = {
  feedback: { label: 'Feedback', subject: 'Switch feedback', prompt: 'What do you think of Switch?' },
  bug: { label: 'Report a bug', subject: 'Switch bug report', prompt: 'What went wrong, and what were you doing when it happened?' },
  idea: { label: 'Suggest an idea', subject: 'Switch suggestion', prompt: 'What would make Switch better for your card night?' },
};

export function feedbackLink(kind: FeedbackKind, message: string, extra = ''): string {
  const body = [message.trim(), extra && `\n---\n${extra}`].filter(Boolean).join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(FEEDBACK_KINDS[kind].subject)}&body=${encodeURIComponent(body.slice(0, 1500))}`;
}
