import { defineConfig } from "@playwright/test";

// Offline behaviour needs the production build, because the service worker is disabled in dev.
export default defineConfig({
  testDir: "./tests/offline",
  testMatch: "**/*.spec.ts",
  timeout: 40_000,
  use: { baseURL: "http://127.0.0.1:4181", viewport: { width: 1100, height: 1100 } },
  webServer: {
    command: "npm run build && npx vite preview --port 4181 --strictPort",
    url: "http://127.0.0.1:4181/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
