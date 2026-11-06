# Switch hardening verification — 6 November 2026

## Result

The hardening branch is suitable for review. Production has not been changed or deployed.

## Automated checks

- Mobile runtime integrity: passed for all 28 protected runtime files.
- TypeScript and production build: passed.
- Static hosting package: passed all 4 worker tests.
- Browser suite: 43 tests passed with no failures.
- Covered areas include the guided game, power-card rules, deterministic computer play, deck recycling, saved-score migration, flexible scoring, leagues, knockout, Switch Cup, and the visible scorekeeper.

## Hands-on checks

- Confirmed the page title is `Switch — A better game night`.
- Confirmed the rules home screen and the exact “When the deck runs out” wording.
- Opened Modes and the Switch scorekeeper.
- Confirmed the scorekeeper renders without horizontal overflow in both iPhone and Pixel 10 frames.
- Confirmed the Google panel truthfully reports that credentials are still required when it is not configured.
- Confirmed fixed navigation and device chrome remain intact.

## Data safety

- The existing `switchScoreKeeper` browser-storage key is preserved.
- Valid older data is migrated additively and unknown fields are retained.
- Malformed stored data is left untouched and the app displays a recovery warning.
- Google ID tokens are not stored in browser storage. They must be exchanged with a server that verifies them and creates a secure session.

## Known configuration item

Google One Tap is implemented but deliberately inactive until a real Google OAuth client ID and secure server verification/logout endpoints are supplied. This prevents a misleading or insecure sign-in experience.
