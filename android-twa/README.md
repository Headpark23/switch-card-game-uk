# Switch Android app (Trusted Web Activity)

This folder wraps the live site `https://switchcardgame.co.uk` as an Android app for Google Play, using Bubblewrap 1.27.

- Package ID: `uk.co.switchcardgame.app` (permanent once published)
- minSdk 24, targetSdk 36 (Play requires 36 for new apps since 31 Aug 2026)
- Only `twa-manifest.json` and this file are committed. The generated Gradle project, APK/AAB files and the keystore are git-ignored.

## Build

Tools (JDK 17, Android SDK with platform 36 and build-tools 36.1.0, Bubblewrap) were installed under `%USERPROFILE%\.bubblewrap`, with `config.json` pointing at them.

From this folder:

```powershell
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = "<keystore password>"
$env:BUBBLEWRAP_KEY_PASSWORD      = "<key password>"
# Windows + Node 24 workarounds: gradlew.bat and jarsigner must be found on PATH.
$env:PATH = "$PWD;$env:USERPROFILE\.bubblewrap\jdk\bin;$env:PATH"
npx @bubblewrap/cli update --skipVersionUpgrade   # regenerates the Gradle project from twa-manifest.json
npx @bubblewrap/cli build --skipPwaValidation
```

Outputs: `app-release-bundle.aab` (upload this to Play) and `app-release-signed.apk` (install with `adb install` to test).

Raise `appVersionCode` in `twa-manifest.json` for every upload to Play.

## The signing key (do this yourself)

The `android.keystore` here is a throwaway **test** key. Do not upload a bundle signed with it. Create your own upload key, keep it and its passwords somewhere safe (losing it means a key-reset request to Google), and never commit it:

```powershell
& "$env:USERPROFILE\.bubblewrap\jdk\bin\keytool.exe" -genkeypair -v -keystore android.keystore -alias switch-upload -keyalg RSA -keysize 2048 -validity 10000
```

Use Play App Signing (the Play Console default). Google re-signs the app with its own key, so the key users get is not your upload key.

## Digital Asset Links (needed or the app opens as a browser tab)

Publish `https://switchcardgame.co.uk/.well-known/assetlinks.json` (served as `application/json`, no redirect) containing the SHA-256 fingerprint of the key that signs the **installed** app:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "uk.co.switchcardgame.app",
    "sha256_cert_fingerprints": ["<fingerprint from Play Console>"]
  }
}]
```

- For the Play release: Play Console > your app > Setup > App signing > "App signing key certificate" SHA-256.
- To test the APK from this folder on a phone: use the test key's SHA-256 from `keytool -list -v -keystore android.keystore`. You can list both fingerprints in the array.

Check it with `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://switchcardgame.co.uk&relation=delegate_permission/common.handle_all_urls`.

## Before upload

- Test the APK on a real Android phone with the assetlinks file live: no browser address bar, the Back button works, offline start works, keyboard and share sheet behave.
- Fill in the Play listing, Data safety and content rating from `docs/store/`.
