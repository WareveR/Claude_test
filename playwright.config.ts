import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:migrate:local && npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: !process.env.CI,
  },
});
