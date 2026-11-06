# Google one-tap sign-in and cloud backup

Switch works fully without an account. When a Google client ID is configured, the History tab gains a "Cloud backup" card with Google One Tap. Signing in backs up the club to the cloud and lets it open on another phone.

## What is built

- `src/auth.ts`: Google Identity Services (One Tap), the saved account, and `syncNow`.
- `src/switch/sync.ts`: merges two copies of a club by id. Nothing is dropped; a night deleted on one phone can return from another.
- `src/AccountPanel.tsx`: the card in the History tab. Hidden while `VITE_GOOGLE_CLIENT_ID` is empty.
- `worker/sync.js`: the `/api/sync` endpoint. It checks the Google token (audience, issuer, verified email, expiry) and gives each account one row.
- Tests: `tests/switch-sync.spec.ts`, `tests/sync-worker.test.mjs`.

## What you need to do

1. In Google Cloud Console, open APIs & Services > Credentials > Create credentials > OAuth client ID > Web application.
2. Add Authorized JavaScript origins: `https://switchcardgame.co.uk` and `http://localhost:4173` for local testing. No redirect URI is needed for One Tap.
3. On the consent screen, keep scopes to the basics (name, email, picture).
4. Put the client ID in `.env` as `VITE_GOOGLE_CLIENT_ID=...` and rebuild.

## Server wiring (done; it needed approval for the protected runtime files)

`worker/index.js` now calls `handleSync` before serving assets, and `scripts/prepare-sites-build.mjs` copies `worker/sync.js` into `dist/server`. The host still needs:

- `GOOGLE_CLIENT_ID` set to the same client ID.
- A D1 database bound as `DB`, with:

```sql
CREATE TABLE IF NOT EXISTS club_sync (user_id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL);
```

Until `GOOGLE_CLIENT_ID` and `DB` are set on the host, `/api/sync` answers 503 and signing in works but syncing shows "The cloud copy could not be reached", and data on the phone is untouched.

## Privacy

The privacy line "everything stays on this device" changes once someone signs in. Update the in-app wording and the privacy policy before enabling the client ID in production.
