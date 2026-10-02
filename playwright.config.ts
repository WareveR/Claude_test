import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A fresh local database and the production build, so each run starts at first-run setup.
    command:
      "rm -rf .wrangler/state && npm run db:migrate:local && npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/api/health",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
