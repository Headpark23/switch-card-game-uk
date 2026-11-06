# Optional Google One Tap setup

Switch remains fully usable without an account. Google sign-in is an optional foundation for future family sharing and history sync; it does not replace local score storage.

## Required configuration

1. Create a Web OAuth client in Google Cloud and register every authorised production and preview origin.
2. Set `VITE_GOOGLE_CLIENT_ID` to that public web client ID.
3. Implement the HTTPS endpoints named by `VITE_GOOGLE_AUTH_ENDPOINT` and `VITE_GOOGLE_LOGOUT_ENDPOINT`.
4. At that endpoint, verify the received `credential` ID token with a Google-supported server library, including signature, issuer, expiry and audience checks.
5. Create the app session using the token's stable `sub` value. Do not use the email address as the account key.
6. Return `{ "user": { "id", "name", "email", "picture" } }` and set a secure, HTTP-only session cookie. The logout endpoint must clear that cookie.

The browser integration never stores the Google ID token. The sign-in prompt is not mounted unless both environment values are present. Production must not enable the client ID until the verification endpoint and logout/session-expiry path have been tested.
