# Google one-tap sign-in and cloud backup

Switch works fully without an account. When a Google client ID is configured, the History tab gains a "Cloud backup" card with Google One Tap. Signing in backs up the club to the cloud and lets it open on another phone.

## How it works

1. Google One Tap hands the page a Google credential.
2. The page posts it once to `POST /api/auth/google`. The server checks it with Google (audience, issuer, verified email, expiry) and sets a signed session cookie: `HttpOnly; Secure; SameSite=Lax`, 30 days.
3. From then on only the cookie is used. The Google token is never stored in the browser. Browser storage keeps just the display name, email and picture.
4. `GET`/`PUT /api/sync` read and write one row per Google account. Changing requests must come from the site's own origin.
5. `POST /api/auth/logout` clears the cookie.

Merging two phones is by id, so nothing is dropped. A night deleted on one phone can return from another phone that still has it.

## Files

- `src/auth.ts`, `src/AccountPanel.tsx`, `src/switch/sync.ts`: the app side. The panel is hidden while `VITE_GOOGLE_CLIENT_ID` is empty.
- `worker/sync.js`: sign-in, session and sync routes. Called from `worker/index.js`; copied into `dist/server` by `scripts/prepare-sites-build.mjs`.
- Tests: `tests/switch-sync.spec.ts`, `tests/sync-worker.test.mjs`, `tests/sites-worker.test.mjs`.

## Go-live steps (need your Google account and your approval to deploy)

1. In Google Cloud Console: APIs & Services > Credentials > Create credentials > OAuth client ID > Web application. Add Authorized JavaScript origins `https://switchcardgame.co.uk` and `http://localhost:4173`. No redirect URI is needed for One Tap. Keep the consent screen to basic scopes (name, email, picture).
2. Put the client ID in `.env` as `VITE_GOOGLE_CLIENT_ID=...` and rebuild.
3. On the host, set `GOOGLE_CLIENT_ID` (same value) and `SESSION_SECRET` (a long random string, for example `openssl rand -base64 48`). Treat the secret like a password and never commit it.
4. Bind a D1 database as `DB` and run:

```sql
CREATE TABLE IF NOT EXISTS club_sync (user_id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL);
```

5. Work through `docs/release/SWITCH-RELEASE-CHECKLIST.md`, including recording the previous production version, before deploying.

Until `GOOGLE_CLIENT_ID`, `SESSION_SECRET` and `DB` are set on the host, the auth and sync routes answer 503 and the app says cloud backup is not switched on.

## Privacy

The in-app line "everything stays on this device" stops being true for anyone who signs in. Update the in-app wording and the privacy policy before enabling the client ID in production.
