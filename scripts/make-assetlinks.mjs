// Writes public/.well-known/assetlinks.json so a tapped Switch link (a table, a night or a club) opens the installed
// Android app instead of a browser tab. Without this file the app cannot be verified for the site's links.
//
// Usage: node scripts/make-assetlinks.mjs <SHA-256 fingerprint> [more fingerprints...]
//   Play release: Play Console > your app > Setup > App signing > "App signing key certificate" SHA-256.
//   Also add the upload key's fingerprint (and the Play "Upload key certificate") if you sideload test builds.
import { mkdirSync, writeFileSync } from "node:fs";

const fingerprints = process.argv.slice(2).map((value) => value.trim().toUpperCase());
const valid = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
if (!fingerprints.length || fingerprints.some((value) => !valid.test(value))) {
  console.error("Give one or more SHA-256 fingerprints like 14:6D:E9:...:A3 (32 pairs of hex digits, colon separated).");
  process.exit(1);
}
mkdirSync("public/.well-known", { recursive: true });
const links = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "uk.co.switchcardgame.app", sha256_cert_fingerprints: fingerprints } }];
writeFileSync("public/.well-known/assetlinks.json", `${JSON.stringify(links, null, 2)}\n`);
console.log(`Wrote public/.well-known/assetlinks.json with ${fingerprints.length} fingerprint(s). Deploy, then check:\nhttps://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://switchcardgame.co.uk&relation=delegate_permission/common.handle_all_urls`);
