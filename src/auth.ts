import { hasClubData, isSyncDocument, mergeDocuments, sameClub, type SyncDocument } from './switch/sync';
import { loadScorekeeper, saveScorekeeper, SCOREKEEPER_STORAGE_KEY } from './switch/storage';

/**
 * Google sign-in and cloud sync. Switch stays fully usable without it: with no client ID
 * configured, none of this appears. The Google ID token only proves who you are to
 * our own /api/sync endpoint, which checks it with Google before saving anything.
 */
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
export const SIGN_IN_AVAILABLE = GOOGLE_CLIENT_ID.length > 0;

const ACCOUNT_KEY = 'switchAccount';
const SYNC_URL = '/api/sync';

export interface Account {
  readonly token: string;
  readonly name: string;
  readonly email: string;
  readonly picture: string;
  /** Seconds since 1970 when the token expires. */
  readonly exp: number;
  readonly lastSyncedAt?: string;
}

function decodeBase64Url(part: string) {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return decodeURIComponent(escape(atob(padded)));
}

/** Reads the display details from a Google ID token. The server does the real verification. */
export function accountFromToken(token: string): Account | null {
  try {
    const claims = JSON.parse(decodeBase64Url(token.split('.')[1])) as Record<string, unknown>;
    if (typeof claims.exp !== 'number' || typeof claims.email !== 'string') return null;
    return {
      token,
      exp: claims.exp,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : claims.email,
      picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : '',
    };
  } catch {
    return null;
  }
}

export function loadAccount(): Account | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function saveAccount(account: Account | null) {
  try {
    if (account) window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Storage can be blocked; sign-in then lasts for this visit only.
  }
}

export const tokenExpired = (account: Account) => account.exp * 1000 < Date.now() + 30_000;

type Gsi = {
  accounts: { id: {
    initialize: (config: Record<string, unknown>) => void;
    prompt: () => void;
    renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    disableAutoSelect: () => void;
  } };
};

let loading: Promise<Gsi> | null = null;
export function loadGoogle(): Promise<Gsi> {
  const existing = (window as unknown as { google?: Gsi }).google;
  if (existing?.accounts?.id) return Promise.resolve(existing);
  loading ??= new Promise<Gsi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: Gsi }).google);
    script.onerror = () => { loading = null; reject(new Error('Google sign-in could not load. Check your connection.')); };
    document.head.appendChild(script);
  });
  return loading;
}

/** Starts Google One Tap. `onCredential` receives the signed-in account. */
export async function startOneTap(onCredential: (account: Account) => void, options: { prompt: boolean; button?: HTMLElement | null }) {
  const google = await loadGoogle();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    auto_select: true,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
    callback: (response: { credential?: string }) => {
      const account = response.credential ? accountFromToken(response.credential) : null;
      if (account) onCredential(account);
    },
  });
  if (options.button) google.accounts.id.renderButton(options.button, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
  if (options.prompt) google.accounts.id.prompt();
}

export async function signOut() {
  saveAccount(null);
  try { (await loadGoogle()).accounts.id.disableAutoSelect(); } catch { /* offline: nothing to forget */ }
}

export type SyncOutcome = 'uploaded' | 'downloaded' | 'merged' | 'up-to-date';

/**
 * Brings this phone and the cloud copy together. Returns what happened. When the local
 * data changed, the caller should reload so the screens read the new data.
 */
export async function syncNow(account: Account, fetcher: typeof fetch = fetch): Promise<SyncOutcome> {
  if (tokenExpired(account)) throw new Error('Your Google sign-in has expired. Sign in again.');
  const headers = { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' };

  const rawLocal = window.localStorage.getItem(SCOREKEEPER_STORAGE_KEY);
  const local = loadScorekeeper(rawLocal);
  if (local.status === 'unreadable') throw new Error('The data on this phone is unreadable, so syncing was stopped to protect it.');
  const localDoc = JSON.parse(saveScorekeeper(rawLocal, local.state)) as SyncDocument;

  const get = await fetcher(SYNC_URL, { headers });
  if (get.status === 401) throw new Error('Google did not accept this sign-in. Sign in again.');
  if (!get.ok) throw new Error('The cloud copy could not be reached. Your data on this phone is safe.');
  const { document: remote } = (await get.json()) as { document: unknown };

  const put = async (doc: SyncDocument) => {
    const response = await fetcher(SYNC_URL, { method: 'PUT', headers, body: JSON.stringify({ document: doc }) });
    if (!response.ok) throw new Error('The cloud copy could not be saved. Your data on this phone is safe.');
  };

  if (!isSyncDocument(remote)) { await put(localDoc); return 'uploaded'; }
  if (sameClub(localDoc, remote)) return 'up-to-date';

  const merged = mergeDocuments(localDoc, remote);
  await put(merged);
  if (!sameClub(merged, localDoc)) {
    window.localStorage.setItem(SCOREKEEPER_STORAGE_KEY, JSON.stringify(merged));
    return hasClubData(localDoc) ? 'merged' : 'downloaded';
  }
  return 'uploaded';
}
