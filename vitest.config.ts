import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          include: ["src/core/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                SETUP_CODE: "test-setup-code",
                TEST_MIGRATIONS: await readD1Migrations("migrations"),
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["src/worker/**/*.test.ts"],
          setupFiles: ["src/worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
});
