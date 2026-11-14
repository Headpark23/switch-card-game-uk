# Google Play: Data safety and privacy answers

Prepared 14 Nov 2026 from the code (`src/switch/telemetry.ts`, `src/auth.ts`, `api/*.js`, `worker/sync.js`), not from memory. Re-check this file whenever a feature that sends data changes. Play Console wording changes from time to time, so treat the section names below as a guide and confirm in the form.

## URLs to enter in Play Console

| Field | Value |
|---|---|
| Privacy policy | `https://switchcardgame.co.uk/privacy.html` |
| Delete account / data URL (needed because Google sign-in creates an account) | `https://switchcardgame.co.uk/delete-data.html` |
| Developer contact email | `martinwhite228@gmail.com` (the address used in the app and privacy policy; change all three together if you prefer another) |

Both pages must be live on the production domain before submitting.

## What the app really does with data

| Feature | Leaves the phone? | Sent | Stored where | Optional? |
|---|---|---|---|---|
| Play, learn, score, stats, badges | No | n/a | Device storage only | n/a |
| Anonymous usage counts (`/api/stat`) | Yes | Whitelisted events: app open (new/returning, platform ios/android/etc., installed), screen views, games and nights finished (counts only), feature names | Daily counter totals in private Vercel Blob. No ID, IP, name or score. | Yes: opt-out in Me > Privacy; honours Do Not Track and Global Privacy Control |
| Visit counter (`/api/hit`) | Yes | Nothing (a POST that adds 1) | One number | No, but carries no data |
| Shared night (`/api/night`) | Yes | Title, player first names, scores, host name, full result (format, winner, venue name and country) | Private Blob under a 6-letter code, host token hash | Yes |
| Join a night | Yes | The chosen player name | Same file | Yes |
| Shared club (`/api/club`) | Yes | Club name, player names and colours, saved nights and scores, seasons | Private Blob under an 8-character code. Anyone with the code can read and add. | Yes |
| Google sign-in and backup (`/api/auth/google`, `/api/sync`) | Yes | Google ID token (verified once). Name, email, picture go in a signed HttpOnly session cookie. The backup is the club document. | Backup stored against the Google account ID | Yes |
| Feedback | Only via the user's own email app | What the user writes | Not on our server | Yes |

No ads, no advertising ID, no purchases, no location permission, no contacts, no camera or microphone, no health or financial data.

## Data safety form answers

**Does your app collect or share any of the required user data types?** Yes.

**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only).

**Do you provide a way for users to request that their data be deleted?** Yes (in-app for the Google backup; by email, with the web page above, for shared nights and clubs).

"Shared" in the Play form means transferred to a third party. Vercel (hosting) and Google (sign-in) process data on our behalf as service providers, so the form can treat this as **collected, not shared**. Nothing is sold or given to advertisers.

| Play data type | Collected | Shared | Optional | Purpose | Why |
|---|---|---|---|---|---|
| Personal info > Name | Yes | No | Yes | App functionality, Account management | Player names in shared nights and clubs; Google account name |
| Personal info > Email address | Yes | No | Yes | Account management | Google sign-in only |
| Personal info > User IDs | Yes | No | Yes | Account management, App functionality | Google account ID keys the backup |
| App activity > Other user-generated content | Yes | No | Yes | App functionality | Scores, nights, seasons and venue text in shared nights, clubs and backups |
| App activity > App interactions | Yes | No | Yes (opt-out) | Analytics | Anonymous counts of screens, games, nights and features used |

Decisions to confirm when filling in the form:
- **Profile picture.** It only passes through the session cookie and is not stored in a database. If Play's guidance in the form says a profile photo counts as collected, tick Photos and videos with purpose "Account management". Declaring slightly more is safer than less.
- **Platform and "installed" flags.** They are coarse counters, not device identifiers, so they are declared under App interactions, not Device or other IDs.
- **Venue text and country.** Typed by the user, not detected, so this is not Location data.
- **Country guess.** The country picker defaults from the phone's language setting on the device only; it is not sent unless the user saves it in a shared night or club.

## Other Play Console declarations

- **App access:** all functionality is available without logging in. No test account needed.
- **Ads:** No. (`AdSlot` in `src/ui.tsx` is a demo placeholder that is not rendered anywhere; keep it that way in the Android build.)
- **Advertising ID:** not used. Declare "No".
- **Target audience:** choose 13+ (or adults), not children. Targeting children brings in the Families policy, which does not fit Google sign-in and club sharing. The privacy policy still says children should not sign in without a parent.
- **Content rating (IARC):** no gambling or simulated gambling, no violence, no user-to-user chat. Shared names and scores are the only user-generated content.
- **Account deletion:** in-app "Delete my cloud copy" plus the web URL above.

## Known gaps to close in code (not done here)

These make the privacy policy wording honest today, but a fix would let us promise more:
1. **Shared nights are not physically deleted after two weeks.** `api/_night.js` stops serving a night after 14 days but never removes the file from Blob. The policy therefore says the night "can no longer be opened" and that we delete on request. A small scheduled cleanup would let us say it is deleted.
2. **Shared clubs never expire and cannot be deleted by their members.** `api/club.js` has no delete or expiry. Today deletion is by email. An in-app "Delete this shared club" for whoever created it, or an inactivity expiry, would remove most manual requests.
3. **No way for a user to report or remove another person's name from a shared club.** Play's user-generated-content policy may ask for this; the email address in the policy is the current route.
