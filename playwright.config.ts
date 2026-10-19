import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // Specs share one fresh database and run in file order.
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Open-Meteo's stand-in; .dev.vars points the Worker's weather URLs here.
      command: "node e2e/fake-open-meteo.mjs",
      url: "http://localhost:4174/health",
      reuseExistingServer: false,
    },
    {
      // A fresh local database and the production build, so each run starts at first-run setup.
      command:
        "rm -rf .wrangler/state && npm run db:migrate:local && npm run build && npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173/api/health",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
