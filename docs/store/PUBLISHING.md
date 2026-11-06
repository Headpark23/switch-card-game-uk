# Publishing checklist

## Today: installable web app (no store needed)
- The site serves `manifest.webmanifest`, icons and a service worker, so Chrome on Android and Safari on iPhone can add it to the home screen. The "Add Switch to your phone" button guides people.
- Needs a deployed HTTPS URL. Deploying needs explicit approval (see `docs/release/SWITCH-RELEASE-CHECKLIST.md`).

## Before any store submission
- [ ] Add a real support email to `public/privacy.html` and the listing.
- [ ] Choose a domain and set it as the manifest `start_url` origin if different.
- [ ] Re-record screenshots with `node scripts/store-screenshots.mjs <deployed-url>` and review each one.
- [ ] Decide on Google sign-in (see `docs/google-sign-in.md`); if enabled, list it in the privacy answers.
- [ ] Run the full test suite and `npm run test:offline` against the production build.

## Google Play (fastest route)
Wrap the deployed PWA as a Trusted Web Activity with Bubblewrap (`npx @bubblewrap/cli init --manifest https://<domain>/manifest.webmanifest`). Needs a Play developer account, a signing key, and a Digital Asset Links file on the domain.

## Apple App Store
Wrap with Capacitor (`npm i @capacitor/core @capacitor/cli @capacitor/ios`, `npx cap init`, `npx cap add ios`, `npm run build`, `npx cap copy`). Apple expects more than a thin website: the offline play, coach, puzzles and scorekeeper support the "minimum functionality" guideline, but state that in review notes. Needs an Apple developer account and a Mac with Xcode.

## Data safety answers
Everything stays on device. Optional Google sign-in shares name and email for backup only. No ads, no analytics, no purchases.
